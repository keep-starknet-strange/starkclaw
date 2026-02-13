/**
 * useLiveActivity — React hook for the live activity timeline.
 *
 * Loads activity items from SecureStore, polls pending txs for status updates,
 * and provides a manual refresh function.
 */

import * as React from "react";

import { listActivity, type ActivityItem } from "./activity";
import { pollPendingTransactions } from "./tx-tracker";

type LiveActivityResult = {
  items: ActivityItem[];
  loading: boolean;
  hasPending: boolean;
  refresh: () => void;
};

const POLL_INTERVAL_MS = 8_000;

export function useLiveActivity(rpcUrl: string | null): LiveActivityResult {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((n) => n + 1), []);

  // Load items from store on mount and on refresh.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all = await listActivity();
      if (cancelled) return;
      setItems(all);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick]);

  // Poll pending txs at interval.
  React.useEffect(() => {
    if (!rpcUrl) return;
    const hasPending = items.some((i) => i.status === "pending" && i.txHash);
    if (!hasPending) return;

    const id = setInterval(async () => {
      const result = await pollPendingTransactions(rpcUrl);
      if (result.updated > 0) {
        const all = await listActivity();
        setItems(all);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [rpcUrl, items]);

  const hasPending = items.some((i) => i.status === "pending");

  return { items, loading, hasPending, refresh };
}
