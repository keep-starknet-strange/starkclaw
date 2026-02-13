import * as React from "react";

import { secureGet, secureSet } from "@/lib/storage/secure-store";

import { createInitialDemoState, type DemoAlertPrefKey, type DemoProposal, type DemoState } from "./demo-state";

const STORAGE_KEY = "starkclaw.demo_state.v1";

type BootStatus = "booting" | "ready";

type CompleteOnboardingInput = {
  displayName: string;
  riskMode: DemoState["onboarding"]["riskMode"];
  dailySpendCapUsd: number;
  perTxCapUsd: number;
};

type TradeDraft = {
  from: "ETH" | "USDC" | "STRK";
  to: "ETH" | "USDC" | "STRK";
  amount: number;
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeParse(raw: string | null): DemoState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const v = (parsed as any).version;
    if (v !== 1) return null;
    return parsed as DemoState;
  } catch {
    return null;
  }
}

type DemoContextValue = {
  bootStatus: BootStatus;
  state: DemoState;
  actions: {
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
};

const DemoContext = React.createContext<DemoContextValue | null>(null);

export function DemoProvider(props: { children: React.ReactNode }) {
  const [bootStatus, setBootStatus] = React.useState<BootStatus>("booting");
  const [state, setState] = React.useState<DemoState>(createInitialDemoState);

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
    secureSet(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Best-effort persistence.
    });
  }, [bootStatus, state]);

  const actions = React.useMemo<DemoContextValue["actions"]>(() => {
    return {
      reset: () => setState(createInitialDemoState()),
      setOnboardingProfile: (displayName, riskMode) =>
        setState((s) => ({
          ...s,
          onboarding: {
            ...s.onboarding,
            displayName,
            riskMode,
          },
        })),
      completeOnboarding: (input) => {
        const displayName = input.displayName.trim();
        setState((s) => {
          const next: DemoState = {
            ...s,
            onboarding: {
              completed: true,
              displayName,
              riskMode: input.riskMode,
            },
            account: {
              ...s.account,
              status: "ready",
            },
            policy: {
              ...s.policy,
              dailySpendCapUsd: clamp(input.dailySpendCapUsd, 10, 25_000),
              perTxCapUsd: clamp(input.perTxCapUsd, 5, 10_000),
            },
          };

          const t = nowSec();
          next.activity = [
            {
              id: id("ac"),
              createdAt: t,
              kind: "onboarding",
              title: "Onboarding complete",
              subtitle: displayName ? `Welcome, ${displayName}` : "Welcome",
              meta: null,
            },
            ...s.activity,
          ];

          return next;
        });
      },
      setAlertPref: (key, enabled) =>
        setState((s) => ({ ...s, alertPrefs: { ...s.alertPrefs, [key]: enabled } })),
      markAllAlertsRead: () =>
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) => ({ ...a, read: true })),
        })),
      triggerAlert: (title, body, severity = "info") =>
        setState((s) => {
          const t = nowSec();
          const alert = {
            id: id("al"),
            createdAt: t,
            title,
            body,
            severity,
            read: false,
          };
          return {
            ...s,
            alerts: [alert, ...s.alerts],
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "alert_triggered",
                title,
                subtitle: body,
                meta: "Inbox",
              },
              ...s.activity,
            ],
          };
        }),
      setEmergencyLockdown: (enabled) =>
        setState((s) => {
          const t = nowSec();
          return {
            ...s,
            policy: { ...s.policy, emergencyLockdown: enabled },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "policy_updated",
                title: enabled ? "Emergency lockdown enabled" : "Emergency lockdown disabled",
                subtitle: enabled ? "All agent actions will be blocked." : "Actions can proceed within policy.",
                meta: "Policies",
              },
              ...s.activity,
            ],
          };
        }),
      updateSpendCaps: (dailyUsd, perTxUsd) =>
        setState((s) => {
          const nextDaily = clamp(dailyUsd, 10, 25_000);
          const nextPerTx = clamp(perTxUsd, 5, 10_000);
          const t = nowSec();
          return {
            ...s,
            policy: { ...s.policy, dailySpendCapUsd: nextDaily, perTxCapUsd: nextPerTx },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "policy_updated",
                title: "Spend caps updated",
                subtitle: `$${nextDaily}/day, $${nextPerTx}/tx`,
                meta: "Policies",
              },
              ...s.activity,
            ],
          };
        }),
      setContractMode: (mode) =>
        setState((s) => {
          const t = nowSec();
          return {
            ...s,
            policy: { ...s.policy, contractAllowlistMode: mode },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "policy_updated",
                title: "Contract trust updated",
                subtitle: mode === "trusted-only" ? "Trusted-only" : mode === "warn" ? "Warn on unknown" : "Open",
                meta: "Policies",
              },
              ...s.activity,
            ],
          };
        }),
      addAllowlistedRecipient: (recipientShort) =>
        setState((s) => {
          const next = recipientShort.trim();
          if (!next) return s;
          if (s.policy.allowlistedRecipients.includes(next)) return s;
          const t = nowSec();
          return {
            ...s,
            policy: { ...s.policy, allowlistedRecipients: [next, ...s.policy.allowlistedRecipients].slice(0, 8) },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "policy_updated",
                title: "Recipient allowlisted",
                subtitle: next,
                meta: "Policies",
              },
              ...s.activity,
            ],
          };
        }),
      removeAllowlistedRecipient: (recipientShort) =>
        setState((s) => {
          const t = nowSec();
          return {
            ...s,
            policy: { ...s.policy, allowlistedRecipients: s.policy.allowlistedRecipients.filter((x) => x !== recipientShort) },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "policy_updated",
                title: "Recipient removed",
                subtitle: recipientShort,
                meta: "Policies",
              },
              ...s.activity,
            ],
          };
        }),
      simulateTrade: (trade) =>
        setState((s) => {
          const t = nowSec();
          const from = s.portfolio.balances.find((b) => b.symbol === trade.from);
          const to = s.portfolio.balances.find((b) => b.symbol === trade.to);
          if (!from || !to || trade.amount <= 0) return s;

          // Extremely simplified quote: 0.25% fee, then convert via usd prices.
          const fromUsd = trade.amount * from.usdPrice;
          const feeUsd = fromUsd * 0.0025;
          const recvUsd = Math.max(0, fromUsd - feeUsd);
          const recvAmount = recvUsd / to.usdPrice;

          const nextBalances = s.portfolio.balances.map((b) => {
            if (b.symbol === from.symbol) return { ...b, amount: Math.max(0, b.amount - trade.amount) };
            if (b.symbol === to.symbol) return { ...b, amount: b.amount + recvAmount };
            return b;
          });

          return {
            ...s,
            portfolio: { balances: nextBalances },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "trade_settled",
                title: "Trade settled",
                subtitle: `${trade.amount.toFixed(4)} ${from.symbol} → ${recvAmount.toFixed(2)} ${to.symbol}`,
                meta: "Trade",
              },
              ...s.activity,
            ],
          };
        }),
      sendAgentMessage: (text) =>
        setState((s) => {
          const trimmed = text.trim();
          if (!trimmed) return s;
          const t = nowSec();
          const userMsg = { id: id("m"), createdAt: t, role: "user" as const, text: trimmed };

          let assistantText = "I can help. Try: “rebalance”, “tighten policies”, or “preview a trade”.";
          let proposal: DemoProposal | null = null;
          const lower = trimmed.toLowerCase();
          if (lower.includes("rebalance") || lower.includes("trade") || lower.includes("swap")) {
            assistantText = "Here’s a safe preview. Approve it to simulate execution.";
            proposal = {
              id: id("p"),
              createdAt: t,
              kind: "trade",
              title: "Preview: STRK → USDC",
              summary: "Swap 80 STRK for ~137 USDC if slippage < 0.5%.",
              status: "pending",
              risk: "low",
              details: {
                Route: "STRK → USDC",
                Slippage: "0.50% max",
                Fees: "~$0.27",
                Policy: "Within spend caps",
              },
            };
          } else if (lower.includes("policy") || lower.includes("limit") || lower.includes("cap")) {
            assistantText = "I can tighten your caps to reduce risk. Approve to apply.";
            proposal = {
              id: id("p"),
              createdAt: t,
              kind: "policy",
              title: "Tighten spend caps",
              summary: "Set caps to $180/day and $50/tx until you expand allowlists.",
              status: "pending",
              risk: "low",
              details: {
                "Daily cap": "$180",
                "Per-tx cap": "$50",
                Duration: "Until changed",
                Notes: "Reduces blast radius",
              },
            };
          } else if (lower.includes("send") || lower.includes("transfer")) {
            assistantText = "I drafted a transfer. Approve to simulate submission.";
            proposal = {
              id: id("p"),
              createdAt: t,
              kind: "transfer",
              title: "Transfer 40 USDC",
              summary: "Send 40 USDC to allowlisted recipient.",
              status: "pending",
              risk: "medium",
              details: {
                To: s.policy.allowlistedRecipients[0] ?? "0x…",
                Amount: "40 USDC",
                Policy: "Within per-tx cap",
                Safety: "Allowlisted recipient",
              },
            };
          }

          const assistantMsg = { id: id("m"), createdAt: t + 1, role: "assistant" as const, text: assistantText };

          return {
            ...s,
            agent: {
              ...s.agent,
              messages: [...s.agent.messages, userMsg, assistantMsg],
              proposals: proposal ? [proposal, ...s.agent.proposals] : s.agent.proposals,
            },
            activity: [
              proposal
                ? {
                    id: id("ac"),
                    createdAt: t,
                    kind: "agent_proposed",
                    title: "Agent proposed an action",
                    subtitle: proposal.title,
                    meta: "Agent",
                  }
                : null,
              ...s.activity,
            ].filter(Boolean) as DemoState["activity"],
          };
        }),
      approveProposal: (proposalId) =>
        setState((s) => {
          const p = s.agent.proposals.find((x) => x.id === proposalId);
          if (!p || p.status !== "pending") return s;
          const t = nowSec();

          let next = {
            ...s,
            agent: {
              ...s.agent,
              proposals: s.agent.proposals.map((x) => (x.id === proposalId ? { ...x, status: "approved" } : x)),
            },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "agent_executed",
                title: "Agent action approved",
                subtitle: p.title,
                meta: "Agent",
              },
              ...s.activity,
            ],
          } satisfies DemoState;

          if (p.kind === "policy") {
            next = {
              ...next,
              policy: { ...next.policy, dailySpendCapUsd: 180, perTxCapUsd: 50 },
            };
          }

          if (p.kind === "trade") {
            // Simulate a small rebalance.
            const trade: TradeDraft = { from: "STRK", to: "USDC", amount: 80 };
            const from = next.portfolio.balances.find((b) => b.symbol === trade.from);
            const to = next.portfolio.balances.find((b) => b.symbol === trade.to);
            if (from && to) {
              const fromUsd = trade.amount * from.usdPrice;
              const feeUsd = fromUsd * 0.0025;
              const recvUsd = Math.max(0, fromUsd - feeUsd);
              const recvAmount = recvUsd / to.usdPrice;
              next = {
                ...next,
                portfolio: {
                  balances: next.portfolio.balances.map((b) => {
                    if (b.symbol === from.symbol) return { ...b, amount: Math.max(0, b.amount - trade.amount) };
                    if (b.symbol === to.symbol) return { ...b, amount: b.amount + recvAmount };
                    return b;
                  }),
                },
              };
            }
          }

          return next;
        }),
      rejectProposal: (proposalId) =>
        setState((s) => {
          const p = s.agent.proposals.find((x) => x.id === proposalId);
          if (!p || p.status !== "pending") return s;
          const t = nowSec();
          return {
            ...s,
            agent: {
              ...s.agent,
              proposals: s.agent.proposals.map((x) => (x.id === proposalId ? { ...x, status: "rejected" } : x)),
            },
            activity: [
              {
                id: id("ac"),
                createdAt: t,
                kind: "agent_executed",
                title: "Agent action rejected",
                subtitle: p.title,
                meta: "Agent",
              },
              ...s.activity,
            ],
          };
        }),
      setAutopilotEnabled: (enabled) =>
        setState((s) => ({
          ...s,
          agent: { ...s.agent, autopilotEnabled: enabled },
        })),
      setQuietHoursEnabled: (enabled) =>
        setState((s) => ({
          ...s,
          agent: { ...s.agent, quietHoursEnabled: enabled },
        })),
    };
  }, []);

  const value = React.useMemo<DemoContextValue>(
    () => ({
      bootStatus,
      state,
      actions,
    }),
    [bootStatus, state, actions]
  );

  return <DemoContext.Provider value={value}>{props.children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = React.useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within <DemoProvider />");
  return ctx;
}
