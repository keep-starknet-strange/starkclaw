/**
 * onboarding-flow — Step-based onboarding state machine.
 *
 * Guides the user through: network selection → wallet creation →
 * funding → deploy → first session key → first action. Each step
 * is policy-first with clear progress tracking.
 */

import { secureGet, secureSet } from "../storage/secure-store";
import type { StarknetNetworkId } from "../starknet/networks";

const ONBOARDING_STATE_ID = "starkclaw.onboarding.v2";

// ── Steps ───────────────────────────────────────────────────────────

export type OnboardingStep =
  | "network"       // Choose sepolia (default) or mainnet (opt-in, warned)
  | "create_wallet" // Generate keypair + compute address
  | "fund"          // Deposit ETH/STRK to the computed address
  | "deploy"        // Deploy AgentAccount on-chain
  | "session_key"   // Create + register first session key
  | "first_action"  // Execute a constrained test action
  | "complete";     // Onboarding done

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "network",
  "create_wallet",
  "fund",
  "deploy",
  "session_key",
  "first_action",
  "complete",
];

export type OnboardingState = {
  currentStep: OnboardingStep;
  networkId: StarknetNetworkId | null;
  walletCreated: boolean;
  funded: boolean;
  deployed: boolean;
  sessionKeyCreated: boolean;
  firstActionDone: boolean;
  startedAt: number; // unix seconds
  completedAt: number | null;
};

function defaultState(): OnboardingState {
  return {
    currentStep: "network",
    networkId: null,
    walletCreated: false,
    funded: false,
    deployed: false,
    sessionKeyCreated: false,
    firstActionDone: false,
    startedAt: Math.floor(Date.now() / 1000),
    completedAt: null,
  };
}

// ── Persistence ─────────────────────────────────────────────────────

export async function loadOnboardingState(): Promise<OnboardingState> {
  const raw = await secureGet(ONBOARDING_STATE_ID);
  if (!raw) return defaultState();
  try {
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return defaultState();
  }
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await secureSet(ONBOARDING_STATE_ID, JSON.stringify(state));
}

export async function resetOnboardingState(): Promise<void> {
  await saveOnboardingState(defaultState());
}

// ── Step advancement ────────────────────────────────────────────────

export function advanceStep(state: OnboardingState): OnboardingState {
  const idx = ONBOARDING_STEPS.indexOf(state.currentStep);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return state;
  return { ...state, currentStep: ONBOARDING_STEPS[idx + 1] };
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function stepProgress(step: OnboardingStep): number {
  const total = ONBOARDING_STEPS.length - 1; // "complete" doesn't count
  const idx = ONBOARDING_STEPS.indexOf(step);
  if (idx < 0 || total === 0) return 0;
  return Math.min(1, idx / total);
}

// ── Mainnet guard ───────────────────────────────────────────────────

export type MainnetConfirmation = {
  required: boolean;
  warnings: string[];
};

export function mainnetConfirmation(networkId: StarknetNetworkId | null): MainnetConfirmation {
  if (networkId !== "mainnet") {
    return { required: false, warnings: [] };
  }

  return {
    required: true,
    warnings: [
      "Mainnet uses real funds. Transactions are irreversible.",
      "Ensure you understand session key policies before proceeding.",
      "Start with small amounts until you are comfortable.",
    ],
  };
}
