/**
 * use-agent-identity — React hook for ERC-8004 agent identity state.
 *
 * Fetches on-chain identity (existence, metadata, wallet binding) and
 * surfaces trust level + warnings. Identity is read-only and never
 * bypasses policy enforcement.
 */

import * as React from "react";

import type { WalletSnapshot } from "../wallet/wallet";

import {
  lookupAgentIdentity,
  type IdentityState,
  type IdentityTrust,
} from "./erc8004";

export type UseAgentIdentityResult = {
  /** Trust classification: verified | registered | unknown | error. */
  trust: IdentityTrust;
  /** Full identity state (null while loading). */
  state: IdentityState | null;
  /** Whether the lookup is in progress. */
  loading: boolean;
  /** Human-readable warning (null if verified). */
  warning: string | null;
  /** Refresh identity state from chain. */
  refresh: () => void;
};

export function useAgentIdentity(
  wallet: WalletSnapshot | null,
  registryAddress: string | null,
  agentId: bigint | null,
): UseAgentIdentityResult {
  const [state, setState] = React.useState<IdentityState | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadRef = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!wallet || !registryAddress || agentId == null) {
      setState(null);
      setLoading(false);
      return;
    }

    const id = ++loadRef.current;
    setLoading(true);

    const result = await lookupAgentIdentity(
      wallet.rpcUrl,
      registryAddress,
      agentId,
    );

    if (id !== loadRef.current) return;

    setState(result);
    setLoading(false);
  }, [wallet, registryAddress, agentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  return {
    trust: state?.trust ?? "unknown",
    state,
    loading,
    warning: state?.warning ?? null,
    refresh: load,
  };
}
