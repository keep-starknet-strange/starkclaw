// Canonical class hash for SessionAccount (starknet-agentic session-account lineage).
// Source baseline: keep-starknet-strange/starknet-agentic PR #227.
//
// Can be overridden in app env for test/deploy parity:
// EXPO_PUBLIC_SESSION_ACCOUNT_CLASS_HASH=0x...
export const SESSION_ACCOUNT_CLASS_HASH =
  process.env.EXPO_PUBLIC_SESSION_ACCOUNT_CLASS_HASH?.trim()
    || "0x4c1adc7ae850ce40188692488816042114f055c32b61270f775c98163a69f77";

// Backward-compatible alias to avoid broad churn during migration slices.
// Do not use for new code; prefer SESSION_ACCOUNT_CLASS_HASH.
export const AGENT_ACCOUNT_CLASS_HASH = SESSION_ACCOUNT_CLASS_HASH;
