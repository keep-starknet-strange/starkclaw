/**
 * use-tx-status-poller - polls pending transactions for status updates.
 * 
 * Runs only in live mode while app is foregrounded.
 * Updates activity entries via updateActivityByTxHash.
 */

import * as React from "react";
import { AppState, AppStateStatus } from "react-native";

import { listActivity, updateActivityByTxHash, type ActivityStatus } from "../activity/activity";
import { starknetRpc } from "../starknet/rpc";
import { STARKNET_NETWORKS } from "../starknet/networks";
import { loadWallet } from "../wallet/wallet";

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const MAX_POLL_AGE_MS = 30 * 60 * 1000; // Stop polling after 30 minutes
const MAX_CONCURRENT_POLLS = 3; // Bounded concurrency for polling

type TxReceiptStatus = {
  status: "ACCEPTED_ON_L2" | "ACCEPTED_ON_L1" | "REJECTED";
  execution_status?: "SUCCEEDED" | "FAILED" | "REVERTED";
  revert_reason?: string;
};

/**
 * Poll a single transaction for status.
 */
async function pollTxStatus(
  txHash: string,
  rpcUrl: string
): Promise<{ status: ActivityStatus; executionStatus?: string; revertReason?: string } | null> {
  try {
    const receipt = await starknetRpc<TxReceiptStatus>(
      rpcUrl,
      "starknet_getTransactionReceipt",
      [txHash],
      { timeoutMs: 10_000 }
    );

    let status: ActivityStatus;
    let executionStatus: string | undefined;
    let revertReason: string | undefined;

    if (receipt.status === "REJECTED") {
      status = "reverted";
    } else if (receipt.execution_status === "REVERTED") {
      status = "reverted";
      executionStatus = "REVERTED";
      revertReason = receipt.revert_reason ?? "Transaction reverted";
    } else if (receipt.execution_status === "FAILED") {
      status = "reverted";
      executionStatus = "FAILED";
    } else {
      status = "succeeded";
      executionStatus = receipt.execution_status ?? "SUCCEEDED";
    }

    return { status, executionStatus, revertReason };
  } catch (err) {
    // Transaction might not be mined yet
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("pending")) {
      return null;
    }
    throw err;
  }
}

/**
 * Run tasks with bounded concurrency.
 */
async function runWithLimit<T>(
  limit: number,
  items: T[],
  fn: (item: T) => Promise<void>
): Promise<void> {
  const running: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = fn(item).catch((err) => {
      console.warn("Polling task failed:", err);
    });
    running.push(promise);
    
    if (running.length >= limit) {
      await Promise.race(running);
      // Remove completed promises
      const completed = await Promise.allSettled(running);
    }
  }
  
  // Wait for remaining
  await Promise.allSettled(running);
}

/**
 * Hook that polls pending transactions for status updates.
 * Only runs in live mode when app is foregrounded.
 */
export function useTxStatusPoller(isLive: boolean): void {
  const [wallet, setWallet] = React.useState<{ networkId: string; rpcUrl: string } | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  // Load wallet once
  React.useEffect(() => {
    if (!isLive) return;

    let mounted = true;
    loadWallet().then((w) => {
      if (mounted && w) {
        setWallet({ networkId: w.networkId, rpcUrl: w.rpcUrl });
      }
    });

    return () => {
      mounted = false;
    };
  }, [isLive]);

  // Handle app state changes (pause polling when backgrounded)
  React.useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Polling interval
  React.useEffect(() => {
    if (!isLive || !wallet) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      // Skip if app is backgrounded
      if (appStateRef.current.match(/inactive|background/)) {
        return;
      }

      const now = Date.now();
      const items = await listActivity();

      // Filter items that need polling
      const pendingItems = items.filter((item) => 
        item.status === "pending" && item.txHash
      );

      if (pendingItems.length === 0) return;

      // Process with bounded concurrency
      await runWithLimit(
        MAX_CONCURRENT_POLLS,
        pendingItems,
        async (item) => {
          if (!item.txHash) return;

          // Stop polling old txs
          const ageMs = now - item.createdAt * 1000;
          if (ageMs > MAX_POLL_AGE_MS) {
            await updateActivityByTxHash(item.txHash, {
              status: "unknown",
              executionStatus: "UNKNOWN",
              revertReason: "Polling timeout - tx status unknown",
            });
            return;
          }

          const result = await pollTxStatus(item.txHash, wallet.rpcUrl);
          if (result) {
            await updateActivityByTxHash(item.txHash, {
              status: result.status,
              executionStatus: result.executionStatus ?? null,
              revertReason: result.revertReason ?? null,
            });
          }
        }
      );
    };

    // Initial poll with error handling
    poll().catch((err) => {
      console.warn("Initial poll failed:", err);
    });

    // Set up interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, wallet]);
}
