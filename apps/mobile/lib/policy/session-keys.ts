import * as Crypto from "expo-crypto";
import { ec, hash } from "starknet";

import { createOwnerAccount } from "../starknet/account";
import { callContract } from "../starknet/rpc";
import { u256FromBigInt } from "../starknet/u256";
import { secureDelete, secureGet, secureSet } from "../storage/secure-store";
import type { WalletSnapshot } from "../wallet/wallet";
import { MAX_ALLOWED_TARGETS, ZERO_ADDRESS, padTargets } from "./target-presets";

const SESSION_KEYS_INDEX_ID = "starkclaw.session_keys.v1";

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
  const spending = BigInt(params.session.spendingLimit);
  const { low, high } = u256FromBigInt(spending);

  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: params.ownerPrivateKey,
  });

  // Pad allowed contracts to exactly 4 slots (filling unused with zero address).
  const targets = padTargets(params.session.allowedContracts);

  // Call register_session_key(key, SessionPolicy).
  // SessionPolicy struct fields are serialized in declaration order:
  //   valid_after, valid_until, spending_limit (u256 = low + high),
  //   spending_token, allowed_contract_0…3
  const tx = await account.execute([
    {
      contractAddress: params.wallet.accountAddress,
      entrypoint: "register_session_key",
      calldata: [
        params.session.key,
        // SessionPolicy fields:
        params.session.validAfter.toString(),
        params.session.validUntil.toString(),
        low,   // spending_limit.low
        high,  // spending_limit.high
        params.session.tokenAddress,  // spending_token
        targets[0],  // allowed_contract_0
        targets[1],  // allowed_contract_1
        targets[2],  // allowed_contract_2
        targets[3],  // allowed_contract_3
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
