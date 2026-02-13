/**
 * network-guard — Safety guardrails for mainnet vs testnet.
 *
 * Chain-id verification, RPC allowlist, and explicit warnings when
 * operating on mainnet. Mainnet mode is opt-in and harder to misconfigure.
 */

import { getChainId } from "./rpc";
import type { StarknetNetworkId, StarknetNetworkConfig } from "./networks";
import { STARKNET_NETWORKS } from "./networks";

// ── RPC allowlist ───────────────────────────────────────────────────

const RPC_ALLOWLIST: Record<StarknetNetworkId, string[]> = {
  sepolia: [
    "https://starknet-sepolia-rpc.publicnode.com",
    "https://free-rpc.nethermind.io/sepolia-juno",
  ],
  mainnet: [
    "https://starknet-rpc.publicnode.com",
    "https://free-rpc.nethermind.io/mainnet-juno",
  ],
};

export function isRpcAllowed(networkId: StarknetNetworkId, rpcUrl: string): boolean {
  const allowed = RPC_ALLOWLIST[networkId];
  if (!allowed) return false;
  return allowed.some((u) => rpcUrl.startsWith(u));
}

// ── Chain-id verification ───────────────────────────────────────────

export type ChainVerification = {
  valid: boolean;
  expected: string;
  actual: string | null;
  error: string | null;
};

export async function verifyChainId(
  rpcUrl: string,
  expectedNetwork: StarknetNetworkId,
): Promise<ChainVerification> {
  const expected = STARKNET_NETWORKS[expectedNetwork]?.chainIdHex;
  if (!expected) {
    return {
      valid: false,
      expected: "unknown",
      actual: null,
      error: `Unknown network: ${expectedNetwork}`,
    };
  }

  try {
    const actual = await getChainId(rpcUrl);
    const normalExpected = BigInt(expected);
    const normalActual = BigInt(actual);

    if (normalExpected !== normalActual) {
      return {
        valid: false,
        expected,
        actual,
        error: `Chain mismatch: expected ${expectedNetwork} (${expected}) but got ${actual}. Wrong RPC endpoint.`,
      };
    }

    return { valid: true, expected, actual, error: null };
  } catch (e) {
    return {
      valid: false,
      expected,
      actual: null,
      error: e instanceof Error ? e.message : "Chain verification failed.",
    };
  }
}

// ── Network safety classification ───────────────────────────────────

export type NetworkSafety = {
  networkId: StarknetNetworkId;
  isMainnet: boolean;
  warning: string | null;
  confirmationRequired: boolean;
};

export function classifyNetworkSafety(networkId: StarknetNetworkId): NetworkSafety {
  if (networkId === "mainnet") {
    return {
      networkId,
      isMainnet: true,
      warning:
        "You are on Starknet Mainnet. Transactions use real funds and are irreversible. Proceed with caution.",
      confirmationRequired: true,
    };
  }

  return {
    networkId,
    isMainnet: false,
    warning: null,
    confirmationRequired: false,
  };
}

// ── Full network validation ─────────────────────────────────────────

export type NetworkValidation = {
  valid: boolean;
  safety: NetworkSafety;
  chainVerification: ChainVerification | null;
  rpcAllowed: boolean;
  errors: string[];
};

export async function validateNetwork(
  config: StarknetNetworkConfig,
): Promise<NetworkValidation> {
  const safety = classifyNetworkSafety(config.id);
  const rpcAllowed = isRpcAllowed(config.id, config.rpcUrl);
  const errors: string[] = [];

  if (!rpcAllowed) {
    errors.push(`RPC endpoint "${config.rpcUrl}" is not in the allowlist for ${config.id}.`);
  }

  let chainVerification: ChainVerification | null = null;
  try {
    chainVerification = await verifyChainId(config.rpcUrl, config.id);
    if (!chainVerification.valid && chainVerification.error) {
      errors.push(chainVerification.error);
    }
  } catch {
    errors.push("Could not verify chain ID.");
  }

  return {
    valid: errors.length === 0,
    safety,
    chainVerification,
    rpcAllowed,
    errors,
  };
}
