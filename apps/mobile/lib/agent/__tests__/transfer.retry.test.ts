import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  mockCreateSessionAccount: vi.fn(),
  mockGetSessionPrivateKey: vi.fn(),
  mockListSessionKeys: vi.fn(),
  mockEnsureSignerCertificatePinning: vi.fn(async () => {}),
}));

vi.mock("@/lib/starknet/account", () => ({
  createSessionAccount: hoisted.mockCreateSessionAccount,
}));

vi.mock("@/lib/signer/keyring-proxy-signer", () => ({
  KeyringProxySigner: class KeyringProxySigner {
    getLastRequestId() {
      return "req-123";
    }
  },
  KeyringProxySignerError: class KeyringProxySignerError extends Error {
    code?: string;
    statusCode?: number;
  },
}));

vi.mock("@/lib/signer/runtime-config", () => ({
  getSignerMode: () => "remote",
  loadRemoteSignerRuntimeConfig: async () => ({
    proxyUrl: "http://127.0.0.1:8654",
    clientId: "default",
    hmacSecret: "x".repeat(32),
    requestTimeoutMs: 5_000,
    requester: "tests",
    mtlsRequired: false,
    pinnedPublicKeyHashes: [],
    pinningIncludeSubdomains: false,
    pinningExpirationDate: undefined,
  }),
  SignerRuntimeConfigError: class SignerRuntimeConfigError extends Error {
    code?: string;
  },
}));

vi.mock("@/lib/signer/pinning", () => ({
  ensureSignerCertificatePinning: hoisted.mockEnsureSignerCertificatePinning,
}));

vi.mock("@/lib/policy/session-keys", () => ({
  getSessionPrivateKey: hoisted.mockGetSessionPrivateKey,
  listSessionKeys: hoisted.mockListSessionKeys,
}));

import { executeTransfer, type TransferAction } from "@/lib/agent/transfer";
import type { WalletSnapshot } from "@/lib/wallet/wallet";

const wallet: WalletSnapshot = {
  networkId: "sepolia",
  rpcUrl: "https://starknet-sepolia-rpc.publicnode.com",
  chainIdHex: "0x534e5f5345504f4c4941",
  ownerPublicKey: "0x1",
  accountAddress: "0x123",
};

const action: TransferAction = {
  kind: "erc20_transfer",
  tokenSymbol: "STRK",
  tokenAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  to: "0x123",
  amount: "0.000000000000000001",
  amountBaseUnits: "1",
  balanceBaseUnits: "100",
  calldata: ["0x123", "0x1", "0x0"],
  sessionPublicKey: "0xabc",
  warnings: [],
  policy: {
    spendingLimitBaseUnits: "1000000",
    validUntil: Math.floor(Date.now() / 1000) + 600,
  },
};

describe("executeTransfer L2 gas retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockListSessionKeys.mockResolvedValue([
      {
        key: action.sessionPublicKey,
        tokenSymbol: action.tokenSymbol,
        tokenAddress: action.tokenAddress,
        spendingLimit: action.policy.spendingLimitBaseUnits,
        validAfter: Math.floor(Date.now() / 1000) - 10,
        validUntil: action.policy.validUntil,
        allowedContract: "0x0",
        createdAt: Math.floor(Date.now() / 1000) - 10,
      },
    ]);
  });

  it("retries once with bumped resource bounds on Insufficient max L2Gas revert", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ transaction_hash: "0xfirst" })
      .mockResolvedValueOnce({ transaction_hash: "0xsecond" });
    const waitForTransaction = vi
      .fn()
      .mockResolvedValueOnce({
        execution_status: "REVERTED",
        revert_reason: "Insufficient max L2Gas: max amount: 10, actual used: 12.",
      })
      .mockResolvedValueOnce({ execution_status: "SUCCEEDED" });
    const estimateInvokeFee = vi.fn().mockResolvedValue({
      resourceBounds: {
        l1_gas: { max_amount: 100n, max_price_per_unit: 10n },
        l1_data_gas: { max_amount: 200n, max_price_per_unit: 20n },
        l2_gas: { max_amount: 300n, max_price_per_unit: 30n },
      },
    });

    hoisted.mockCreateSessionAccount.mockReturnValue({
      execute,
      waitForTransaction,
      getTransactionReceipt: vi.fn(),
      estimateInvokeFee,
    });

    const result = await executeTransfer({
      wallet,
      action,
      mobileActionId: "mobile_action_test",
      requester: "tests",
      tool: "execute_transfer",
    });

    expect(result.txHash).toBe("0xsecond");
    expect(result.executionStatus).toBe("SUCCEEDED");
    expect(result.revertReason).toBeNull();
    expect(result.signerRequestId).toBe("req-123");
    expect(hoisted.mockEnsureSignerCertificatePinning).toHaveBeenCalledTimes(1);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(estimateInvokeFee).toHaveBeenCalledTimes(1);

    const secondCallArgs = execute.mock.calls[1];
    const executionDetails = secondCallArgs?.[1];
    expect(executionDetails.resourceBounds.l1_gas.max_amount).toBe(130n);
    expect(executionDetails.resourceBounds.l1_data_gas.max_amount).toBe(440n);
    expect(executionDetails.resourceBounds.l2_gas.max_amount).toBe(420n);
  });

  it("does not retry for unrelated reverts", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ transaction_hash: "0xfirst" });
    const waitForTransaction = vi.fn().mockResolvedValueOnce({
      execution_status: "REVERTED",
      revert_reason: "Insufficient balance",
    });
    const estimateInvokeFee = vi.fn();

    hoisted.mockCreateSessionAccount.mockReturnValue({
      execute,
      waitForTransaction,
      getTransactionReceipt: vi.fn(),
      estimateInvokeFee,
    });

    const result = await executeTransfer({
      wallet,
      action,
      mobileActionId: "mobile_action_test",
      requester: "tests",
      tool: "execute_transfer",
    });

    expect(result.txHash).toBe("0xfirst");
    expect(result.executionStatus).toBe("REVERTED");
    expect(result.revertReason).toContain("Insufficient balance");

    expect(execute).toHaveBeenCalledTimes(1);
    expect(estimateInvokeFee).not.toHaveBeenCalled();
  });

  it("rejects when action token target does not match stored session policy token", async () => {
    const execute = vi.fn();
    hoisted.mockCreateSessionAccount.mockReturnValue({
      execute,
      waitForTransaction: vi.fn(),
      getTransactionReceipt: vi.fn(),
      estimateInvokeFee: vi.fn(),
    });
    hoisted.mockListSessionKeys.mockResolvedValue([
      {
        key: action.sessionPublicKey,
        tokenSymbol: action.tokenSymbol,
        tokenAddress: "0x9999",
        spendingLimit: action.policy.spendingLimitBaseUnits,
        validAfter: Math.floor(Date.now() / 1000) - 10,
        validUntil: action.policy.validUntil,
        allowedContract: "0x0",
        createdAt: Math.floor(Date.now() / 1000) - 10,
      },
    ]);

    await expect(
      executeTransfer({
        wallet,
        action,
        mobileActionId: "mobile_action_test",
        requester: "tests",
        tool: "execute_transfer",
      })
    ).rejects.toThrow(/not allowed for the selected session policy/i);

    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when certificate pinning initialization fails in remote mode", async () => {
    const execute = vi.fn();
    hoisted.mockCreateSessionAccount.mockReturnValue({
      execute,
      waitForTransaction: vi.fn(),
      getTransactionReceipt: vi.fn(),
      estimateInvokeFee: vi.fn(),
    });
    hoisted.mockEnsureSignerCertificatePinning.mockRejectedValueOnce(
      new Error("PINNING_INIT_FAILED: bad pin set")
    );

    await expect(
      executeTransfer({
        wallet,
        action,
        mobileActionId: "mobile_action_test",
        requester: "tests",
        tool: "execute_transfer",
      })
    ).rejects.toThrow(/PINNING_INIT_FAILED/i);

    expect(execute).not.toHaveBeenCalled();
  });
});
