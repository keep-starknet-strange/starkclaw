/**
 * useBalances — fetches ERC-20 balances for a Starknet address.
 *
 * Reads ETH, STRK, USDC from the static token list via RPC.
 * Returns formatted balances, loading state, user-safe error, and refresh().
 */

import * as React from "react";

import { getErc20Balance, formatUnits } from "./balances";
import { StarknetRpcError } from "./rpc";
import { TOKENS, type StarknetTokenSymbol } from "./tokens";
import type { StarknetNetworkId } from "./networks";

export type TokenBalance = {
  symbol: StarknetTokenSymbol;
  name: string;
  decimals: number;
  raw: bigint;
  formatted: string;
};

type BalancesResult = {
  status: "idle" | "loading" | "success" | "error";
  balances: TokenBalance[];
  error: string | null;
  refresh: () => void;
};

function userSafeError(err: unknown): string {
  if (err instanceof StarknetRpcError) {
    if (err.message.includes("HTTP 429")) return "Rate limited by RPC. Try again in a moment.";
    if (err.message.includes("HTTP 5")) return "RPC server error. Try again later.";
    if (err.message.includes("timeout") || err.message.includes("abort")) return "Network request timed out.";
    return `RPC error: ${err.message}`;
  }
  if (err instanceof TypeError && (err.message.includes("Network") || err.message.includes("fetch"))) {
    return "Network error. Check your connection.";
  }
  return "Failed to fetch balances. Try again.";
}

export function useBalances(
  rpcUrl: string | null,
  accountAddress: string | null,
  networkId: StarknetNetworkId | null,
): BalancesResult {
  const [status, setStatus] = React.useState<BalancesResult["status"]>("idle");
  const [balances, setBalances] = React.useState<TokenBalance[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((n) => n + 1), []);

  React.useEffect(() => {
    if (!rpcUrl || !accountAddress || !networkId) {
      setStatus("idle");
      setBalances([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const results: TokenBalance[] = [];
        for (const token of TOKENS) {
          const address = token.addressByNetwork[networkId];
          if (!address) continue;
          const raw = await getErc20Balance(rpcUrl, address, accountAddress);
          results.push({
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            raw,
            formatted: formatUnits(raw, token.decimals),
          });
        }
        if (cancelled) return;
        setBalances(results);
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setError(userSafeError(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rpcUrl, accountAddress, networkId, tick]);

  return { status, balances, error, refresh };
}
