import { validateAndParseAddress } from "starknet";

import { getSessionPrivateKey, listSessionKeys, type StoredSessionKey } from "../policy/session-keys";
import { createSessionAccount } from "../starknet/account";
import { getErc20Balance } from "../starknet/balances";
import { TOKENS, type StarknetTokenSymbol } from "../starknet/tokens";
import { u256FromBigInt } from "../starknet/u256";
import { parseUnits } from "../starknet/units";
import type { WalletSnapshot } from "../wallet/wallet";

export type TransferAction = {
  kind: "erc20_transfer";
  tokenSymbol: StarknetTokenSymbol;
  tokenAddress: string;
  to: string;
  amount: string; // human input
  amountBaseUnits: string; // decimal bigint string
  balanceBaseUnits: string; // decimal bigint string
  calldata: string[]; // [to, amount_low, amount_high]
  sessionPublicKey: string;
  warnings: string[];
  policy: {
    spendingLimitBaseUnits: string;
    validUntil: number;
  };
};

function getToken(symbol: StarknetTokenSymbol) {
  const t = TOKENS.find((x) => x.symbol === symbol);
  if (!t) throw new Error(`Unknown token: ${symbol}`);
  return t;
}

function pickKeyForToken(keys: StoredSessionKey[], tokenSymbol: StarknetTokenSymbol): StoredSessionKey {
  const k = keys.find((x) => !x.revokedAt && x.tokenSymbol === tokenSymbol);
  if (!k) throw new Error(`No active session key found for ${tokenSymbol}. Create one in Policies.`);
  return k;
}

export async function prepareTransferFromText(params: {
  wallet: WalletSnapshot;
  text: string;
}): Promise<TransferAction> {
  const m = params.text.trim().match(/^send\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})\s+to\s+(0x[0-9a-fA-F]+)$/i);
  if (!m) {
    throw new Error('Try: "send 2 USDC to 0xabc..."');
  }

  const amount = m[1];
  const tokenSymbol = m[2].toUpperCase() as StarknetTokenSymbol;
  const to = validateAndParseAddress(m[3]);

  const token = getToken(tokenSymbol);
  const tokenAddress = validateAndParseAddress(token.addressByNetwork[params.wallet.networkId]);
  const amountUnits = parseUnits(amount, token.decimals);
  const { low, high } = u256FromBigInt(amountUnits);

  const balance = await getErc20Balance(params.wallet.rpcUrl, tokenAddress, params.wallet.accountAddress);
  if (balance < amountUnits) {
    throw new Error(`Insufficient ${tokenSymbol} balance.`);
  }

  const keys = await listSessionKeys();
  const key = pickKeyForToken(keys, tokenSymbol);

  // Local preflight checks (on-chain remains the source of truth).
  const now = Math.floor(Date.now() / 1000);
  if (key.validUntil <= now) throw new Error("Session key expired. Create a new one in Policies.");
  if (now < key.validAfter) throw new Error("Session key not yet valid. Create a new one in Policies.");
  const warnings: string[] = [];
  if (BigInt(key.spendingLimit) < amountUnits) {
    warnings.push("Amount exceeds the session key cap; expected to be denied on-chain.");
  }

  return {
    kind: "erc20_transfer",
    tokenSymbol,
    tokenAddress,
    to,
    amount,
    amountBaseUnits: amountUnits.toString(),
    balanceBaseUnits: balance.toString(),
    calldata: [to, low, high],
    sessionPublicKey: key.key,
    warnings,
    policy: {
      spendingLimitBaseUnits: key.spendingLimit,
      validUntil: key.validUntil,
    },
  };
}

function extractRevertReason(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = receipt as any;

  const candidates = [
    r.revert_reason,
    r.revertReason,
    r.reason,
    r?.value?.revert_reason,
    r?.value?.revertReason,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
}

function extractExecutionStatus(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = receipt as any;
  const v = r.execution_status ?? r.executionStatus ?? r?.value?.execution_status;
  return typeof v === "string" ? v : null;
}

export async function executeTransfer(params: {
  wallet: WalletSnapshot;
  action: TransferAction;
}): Promise<{
  txHash: string;
  executionStatus: string | null;
  revertReason: string | null;
}> {
  const pk = await getSessionPrivateKey(params.action.sessionPublicKey);
  if (!pk) throw new Error("Missing session private key. Create a new session key in Policies.");

  const account = createSessionAccount({
    rpcUrl: params.wallet.rpcUrl,
    accountAddress: params.wallet.accountAddress,
    sessionPrivateKey: pk,
    sessionValidUntil: params.action.policy.validUntil,
    sessionPublicKey: params.action.sessionPublicKey,
  });

  const tx = await account.execute({
    contractAddress: params.action.tokenAddress,
    entrypoint: "transfer",
    calldata: params.action.calldata,
  });

  let receipt: unknown = null;
  try {
    receipt = await account.waitForTransaction(tx.transaction_hash, {
      retries: 60,
      retryInterval: 3_000,
    });
  } catch {
    try {
      receipt = await account.getTransactionReceipt(tx.transaction_hash);
    } catch {
      // ignored
    }
  }

  return {
    txHash: tx.transaction_hash,
    executionStatus: extractExecutionStatus(receipt),
    revertReason: extractRevertReason(receipt),
  };
}
