/**
 * use-paymaster — React hook for paymaster availability and fee estimation.
 *
 * Checks whether the paymaster is reachable and surfaces gas token prices
 * for sponsored execution. Eligibility is always checked before offering
 * gasless mode.
 */

import * as React from "react";

import type { WalletSnapshot } from "../wallet/wallet";

import {
  isPaymasterAvailable,
  buildTypedData,
  checkSponsorshipEligibility,
  type PaymasterCall,
  type PaymasterNetwork,
  type GasTokenPrice,
  type EligibilityResult,
} from "./paymaster";

export type PaymasterStatus = "checking" | "available" | "unavailable";

export type UsePaymasterResult = {
  /** Whether the paymaster service is reachable. */
  status: PaymasterStatus;
  /** Re-check availability. */
  refresh: () => void;
  /** Check if a specific action is eligible for sponsorship. */
  checkEligibility: (actionKind: string, entrypoints: string[]) => EligibilityResult;
  /** Estimate gas fees for sponsored execution (returns gas token prices). */
  estimateFees: (calls: PaymasterCall[]) => Promise<GasTokenPrice[] | null>;
  error: string | null;
};

function paymasterNetwork(networkId: string): PaymasterNetwork {
  if (networkId === "mainnet") return "mainnet";
  return "sepolia";
}

export function usePaymaster(wallet: WalletSnapshot | null): UsePaymasterResult {
  const [status, setStatus] = React.useState<PaymasterStatus>("checking");
  const [error, setError] = React.useState<string | null>(null);
  const checkRef = React.useRef(0);

  const network = wallet ? paymasterNetwork(wallet.networkId) : null;

  const checkAvailability = React.useCallback(async () => {
    if (!network) {
      setStatus("unavailable");
      return;
    }
    const id = ++checkRef.current;
    setStatus("checking");
    setError(null);
    try {
      const ok = await isPaymasterAvailable(network);
      if (id !== checkRef.current) return;
      setStatus(ok ? "available" : "unavailable");
    } catch {
      if (id !== checkRef.current) return;
      setStatus("unavailable");
    }
  }, [network]);

  React.useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const checkEligibility = React.useCallback(
    (actionKind: string, entrypoints: string[]): EligibilityResult => {
      return checkSponsorshipEligibility({ actionKind, entrypoints });
    },
    [],
  );

  const estimateFees = React.useCallback(
    async (calls: PaymasterCall[]): Promise<GasTokenPrice[] | null> => {
      if (!wallet || !network || status !== "available") return null;
      setError(null);
      try {
        const result = await buildTypedData(network, {
          userAddress: wallet.accountAddress,
          calls,
        });
        return result.gasTokenPrices;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fee estimation failed";
        setError(msg);
        return null;
      }
    },
    [wallet, network, status],
  );

  return {
    status,
    refresh: checkAvailability,
    checkEligibility,
    estimateFees,
    error,
  };
}
