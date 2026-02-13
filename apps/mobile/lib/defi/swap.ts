/**
 * swap — bounded-approval swap flow via AVNU.
 *
 * Key safety invariant: ERC-20 approvals are always bounded to the exact
 * sellAmount. Never issues unlimited approvals.
 */

import { hash } from "starknet";

import { createOwnerAccount } from "../starknet/account";
import { u256FromBigInt } from "../starknet/u256";
import { formatUnits } from "../starknet/balances";
import { appendActivity } from "../activity/activity";
import { requireOwnerAuth } from "../security/owner-auth";
import { loadOwnerPrivateKey } from "../wallet/wallet";
import type { WalletSnapshot } from "../wallet/wallet";
import type { StarknetToken } from "../starknet/tokens";

import {
  fetchQuote,
  buildSwapCalldata,
  type AvnuNetwork,
  type AvnuQuote,
} from "./avnu";

// ── Types ───────────────────────────────────────────────────────────

export type SwapPreview = {
  quote: AvnuQuote;
  sellToken: StarknetToken;
  buyToken: StarknetToken;
  sellAmountRaw: bigint;
  sellAmountFormatted: string;
  buyAmountFormatted: string;
  minReceivedFormatted: string;
  slippagePct: number;
  gasFeeFormatted: string;
  avnuFeeFormatted: string;
  priceImpactPct: number;
  routeSummary: string;
};

export type SwapResult = {
  txHash: string;
  sellSymbol: string;
  buySymbol: string;
  sellAmountFormatted: string;
  buyAmountFormatted: string;
};

// ── Helpers ─────────────────────────────────────────────────────────

function avnuNetwork(networkId: string): AvnuNetwork {
  if (networkId === "mainnet") return "mainnet";
  return "sepolia";
}

function parseHexOrDecimal(s: string): bigint {
  if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
  return BigInt(s);
}

// ── Prepare swap (quote + preview) ──────────────────────────────────

const DEFAULT_SLIPPAGE = 0.01; // 1%

export async function prepareSwap(params: {
  wallet: WalletSnapshot;
  sellToken: StarknetToken;
  buyToken: StarknetToken;
  sellAmount: bigint;
  slippage?: number;
}): Promise<SwapPreview> {
  const network = avnuNetwork(params.wallet.networkId);
  const slippage = params.slippage ?? DEFAULT_SLIPPAGE;

  const sellAddress = params.sellToken.addressByNetwork[params.wallet.networkId];
  const buyAddress = params.buyToken.addressByNetwork[params.wallet.networkId];

  if (!sellAddress || !buyAddress) {
    throw new Error("Token not available on this network.");
  }

  const sellAmountHex = `0x${params.sellAmount.toString(16)}`;

  const quotes = await fetchQuote(network, {
    sellTokenAddress: sellAddress,
    buyTokenAddress: buyAddress,
    sellAmount: sellAmountHex,
    takerAddress: params.wallet.accountAddress,
    size: 1,
  });

  if (!quotes.length) {
    throw new Error("No swap route found for this pair.");
  }

  const quote = quotes[0];
  const buyAmountRaw = parseHexOrDecimal(quote.buyAmount);
  const minReceived = buyAmountRaw - (buyAmountRaw * BigInt(Math.floor(slippage * 10000))) / 10000n;

  const routeNames = quote.routes.map((r) => r.name).join(" → ");

  const priceImpactPct =
    quote.buyAmountWithoutFeesInUsd > 0
      ? ((quote.buyAmountWithoutFeesInUsd - quote.buyAmountInUsd) / quote.buyAmountWithoutFeesInUsd) * 100
      : 0;

  return {
    quote,
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmountRaw: params.sellAmount,
    sellAmountFormatted: formatUnits(params.sellAmount, params.sellToken.decimals),
    buyAmountFormatted: formatUnits(buyAmountRaw, params.buyToken.decimals),
    minReceivedFormatted: formatUnits(minReceived, params.buyToken.decimals),
    slippagePct: slippage * 100,
    gasFeeFormatted: `$${quote.gasFeesInUsd.toFixed(4)}`,
    avnuFeeFormatted: `$${quote.avnuFeesInUsd.toFixed(4)}`,
    priceImpactPct: Math.abs(priceImpactPct),
    routeSummary: routeNames || quote.liquiditySource,
  };
}

// ── Execute swap (bounded approve + swap call) ──────────────────────

export async function executeSwap(params: {
  wallet: WalletSnapshot;
  preview: SwapPreview;
}): Promise<SwapResult> {
  await requireOwnerAuth({ reason: "Execute swap" });

  const pk = await loadOwnerPrivateKey();
  if (!pk) throw new Error("Owner private key not found.");

  const network = avnuNetwork(params.wallet.networkId);
  const sellAddress = params.preview.sellToken.addressByNetwork[params.wallet.networkId];

  // Build swap calldata from AVNU.
  const swap = await buildSwapCalldata(network, {
    quoteId: params.preview.quote.quoteId,
    takerAddress: params.wallet.accountAddress,
    slippage: params.preview.slippagePct / 100,
  });

  // Bounded approval: approve exactly the sell amount, never unlimited.
  const { low, high } = u256FromBigInt(params.preview.sellAmountRaw);
  const approveSelector = hash.getSelectorFromName("approve");

  const account = createOwnerAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    ownerPrivateKey: pk,
  });

  const tx = await account.execute([
    // 1. Bounded ERC-20 approval (exact amount).
    {
      contractAddress: sellAddress,
      entrypoint: "approve",
      calldata: [swap.contractAddress, low, high],
    },
    // 2. Execute the swap via AVNU router.
    {
      contractAddress: swap.contractAddress,
      entrypoint: swap.entrypoint,
      calldata: swap.calldata,
    },
  ]);

  await appendActivity({
    networkId: params.wallet.networkId,
    kind: "swap",
    summary: `Swap ${params.preview.sellAmountFormatted} ${params.preview.sellToken.symbol} → ${params.preview.buyAmountFormatted} ${params.preview.buyToken.symbol}`,
    txHash: tx.transaction_hash,
    status: "pending",
  });

  return {
    txHash: tx.transaction_hash,
    sellSymbol: params.preview.sellToken.symbol,
    buySymbol: params.preview.buyToken.symbol,
    sellAmountFormatted: params.preview.sellAmountFormatted,
    buyAmountFormatted: params.preview.buyAmountFormatted,
  };
}
