import { EDataAvailabilityMode, validateAndParseAddress } from "starknet";

import { getSessionPrivateKey, listSessionKeys, type StoredSessionKey } from "../policy/session-keys";
import { KeyringProxySigner, KeyringProxySignerError } from "../signer/keyring-proxy-signer";
import { ensureSignerCertificatePinning } from "../signer/pinning";
import {
  type SignerMode,
  SignerRuntimeConfigError,
  getSignerMode,
  loadRemoteSignerRuntimeConfig,
} from "../signer/runtime-config";
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

function normalizeAddress(value: string): string {
  return validateAndParseAddress(value).toLowerCase();
}

function enforceSessionTransferTargetPolicy(
  action: TransferAction,
  session: StoredSessionKey
): void {
  if (session.revokedAt) {
    throw new Error("Session key revoked. Create a new one in Policies.");
  }
  if (session.tokenSymbol !== action.tokenSymbol) {
    throw new Error("Transfer token symbol does not match the selected session policy.");
  }
  const policyTokenAddress = normalizeAddress(session.tokenAddress);
  const transferTokenAddress = normalizeAddress(action.tokenAddress);
  if (policyTokenAddress !== transferTokenAddress) {
    throw new Error("Transfer token is not allowed for the selected session policy.");
  }
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

function isL2GasRevert(status: string | null, revertReason: string | null): boolean {
  if (status !== "REVERTED") return false;
  if (!revertReason) return false;
  return /Insufficient max L2Gas/i.test(revertReason);
}

function bumpBound(value: unknown, percent: number): bigint {
  return (BigInt(value as bigint | number | string) * BigInt(100 + percent)) / 100n;
}

async function waitForReceiptOrFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionAccount: any,
  txHash: string
): Promise<unknown> {
  try {
    return await sessionAccount.waitForTransaction(txHash, {
      retries: 60,
      retryInterval: 3_000,
    });
  } catch {
    try {
      return await sessionAccount.getTransactionReceipt(txHash);
    } catch {
      return null;
    }
  }
}

function createMobileActionId(): string {
  return `mobile_action_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function mapRemoteSignerError(err: unknown): Error {
  if (err instanceof SignerRuntimeConfigError) {
    return err;
  }
  if (err instanceof KeyringProxySignerError) {
    if (err.code === "TIMEOUT") {
      return new Error("Signer timeout. Retry the transfer.");
    }
    if (err.code === "AUTH_REPLAY") {
      return new Error("Signer rejected replayed nonce. Retry with a fresh request.");
    }
    if (err.code === "AUTH_INVALID") {
      return new Error("Signer authentication failed (401). Check remote signer credentials.");
    }
    if (err.code === "POLICY_DENIED") {
      return new Error("Signer policy denied this transfer. Review session policy and limits.");
    }
  }
  const msg = err instanceof Error ? err.message : String(err);

  if (/Keyring proxy request timed out/i.test(msg)) {
    return new Error("Signer timeout. Retry the transfer.");
  }
  if (/Keyring proxy error \(401\)/i.test(msg)) {
    if (/nonce|replay/i.test(msg)) {
      return new Error("Signer rejected replayed nonce. Retry with a fresh request.");
    }
    return new Error("Signer authentication failed (401). Check remote signer credentials.");
  }
  if (/Keyring proxy error \((403|422)\)/i.test(msg)) {
    return new Error("Signer policy denied this transfer. Review session policy and limits.");
  }
  if (/INSECURE_TRANSPORT|MTLS_REQUIRED|PINNING_/i.test(msg)) {
    return new Error(msg);
  }
  return err instanceof Error ? err : new Error(msg);
}

export async function executeTransfer(params: {
  wallet: WalletSnapshot;
  action: TransferAction;
  mobileActionId?: string;
  requester?: string;
  tool?: string;
}): Promise<{
  txHash: string;
  executionStatus: string | null;
  revertReason: string | null;
  signerMode: SignerMode;
  signerRequestId: string | null;
  mobileActionId: string;
}> {
  const signerMode = getSignerMode();
  const mobileActionId = params.mobileActionId ?? createMobileActionId();
  let signerRequestId: string | null = null;
  let sessionAccount: ReturnType<typeof createSessionAccount>;
  let remoteSigner: KeyringProxySigner | null = null;

  const sessions = await listSessionKeys();
  const session = sessions.find((k) => k.key === params.action.sessionPublicKey);
  if (!session) {
    throw new Error("Session key not found in local policy store.");
  }
  enforceSessionTransferTargetPolicy(params.action, session);

  if (signerMode === "remote") {
    try {
      const remoteConfig = await loadRemoteSignerRuntimeConfig();
      await ensureSignerCertificatePinning({
        proxyUrl: remoteConfig.proxyUrl,
        pinnedPublicKeyHashes: remoteConfig.pinnedPublicKeyHashes,
        pinningIncludeSubdomains: remoteConfig.pinningIncludeSubdomains,
        pinningExpirationDate: remoteConfig.pinningExpirationDate,
      });
      remoteSigner = new KeyringProxySigner({
        proxyUrl: remoteConfig.proxyUrl,
        accountAddress: params.wallet.accountAddress,
        clientId: remoteConfig.clientId,
        hmacSecret: remoteConfig.hmacSecret,
        requestTimeoutMs: remoteConfig.requestTimeoutMs,
        validUntil: params.action.policy.validUntil,
        keyId: remoteConfig.keyId,
        requester: params.requester ?? remoteConfig.requester,
        tool: params.tool ?? "execute_transfer",
        mobileActionId,
        allowedTransferTokenAddress: params.action.tokenAddress,
      });

      sessionAccount = createSessionAccount({
        rpcUrl: params.wallet.rpcUrl,
        accountAddress: params.wallet.accountAddress,
        signer: remoteSigner,
      });
    } catch (err) {
      const mapped = mapRemoteSignerError(err);
      throw mapped;
    }
  } else {
    const pk = await getSessionPrivateKey(params.action.sessionPublicKey);
    if (!pk) throw new Error("Missing session private key. Create a new session key in Policies.");

    sessionAccount = createSessionAccount({
      rpcUrl: params.wallet.rpcUrl,
      accountAddress: params.wallet.accountAddress,
      sessionPrivateKey: pk,
      sessionValidUntil: params.action.policy.validUntil,
      sessionPublicKey: params.action.sessionPublicKey,
    });
  }

  let txHash = "";
  const transferCall = {
    contractAddress: params.action.tokenAddress,
    entrypoint: "transfer",
    calldata: params.action.calldata,
  };
  try {
    const tx = await sessionAccount.execute(transferCall);
    txHash = tx.transaction_hash;
  } catch (err) {
    if (signerMode === "remote") {
      const mapped = mapRemoteSignerError(err);
      throw mapped;
    }
    throw err;
  }

  if (remoteSigner) {
    signerRequestId = remoteSigner.getLastRequestId() ?? null;
  }

  let receipt = await waitForReceiptOrFallback(sessionAccount, txHash);
  let executionStatus = extractExecutionStatus(receipt);
  let revertReason = extractRevertReason(receipt);

  // Sepolia can under-estimate v3 L2 gas bounds. Retry once with bumped resource bounds.
  if (isL2GasRevert(executionStatus, revertReason)) {
    try {
      const estimate = await sessionAccount.estimateInvokeFee(transferCall, { skipValidate: false });
      const rb = estimate?.resourceBounds;

      if (rb?.l1_gas && rb?.l1_data_gas && rb?.l2_gas) {
        const tx = await sessionAccount.execute(transferCall, {
          tip: 0n,
          paymasterData: [],
          accountDeploymentData: [],
          nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
          feeDataAvailabilityMode: EDataAvailabilityMode.L1,
          resourceBounds: {
            l1_gas: {
              max_amount: bumpBound(rb.l1_gas.max_amount, 30),
              max_price_per_unit: bumpBound(rb.l1_gas.max_price_per_unit, 20),
            },
            l1_data_gas: {
              max_amount: bumpBound(rb.l1_data_gas.max_amount, 120),
              max_price_per_unit: bumpBound(rb.l1_data_gas.max_price_per_unit, 20),
            },
            l2_gas: {
              max_amount: bumpBound(rb.l2_gas.max_amount, 40),
              max_price_per_unit: bumpBound(rb.l2_gas.max_price_per_unit, 20),
            },
          },
        });
        txHash = tx.transaction_hash;
        if (remoteSigner) {
          signerRequestId = remoteSigner.getLastRequestId() ?? signerRequestId;
        }
        receipt = await waitForReceiptOrFallback(sessionAccount, txHash);
        executionStatus = extractExecutionStatus(receipt);
        revertReason = extractRevertReason(receipt);
      }
    } catch {
      // Keep original revert result if retry path fails unexpectedly.
    }
  }

  return {
    txHash,
    executionStatus,
    revertReason,
    signerMode,
    signerRequestId,
    mobileActionId,
  };
}
