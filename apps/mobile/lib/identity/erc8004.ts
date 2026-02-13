/**
 * erc8004 — Read-only client for ERC-8004 Identity Registry.
 *
 * Reads agent identity state (existence, metadata, wallet binding) from
 * on-chain. Identity data is optional and never bypasses policy enforcement.
 */

import { hash } from "starknet";

import { callContract } from "../starknet/rpc";
import { bigIntFromU256 } from "../starknet/u256";

// ── Well-known metadata keys ────────────────────────────────────────

export const METADATA_KEYS = {
  agentName: "agentName",
  agentType: "agentType",
  version: "version",
  model: "model",
  status: "status",
  framework: "framework",
  capabilities: "capabilities",
  a2aEndpoint: "a2aEndpoint",
} as const;

// ── Types ───────────────────────────────────────────────────────────

export type AgentIdentity = {
  agentId: bigint;
  exists: boolean;
  metadata: Record<string, string>;
  walletAddress: string | null;
};

export type IdentityTrust =
  | "verified"   // Exists + has name + wallet bound
  | "registered" // Exists but incomplete metadata
  | "unknown"    // Not found on-chain
  | "error";     // Lookup failed

export type IdentityState = {
  trust: IdentityTrust;
  identity: AgentIdentity | null;
  warning: string | null;
};

// ── ByteArray encoding/decoding (short strings ≤31 bytes) ───────────

function encodeShortString(s: string): string {
  if (s.length > 31) throw new Error("String too long for short encoding");
  let hex = "0x";
  for (let i = 0; i < s.length; i++) {
    hex += s.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex || "0x0";
}

function decodeShortString(felt: string): string {
  const n = BigInt(felt);
  if (n === 0n) return "";
  const hexStr = n.toString(16);
  const padded = hexStr.length % 2 ? "0" + hexStr : hexStr;
  let result = "";
  for (let i = 0; i < padded.length; i += 2) {
    const code = parseInt(padded.substring(i, i + 2), 16);
    if (code === 0) break;
    result += String.fromCharCode(code);
  }
  return result;
}

/**
 * Decode a Cairo ByteArray from calldata felts.
 *
 * ByteArray layout: [num_full_words, ...full_words(31 bytes each), pending_word, pending_len]
 */
function decodeByteArray(felts: string[], offset: number): { value: string; consumed: number } {
  if (offset >= felts.length) return { value: "", consumed: 0 };

  const numFull = Number(BigInt(felts[offset]));
  let result = "";
  let idx = offset + 1;

  for (let i = 0; i < numFull; i++) {
    if (idx >= felts.length) break;
    result += decodeShortString(felts[idx]);
    idx++;
  }

  // Pending word.
  if (idx < felts.length) {
    const pendingWord = felts[idx];
    idx++;
    const pendingLen = idx < felts.length ? Number(BigInt(felts[idx])) : 0;
    idx++;

    if (pendingLen > 0) {
      const n = BigInt(pendingWord);
      const hexStr = n.toString(16).padStart(pendingLen * 2, "0");
      for (let i = 0; i < pendingLen; i++) {
        const code = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
        if (code > 0) result += String.fromCharCode(code);
      }
    }
  }

  return { value: result, consumed: idx - offset };
}

/**
 * Encode a string as Cairo ByteArray calldata felts.
 *
 * ByteArray layout: [num_full_words, ...full_words, pending_word, pending_len]
 */
function encodeByteArray(s: string): string[] {
  const fullWords: string[] = [];
  let i = 0;

  while (i + 31 <= s.length) {
    fullWords.push(encodeShortString(s.substring(i, i + 31)));
    i += 31;
  }

  const remainder = s.substring(i);
  const pendingWord = remainder.length > 0 ? encodeShortString(remainder) : "0x0";
  const pendingLen = `0x${remainder.length.toString(16)}`;

  return [`0x${fullWords.length.toString(16)}`, ...fullWords, pendingWord, pendingLen];
}

// ── On-chain reads ──────────────────────────────────────────────────

export async function agentExists(
  rpcUrl: string,
  registryAddress: string,
  agentId: bigint,
): Promise<boolean> {
  const selector = hash.getSelectorFromName("agent_exists");
  const low = agentId & ((1n << 128n) - 1n);
  const high = agentId >> 128n;

  try {
    const res = await callContract(rpcUrl, {
      contract_address: registryAddress,
      entry_point_selector: selector,
      calldata: [`0x${low.toString(16)}`, `0x${high.toString(16)}`],
    });
    return BigInt(res[0] ?? "0x0") !== 0n;
  } catch {
    return false;
  }
}

export async function getMetadata(
  rpcUrl: string,
  registryAddress: string,
  agentId: bigint,
  key: string,
): Promise<string> {
  const selector = hash.getSelectorFromName("get_metadata");
  const low = agentId & ((1n << 128n) - 1n);
  const high = agentId >> 128n;
  const keyCalldata = encodeByteArray(key);

  const res = await callContract(rpcUrl, {
    contract_address: registryAddress,
    entry_point_selector: selector,
    calldata: [`0x${low.toString(16)}`, `0x${high.toString(16)}`, ...keyCalldata],
  });

  const { value } = decodeByteArray(res, 0);
  return value;
}

export async function getAgentWallet(
  rpcUrl: string,
  registryAddress: string,
  agentId: bigint,
): Promise<string | null> {
  const selector = hash.getSelectorFromName("get_agent_wallet");
  const low = agentId & ((1n << 128n) - 1n);
  const high = agentId >> 128n;

  try {
    const res = await callContract(rpcUrl, {
      contract_address: registryAddress,
      entry_point_selector: selector,
      calldata: [`0x${low.toString(16)}`, `0x${high.toString(16)}`],
    });
    const addr = res[0] ?? "0x0";
    return BigInt(addr) === 0n ? null : addr;
  } catch {
    return null;
  }
}

export async function totalAgents(
  rpcUrl: string,
  registryAddress: string,
): Promise<bigint> {
  const selector = hash.getSelectorFromName("total_agents");

  try {
    const res = await callContract(rpcUrl, {
      contract_address: registryAddress,
      entry_point_selector: selector,
      calldata: [],
    });
    if (res.length < 2) return 0n;
    return bigIntFromU256(res[0], res[1]);
  } catch {
    return 0n;
  }
}

// ── Composite identity lookup ───────────────────────────────────────

export async function lookupAgentIdentity(
  rpcUrl: string,
  registryAddress: string,
  agentId: bigint,
): Promise<IdentityState> {
  try {
    const exists = await agentExists(rpcUrl, registryAddress, agentId);
    if (!exists) {
      return {
        trust: "unknown",
        identity: null,
        warning: "Agent identity not found on-chain. Proceed with caution.",
      };
    }

    const [name, agentType, status, walletAddr] = await Promise.all([
      getMetadata(rpcUrl, registryAddress, agentId, METADATA_KEYS.agentName).catch(() => ""),
      getMetadata(rpcUrl, registryAddress, agentId, METADATA_KEYS.agentType).catch(() => ""),
      getMetadata(rpcUrl, registryAddress, agentId, METADATA_KEYS.status).catch(() => ""),
      getAgentWallet(rpcUrl, registryAddress, agentId),
    ]);

    const metadata: Record<string, string> = {};
    if (name) metadata.agentName = name;
    if (agentType) metadata.agentType = agentType;
    if (status) metadata.status = status;

    const identity: AgentIdentity = {
      agentId,
      exists: true,
      metadata,
      walletAddress: walletAddr,
    };

    const hasName = !!name;
    const hasWallet = !!walletAddr;

    if (hasName && hasWallet) {
      return { trust: "verified", identity, warning: null };
    }

    const warnings: string[] = [];
    if (!hasName) warnings.push("missing name");
    if (!hasWallet) warnings.push("no wallet bound");

    return {
      trust: "registered",
      identity,
      warning: `Identity incomplete: ${warnings.join(", ")}.`,
    };
  } catch (e) {
    return {
      trust: "error",
      identity: null,
      warning: e instanceof Error ? e.message : "Identity lookup failed.",
    };
  }
}
