/**
 * Core tool definitions for the transfer/runtime flow.
 *
 * Tools:
 *   get_balances     — Read ERC-20 balances for the active wallet
 *   prepare_transfer — Validate + prepare an ERC-20 transfer action
 *   estimate_fee     — Placeholder estimation
 *   execute_transfer — Execute a prepared ERC-20 transfer
 */

import { executeTransfer, prepareTransferFromText } from "@/lib/agent/transfer";
import { appendActivity, type ActivityStatus } from "@/lib/activity/activity";
import { getErc20Balance } from "@/lib/starknet/balances";
import { STARKNET_NETWORKS, type StarknetNetworkId } from "@/lib/starknet/networks";
import { TOKENS, type StarknetTokenSymbol } from "@/lib/starknet/tokens";
import { loadWallet } from "@/lib/wallet/wallet";

import type { ToolDefinition, ToolResult } from "./types";

function formatTokenAmount(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();

  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

function parseNetwork(value: string): StarknetNetworkId | null {
  if (value === "sepolia" || value === "mainnet") return value;
  return null;
}

function isValidHexAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(value);
}

function createMobileActionId(): string {
  return `mobile_action_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function mapExecutionStatusToActivityStatus(executionStatus: string | null): ActivityStatus {
  if (!executionStatus) return "unknown";
  const normalized = executionStatus.toUpperCase();
  if (normalized.includes("SUCCEED")) return "succeeded";
  if (normalized.includes("REVERT")) return "reverted";
  return "unknown";
}

async function loadWalletForNetwork(network: StarknetNetworkId) {
  const wallet = await loadWallet();
  if (!wallet) {
    throw new Error("Wallet not initialized. Complete onboarding and create a wallet first.");
  }
  if (wallet.networkId !== network) {
    throw new Error(
      `Wallet network mismatch: wallet is on ${wallet.networkId}, tool requested ${network}.`
    );
  }
  return wallet;
}

export const getBalancesTool: ToolDefinition = {
  name: "get_balances",
  description:
    "Read ERC-20 balances (ETH, USDC, STRK) for the active wallet. Returns raw and human-readable amounts.",
  argsSchema: {
    type: "object",
    properties: {
      network: {
        type: "string",
        description: "Network to query.",
        enum: ["sepolia", "mainnet"],
      },
    },
    required: ["network"],
  },
  async handler(args): Promise<ToolResult> {
    try {
      const network = parseNetwork(String(args.network));
      if (!network) {
        return { ok: false, error: 'Invalid network. Use "sepolia" or "mainnet".' };
      }

      const wallet = await loadWalletForNetwork(network);
      const balances = await Promise.all(
        TOKENS.map(async (token) => {
          const tokenAddress = token.addressByNetwork[network];
          const amount = await getErc20Balance(wallet.rpcUrl, tokenAddress, wallet.accountAddress);
          return {
            symbol: token.symbol,
            amount: amount.toString(),
            formatted: `${formatTokenAmount(amount, token.decimals)} ${token.symbol}`,
          };
        })
      );

      return {
        ok: true,
        data: {
          network,
          rpcUrl: STARKNET_NETWORKS[network].rpcUrl,
          accountAddress: wallet.accountAddress,
          balances,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load balances.",
      };
    }
  },
};

export const prepareTransferTool: ToolDefinition = {
  name: "prepare_transfer",
  description:
    "Validate and prepare an ERC-20 transfer. Returns transfer payload and policy warnings without executing.",
  argsSchema: {
    type: "object",
    properties: {
      network: {
        type: "string",
        description: "Network to query.",
        enum: ["sepolia", "mainnet"],
      },
      tokenSymbol: {
        type: "string",
        description: "Token to transfer.",
        enum: ["ETH", "USDC", "STRK"],
      },
      amount: {
        type: "string",
        description: "Amount to transfer in human-readable units (e.g. '2.5').",
      },
      to: {
        type: "string",
        description: "Recipient Starknet address (0x-prefixed hex).",
      },
    },
    required: ["network", "tokenSymbol", "amount", "to"],
  },
  async handler(args): Promise<ToolResult> {
    try {
      const network = parseNetwork(String(args.network));
      if (!network) return { ok: false, error: 'Invalid network. Use "sepolia" or "mainnet".' };

      const tokenSymbol = String(args.tokenSymbol).toUpperCase() as StarknetTokenSymbol;
      const amount = String(args.amount);
      const to = String(args.to);

      if (!isValidHexAddress(to)) {
        return { ok: false, error: "Invalid recipient address. Must be 0x-prefixed hex." };
      }

      const wallet = await loadWalletForNetwork(network);
      const action = await prepareTransferFromText({
        wallet,
        text: `send ${amount} ${tokenSymbol} to ${to}`,
      });

      return {
        ok: true,
        data: {
          ...action,
          network,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to prepare transfer.",
      };
    }
  },
};

export const estimateFeeTool: ToolDefinition = {
  name: "estimate_fee",
  description:
    "Estimate gas fee for a prepared transfer. Returns a conservative placeholder until simulation wiring lands.",
  argsSchema: {
    type: "object",
    properties: {
      tokenSymbol: {
        type: "string",
        description: "Token being transferred.",
        enum: ["ETH", "USDC", "STRK"],
      },
      amount: {
        type: "string",
        description: "Amount being transferred.",
      },
      to: {
        type: "string",
        description: "Recipient address.",
      },
    },
    required: ["tokenSymbol", "amount", "to"],
  },
  async handler(): Promise<ToolResult> {
    return {
      ok: true,
      data: {
        estimatedFeeStrk: "0.001",
        estimatedFeeUsd: "$0.002",
        note: "Simulation-based fee estimation will be wired in a dedicated follow-up.",
      },
    };
  },
};

export const executeTransferTool: ToolDefinition = {
  name: "execute_transfer",
  description:
    "Execute an ERC-20 transfer using session signing (local or remote signer mode). Returns tx hash + signer correlation IDs.",
  argsSchema: {
    type: "object",
    properties: {
      network: {
        type: "string",
        description: "Network to execute on.",
        enum: ["sepolia", "mainnet"],
      },
      tokenSymbol: {
        type: "string",
        description: "Token to transfer.",
        enum: ["ETH", "USDC", "STRK"],
      },
      amount: {
        type: "string",
        description: "Amount to transfer.",
      },
      to: {
        type: "string",
        description: "Recipient address.",
      },
      mobileActionId: {
        type: "string",
        description: "Optional external correlation id for audit traceability.",
      },
    },
    required: ["network", "tokenSymbol", "amount", "to"],
  },
  async handler(args): Promise<ToolResult> {
    try {
      const network = parseNetwork(String(args.network));
      if (!network) return { ok: false, error: 'Invalid network. Use "sepolia" or "mainnet".' };

      const tokenSymbol = String(args.tokenSymbol).toUpperCase() as StarknetTokenSymbol;
      const amount = String(args.amount);
      const to = String(args.to);
      const mobileActionId = args.mobileActionId
        ? String(args.mobileActionId)
        : createMobileActionId();

      if (!isValidHexAddress(to)) {
        return { ok: false, error: "Invalid recipient address." };
      }

      const wallet = await loadWalletForNetwork(network);
      const action = await prepareTransferFromText({
        wallet,
        text: `send ${amount} ${tokenSymbol} to ${to}`,
      });

      let execution:
        | Awaited<ReturnType<typeof executeTransfer>>
        | null = null;
      try {
        execution = await executeTransfer({
          wallet,
          action,
          requester: "starkclaw-mobile",
          tool: "execute_transfer",
          mobileActionId,
        });
      } catch (err) {
        await appendActivity({
          networkId: wallet.networkId,
          kind: "transfer",
          summary: `Transfer ${amount} ${tokenSymbol} to ${to}`,
          status: "unknown",
          mobileActionId,
          signerRequestId: null,
          executionStatus: null,
          revertReason: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      await appendActivity({
        networkId: wallet.networkId,
        kind: "transfer",
        summary: `Transfer ${amount} ${tokenSymbol} to ${to}`,
        txHash: execution.txHash,
        status: mapExecutionStatusToActivityStatus(execution.executionStatus),
        executionStatus: execution.executionStatus,
        revertReason: execution.revertReason,
        mobileActionId: execution.mobileActionId,
        signerRequestId: execution.signerRequestId,
      });

      return {
        ok: true,
        data: {
          txHash: execution.txHash,
          executionStatus: execution.executionStatus,
          revertReason: execution.revertReason,
          signerMode: execution.signerMode,
          signerRequestId: execution.signerRequestId,
          mobileActionId: execution.mobileActionId,
          tokenSymbol,
          amount,
          to,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Transfer execution failed.",
      };
    }
  },
};

export const CORE_TOOLS: ToolDefinition[] = [
  getBalancesTool,
  prepareTransferTool,
  estimateFeeTool,
  executeTransferTool,
];
