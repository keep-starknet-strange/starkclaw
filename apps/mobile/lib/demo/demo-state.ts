export type DemoRiskMode = "calm" | "balanced" | "bold";

export type DemoTokenSymbol = "ETH" | "USDC" | "STRK";

export type DemoBalance = {
  symbol: DemoTokenSymbol;
  name: string;
  amount: number;
  usdPrice: number;
  change24hPct: number; // -100..+100
};

export type DemoPortfolio = {
  balances: DemoBalance[];
};

export type DemoPolicy = {
  dailySpendCapUsd: number;
  perTxCapUsd: number;
  allowlistedRecipients: string[];
  contractAllowlistMode: "trusted-only" | "warn" | "open";
  emergencyLockdown: boolean;
};

export type DemoAlertPrefKey =
  | "spendCap"
  | "blockedAction"
  | "newContract"
  | "priceMove"
  | "agentDigest";

export type DemoAlertSeverity = "info" | "warn" | "danger";

export type DemoAlert = {
  id: string;
  createdAt: number; // unix seconds
  title: string;
  body: string;
  severity: DemoAlertSeverity;
  read: boolean;
};

export type DemoActivityKind =
  | "onboarding"
  | "policy_updated"
  | "trade_submitted"
  | "trade_settled"
  | "agent_proposed"
  | "agent_executed"
  | "alert_triggered";

export type DemoActivityItem = {
  id: string;
  createdAt: number; // unix seconds
  kind: DemoActivityKind;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
};

export type DemoAgentMessage = {
  id: string;
  createdAt: number; // unix seconds
  role: "user" | "assistant";
  text: string;
};

export type DemoProposalKind = "trade" | "policy" | "transfer";

export type DemoProposalEffect =
  | {
      type: "trade";
      from: DemoTokenSymbol;
      to: DemoTokenSymbol;
      amount: number;
      maxSlippagePct: number;
    }
  | {
      type: "policy_caps";
      dailySpendCapUsd: number;
      perTxCapUsd: number;
    }
  | {
      type: "policy_lockdown";
      enabled: boolean;
    }
  | {
      type: "allowlist_recipient";
      recipient: string;
    }
  | {
      type: "agent_autopilot";
      enabled: boolean;
    }
  | {
      type: "agent_quiet_hours";
      enabled: boolean;
    }
  | {
      type: "transfer";
      to: string;
      tokenSymbol: DemoTokenSymbol;
      amount: number;
    };

export type DemoProposal = {
  id: string;
  createdAt: number; // unix seconds
  kind: DemoProposalKind;
  title: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  risk: "low" | "medium" | "high";
  details: Record<string, string>;
  effect?: DemoProposalEffect;
};

export type DemoAccount = {
  network: "Starknet";
  environment: "mainnet" | "sepolia";
  address: string;
  status: "not-created" | "creating" | "ready";
};

export type DemoOnboarding = {
  completed: boolean;
  displayName: string;
  riskMode: DemoRiskMode;
};

export type DemoState = {
  version: 1;
  onboarding: DemoOnboarding;
  account: DemoAccount;
  portfolio: DemoPortfolio;
  policy: DemoPolicy;
  alertPrefs: Record<DemoAlertPrefKey, boolean>;
  alerts: DemoAlert[];
  activity: DemoActivityItem[];
  agent: {
    autopilotEnabled: boolean;
    quietHoursEnabled: boolean;
    messages: DemoAgentMessage[];
    proposals: DemoProposal[];
  };
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function randomHex(len: number): string {
  // Non-crypto RNG is fine: this is a UI-only demo state.
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function shortenHex(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (s.length <= 18) return s;
  if (!s.startsWith("0x")) return s.slice(0, 16) + "…";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

export function makeMockAddress(): string {
  return `0x${randomHex(64)}`;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createInitialDemoState(): DemoState {
  const t = nowSec();
  const address = makeMockAddress();
  const allowlist = [makeMockAddress(), makeMockAddress()].map(shortenHex);

  return {
    version: 1,
    onboarding: {
      completed: false,
      displayName: "",
      riskMode: "calm",
    },
    account: {
      network: "Starknet",
      environment: "mainnet",
      address,
      status: "not-created",
    },
    portfolio: {
      balances: [
        { symbol: "ETH", name: "Ether", amount: 0.82, usdPrice: 3320, change24hPct: 1.8 },
        { symbol: "USDC", name: "USD Coin", amount: 1460.5, usdPrice: 1.0, change24hPct: 0.0 },
        { symbol: "STRK", name: "Starknet", amount: 620, usdPrice: 1.72, change24hPct: -3.1 },
      ],
    },
    policy: {
      dailySpendCapUsd: 250,
      perTxCapUsd: 75,
      allowlistedRecipients: allowlist,
      contractAllowlistMode: "warn",
      emergencyLockdown: false,
    },
    alertPrefs: {
      spendCap: true,
      blockedAction: true,
      newContract: true,
      priceMove: true,
      agentDigest: true,
    },
    alerts: [
      {
        id: id("al"),
        createdAt: t - 60 * 18,
        title: "Policy blocked a spend",
        body: "A transfer was denied because it exceeded your per-transaction cap.",
        severity: "warn",
        read: false,
      },
      {
        id: id("al"),
        createdAt: t - 60 * 55,
        title: "Agent daily digest",
        body: "2 suggestions pending: rebalance + tighten contract allowlist.",
        severity: "info",
        read: true,
      },
    ],
    activity: [
      {
        id: id("ac"),
        createdAt: t - 60 * 70,
        kind: "onboarding",
        title: "Starkclaw installed",
        subtitle: "Demo mode enabled",
        meta: null,
      },
      {
        id: id("ac"),
        createdAt: t - 60 * 54,
        kind: "policy_updated",
        title: "Spend cap set",
        subtitle: "$250/day, $75/tx",
        meta: "Policies",
      },
      {
        id: id("ac"),
        createdAt: t - 60 * 22,
        kind: "agent_proposed",
        title: "Agent suggested a rebalance",
        subtitle: "STRK → USDC (low risk)",
        meta: "Agent",
      },
    ],
    agent: {
      autopilotEnabled: true,
      quietHoursEnabled: true,
      messages: [
        {
          id: id("m"),
          createdAt: t - 60 * 30,
          role: "assistant",
          text:
            "I’m on standby.\n\nI can rebalance into stablecoins, tighten your contract rules, or prep a trade preview.",
        },
      ],
      proposals: [
        {
          id: id("p"),
          createdAt: t - 60 * 22,
          kind: "trade",
          title: "Rebalance: STRK → USDC",
          summary: "Swap 40 STRK for ~69 USDC if slippage < 0.6%.",
          status: "pending",
          risk: "low",
          details: {
            Route: "STRK → USDC (best-price)",
            Slippage: "0.60% max",
            Fees: "~$0.17",
            Policy: "Within per-tx cap",
          },
          effect: {
            type: "trade",
            from: "STRK",
            to: "USDC",
            amount: 40,
            maxSlippagePct: 0.6,
          },
        },
      ],
    },
  };
}
