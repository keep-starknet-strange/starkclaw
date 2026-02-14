/**
 * Audit bundle export — produces a JSON snapshot of app state
 * that is safe to share (no secrets, no private keys, no signatures).
 */

import { listActivity, type ActivityItem } from "./activity";
import type { DemoState } from "../demo/demo-state";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AUDIT_SCHEMA_VERSION = 1;
const APP_VERSION = "1.0.0"; // matches app.json

export type AuditBundle = {
  schemaVersion: number;
  appVersion: string;
  exportedAt: number; // unix seconds
  mode: "demo" | "live";

  account: {
    network: string;
    environment: string;
    address: string; // public — safe to include
  };

  policy: {
    dailySpendCapUsd: number;
    perTxCapUsd: number;
    allowlistedRecipients: string[];
    contractAllowlistMode: string;
    emergencyLockdown: boolean;
  };

  messages: Array<{
    createdAt: number;
    role: string;
    text: string;
  }>;

  proposals: Array<{
    createdAt: number;
    kind: string;
    title: string;
    summary: string;
    status: string;
    risk: string;
    details: Record<string, string>;
  }>;

  activity: Array<{
    createdAt: number;
    kind: string;
    title?: string;
    summary?: string;
    txHash?: string;
    status?: string;
    executionStatus?: string | null;
    revertReason?: string | null;
    // Observability correlation (#55)
    mobileActionId?: string;
    signerRequestId?: string | null;
  }>;

  alerts: Array<{
    createdAt: number;
    title: string;
    body: string;
    severity: string;
  }>;
};

// ---------------------------------------------------------------------------
// Demo mode export
// ---------------------------------------------------------------------------

/**
 * Build an audit bundle from demo state.
 * Redaction: strips IDs, read status, and any fields that could
 * leak internal state. No secrets exist in demo mode, but we
 * apply the same discipline for consistency.
 */
export function buildDemoAuditBundle(state: DemoState): AuditBundle {
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    mode: "demo",

    account: {
      network: state.account.network,
      environment: state.account.environment,
      address: state.account.address,
    },

    policy: {
      dailySpendCapUsd: state.policy.dailySpendCapUsd,
      perTxCapUsd: state.policy.perTxCapUsd,
      allowlistedRecipients: [...state.policy.allowlistedRecipients],
      contractAllowlistMode: state.policy.contractAllowlistMode,
      emergencyLockdown: state.policy.emergencyLockdown,
    },

    messages: state.agent.messages.map((m) => ({
      createdAt: m.createdAt,
      role: m.role,
      text: m.text,
    })),

    proposals: state.agent.proposals.map((p) => ({
      createdAt: p.createdAt,
      kind: p.kind,
      title: p.title,
      summary: p.summary,
      status: p.status,
      risk: p.risk,
      details: { ...p.details },
    })),

    activity: state.activity.map((a) => ({
      createdAt: a.createdAt,
      kind: a.kind,
      title: a.title,
      summary: a.subtitle ?? undefined,
    })),

    alerts: state.alerts.map((a) => ({
      createdAt: a.createdAt,
      title: a.title,
      body: a.body,
      severity: a.severity,
    })),
  };
}

// ---------------------------------------------------------------------------
// Live mode export
// ---------------------------------------------------------------------------

/**
 * Build an audit bundle from live on-chain activity.
 * Policy and messages are not available in live mode yet — fields
 * are left as empty/default so the schema stays consistent.
 */
export async function buildLiveAuditBundle(
  networkId: string,
  accountAddress: string
): Promise<AuditBundle> {
  const items: ActivityItem[] = await listActivity();

  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    mode: "live",

    account: {
      network: "Starknet",
      environment: networkId,
      address: accountAddress,
    },

    // Live mode does not yet track policy in exportable form.
    policy: {
      dailySpendCapUsd: 0,
      perTxCapUsd: 0,
      allowlistedRecipients: [],
      contractAllowlistMode: "unknown",
      emergencyLockdown: false,
    },

    messages: [],
    proposals: [],

    activity: items.map((a) => ({
      createdAt: a.createdAt,
      kind: a.kind,
      summary: a.summary,
      txHash: a.txHash,
      status: a.status,
      executionStatus: a.executionStatus,
      revertReason: a.revertReason,
      mobileActionId: a.mobileActionId,
      signerRequestId: a.signerRequestId,
    })),

    alerts: [],
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Serialize a bundle to a formatted JSON string. */
export function serializeAuditBundle(bundle: AuditBundle): string {
  return JSON.stringify(bundle, null, 2);
}
