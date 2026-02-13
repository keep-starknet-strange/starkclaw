/**
 * use-swap — React hook for the AVNU swap lifecycle.
 *
 * Phases: idle → quoting → preview → executing → done | error
 */

import * as React from "react";

import type { WalletSnapshot } from "../wallet/wallet";
import type { StarknetToken } from "../starknet/tokens";

import { prepareSwap, executeSwap, type SwapPreview, type SwapResult } from "./swap";

export type SwapPhase = "idle" | "quoting" | "preview" | "executing" | "done" | "error";

export type UseSwapResult = {
  phase: SwapPhase;
  preview: SwapPreview | null;
  result: SwapResult | null;
  error: string | null;

  /** Fetch a quote and compute the swap preview. */
  quote: (params: {
    sellToken: StarknetToken;
    buyToken: StarknetToken;
    sellAmount: bigint;
    slippage?: number;
  }) => Promise<void>;

  /** Confirm and execute the current preview. */
  confirm: () => Promise<void>;

  /** Reset back to idle. */
  reset: () => void;
};

export function useSwap(wallet: WalletSnapshot | null): UseSwapResult {
  const [phase, setPhase] = React.useState<SwapPhase>("idle");
  const [preview, setPreview] = React.useState<SwapPreview | null>(null);
  const [result, setResult] = React.useState<SwapResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const quote = React.useCallback(
    async (params: {
      sellToken: StarknetToken;
      buyToken: StarknetToken;
      sellAmount: bigint;
      slippage?: number;
    }) => {
      if (!wallet) return;
      setPhase("quoting");
      setError(null);
      setResult(null);
      try {
        const p = await prepareSwap({
          wallet,
          sellToken: params.sellToken,
          buyToken: params.buyToken,
          sellAmount: params.sellAmount,
          slippage: params.slippage,
        });
        setPreview(p);
        setPhase("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Quote failed");
        setPhase("error");
      }
    },
    [wallet],
  );

  const confirm = React.useCallback(async () => {
    if (!wallet || !preview) return;
    setPhase("executing");
    setError(null);
    try {
      const r = await executeSwap({ wallet, preview });
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap execution failed");
      setPhase("error");
    }
  }, [wallet, preview]);

  return { phase, preview, result, error, quote, confirm, reset };
}
