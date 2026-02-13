/**
 * useTransfer — React hook for the live transfer lifecycle.
 *
 * Phases: idle → preparing → preview → executing → done | denied
 */

import * as React from "react";

import {
  prepareTransferFromText,
  executeTransfer,
  type TransferAction,
} from "./transfer";
import {
  classifyRevertReason,
  type TransferGuidance,
} from "./transfer-errors";
import { appendActivity } from "../activity/activity";
import type { WalletSnapshot } from "../wallet/wallet";

export type TransferPhase = "idle" | "preparing" | "preview" | "executing" | "done" | "denied";

type TransferResult = {
  phase: TransferPhase;
  action: TransferAction | null;
  txHash: string | null;
  guidance: TransferGuidance | null;
  error: string | null;
  prepare: (text: string) => Promise<void>;
  execute: () => Promise<void>;
  reset: () => void;
};

export function useTransfer(wallet: WalletSnapshot | null): TransferResult {
  const [phase, setPhase] = React.useState<TransferPhase>("idle");
  const [action, setAction] = React.useState<TransferAction | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [guidance, setGuidance] = React.useState<TransferGuidance | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setAction(null);
    setTxHash(null);
    setGuidance(null);
    setError(null);
  }, []);

  const prepare = React.useCallback(
    async (text: string) => {
      if (!wallet) return;
      setPhase("preparing");
      setError(null);
      setGuidance(null);

      try {
        const prepared = await prepareTransferFromText({ wallet, text });
        setAction(prepared);
        setPhase("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to prepare transfer.");
        setPhase("idle");
      }
    },
    [wallet],
  );

  const execute = React.useCallback(async () => {
    if (!wallet || !action) return;
    setPhase("executing");
    setError(null);

    try {
      const result = await executeTransfer({ wallet, action });
      setTxHash(result.txHash);

      await appendActivity({
        networkId: wallet.networkId,
        kind: "transfer",
        summary: `Transfer ${action.amount} ${action.tokenSymbol} to ${action.to.slice(0, 10)}…`,
        txHash: result.txHash,
        status: result.executionStatus?.toUpperCase() === "REVERTED" ? "reverted" : "pending",
        executionStatus: result.executionStatus,
        revertReason: result.revertReason,
      });

      const g = classifyRevertReason(result.revertReason, result.executionStatus);
      if (g) {
        setGuidance(g);
        setPhase("denied");
      } else {
        setPhase("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer execution failed.");
      setPhase("preview"); // Allow retry from preview.
    }
  }, [wallet, action]);

  return { phase, action, txHash, guidance, error, prepare, execute, reset };
}
