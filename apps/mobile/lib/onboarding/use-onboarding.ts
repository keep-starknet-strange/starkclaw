/**
 * use-onboarding — React hook for the onboarding flow.
 *
 * Manages step progression, network selection with mainnet warnings,
 * and progress tracking. Persists state so users can resume after
 * closing the app.
 */

import * as React from "react";

import type { StarknetNetworkId } from "../starknet/networks";

import {
  type OnboardingState,
  type OnboardingStep,
  loadOnboardingState,
  saveOnboardingState,
  resetOnboardingState,
  advanceStep,
  stepProgress,
  mainnetConfirmation,
} from "./onboarding-flow";

export type UseOnboardingResult = {
  /** Current onboarding state (null while loading). */
  state: OnboardingState | null;
  /** 0-1 progress through the flow. */
  progress: number;
  /** Whether onboarding is complete. */
  complete: boolean;
  /** Loading state. */
  loading: boolean;

  /** Select network (with mainnet warnings). */
  selectNetwork: (networkId: StarknetNetworkId) => Promise<{
    confirmed: boolean;
    warnings: string[];
  }>;

  /** Mark the current step as done and advance. */
  completeStep: (patch?: Partial<OnboardingState>) => Promise<void>;

  /** Reset onboarding (start over). */
  reset: () => Promise<void>;
};

export function useOnboarding(): UseOnboardingResult {
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadOnboardingState().then((s) => {
      setState(s);
      setLoading(false);
    });
  }, []);

  const selectNetwork = React.useCallback(
    async (
      networkId: StarknetNetworkId,
    ): Promise<{ confirmed: boolean; warnings: string[] }> => {
      const conf = mainnetConfirmation(networkId);

      if (!state) return { confirmed: false, warnings: [] };

      const next: OnboardingState = {
        ...state,
        networkId,
        currentStep: "create_wallet",
      };
      await saveOnboardingState(next);
      setState(next);

      return {
        confirmed: true,
        warnings: conf.warnings,
      };
    },
    [state],
  );

  const completeStep = React.useCallback(
    async (patch?: Partial<OnboardingState>) => {
      if (!state) return;

      let next = { ...state, ...patch };
      next = advanceStep(next);

      if (next.currentStep === "complete") {
        next.completedAt = Math.floor(Date.now() / 1000);
      }

      await saveOnboardingState(next);
      setState(next);
    },
    [state],
  );

  const reset = React.useCallback(async () => {
    await resetOnboardingState();
    const fresh = await loadOnboardingState();
    setState(fresh);
  }, []);

  return {
    state,
    progress: state ? stepProgress(state.currentStep) : 0,
    complete: state?.currentStep === "complete",
    loading,
    selectNetwork,
    completeStep,
    reset,
  };
}
