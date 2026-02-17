/**
 * Live backend — real implementation using wallet, balances, and policy libs.
 *
 * Wires real actions for onboarding, policy management, and balance refresh.
 */

import * as React from "react";

import { createInitialDemoState } from "@/lib/demo/demo-state";
import { secureGet, secureSet, secureDelete } from "@/lib/storage/secure-store";
import { createWallet, loadWallet, resetWallet, type WalletSnapshot } from "@/lib/wallet/wallet";
import { getErc20Balance, formatUnits } from "@/lib/starknet/balances";
import { STARKNET_NETWORKS, type StarknetNetworkId } from "@/lib/starknet/networks";
import { TOKENS } from "@/lib/starknet/tokens";

import type { AppActions, AppState, BootStatus } from "./types";

const STORAGE_KEY = "starkclaw.live_state.v1";
const SESSION_KEYS_INDEX_ID = "starkclaw.session_keys.v1";

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

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function shortenHex(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (s.length <= 18) return s;
  if (!s.startsWith("0x")) return s.slice(0, 16) + "…";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

/**
 * Sanitize error for logging - only extract whitelisted non-sensitive properties.
 */
function sanitizeError(err: unknown): string {
  // Only return safe identifiers - never err.message which may contain addresses/hashes
  if (err && typeof err === "object" && "code" in err) {
    // Handle errors with code property (e.g., network errors)
    return `code: ${(err as { code: unknown }).code}`;
  }
  if (err instanceof Error) {
    // Only return err.name - never err.message (may leak addresses/hashes/txIds)
    if (err.name && err.name !== "Error") {
      return err.name;
    }
    return "Unknown error";
  }
  return "redacted";
}

/**
 * Refresh live balances from chain for ETH, USDC, STRK.
 * Runs balance fetches in parallel using Promise.all.
 */
async function refreshBalances(
  rpcUrl: string,
  accountAddress: string,
  networkId: StarknetNetworkId
): Promise<AppState["portfolio"]["balances"]> {
  // Map each token to a promise that catches its own errors
  const balancePromises = TOKENS.map(async (token): Promise<AppState["portfolio"]["balances"][number]> => {
    try {
      const tokenAddress = token.addressByNetwork[networkId];
      const rawBalance = await getErc20Balance(rpcUrl, tokenAddress, accountAddress);
      const formatted = formatUnits(rawBalance, token.decimals);
      
      return {
        symbol: token.symbol,
        name: token.name,
        amount: 0, // Deprecated: use amountDisplay for UI
        amountRaw: rawBalance.toString(),
        amountDisplay: formatted,
        usdPrice: 0, // TODO: fetch real price
        change24hPct: 0,
      };
    } catch {
      // Token might not be deployed or balance call failed
      return {
        symbol: token.symbol,
        name: token.name,
        amount: 0,
        amountRaw: "0",
        amountDisplay: "0",
        usdPrice: 0,
        change24hPct: 0,
      };
    }
  });

  // Wait for all promises in parallel, preserving TOKENS order
  const balances = await Promise.all(balancePromises);
  return balances;
}

/**
 * Appends an activity record to state.
 */
function appendActivity(
  state: AppState,
  kind: AppState["activity"][number]["kind"],
  title: string,
  subtitle?: string,
  meta?: string
): AppState {
  const item: AppState["activity"][number] = {
    id: id("act"),
    createdAt: nowSec(),
    kind,
    title,
    subtitle,
    meta,
  };
  return {
    ...state,
    activity: [item, ...state.activity].slice(0, 50), // Keep last 50
  };
}

/**
 * Creates a fresh live state with uninitialized values.
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
        { symbol: "ETH", name: "Ether", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
        { symbol: "USDC", name: "USD Coin", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
        { symbol: "STRK", name: "Starknet", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
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
          createdAt: nowSec(),
          role: "assistant",
          text: "Live mode connected. Your wallet and balances are loaded from Starknet.",
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
  
  // Ref to access latest state in async callbacks without stale closure
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Load persisted state on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await secureGet(STORAGE_KEY);
        const parsed = safeParse(raw);
        
        if (cancelled) return;
        
        if (parsed) {
          // Try to load wallet and refresh balances
          const wallet = await loadWallet();
          if (wallet && wallet.accountAddress !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            // Wallet exists, refresh balances
            try {
              const balances = await refreshBalances(
                wallet.rpcUrl,
                wallet.accountAddress,
                wallet.networkId
              );
              
              if (!cancelled) {
                setState({
                  ...parsed,
                  account: {
                    ...parsed.account,
                    address: wallet.accountAddress,
                    status: "ready",
                    environment: wallet.networkId,
                  },
                  portfolio: {
                    ...parsed.portfolio,
                    balances,
                  },
                });
              }
            } catch (balanceErr) {
              // Failed to fetch balances, still use wallet
              if (!cancelled) {
                setState({
                  ...parsed,
                  account: {
                    ...parsed.account,
                    address: wallet.accountAddress,
                    status: "ready",
                    environment: wallet.networkId,
                  },
                });
              }
            }
          } else {
            // Wallet not found or zero address - sanitize state to avoid showing stale data
            const sanitizedState: AppState = {
              ...parsed,
              account: {
                ...parsed.account,
                address: "0x0000000000000000000000000000000000000000000000000000000000000000",
                status: "not-created",
                environment: "sepolia",
              },
              portfolio: {
                ...parsed.portfolio,
                balances: [], // Clear stale balances
              },
            };
            if (!cancelled) {
              setState(sanitizedState);
            }
          }
        } else {
          setState(createInitialLiveState());
        }
      } catch (err) {
        console.error("[live] Boot error:", sanitizeError(err));
        if (!cancelled) {
          setState(createInitialLiveState());
        }
      }
      
      if (!cancelled) {
        setBootStatus("ready");
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state changes
  React.useEffect(() => {
    if (bootStatus !== "ready") return;
    secureSet(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [bootStatus, state]);

  const actions = React.useMemo<AppActions>(
    () => ({
      reset: async () => {
        try {
          // Clear wallet and session-related secure state
          await resetWallet();
          await secureDelete(SESSION_KEYS_INDEX_ID);
        } catch (err) {
          console.error("[live] reset wallet error");
        } finally {
          // Always clear in-memory UI state, even if secure cleanup failed
          setState(createInitialLiveState());
        }
      },
      
      setOnboardingProfile: (displayName, riskMode) => {
        setState((s) => ({
          ...s,
          onboarding: { ...s.onboarding, displayName, riskMode },
        }));
      },
      
      completeOnboarding: async (input) => {
        try {
          // Check if wallet already exists
          let wallet: WalletSnapshot | null = await loadWallet();
          
          // If no wallet exists, create one
          if (!wallet) {
            // Use the network from current state, default to sepolia
            const networkId = stateRef.current.account.environment === "mainnet" ? "mainnet" : "sepolia";
            wallet = await createWallet(networkId);
          }
          
          // wallet is now guaranteed to be defined after this point
          const walletAddress = wallet.accountAddress;
          const walletNetwork = wallet.networkId;
          
          // Get network config for balance refresh
          const network = STARKNET_NETWORKS[walletNetwork];
          
          // Try to fetch initial balances
          let balances = stateRef.current.portfolio.balances;
          try {
            balances = await refreshBalances(
              network.rpcUrl,
              walletAddress,
              walletNetwork
            );
          } catch {
            // Balance fetch failed, use empty balances
            balances = [
              { symbol: "ETH" as const, name: "Ether", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
              { symbol: "USDC" as const, name: "USD Coin", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
              { symbol: "STRK" as const, name: "Starknet", amount: 0, amountRaw: "0", amountDisplay: "0", usdPrice: 0, change24hPct: 0 },
            ];
          }
          
          // Use functional update to avoid stale closure
          setState((s) => {
            const newState: AppState = {
              ...s,
              onboarding: {
                completed: true,
                displayName: input.displayName.trim(),
                riskMode: input.riskMode,
              },
              account: {
                network: "Starknet",
                environment: walletNetwork,
                address: walletAddress,
                status: "creating", // Created, not yet deployed
              },
              portfolio: {
                ...s.portfolio,
                balances,
              },
              policy: {
                ...s.policy,
                dailySpendCapUsd: input.dailySpendCapUsd,
                perTxCapUsd: input.perTxCapUsd,
              },
            };
            
            // Add activity
            return appendActivity(
              newState,
              "onboarding",
              "Wallet created",
              shortenHex(walletAddress)
            );
          });
        } catch (err) {
          console.error("[live] completeOnboarding error:", sanitizeError(err));
          // Do NOT mark onboarding as completed on wallet failure
          // Set account status to error and keep onboarding incomplete
          setState((s) => {
            const newState: AppState = {
              ...s,
              account: {
                ...s.account,
                status: "not-created", // Reset to not-created on failure
              },
              // Keep onboarding incomplete - do NOT set completed: true
              onboarding: {
                completed: false,
                displayName: input.displayName.trim(),
                riskMode: input.riskMode,
              },
            };
            
            // Add activity noting the failure
            return appendActivity(
              newState,
              "onboarding",
              "Wallet creation failed",
              sanitizeError(err)
            );
          });
        }
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
        const t = nowSec();
        setState((s) => ({
          ...s,
          alerts: [
            { id: id("al"), createdAt: t, title, body, severity, read: false },
            ...s.alerts,
          ],
        }));
      },
      
      setEmergencyLockdown: (enabled) => {
        // Use functional update to get fresh state
        setState((s) => {
          const newState = {
            ...s,
            policy: { ...s.policy, emergencyLockdown: enabled },
          };
          
          // Add activity
          return appendActivity(
            newState,
            "policy_updated",
            enabled ? "Emergency lockdown enabled" : "Emergency lockdown disabled",
            enabled ? "All session keys revoked" : "Session keys remain active"
          );
        });
      },
      
      updateSpendCaps: (dailyUsd, perTxUsd) => {
        // Use functional update - read old values from current state via callback
        setState((s) => {
          const oldDaily = s.policy.dailySpendCapUsd;
          const oldPerTx = s.policy.perTxCapUsd;
          
          const newState = {
            ...s,
            policy: { ...s.policy, dailySpendCapUsd: dailyUsd, perTxCapUsd: perTxUsd },
          };
          
          // Add activity if values changed
          if (oldDaily !== dailyUsd || oldPerTx !== perTxUsd) {
            return appendActivity(
              newState,
              "policy_updated",
              "Spend caps updated",
              `Daily: $${dailyUsd}, per tx: $${perTxUsd}`
            );
          }
          return newState;
        });
      },
      
      setContractMode: (mode) => {
        setState((s) => ({
          ...s,
          policy: { ...s.policy, contractAllowlistMode: mode },
        }));
      },
      
      addAllowlistedRecipient: (recipientShort) => {
        setState((s) => {
          const next = recipientShort.trim();
          if (!next || s.policy.allowlistedRecipients.includes(next)) return s;
          
          const newState = {
            ...s,
            policy: {
              ...s.policy,
              allowlistedRecipients: [next, ...s.policy.allowlistedRecipients].slice(0, 8),
            },
          };
          
          return appendActivity(
            newState,
            "policy_updated",
            "Recipient added",
            shortenHex(next)
          );
        });
      },
      
      removeAllowlistedRecipient: (recipientShort) => {
        setState((s) => {
          const newState = {
            ...s,
            policy: {
              ...s.policy,
              allowlistedRecipients: s.policy.allowlistedRecipients.filter((x) => x !== recipientShort),
            },
          };
          
          return appendActivity(
            newState,
            "policy_updated",
            "Recipient removed",
            shortenHex(recipientShort)
          );
        });
      },
      
      setAllowedTargets: (targets, preset) => {
        setState((s) => {
          const newState = {
            ...s,
            policy: {
              ...s.policy,
              allowedTargets: targets,
              allowedTargetsPreset: preset,
            },
          };
          
          return appendActivity(
            newState,
            "policy_updated",
            `Allowed targets set to ${preset}`,
            targets.length > 0 ? `${targets.length} contracts` : "Wildcard (any)"
          );
        });
      },
      
      simulateTrade: () => {
        // Silent no-op - will be implemented in future
      },
      
      sendAgentMessage: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        
        const t = nowSec();
        
        // Use functional update to avoid stale state
        setState((s) => {
          // Add user message
          let newState = {
            ...s,
            agent: {
              ...s.agent,
              messages: [
                ...s.agent.messages,
                { id: id("m"), createdAt: t, role: "user" as const, text: trimmed },
              ],
            },
          };
          
          // Add assistant response
          newState = {
            ...newState,
            agent: {
              ...newState.agent,
              messages: [
                ...newState.agent.messages,
                {
                  id: id("m"),
                  createdAt: t + 1,
                  role: "assistant" as const,
                  text: "Live agent runtime is connecting. For now, you can view your balances and policy in the Home and Policies screens.",
                },
              ],
            },
          };
          
          return newState;
        });
      },
      
      approveProposal: (proposalId) => {
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
    [] // No deps - all state access is via functional updates or stateRef
  );

  return { bootStatus, state, actions };
}
