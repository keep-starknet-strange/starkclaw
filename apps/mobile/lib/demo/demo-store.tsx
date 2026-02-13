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

type TokenSymbol = TradeDraft["from"];

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$—";
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortenHex(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (s.length <= 18) return s;
  if (!s.startsWith("0x")) return s.slice(0, 16) + "…";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

function extractFirstNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function findTokenSymbols(text: string): TokenSymbol[] {
  const upper = text.toUpperCase();
  const out: TokenSymbol[] = [];
  (["ETH", "USDC", "STRK"] as const).forEach((sym) => {
    if (upper.includes(sym)) out.push(sym);
  });
  return out;
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

          const lower = trimmed.toLowerCase();
          const inLockdown = s.policy.emergencyLockdown;
          const priceOf = (sym: TokenSymbol) =>
            s.portfolio.balances.find((b) => b.symbol === sym)?.usdPrice ?? 0;

          let assistantText =
            "Try: “swap 50 STRK to USDC”, “set caps to $200/day and $60/tx”, “allowlist 0x…”, or “enable emergency lockdown”.";
          let proposal: DemoProposal | null = null;

          const mkCapsProposal = (dailyUsd: number, perTxUsd: number, note: string): DemoProposal => {
            const nextDaily = clamp(dailyUsd, 10, 25_000);
            const nextPerTx = clamp(perTxUsd, 5, 10_000);
            return {
              id: id("p"),
              createdAt: t,
              kind: "policy",
              title: "Update spend caps",
              summary: `${formatUsd(nextDaily)}/day and ${formatUsd(nextPerTx)}/tx.`,
              status: "pending",
              risk: "low",
              details: {
                "Daily cap": formatUsd(nextDaily),
                "Per-tx cap": formatUsd(nextPerTx),
                Notes: note,
                Policy: "Applies immediately (mocked)",
              },
              effect: { type: "policy_caps", dailySpendCapUsd: nextDaily, perTxCapUsd: nextPerTx },
            };
          };

          const mkLockdownProposal = (enabled: boolean): DemoProposal => ({
            id: id("p"),
            createdAt: t,
            kind: "policy",
            title: enabled ? "Enable emergency lockdown" : "Disable emergency lockdown",
            summary: enabled ? "Block all agent actions until you turn it off." : "Allow actions to proceed within policy.",
            status: "pending",
            risk: "low",
            details: {
              Mode: enabled ? "Locked" : "Unlocked",
              Scope: enabled ? "Block all actions" : "Policy-first",
              Notes: enabled ? "Best for suspected compromise." : "Restore normal operation.",
            },
            effect: { type: "policy_lockdown", enabled },
          });

          const mkAllowlistProposal = (recipientRaw: string): DemoProposal => {
            const short = shortenHex(recipientRaw);
            return {
              id: id("p"),
              createdAt: t,
              kind: "policy",
              title: "Allowlist recipient",
              summary: `Add ${short} to your approved recipients.`,
              status: "pending",
              risk: "low",
              details: {
                Recipient: short,
                Scope: "Transfers",
                Notes: "Allowlisting reduces transfer risk.",
              },
              effect: { type: "allowlist_recipient", recipient: short },
            };
          };

          const mkAgentToggleProposal = (
            which: "autopilot" | "quiet_hours",
            enabled: boolean
          ): DemoProposal => ({
            id: id("p"),
            createdAt: t,
            kind: "policy",
            title:
              which === "autopilot"
                ? enabled
                  ? "Enable autopilot"
                  : "Disable autopilot"
                : enabled
                  ? "Enable quiet hours"
                  : "Disable quiet hours",
            summary:
              which === "autopilot"
                ? enabled
                  ? "Auto-execute low-risk actions within policy."
                  : "Require approval for every proposal."
                : enabled
                  ? "Suppress non-critical alerts outside focus time."
                  : "Show all alerts immediately.",
            status: "pending",
            risk: "low",
            details:
              which === "autopilot"
                ? {
                    Autopilot: enabled ? "On" : "Off",
                    Notes: enabled ? "Best when caps + alerts are tuned." : "Best while you calibrate policies.",
                  }
                : {
                    "Quiet hours": enabled ? "On" : "Off",
                    Notes: enabled ? "Calmer notifications." : "More immediate signal.",
                  },
            effect:
              which === "autopilot"
                ? { type: "agent_autopilot", enabled }
                : { type: "agent_quiet_hours", enabled },
          });

          const mkTradeProposal = (trade: {
            from: TokenSymbol;
            to: TokenSymbol;
            amount: number;
            maxSlippagePct: number;
          }): DemoProposal => {
            const fromUsd = trade.amount * priceOf(trade.from);
            const feeUsd = fromUsd * 0.0025;
            const recvUsd = Math.max(0, fromUsd - feeUsd);
            const recvAmount = priceOf(trade.to) > 0 ? recvUsd / priceOf(trade.to) : 0;

            const risk: DemoProposal["risk"] =
              fromUsd > s.policy.perTxCapUsd * 0.9 ? "high" : fromUsd > s.policy.perTxCapUsd * 0.6 ? "medium" : "low";

            return {
              id: id("p"),
              createdAt: t,
              kind: "trade",
              title: `Swap ${trade.from} → ${trade.to}`,
              summary: `${trade.amount.toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })} ${trade.from} for ~${recvAmount.toLocaleString(undefined, {
                maximumFractionDigits: trade.to === "USDC" ? 2 : 4,
              })} ${trade.to}.`,
              status: "pending",
              risk,
              details: {
                Route: `${trade.from} → ${trade.to} (best-price)`,
                Slippage: `${trade.maxSlippagePct.toFixed(2)}% max`,
                Fee: formatUsd(feeUsd),
                "Policy check": fromUsd <= s.policy.perTxCapUsd ? "Allowed" : "Exceeds per-tx cap",
              },
              effect: {
                type: "trade",
                from: trade.from,
                to: trade.to,
                amount: trade.amount,
                maxSlippagePct: trade.maxSlippagePct,
              },
            };
          };

          const mkTransferProposal = (input: {
            tokenSymbol: TokenSymbol;
            amount: number;
            to: string;
          }): DemoProposal => {
            const shortTo = shortenHex(input.to);
            const usd = input.amount * priceOf(input.tokenSymbol);
            const allowlisted = s.policy.allowlistedRecipients.includes(shortTo);
            const risk: DemoProposal["risk"] = allowlisted ? "low" : "high";

            return {
              id: id("p"),
              createdAt: t,
              kind: "transfer",
              title: `Transfer ${input.tokenSymbol}`,
              summary: `Send ${input.amount.toLocaleString(undefined, {
                maximumFractionDigits: input.tokenSymbol === "USDC" ? 2 : 6,
              })} ${input.tokenSymbol} to ${shortTo}.`,
              status: "pending",
              risk,
              details: {
                To: shortTo,
                Amount: `${input.amount} ${input.tokenSymbol}`,
                Value: usd > 0 ? formatUsd(usd) : "—",
                Policy: usd <= s.policy.perTxCapUsd ? "Within per-tx cap" : "Exceeds per-tx cap",
                Safety: allowlisted ? "Allowlisted recipient" : "Recipient not allowlisted",
              },
              effect: { type: "transfer", to: shortTo, tokenSymbol: input.tokenSymbol, amount: input.amount },
            };
          };

          if (lower === "help" || lower === "?" || lower.includes("what can you do")) {
            assistantText =
              "I can draft proposals for: trades, spend caps, recipient allowlists, emergency lockdown, autopilot, and quiet hours.\n\nExamples:\n- swap 50 STRK to USDC\n- set caps to $200/day and $60/tx\n- allowlist 0xabc…\n- enable emergency lockdown";
          } else if (lower.includes("lockdown") || lower.includes("emergency") || lower.includes("freeze")) {
            const wantsOff = lower.includes("disable") || lower.includes("off") || lower.includes("unlock");
            const wantsOn = lower.includes("enable") || lower.includes("on") || lower.includes("lock");
            const enabled = wantsOn ? true : wantsOff ? false : !s.policy.emergencyLockdown;
            assistantText = enabled
              ? "I can enable emergency lockdown. Approve to block all agent actions."
              : "I can disable emergency lockdown. Approve to restore normal operation within policy.";
            proposal = mkLockdownProposal(enabled);
          } else if (lower.includes("autopilot")) {
            const wantsOff = lower.includes("disable") || lower.includes("off");
            const wantsOn = lower.includes("enable") || lower.includes("on");
            const enabled = wantsOn ? true : wantsOff ? false : !s.agent.autopilotEnabled;
            assistantText = enabled
              ? "I can enable autopilot for low-risk actions. Approve to apply."
              : "I can disable autopilot so every action requires approval. Approve to apply.";
            proposal = mkAgentToggleProposal("autopilot", enabled);
          } else if (lower.includes("quiet hour") || lower.includes("quiet-hours") || lower.includes("quiet hours")) {
            const wantsOff = lower.includes("disable") || lower.includes("off");
            const wantsOn = lower.includes("enable") || lower.includes("on");
            const enabled = wantsOn ? true : wantsOff ? false : !s.agent.quietHoursEnabled;
            assistantText = enabled
              ? "I can enable quiet hours to suppress non-critical alerts. Approve to apply."
              : "I can disable quiet hours to show all alerts immediately. Approve to apply.";
            proposal = mkAgentToggleProposal("quiet_hours", enabled);
          } else if (lower.includes("allowlist") || lower.includes("whitelist")) {
            const m = trimmed.match(/(?:allowlist|whitelist)\s+(.+)$/i);
            const recipient = m?.[1]?.trim();
            if (!recipient) {
              assistantText = "Tell me which address to allowlist. Example: “allowlist 0xabc…”.";
            } else {
              assistantText = `I can allowlist ${shortenHex(recipient)}. Approve to apply.`;
              proposal = mkAllowlistProposal(recipient);
            }
          } else if (lower.includes("cap") || lower.includes("limit") || lower.includes("budget")) {
            const dailyMatch = trimmed.match(/\$?(\d+(?:\.\d+)?)\s*(?:\/\s*day|per day|daily)/i);
            const perTxMatch = trimmed.match(/\$?(\d+(?:\.\d+)?)\s*(?:\/\s*tx|per tx|per transaction|each tx|per-?tx)/i);
            const daily = dailyMatch ? Number(dailyMatch[1]) : null;
            const perTx = perTxMatch ? Number(perTxMatch[1]) : null;

            const wantsTighten = lower.includes("tighten") || lower.includes("reduce") || lower.includes("lower");
            const wantsRaise = lower.includes("raise") || lower.includes("increase") || lower.includes("loosen");

            if (daily || perTx) {
              const nextDaily = daily ?? s.policy.dailySpendCapUsd;
              const nextPerTx = perTx ?? s.policy.perTxCapUsd;
              assistantText = `I drafted updated caps: ${formatUsd(nextDaily)}/day and ${formatUsd(nextPerTx)}/tx. Approve to apply.`;
              proposal = mkCapsProposal(nextDaily, nextPerTx, "Requested via chat (mocked)");
            } else if (wantsTighten) {
              const nextDaily = Math.max(50, Math.round(s.policy.dailySpendCapUsd * 0.7));
              const nextPerTx = Math.max(10, Math.round(s.policy.perTxCapUsd * 0.7));
              assistantText = `I can tighten your caps to ${formatUsd(nextDaily)}/day and ${formatUsd(nextPerTx)}/tx. Approve to apply.`;
              proposal = mkCapsProposal(nextDaily, nextPerTx, "Tighten caps");
            } else if (wantsRaise) {
              const nextDaily = Math.min(25_000, Math.round(s.policy.dailySpendCapUsd * 1.5));
              const nextPerTx = Math.min(10_000, Math.round(s.policy.perTxCapUsd * 1.5));
              assistantText = `I can raise your caps to ${formatUsd(nextDaily)}/day and ${formatUsd(nextPerTx)}/tx. Approve to apply.`;
              proposal = mkCapsProposal(nextDaily, nextPerTx, "Raise caps");
            } else {
              assistantText = "Tell me the caps you want. Example: “set caps to $200/day and $60/tx”.";
            }
          } else if (lower.includes("send") || lower.includes("transfer") || lower.includes("pay")) {
            const m = trimmed.match(
              /\b(?:send|transfer|pay)\s+(\d+(?:\.\d+)?)\s*(ETH|USDC|STRK)\s+to\s+([^\s]+)/i
            );
            const amount = m ? Number(m[1]) : extractFirstNumber(trimmed);
            const sym = m ? (m[2].toUpperCase() as TokenSymbol) : findTokenSymbols(trimmed)[0];
            const to = m ? m[3] : null;

            if (!amount || !sym || !to) {
              assistantText = "Example: “send 40 USDC to 0xabc…”.";
            } else if (inLockdown) {
              assistantText = "Emergency lockdown is enabled. Approve to disable it first.";
              proposal = mkLockdownProposal(false);
            } else {
              const usd = amount * priceOf(sym);
              const shortTo = shortenHex(to);
              const allowlisted = s.policy.allowlistedRecipients.includes(shortTo);
              if (!allowlisted) {
                assistantText = `That recipient isn’t allowlisted. Approve to allowlist ${shortTo} first.`;
                proposal = mkAllowlistProposal(to);
              } else if (usd > s.policy.perTxCapUsd) {
                assistantText = `That exceeds your per-tx cap (${formatUsd(s.policy.perTxCapUsd)}). Approve to raise it for this transfer.`;
                const nextPerTx = Math.min(10_000, Math.ceil(usd * 1.1));
                const nextDaily = Math.max(s.policy.dailySpendCapUsd, nextPerTx * 2);
                proposal = mkCapsProposal(nextDaily, nextPerTx, "Raise cap to allow transfer");
              } else {
                assistantText = "I drafted a transfer. Approve to simulate execution.";
                proposal = mkTransferProposal({ tokenSymbol: sym, amount, to });
              }
            }
          } else if (
            lower.includes("swap") ||
            lower.includes("trade") ||
            lower.includes("rebalance") ||
            lower.includes("sell") ||
            lower.includes("buy")
          ) {
            const explicit = trimmed.match(
              /\b(?:swap|trade|sell|buy)\s+(\d+(?:\.\d+)?)\s*(ETH|USDC|STRK)\s+(?:to|for)\s*(ETH|USDC|STRK)\b/i
            );
            const slippageMatch = trimmed.match(/slippage\s*(?:<|<=|max)?\s*(\d+(?:\.\d+)?)\s*%/i);
            const maxSlippage = slippageMatch ? clamp(Number(slippageMatch[1]), 0.1, 5) : 0.6;

            const trade = explicit
              ? {
                  amount: clamp(Number(explicit[1]), 0, 1_000_000),
                  from: explicit[2].toUpperCase() as TokenSymbol,
                  to: explicit[3].toUpperCase() as TokenSymbol,
                  maxSlippagePct: maxSlippage,
                }
              : {
                  amount: clamp(extractFirstNumber(trimmed) ?? 80, 0, 1_000_000),
                  from: findTokenSymbols(trimmed)[0] ?? "STRK",
                  to: findTokenSymbols(trimmed)[1] ?? "USDC",
                  maxSlippagePct: maxSlippage,
                };

            if (!trade.amount || trade.from === trade.to) {
              assistantText = "Example: “swap 50 STRK to USDC”.";
            } else if (inLockdown) {
              assistantText = "Emergency lockdown is enabled. Approve to disable it first.";
              proposal = mkLockdownProposal(false);
            } else {
              const fromUsd = trade.amount * priceOf(trade.from);
              if (fromUsd > s.policy.perTxCapUsd) {
                assistantText = `That trade exceeds your per-tx cap (${formatUsd(s.policy.perTxCapUsd)}). Approve to raise caps or reduce the amount.`;
                const nextPerTx = Math.min(10_000, Math.ceil(fromUsd * 1.1));
                const nextDaily = Math.max(s.policy.dailySpendCapUsd, nextPerTx * 2);
                proposal = mkCapsProposal(nextDaily, nextPerTx, "Raise cap to allow trade");
              } else {
                assistantText = "Here’s a clean preview. Approve to simulate execution.";
                proposal = mkTradeProposal(trade);
              }
            }
          } else if (inLockdown) {
            assistantText =
              "Emergency lockdown is enabled. I can’t draft actions until it’s disabled. Say: “disable emergency lockdown”.";
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

          let next: DemoState = {
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
          };

          const effect = p.effect;
          if (!effect) return next;

          const addActivity = (item: DemoState["activity"][number]) => {
            next = { ...next, activity: [item, ...next.activity] };
          };

          if (effect.type === "policy_caps") {
            next = {
              ...next,
              policy: {
                ...next.policy,
                dailySpendCapUsd: effect.dailySpendCapUsd,
                perTxCapUsd: effect.perTxCapUsd,
              },
            };
            addActivity({
              id: id("ac"),
              createdAt: t + 1,
              kind: "policy_updated",
              title: "Spend caps updated",
              subtitle: `${formatUsd(effect.dailySpendCapUsd)}/day, ${formatUsd(effect.perTxCapUsd)}/tx`,
              meta: "Policies",
            });
          } else if (effect.type === "policy_lockdown") {
            next = { ...next, policy: { ...next.policy, emergencyLockdown: effect.enabled } };
            addActivity({
              id: id("ac"),
              createdAt: t + 1,
              kind: "policy_updated",
              title: effect.enabled ? "Emergency lockdown enabled" : "Emergency lockdown disabled",
              subtitle: effect.enabled ? "All agent actions will be blocked." : "Actions can proceed within policy.",
              meta: "Policies",
            });
          } else if (effect.type === "allowlist_recipient") {
            if (!next.policy.allowlistedRecipients.includes(effect.recipient)) {
              next = {
                ...next,
                policy: {
                  ...next.policy,
                  allowlistedRecipients: [effect.recipient, ...next.policy.allowlistedRecipients].slice(0, 8),
                },
              };
            }
            addActivity({
              id: id("ac"),
              createdAt: t + 1,
              kind: "policy_updated",
              title: "Recipient allowlisted",
              subtitle: effect.recipient,
              meta: "Policies",
            });
          } else if (effect.type === "agent_autopilot") {
            next = { ...next, agent: { ...next.agent, autopilotEnabled: effect.enabled } };
            addActivity({
              id: id("ac"),
              createdAt: t + 1,
              kind: "policy_updated",
              title: effect.enabled ? "Autopilot enabled" : "Autopilot disabled",
              subtitle: effect.enabled ? "Low-risk actions may execute automatically." : "All actions require approval.",
              meta: "Agent",
            });
          } else if (effect.type === "agent_quiet_hours") {
            next = { ...next, agent: { ...next.agent, quietHoursEnabled: effect.enabled } };
            addActivity({
              id: id("ac"),
              createdAt: t + 1,
              kind: "policy_updated",
              title: effect.enabled ? "Quiet hours enabled" : "Quiet hours disabled",
              subtitle: effect.enabled ? "Non-critical alerts will be suppressed." : "All alerts will show immediately.",
              meta: "Agent",
            });
          } else if (effect.type === "trade") {
            const from = next.portfolio.balances.find((b) => b.symbol === effect.from);
            const to = next.portfolio.balances.find((b) => b.symbol === effect.to);
            if (from && to && effect.amount > 0) {
              const fromUsd = effect.amount * from.usdPrice;
              const feeUsd = fromUsd * 0.0025;
              const recvUsd = Math.max(0, fromUsd - feeUsd);
              const recvAmount = recvUsd / to.usdPrice;
              next = {
                ...next,
                portfolio: {
                  balances: next.portfolio.balances.map((b) => {
                    if (b.symbol === from.symbol) return { ...b, amount: Math.max(0, b.amount - effect.amount) };
                    if (b.symbol === to.symbol) return { ...b, amount: b.amount + recvAmount };
                    return b;
                  }),
                },
              };
              addActivity({
                id: id("ac"),
                createdAt: t + 1,
                kind: "trade_settled",
                title: "Trade settled",
                subtitle: `${effect.amount.toFixed(4)} ${from.symbol} → ${recvAmount.toFixed(2)} ${to.symbol}`,
                meta: "Trade",
              });
            }
          } else if (effect.type === "transfer") {
            const token = next.portfolio.balances.find((b) => b.symbol === effect.tokenSymbol);
            if (token && effect.amount > 0) {
              next = {
                ...next,
                portfolio: {
                  balances: next.portfolio.balances.map((b) => {
                    if (b.symbol !== token.symbol) return b;
                    return { ...b, amount: Math.max(0, b.amount - effect.amount) };
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
