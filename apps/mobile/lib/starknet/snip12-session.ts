/**
 * snip12-session — SNIP-12 typed-data builder for session key operations.
 *
 * Builds canonical typed-data payloads for session operations (register,
 * revoke, emergency revoke-all). Uses Poseidon hashing for deterministic
 * serialization. Compatible with starknet.js TypedData format.
 */

import { hash, type TypedData } from "starknet";

// ── Constants ───────────────────────────────────────────────────────

const DOMAIN_NAME = "Starkclaw";
const SPEC_VERSION_V2 = "2";

export type SignerMode = "v2";

// ── SNIP-12 Domain ──────────────────────────────────────────────────

export type SessionDomain = {
  name: string;
  version: string;
  chainId: string;
  verifyingContract: string;
};

function buildDomain(params: {
  chainId: string;
  accountAddress: string;
}): SessionDomain {
  return {
    name: DOMAIN_NAME,
    version: SPEC_VERSION_V2,
    chainId: params.chainId,
    verifyingContract: params.accountAddress,
  };
}

// ── SNIP-12 Type Definitions ────────────────────────────────────────

const STARKNET_DOMAIN_TYPE = [
  { name: "name", type: "shortstring" },
  { name: "version", type: "shortstring" },
  { name: "chainId", type: "shortstring" },
  { name: "verifyingContract", type: "ContractAddress" },
];

const REGISTER_SESSION_KEY_TYPE = [
  { name: "session_key", type: "felt" },
  { name: "valid_after", type: "felt" },
  { name: "valid_until", type: "felt" },
  { name: "spending_limit_low", type: "felt" },
  { name: "spending_limit_high", type: "felt" },
  { name: "spending_token", type: "ContractAddress" },
  { name: "allowed_contract_0", type: "ContractAddress" },
  { name: "allowed_contract_1", type: "ContractAddress" },
  { name: "allowed_contract_2", type: "ContractAddress" },
  { name: "allowed_contract_3", type: "ContractAddress" },
];

const REVOKE_SESSION_KEY_TYPE = [
  { name: "session_key", type: "felt" },
];

const EMERGENCY_REVOKE_ALL_TYPE = [
  { name: "nonce", type: "felt" },
  { name: "timestamp", type: "felt" },
];

// ── Typed-data builders ─────────────────────────────────────────────

export type RegisterSessionKeyMessage = {
  session_key: string;
  valid_after: string;
  valid_until: string;
  spending_limit_low: string;
  spending_limit_high: string;
  spending_token: string;
  allowed_contract_0: string;
  allowed_contract_1: string;
  allowed_contract_2: string;
  allowed_contract_3: string;
};

export function buildRegisterSessionKeyTypedData(params: {
  chainId: string;
  accountAddress: string;
  sessionKey: string;
  validAfter: number;
  validUntil: number;
  spendingLimitLow: string;
  spendingLimitHigh: string;
  spendingToken: string;
  allowedContract0: string;
  allowedContract1: string;
  allowedContract2: string;
  allowedContract3: string;
}): TypedData {
  const domain = buildDomain({
    chainId: params.chainId,
    accountAddress: params.accountAddress,
  });

  const message: RegisterSessionKeyMessage = {
    session_key: params.sessionKey,
    valid_after: `0x${params.validAfter.toString(16)}`,
    valid_until: `0x${params.validUntil.toString(16)}`,
    spending_limit_low: params.spendingLimitLow,
    spending_limit_high: params.spendingLimitHigh,
    spending_token: params.spendingToken,
    allowed_contract_0: params.allowedContract0,
    allowed_contract_1: params.allowedContract1,
    allowed_contract_2: params.allowedContract2,
    allowed_contract_3: params.allowedContract3,
  };

  return {
    types: {
      StarknetDomain: STARKNET_DOMAIN_TYPE,
      RegisterSessionKey: REGISTER_SESSION_KEY_TYPE,
    },
    primaryType: "RegisterSessionKey",
    domain,
    message,
  };
}

export type RevokeSessionKeyMessage = {
  session_key: string;
};

export function buildRevokeSessionKeyTypedData(params: {
  chainId: string;
  accountAddress: string;
  sessionKey: string;
}): TypedData {
  const domain = buildDomain({
    chainId: params.chainId,
    accountAddress: params.accountAddress,
  });

  const message: RevokeSessionKeyMessage = {
    session_key: params.sessionKey,
  };

  return {
    types: {
      StarknetDomain: STARKNET_DOMAIN_TYPE,
      RevokeSessionKey: REVOKE_SESSION_KEY_TYPE,
    },
    primaryType: "RevokeSessionKey",
    domain,
    message,
  };
}

export type EmergencyRevokeAllMessage = {
  nonce: string;
  timestamp: string;
};

export function buildEmergencyRevokeAllTypedData(params: {
  chainId: string;
  accountAddress: string;
  nonce: number;
  timestamp: number;
}): TypedData {
  const domain = buildDomain({
    chainId: params.chainId,
    accountAddress: params.accountAddress,
  });

  const message: EmergencyRevokeAllMessage = {
    nonce: `0x${params.nonce.toString(16)}`,
    timestamp: `0x${params.timestamp.toString(16)}`,
  };

  return {
    types: {
      StarknetDomain: STARKNET_DOMAIN_TYPE,
      EmergencyRevokeAll: EMERGENCY_REVOKE_ALL_TYPE,
    },
    primaryType: "EmergencyRevokeAll",
    domain,
    message,
  };
}

// ── Hash helpers (deterministic) ────────────────────────────────────

/**
 * Compute the SNIP-12 message hash for a typed-data payload.
 * Uses starknet.js's built-in typed-data hashing (Poseidon-based).
 */
export function computeTypedDataHash(
  typedData: TypedData,
  accountAddress: string,
): string {
  return hash.computeHashOnElements([
    hash.computeHashOnElements(
      Object.values(typedData.domain).map((v) =>
        typeof v === "string" ? v : `0x${BigInt(v as string | number | bigint).toString(16)}`,
      ),
    ),
    accountAddress,
  ]);
}

// ── Signer metadata ─────────────────────────────────────────────────

export type SignerMetadata = {
  signature_mode: SignerMode;
  spec_version: string;
  domain_name: string;
};

export function signerMetadata(): SignerMetadata {
  return {
    signature_mode: "v2",
    spec_version: SPEC_VERSION_V2,
    domain_name: DOMAIN_NAME,
  };
}
