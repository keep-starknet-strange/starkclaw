/**
 * Typed request/response models for the AVNU quote API.
 */

export type AvnuQuoteRequest = {
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmount: string; // hex or decimal string
  takerAddress?: string;
  size?: number;
  excludeSources?: string[];
};

export type AvnuRoute = {
  name: string;
  address: string;
  percent: number;
};

export type AvnuQuote = {
  quoteId: string;
  sellTokenAddress: string;
  sellAmount: string;
  sellAmountInUsd: number;
  buyTokenAddress: string;
  buyAmount: string;
  buyAmountInUsd: number;
  buyAmountWithoutFees: string;
  buyAmountWithoutFeesInUsd: number;
  gasFees: string;
  gasFeesInUsd: number;
  avnuFees: string;
  avnuFeesInUsd: number;
  priceRatioUsd: number;
  routes: AvnuRoute[];
  liquiditySource: string;
  estimatedAmount: boolean;
  expiry: number | null;
};

export type AvnuQuoteResponse = AvnuQuote[];

export type AvnuBuildSwapRequest = {
  quoteId: string;
  takerAddress: string;
  slippage: number; // e.g. 0.01 for 1%
};

export type AvnuBuildSwapResponse = {
  calldata: string[];
  contractAddress: string;
  entrypoint: string;
};
