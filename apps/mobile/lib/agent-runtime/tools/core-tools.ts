/**
 * Core tool definitions for the MVP transfer flow.
 *
 * Tools:
 *   get_balances     — Read ERC-20 balances for the wallet
 *   prepare_transfer — Validate + prepare an ERC-20 transfer action
 *   estimate_fee     — Stub: estimate gas for a prepared transfer
 *   execute_transfer — Execute a prepared transfer via session key
 *
 * Each tool wraps existing live library functions and returns structured
 * results that the model can reason about.
 */

import type { ToolDefinition, ToolResult } from "./types";

// ---------------------------------------------------------------------------
// get_balances
// ---------------------------------------------------------------------------

export const getBalancesTool: ToolDefinition = {
  name: "get_balances",
  description:
    "Read the ERC-20 balances (ETH, USDC, STRK) for the connected wallet. Returns token symbols, raw balances, and human-readable amounts.",
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
    const network = args.network as string;
    // Stub: live implementation will call getErc20Balance for each token.
    return {
      ok: true,
      data: {
        network,
        balances: [
          { symbol: "ETH", amount: "0", formatted: "0 ETH" },
          { symbol: "USDC", amount: "0", formatted: "0 USDC" },
          { symbol: "STRK", amount: "0", formatted: "0 STRK" },
        ],
        note: "Live balance fetching will be wired when wallet lifecycle (#3) lands.",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// prepare_transfer
// ---------------------------------------------------------------------------

export const prepareTransferTool: ToolDefinition = {
  name: "prepare_transfer",
  description:
    "Validate and prepare an ERC-20 transfer. Returns the transfer action with policy checks and warnings. Does NOT execute.",
  argsSchema: {
    type: "object",
    properties: {
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
    required: ["tokenSymbol", "amount", "to"],
  },
  async handler(args): Promise<ToolResult> {
    const { tokenSymbol, amount, to } = args as Record<string, string>;

    // Basic input validation.
    if (!/^0x[0-9a-fA-F]+$/.test(to)) {
      return { ok: false, error: "Invalid recipient address. Must be 0x-prefixed hex." };
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return { ok: false, error: "Amount must be a positive number." };
    }

    // Stub: live implementation will call prepareTransferFromText.
    return {
      ok: true,
      data: {
        kind: "erc20_transfer",
        tokenSymbol,
        amount,
        to,
        warnings: [],
        note: "Live transfer preparation will be wired when wallet lifecycle (#3) and session keys (#6) land.",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// estimate_fee
// ---------------------------------------------------------------------------

export const estimateFeeTool: ToolDefinition = {
  name: "estimate_fee",
  description:
    "Estimate the gas fee for a prepared transfer. Returns the estimated fee in STRK.",
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
    // Stub: live implementation will simulate the transaction.
    return {
      ok: true,
      data: {
        estimatedFeeStrk: "0.001",
        estimatedFeeUsd: "$0.002",
        note: "Live fee estimation will be wired when account deployment (#5) lands.",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// execute_transfer
// ---------------------------------------------------------------------------

export const executeTransferTool: ToolDefinition = {
  name: "execute_transfer",
  description:
    "Execute a prepared ERC-20 transfer using a session key. Returns the transaction hash.",
  argsSchema: {
    type: "object",
    properties: {
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
    },
    required: ["tokenSymbol", "amount", "to"],
  },
  async handler(args): Promise<ToolResult> {
    const { tokenSymbol, amount, to } = args as Record<string, string>;

    // Basic input validation.
    if (!/^0x[0-9a-fA-F]+$/.test(to)) {
      return { ok: false, error: "Invalid recipient address." };
    }

    // Stub: live implementation will call executeTransfer from lib/agent/transfer.ts.
    return {
      ok: true,
      data: {
        txHash: null,
        tokenSymbol,
        amount,
        to,
        status: "stubbed",
        note: "Live transfer execution will be wired when session keys (#6) land.",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// All core tools
// ---------------------------------------------------------------------------

export const CORE_TOOLS: ToolDefinition[] = [
  getBalancesTool,
  prepareTransferTool,
  estimateFeeTool,
  executeTransferTool,
];
