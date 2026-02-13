/**
 * Shared app-facing types for demo and live backends.
 *
 * The canonical state shape re-uses the existing DemoState structure so that
 * all screens can switch backends without any UI changes.
 */

import type {
  DemoAlertPrefKey,
  DemoState,
} from "@/lib/demo/demo-state";

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

export type AppMode = "demo" | "live";

// ---------------------------------------------------------------------------
// State — same shape as DemoState so every screen works unchanged.
// ---------------------------------------------------------------------------

export type AppState = DemoState;

// ---------------------------------------------------------------------------
// Actions — matches the demo-store action surface exactly.
// ---------------------------------------------------------------------------

export type CompleteOnboardingInput = {
  displayName: string;
  riskMode: DemoState["onboarding"]["riskMode"];
  dailySpendCapUsd: number;
  perTxCapUsd: number;
};

export type TradeDraft = {
  from: "ETH" | "USDC" | "STRK";
  to: "ETH" | "USDC" | "STRK";
  amount: number;
};

export type AppActions = {
  reset: () => void;
  setOnboardingProfile: (displayName: string, riskMode: DemoState["onboarding"]["riskMode"]) => void;
  completeOnboarding: (input: CompleteOnboardingInput) => void;
  setAlertPref: (key: DemoAlertPrefKey, enabled: boolean) => void;
  markAllAlertsRead: () => void;
  triggerAlert: (title: string, body: string, severity?: DemoState["alerts"][number]["severity"]) => void;
  setEmergencyLockdown: (enabled: boolean) => void;
  updateSpendCaps: (dailyUsd: number, perTxUsd: number) => void;
  setContractMode: (mode: DemoState["policy"]["contractAllowlistMode"]) => void;
  addAllowlistedRecipient: (recipientShort: string) => void;
  removeAllowlistedRecipient: (recipientShort: string) => void;
  simulateTrade: (trade: TradeDraft) => void;
  sendAgentMessage: (text: string) => void;
  approveProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;
  setAutopilotEnabled: (enabled: boolean) => void;
  setQuietHoursEnabled: (enabled: boolean) => void;
};

// ---------------------------------------------------------------------------
// Context value returned by useApp()
// ---------------------------------------------------------------------------

export type BootStatus = "booting" | "ready";

export type AppContextValue = {
  bootStatus: BootStatus;
  state: AppState;
  actions: AppActions;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};
