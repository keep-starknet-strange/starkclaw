/**
 * Live backend — stubbed implementation providing the same AppState shape.
 *
 * Each action logs a warning and returns gracefully. Follow-up PRs will wire
 * real implementations from lib/wallet, lib/policy, lib/agent, lib/starknet.
 */

import * as React from "react";

import { createInitialDemoState } from "@/lib/demo/demo-state";
import { secureGet, secureSet } from "@/lib/storage/secure-store";

import type { AppActions, AppState, BootStatus } from "./types";

const STORAGE_KEY = "starkclaw.live_state.v1";

function stub(name: string) {
  // eslint-disable-next-line no-console
  console.warn(`[live] ${name} is not yet implemented.`);
}

function safeParse(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as any).version !== 1) return null;
    return parsed as AppState;
  } catch {
    return null;
  }
}

/**
 * Creates a fresh live state. Uses the same shape as DemoState but with
 * empty / uninitialized values to make it obvious we're in live mode.
 */
function createInitialLiveState(): AppState {
  return {
    ...createInitialDemoState(),
    account: {
      network: "Starknet",
      environment: "sepolia",
      address: "0x0000000000000000000000000000000000000000000000000000000000000000",
      status: "not-created",
    },
    portfolio: {
      balances: [
        { symbol: "ETH", name: "Ether", amount: 0, usdPrice: 0, change24hPct: 0 },
        { symbol: "USDC", name: "USD Coin", amount: 0, usdPrice: 0, change24hPct: 0 },
        { symbol: "STRK", name: "Starknet", amount: 0, usdPrice: 0, change24hPct: 0 },
      ],
    },
    alerts: [],
    activity: [],
    agent: {
      autopilotEnabled: false,
      quietHoursEnabled: false,
      messages: [
        {
          id: `m_live_${Date.now()}`,
          createdAt: Math.floor(Date.now() / 1000),
          role: "assistant",
          text: "Live mode is under construction. Core actions will be wired in upcoming PRs.",
        },
      ],
      proposals: [],
    },
  };
}

export function useLiveBackend(): {
  bootStatus: BootStatus;
  state: AppState;
  actions: AppActions;
} {
  const [bootStatus, setBootStatus] = React.useState<BootStatus>("booting");
  const [state, setState] = React.useState<AppState>(createInitialLiveState);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await secureGet(STORAGE_KEY);
      const parsed = safeParse(raw);
      if (cancelled) return;
      if (parsed) setState(parsed);
      setBootStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (bootStatus !== "ready") return;
    secureSet(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [bootStatus, state]);

  const actions = React.useMemo<AppActions>(
    () => ({
      reset: () => setState(createInitialLiveState()),
      setOnboardingProfile: (displayName, riskMode) => {
        setState((s) => ({
          ...s,
          onboarding: { ...s.onboarding, displayName, riskMode },
        }));
      },
      completeOnboarding: (input) => {
        stub("completeOnboarding");
        setState((s) => ({
          ...s,
          onboarding: {
            completed: true,
            displayName: input.displayName.trim(),
            riskMode: input.riskMode,
          },
          policy: {
            ...s.policy,
            dailySpendCapUsd: input.dailySpendCapUsd,
            perTxCapUsd: input.perTxCapUsd,
          },
        }));
      },
      setAlertPref: (key, enabled) => {
        setState((s) => ({ ...s, alertPrefs: { ...s.alertPrefs, [key]: enabled } }));
      },
      markAllAlertsRead: () => {
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) => ({ ...a, read: true })),
        }));
      },
      triggerAlert: (title, body, severity = "info") => {
        const t = Math.floor(Date.now() / 1000);
        setState((s) => ({
          ...s,
          alerts: [
            { id: `al_${Date.now()}`, createdAt: t, title, body, severity, read: false },
            ...s.alerts,
          ],
        }));
      },
      setEmergencyLockdown: (enabled) => {
        stub("setEmergencyLockdown");
        setState((s) => ({
          ...s,
          policy: { ...s.policy, emergencyLockdown: enabled },
        }));
      },
      updateSpendCaps: (dailyUsd, perTxUsd) => {
        stub("updateSpendCaps");
        setState((s) => ({
          ...s,
          policy: { ...s.policy, dailySpendCapUsd: dailyUsd, perTxCapUsd: perTxUsd },
        }));
      },
      setContractMode: (mode) => {
        stub("setContractMode");
        setState((s) => ({
          ...s,
          policy: { ...s.policy, contractAllowlistMode: mode },
        }));
      },
      addAllowlistedRecipient: (recipientShort) => {
        stub("addAllowlistedRecipient");
        setState((s) => {
          const next = recipientShort.trim();
          if (!next || s.policy.allowlistedRecipients.includes(next)) return s;
          return {
            ...s,
            policy: {
              ...s.policy,
              allowlistedRecipients: [next, ...s.policy.allowlistedRecipients].slice(0, 8),
            },
          };
        });
      },
      removeAllowlistedRecipient: (recipientShort) => {
        stub("removeAllowlistedRecipient");
        setState((s) => ({
          ...s,
          policy: {
            ...s.policy,
            allowlistedRecipients: s.policy.allowlistedRecipients.filter((x) => x !== recipientShort),
          },
        }));
      },
      simulateTrade: () => {
        stub("simulateTrade");
      },
      sendAgentMessage: (text) => {
        stub("sendAgentMessage");
        const trimmed = text.trim();
        if (!trimmed) return;
        const t = Math.floor(Date.now() / 1000);
        setState((s) => ({
          ...s,
          agent: {
            ...s.agent,
            messages: [
              ...s.agent.messages,
              { id: `m_${Date.now()}`, createdAt: t, role: "user" as const, text: trimmed },
              {
                id: `m_${Date.now() + 1}`,
                createdAt: t + 1,
                role: "assistant" as const,
                text: "Live agent runtime is not yet connected. This will be wired in a follow-up PR.",
              },
            ],
          },
        }));
      },
      approveProposal: (proposalId) => {
        stub("approveProposal");
        setState((s) => ({
          ...s,
          agent: {
            ...s.agent,
            proposals: s.agent.proposals.map((p) =>
              p.id === proposalId ? { ...p, status: "approved" as const } : p
            ),
          },
        }));
      },
      rejectProposal: (proposalId) => {
        stub("rejectProposal");
        setState((s) => ({
          ...s,
          agent: {
            ...s.agent,
            proposals: s.agent.proposals.map((p) =>
              p.id === proposalId ? { ...p, status: "rejected" as const } : p
            ),
          },
        }));
      },
      setAutopilotEnabled: (enabled) => {
        setState((s) => ({ ...s, agent: { ...s.agent, autopilotEnabled: enabled } }));
      },
      setQuietHoursEnabled: (enabled) => {
        setState((s) => ({ ...s, agent: { ...s.agent, quietHoursEnabled: enabled } }));
      },
    }),
    []
  );

  return { bootStatus, state, actions };
}
