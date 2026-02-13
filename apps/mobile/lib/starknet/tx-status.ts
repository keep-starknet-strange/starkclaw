/**
 * tx-status — fetch transaction receipt and classify the result.
 *
 * Wraps starknet_getTransactionReceipt and returns a structured result
 * with safe error messages for reverted txs.
 */

import { starknetRpc, StarknetRpcError } from "./rpc";

export type TxFinalStatus = "succeeded" | "reverted" | "unknown";

export type TxStatusResult =
  | { finalized: false }
  | { finalized: true; status: TxFinalStatus; revertReason: string | null };

type ReceiptResult = {
  execution_status?: string;
  finality_status?: string;
  revert_reason?: string;
};

function scrubRevertReason(raw: string | undefined): string | null {
  if (!raw) return null;
  // Strip internal addresses and hex blobs for user display.
  const cleaned = raw
    .replace(/0x[0-9a-fA-F]{10,}/g, "0x...")
    .replace(/\n/g, " ")
    .trim();
  if (cleaned.length > 200) return cleaned.slice(0, 200) + "...";
  return cleaned;
}

export async function fetchTxStatus(
  rpcUrl: string,
  txHash: string,
): Promise<TxStatusResult> {
  try {
    const receipt = await starknetRpc<ReceiptResult>(
      rpcUrl,
      "starknet_getTransactionReceipt",
      [txHash],
    );

    const finality = receipt.finality_status?.toUpperCase();
    if (finality !== "ACCEPTED_ON_L2" && finality !== "ACCEPTED_ON_L1") {
      return { finalized: false };
    }

    const execution = receipt.execution_status?.toUpperCase();
    if (execution === "REVERTED") {
      return {
        finalized: true,
        status: "reverted",
        revertReason: scrubRevertReason(receipt.revert_reason),
      };
    }

    if (execution === "SUCCEEDED") {
      return { finalized: true, status: "succeeded", revertReason: null };
    }

    return { finalized: true, status: "unknown", revertReason: null };
  } catch (err) {
    // "Transaction hash not found" means still pending (not finalized).
    if (err instanceof StarknetRpcError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("hash")) {
        return { finalized: false };
      }
    }
    // For any other error, report as unknown (don't crash the poller).
    return { finalized: true, status: "unknown", revertReason: null };
  }
}
