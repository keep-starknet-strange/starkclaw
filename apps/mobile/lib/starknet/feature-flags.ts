/**
 * feature-flags — Runtime feature flags with SecureStore persistence.
 *
 * Flags are runtime-configurable, except session_signer_v2 which is
 * enforced on for strict SNIP-12-only signing.
 */

import { secureGet, secureSet } from "../storage/secure-store";

const FLAGS_STORAGE_ID = "starkclaw.feature_flags.v1";

// ── Flag definitions ────────────────────────────────────────────────

export type FeatureFlagId =
  | "session_signer_v2"; // SNIP-12 typed-data session signing

type FlagDefaults = Record<FeatureFlagId, boolean>;

const DEFAULTS: FlagDefaults = {
  session_signer_v2: true,
};

// ── In-memory cache ─────────────────────────────────────────────────

let cache: Record<string, boolean> | null = null;

async function loadFlags(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  const raw = await secureGet(FLAGS_STORAGE_ID);
  if (!raw) {
    cache = { ...DEFAULTS };
    return cache;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    cache = { ...DEFAULTS, ...parsed };
    return cache;
  } catch {
    cache = { ...DEFAULTS };
    return cache;
  }
}

async function saveFlags(flags: Record<string, boolean>): Promise<void> {
  cache = flags;
  await secureSet(FLAGS_STORAGE_ID, JSON.stringify(flags));
}

// ── Public API ──────────────────────────────────────────────────────

export async function isEnabled(flag: FeatureFlagId): Promise<boolean> {
  if (flag === "session_signer_v2") return true;
  const flags = await loadFlags();
  return flags[flag] ?? DEFAULTS[flag] ?? false;
}

export async function setFlag(flag: FeatureFlagId, enabled: boolean): Promise<void> {
  const flags = await loadFlags();
  flags[flag] = flag === "session_signer_v2" ? true : enabled;
  await saveFlags(flags);
}

export async function getAllFlags(): Promise<Record<FeatureFlagId, boolean>> {
  const flags = await loadFlags();
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULTS)) {
    result[key] = flags[key] ?? DEFAULTS[key as FeatureFlagId] ?? false;
  }
  return result as Record<FeatureFlagId, boolean>;
}

export async function resetFlags(): Promise<void> {
  cache = null;
  await saveFlags({ ...DEFAULTS });
}
