import * as Crypto from "expo-crypto";
import { ec, hash } from "starknet";

import { createOwnerAccount } from "../starknet/account";
import { callContract } from "../starknet/rpc";
import { u256FromBigInt } from "../starknet/u256";
import { secureDelete, secureGet, secureSet } from "../storage/secure-store";
import type { WalletSnapshot } from "../wallet/wallet";
import { MAX_ALLOWED_TARGETS, ZERO_ADDRESS, padTargets } from "./target-presets";

const SESSION_KEYS_INDEX_ID = "starkclaw.session_keys.v1";

/** Default max calls for session keys. */
export const DEFAULT_MAX_CALLS = 100;

/** Common entrypoint names allowed for session keys. */
export const COMMON_ENTRYPOINTS = ["transfer", "transferFrom", "swap", "execute"] as const;

function sessionPkStorageKey(sessionPublicKey: string): string {
  return `starkclaw.session_pk.${sessionPublicKey}`;
}

function normalizePrivateKey(bytes: Uint8Array): string {
  const scalar = ec.starkCurve.utils.normPrivateKeyToScalar(bytes);
  return `0x${scalar.toString(16).padStart(64, "0")}`;
}

export type StoredSessionKey = {
  key: string; // session public key (felt)
  tokenSymbol: string;
  tokenAddress: string;
  spendingLimit: string; // decimal string in token base units
  validAfter: number; // unix seconds
  validUntil: number; // unix seconds
  /** Up to 4 allowed contract addresses. Empty array = wildcard (any contract). */
  allowedContracts: string[];
  createdAt: number; // unix seconds
  registeredAt?: number; // unix seconds
  revokedAt?: number; // unix seconds
  lastTxHash?: string;
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function loadIndex(): Promise<StoredSessionKey[]> {
  const raw = await secureGet(SESSION_KEYS_INDEX_ID);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredSessionKey[];
  } catch {
    return [];
  }
}

async function saveIndex(list: StoredSessionKey[]): Promise<void> {
  await secureSet(SESSION_KEYS_INDEX_ID, JSON.stringify(list));
}

export async function listSessionKeys(): Promise<StoredSessionKey[]> {
  const list = await loadIndex();
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSessionPrivateKey(sessionPublicKey: string): Promise<string | null> {
  return secureGet(sessionPkStorageKey(sessionPublicKey));
}

export async function createLocalSessionKey(params: {
  tokenSymbol: string;
  tokenAddress: string;
  spendingLimit: bigint;
  validForSeconds: number;
  allowedContracts: string[];
}): Promise<StoredSessionKey> {
  const createdAt = nowSec();
  const bytes = await Crypto.getRandomBytesAsync(32);
  const pk = normalizePrivateKey(bytes);
  const pub = ec.starkCurve.getStarkKey(pk);

  const validAfter = createdAt - 5;
  const validUntil = createdAt + Math.max(60, params.validForSeconds);

  const item: StoredSessionKey = {
    key: pub,
    tokenSymbol: params.tokenSymbol,
    tokenAddress: params.tokenAddress,
    spendingLimit: params.spendingLimit.toString(),
    validAfter,
    validUntil,
    allowedContracts: params.allowedContracts.slice(0, MAX_ALLOWED_TARGETS),
    createdAt,
  };

  await secureSet(sessionPkStorageKey(pub), pk);

  const list = await loadIndex();
  list.push(item);
  await saveIndex(list);

  return item;
}

export async function deleteLocalSessionKeySecret(sessionPublicKey: string): Promise<void> {
  await secureDelete(sessionPkStorageKey(sessionPublicKey));
}

export async function registerSessionKeyOnchain(params: {
  wallet: WalletSnapshot;
  ownerPrivateKey: string;
  session: StoredSessionKey;
}): Promise<{ txHash: string }> {
  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: params.ownerPrivateKey,
  });

  // Build allowed entrypoints for the session key
  // Note: session-account API only supports entrypoint selectors, not contract-level restrictions.
  // Contract targeting (allowedContracts) is stored locally but not enforced on-chain yet.
  
  // Validate: block registration if contract-level restrictions are requested
  // (not supported by session-account API)
  if (params.session.allowedContracts && params.session.allowedContracts.length > 0) {
    throw new Error(
      "Contract-level restrictions are not supported by session-account API. " +
      "Only entrypoint selectors are enforced on-chain. Remove allowedContracts or use a future API version."
    );
  }

  // Note: spendingLimit and tokenAddress are local policy fields (UI/runtime checks).
  // They are not part of add_or_update_session_key calldata.
  if (params.session.spendingLimit !== "0" || params.session.tokenAddress !== "") {
    console.warn(
      "[session-keys] spendingLimit/tokenAddress are local-only in this API version and are not enforced on-chain",
    );
  }
  
  const allowedEntrypoints = buildAllowedEntrypoints();

  // Call add_or_update_session_key(key, valid_until, max_calls, allowed_entrypoints)
  // New session-account API: add_or_update_session_key replaces old register_session_key
  const tx = await account.execute([
    {
      contractAddress: params.wallet.accountAddress,
      entrypoint: "add_or_update_session_key",
      calldata: [
        params.session.key,
        params.session.validUntil.toString(),
        DEFAULT_MAX_CALLS.toString(), // max_calls - default limit
        allowedEntrypoints.length.toString(),
        ...allowedEntrypoints,
      ],
    },
  ]);

  await account.waitForTransaction(tx.transaction_hash, { retries: 60, retryInterval: 3_000 });

  const list = await loadIndex();
  const i = list.findIndex((x) => x.key === params.session.key);
  if (i >= 0) {
    const updated: StoredSessionKey = {
      ...list[i],
      registeredAt: nowSec(),
      lastTxHash: tx.transaction_hash,
    };
    list[i] = updated;
    await saveIndex(list);
  }

  return { txHash: tx.transaction_hash };
}

/**
 * Build allowed entrypoint selectors for session keys.
 * Returns a fixed list of common entrypoint selector hashes.
 */
function buildAllowedEntrypoints(): string[] {
  const selectors: string[] = [];
  for (const entrypoint of COMMON_ENTRYPOINTS) {
    selectors.push(hash.getSelectorFromName(entrypoint));
  }
  return selectors;
}

export async function revokeSessionKeyOnchain(params: {
  wallet: WalletSnapshot;
  ownerPrivateKey: string;
  sessionPublicKey: string;
}): Promise<{ txHash: string }> {
  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: params.ownerPrivateKey,
  });

  const tx = await account.execute({
    contractAddress: params.wallet.accountAddress,
    entrypoint: "revoke_session_key",
    calldata: [params.sessionPublicKey],
  });

  await account.waitForTransaction(tx.transaction_hash, { retries: 60, retryInterval: 3_000 });

  const list = await loadIndex();
  const i = list.findIndex((x) => x.key === params.sessionPublicKey);
  if (i >= 0) {
    list[i] = { ...list[i], revokedAt: nowSec(), lastTxHash: tx.transaction_hash };
    await saveIndex(list);
  }

  await deleteLocalSessionKeySecret(params.sessionPublicKey);
  return { txHash: tx.transaction_hash };
}

export async function emergencyRevokeAllOnchain(params: {
  wallet: WalletSnapshot;
  ownerPrivateKey: string;
}): Promise<{ txHash: string }> {
  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: params.ownerPrivateKey,
  });

  const tx = await account.execute({
    contractAddress: params.wallet.accountAddress,
    entrypoint: "emergency_revoke_all",
    calldata: [],
  });

  await account.waitForTransaction(tx.transaction_hash, { retries: 60, retryInterval: 3_000 });

  const list = await loadIndex();
  const revokedAt = nowSec();
  const updated = list.map((x) => ({ ...x, revokedAt, lastTxHash: tx.transaction_hash }));
  await saveIndex(updated);

  for (const k of updated) {
    await deleteLocalSessionKeySecret(k.key);
  }

  return { txHash: tx.transaction_hash };
}

export async function isSessionKeyValidOnchain(params: {
  rpcUrl: string;
  accountAddress: string;
  sessionPublicKey: string;
}): Promise<boolean> {
  try {
    const selector = hash.getSelectorFromName("get_session_data");
    const res = await callContract(params.rpcUrl, {
      contract_address: params.accountAddress,
      entry_point_selector: selector,
      calldata: [params.sessionPublicKey],
    });
    const validUntil = BigInt(res[0] ?? "0x0");
    const maxCalls = BigInt(res[1] ?? "0x0");
    const callsUsed = BigInt(res[2] ?? "0x0");
    const now = BigInt(nowSec());

    return validUntil > now && callsUsed < maxCalls;
  } catch {
    return false;
  }
}
