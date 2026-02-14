/**
 * target-presets — human-readable "app presets" that map to well-known
 * on-chain contract address sets for session key policies.
 *
 * Each preset provides a bounded list of contract addresses (max 4)
 * matching the on-chain SessionPolicy.allowed_contract_0…3 slots.
 *
 * An empty array means "wildcard" — any contract is allowed.
 */

import type { StarknetNetworkId } from "../starknet/networks";

// ── Types ───────────────────────────────────────────────────────────

export type TargetPresetId = "transfers" | "avnu_swap" | "custom";

export type TargetPreset = {
  id: TargetPresetId;
  label: string;
  description: string;
  icon: string; // SF Symbol name (iOS) / FontAwesome fallback
  /** Resolve the concrete contract addresses for a given network. */
  resolve: (network: StarknetNetworkId) => string[];
};

// ── Well-known contract addresses ───────────────────────────────────

/** AVNU Exchange (router) contract addresses by network. */
const AVNU_EXCHANGE: Record<StarknetNetworkId, string> = {
  mainnet:
    "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f",
  sepolia:
    "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f",
};

/** Core token addresses (ETH, STRK, USDC). Duplicated from tokens.ts to avoid circular deps. */
const TOKEN_ADDRESSES: Record<StarknetNetworkId, Record<string, string>> = {
  sepolia: {
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343",
  },
  mainnet: {
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
  },
};

// ── Presets ──────────────────────────────────────────────────────────

const transfersPreset: TargetPreset = {
  id: "transfers",
  label: "Transfers only",
  description: "Allow transfers to any contract (wildcard policy).",
  icon: "arrow.up.right",
  resolve: () => [],
};

const avnuSwapPreset: TargetPreset = {
  id: "avnu_swap",
  label: "AVNU Swap",
  description: "Allow token swaps via AVNU (tokens + router).",
  icon: "arrow.triangle.2.circlepath",
  resolve: (network) => {
    const tokens = TOKEN_ADDRESSES[network];
    return [
      tokens.ETH,
      tokens.STRK,
      tokens.USDC,
      AVNU_EXCHANGE[network],
    ];
  },
};

const customPreset: TargetPreset = {
  id: "custom",
  label: "Custom",
  description: "Manually specify allowed contract addresses.",
  icon: "slider.horizontal.3",
  resolve: () => [],
};

// ── Exports ─────────────────────────────────────────────────────────

export const TARGET_PRESETS: TargetPreset[] = [
  transfersPreset,
  avnuSwapPreset,
  customPreset,
];

export function getPresetById(id: TargetPresetId): TargetPreset | undefined {
  return TARGET_PRESETS.find((p) => p.id === id);
}

/**
 * Maximum number of allowed target slots in the on-chain SessionPolicy.
 */
export const MAX_ALLOWED_TARGETS = 4;

/**
 * The zero address used to represent empty / unused target slots on-chain.
 */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Pad an array of target addresses to exactly MAX_ALLOWED_TARGETS,
 * filling unused slots with ZERO_ADDRESS.
 *
 * If more than MAX_ALLOWED_TARGETS are provided, only the first 4 are kept.
 */
export function padTargets(targets: string[]): [string, string, string, string] {
  const padded: string[] = [];
  for (let i = 0; i < MAX_ALLOWED_TARGETS; i++) {
    padded.push(targets[i] ?? ZERO_ADDRESS);
  }
  return padded as [string, string, string, string];
}

/**
 * Convert 4 on-chain target slots back to a compact address array,
 * stripping zero-address entries.
 */
export function unpadTargets(slots: [string, string, string, string]): string[] {
  return slots.filter((s) => s !== ZERO_ADDRESS && s !== "0x0" && BigInt(s) !== 0n);
}

/**
 * Try to match a set of resolved addresses to a known preset.
 * Returns the preset id if it matches, or "custom" otherwise.
 */
export function detectPreset(
  addresses: string[],
  network: StarknetNetworkId,
): TargetPresetId {
  if (addresses.length === 0) return "transfers";

  // Normalize for comparison
  const normalize = (a: string) => a.toLowerCase();
  const sorted = [...addresses].map(normalize).sort();

  for (const preset of TARGET_PRESETS) {
    if (preset.id === "custom") continue;
    const resolved = preset.resolve(network).map(normalize).sort();
    if (
      resolved.length === sorted.length &&
      resolved.every((addr, i) => addr === sorted[i])
    ) {
      return preset.id;
    }
  }

  return "custom";
}

/**
 * Return a human-readable label for a contract address.
 * Checks against well-known addresses; falls back to truncated hex.
 */
export function labelForAddress(
  address: string,
  network: StarknetNetworkId,
): string {
  const norm = address.toLowerCase();

  if (norm === AVNU_EXCHANGE[network].toLowerCase()) return "AVNU Router";

  const tokens = TOKEN_ADDRESSES[network];
  for (const [symbol, addr] of Object.entries(tokens)) {
    if (norm === addr.toLowerCase()) return symbol;
  }

  // Truncate unknown addresses
  if (address.length > 18) {
    return `${address.slice(0, 10)}…${address.slice(-6)}`;
  }
  return address;
}
