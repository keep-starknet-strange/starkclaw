/**
 * tx-tracker — polls pending transactions and updates activity entries.
 *
 * Call `pollPendingTransactions` with an rpcUrl to check all pending activity
 * items and update their status in the activity store.
 */

import { fetchTxStatus } from "../starknet/tx-status";
import {
  listActivity,
  updateActivityByTxHash,
  type ActivityItem,
  type ActivityStatus,
} from "./activity";

type PollResult = {
  checked: number;
  updated: number;
  items: ActivityItem[];
};

/**
 * Scans all activity items with status "pending" and a txHash,
 * fetches the on-chain receipt, and updates the store.
 */
export async function pollPendingTransactions(
  rpcUrl: string,
): Promise<PollResult> {
  const all = await listActivity();
  const pending = all.filter(
    (item) => item.status === "pending" && item.txHash,
  );

  let updated = 0;
  const updatedItems: ActivityItem[] = [];

  for (const item of pending) {
    const result = await fetchTxStatus(rpcUrl, item.txHash!);
    if (!result.finalized) continue;

    const nextStatus: ActivityStatus = result.status;
    await updateActivityByTxHash(item.txHash!, {
      status: nextStatus,
      executionStatus: result.status,
      revertReason: result.revertReason,
    });
    updated++;
    updatedItems.push({ ...item, status: nextStatus, revertReason: result.revertReason });
  }

  return { checked: pending.length, updated, items: updatedItems };
}
