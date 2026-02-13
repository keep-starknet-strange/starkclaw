/**
 * transfer-errors — maps common on-chain revert reasons to user guidance.
 */

type GuidanceEntry = {
  pattern: RegExp;
  title: string;
  guidance: string;
};

const GUIDANCE_TABLE: GuidanceEntry[] = [
  {
    pattern: /spending.*limit|exceeds.*cap|cap.*exceeded/i,
    title: "Spending cap exceeded",
    guidance: "Reduce the amount or increase your session key spending limit in Policies.",
  },
  {
    pattern: /session.*key.*expired|key.*validity/i,
    title: "Session key expired",
    guidance: "Create a new session key in Policies with a longer validity period.",
  },
  {
    pattern: /session.*key.*not.*found|invalid.*session/i,
    title: "Invalid session key",
    guidance: "The session key is not registered on-chain. Register it in Policies.",
  },
  {
    pattern: /insufficient.*balance|transfer.*amount.*exceeds/i,
    title: "Insufficient balance",
    guidance: "You don't have enough of this token. Reduce the amount.",
  },
  {
    pattern: /lockdown|emergency.*revoke|all.*keys.*revoked/i,
    title: "Emergency lockdown active",
    guidance: "All session keys have been revoked. Disable lockdown and create new keys.",
  },
  {
    pattern: /not.*allowed.*target|target.*not.*in.*allowlist/i,
    title: "Target not allowed",
    guidance: "The recipient or contract is not in the session key's allowed target list.",
  },
  {
    pattern: /nonce/i,
    title: "Nonce conflict",
    guidance: "A concurrent transaction may be pending. Wait a moment and try again.",
  },
  {
    pattern: /fee.*too.*low|insufficient.*fee/i,
    title: "Gas fee too low",
    guidance: "The network is congested. Try again in a moment.",
  },
];

export type TransferGuidance = {
  title: string;
  guidance: string;
  rawReason: string | null;
};

export function classifyRevertReason(
  revertReason: string | null,
  executionStatus: string | null,
): TransferGuidance | null {
  if (
    !executionStatus ||
    executionStatus.toUpperCase() === "SUCCEEDED"
  ) {
    return null;
  }

  if (!revertReason) {
    return {
      title: "Transaction reverted",
      guidance: "The transaction was rejected on-chain. Check your policies and try again.",
      rawReason: null,
    };
  }

  for (const entry of GUIDANCE_TABLE) {
    if (entry.pattern.test(revertReason)) {
      return {
        title: entry.title,
        guidance: entry.guidance,
        rawReason: revertReason,
      };
    }
  }

  return {
    title: "Transaction reverted",
    guidance: "The on-chain execution failed. Review your policies or try a smaller amount.",
    rawReason: revertReason,
  };
}
