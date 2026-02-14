import * as Crypto from "expo-crypto";
import { ec, hash } from "starknet";

import { createOwnerAccount } from "../starknet/account";
import { callContract } from "../starknet/rpc";
import { u256FromBigInt } from "../starknet/u256";
import { secureDelete, secureGet, secureSet } from "../storage/secure-store";
import type { WalletSnapshot } from "../wallet/wallet";

const SESSION_KEYS_INDEX_ID = "starkclaw.session_keys.v1";
const DEFAULT_SESSION_MAX_CALLS = 100;
const DEFAULT_SPENDING_WINDOW_SECONDS = 86_400;
const DEFAULT_ALLOWED_ENTRYPOINTS = [
  hash.getSelectorFromName("transfer"),
];

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
  maxCalls?: number; // defaults to DEFAULT_SESSION_MAX_CALLS
  validAfter: number; // unix seconds
  validUntil: number; // unix seconds
  allowedContract: string;
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
  allowedContract: string;
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
    allowedContract: params.allowedContract,
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
  const spending = BigInt(params.session.spendingLimit);
  const { low, high } = u256FromBigInt(spending);

  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: params.ownerPrivateKey,
  });

  // SessionAccount scopes sessions by entrypoint selectors (not contract address).
  // Keep default selectors minimal (`transfer` only) and rely on per-token
  // spending policy for amount bounds.
  const tx = await account.execute([
    {
      contractAddress: params.wallet.accountAddress,
      entrypoint: "add_or_update_session_key",
      calldata: [
        params.session.key,
        params.session.validUntil.toString(),
        (params.session.maxCalls ?? DEFAULT_SESSION_MAX_CALLS).toString(),
        DEFAULT_ALLOWED_ENTRYPOINTS.length.toString(),
        ...DEFAULT_ALLOWED_ENTRYPOINTS,
      ],
    },
    {
      contractAddress: params.wallet.accountAddress,
      entrypoint: "set_spending_policy",
      calldata: [
        params.session.key,
        params.session.tokenAddress,
        low,
        high,
        low,
        high,
        DEFAULT_SPENDING_WINDOW_SECONDS.toString(),
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
