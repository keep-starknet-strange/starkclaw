import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet/wallet", () => ({
  loadWallet: vi.fn(),
}));

vi.mock("@/lib/agent/transfer", () => ({
  prepareTransferFromText: vi.fn(),
  executeTransfer: vi.fn(),
}));

vi.mock("@/lib/starknet/balances", () => ({
  getErc20Balance: vi.fn(),
}));

vi.mock("@/lib/activity/activity", () => ({
  appendActivity: vi.fn(),
}));

import { executeTransfer, prepareTransferFromText } from "@/lib/agent/transfer";
import { appendActivity } from "@/lib/activity/activity";
import { getErc20Balance } from "@/lib/starknet/balances";
import { loadWallet } from "@/lib/wallet/wallet";

import {
  executeTransferTool,
  getBalancesTool,
  prepareTransferTool,
} from "../core-tools";

const loadWalletMock = vi.mocked(loadWallet);
const prepareTransferFromTextMock = vi.mocked(prepareTransferFromText);
const executeTransferMock = vi.mocked(executeTransfer);
const getErc20BalanceMock = vi.mocked(getErc20Balance);
const appendActivityMock = vi.mocked(appendActivity);

describe("core-tools runtime wiring", () => {
  const walletFixture = {
    networkId: "sepolia" as const,
    rpcUrl: "https://rpc.example",
    chainIdHex: "0x534e5f5345504f4c4941",
    ownerPublicKey: "0xaaa",
    accountAddress: "0xabc",
  };

  const transferActionFixture = {
    kind: "erc20_transfer" as const,
    tokenSymbol: "USDC" as const,
    tokenAddress: "0xusdc",
    to: "0x123",
    amount: "1",
    amountBaseUnits: "1000000",
    balanceBaseUnits: "2000000",
    calldata: ["0x123", "0xf4240", "0x0"],
    sessionPublicKey: "0xsession",
    warnings: [],
    policy: {
      spendingLimitBaseUnits: "5000000",
      validUntil: Math.floor(Date.now() / 1000) + 3600,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    appendActivityMock.mockResolvedValue({
      id: "activity-1",
      createdAt: Math.floor(Date.now() / 1000),
      networkId: "sepolia",
      kind: "transfer",
      summary: "Transfer",
      status: "succeeded",
    } as never);
  });

  it("returns error when wallet is missing for execute_transfer", async () => {
    loadWalletMock.mockResolvedValue(null);

    const result = await executeTransferTool.handler({
      network: "sepolia",
      tokenSymbol: "USDC",
      amount: "1",
      to: "0x123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Wallet not initialized");
    }
  });

  it("executes transfer and returns signer correlation fields", async () => {
    loadWalletMock.mockResolvedValue(walletFixture);
    prepareTransferFromTextMock.mockResolvedValue(transferActionFixture);
    executeTransferMock.mockResolvedValue({
      txHash: "0xtx",
      executionStatus: "SUCCEEDED",
      revertReason: null,
      signerMode: "remote",
      signerRequestId: "req-123",
      mobileActionId: "mobile_action_1",
    });

    const result = await executeTransferTool.handler({
      network: "sepolia",
      tokenSymbol: "USDC",
      amount: "1",
      to: "0x123",
      mobileActionId: "mobile_action_1",
    });

    expect(result.ok).toBe(true);
    expect(prepareTransferFromTextMock).toHaveBeenCalledTimes(1);
    expect(executeTransferMock).toHaveBeenCalledTimes(1);
    const executeArgs = executeTransferMock.mock.calls[0]?.[0];
    expect(executeArgs).toMatchObject({
      mobileActionId: "mobile_action_1",
      tool: "execute_transfer",
    });
    // Requester label should come from runtime signer config (env), not be hardcoded at tool layer.
    expect(executeArgs).not.toHaveProperty("requester");
    expect(appendActivityMock).toHaveBeenCalledTimes(1);
    expect(appendActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: "0xtx",
        status: "succeeded",
        mobileActionId: "mobile_action_1",
        signerRequestId: "req-123",
      })
    );
    if (result.ok) {
      expect(result.data).toMatchObject({
        txHash: "0xtx",
        signerMode: "remote",
        signerRequestId: "req-123",
        mobileActionId: "mobile_action_1",
      });
    }
  });

  it("records failed execution attempts with correlation metadata", async () => {
    loadWalletMock.mockResolvedValue(walletFixture);
    prepareTransferFromTextMock.mockResolvedValue(transferActionFixture);
    executeTransferMock.mockRejectedValue(new Error("Signer authentication failed (401)."));

    const result = await executeTransferTool.handler({
      network: "sepolia",
      tokenSymbol: "USDC",
      amount: "1",
      to: "0x123",
      mobileActionId: "mobile_action_fail_1",
    });

    expect(result.ok).toBe(false);
    expect(appendActivityMock).toHaveBeenCalledTimes(1);
    expect(appendActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "transfer",
        status: "unknown",
        mobileActionId: "mobile_action_fail_1",
        signerRequestId: null,
      })
    );
  });

  it.each([
    "Signer rejected replayed nonce. Retry with a fresh request.",
    "Signer authentication failed (401). Check remote signer credentials.",
    "Signer policy denied this transfer. Review session policy and limits.",
  ])("surfaces signer hard failures as deterministic tool errors: %s", async (message) => {
    loadWalletMock.mockResolvedValue(walletFixture);
    prepareTransferFromTextMock.mockResolvedValue(transferActionFixture);
    executeTransferMock.mockRejectedValue(new Error(message));

    const result = await executeTransferTool.handler({
      network: "sepolia",
      tokenSymbol: "USDC",
      amount: "1",
      to: "0x123",
      mobileActionId: "mobile_action_hard_fail",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(message);
    }
    expect(appendActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mobileActionId: "mobile_action_hard_fail",
        signerRequestId: null,
        revertReason: message,
      })
    );
  });

  it("returns network mismatch error for get_balances", async () => {
    loadWalletMock.mockResolvedValue({
      networkId: "sepolia",
      rpcUrl: "https://rpc.example",
      chainIdHex: "0x534e5f5345504f4c4941",
      ownerPublicKey: "0xaaa",
      accountAddress: "0xabc",
    });

    const result = await getBalancesTool.handler({ network: "mainnet" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Wallet network mismatch");
    }
  });

  it("loads balances through getErc20Balance", async () => {
    loadWalletMock.mockResolvedValue({
      networkId: "sepolia",
      rpcUrl: "https://rpc.example",
      chainIdHex: "0x534e5f5345504f4c4941",
      ownerPublicKey: "0xaaa",
      accountAddress: "0xabc",
    });
    getErc20BalanceMock.mockResolvedValue(123n);

    const result = await getBalancesTool.handler({ network: "sepolia" });
    expect(result.ok).toBe(true);
    expect(getErc20BalanceMock).toHaveBeenCalled();
    if (result.ok) {
      expect(result.data).toMatchObject({
        network: "sepolia",
        accountAddress: "0xabc",
      });
    }
  });

  it("prepare_transfer delegates to transfer preparation", async () => {
    loadWalletMock.mockResolvedValue(walletFixture);
    prepareTransferFromTextMock.mockResolvedValue(transferActionFixture);

    const result = await prepareTransferTool.handler({
      network: "sepolia",
      tokenSymbol: "USDC",
      amount: "1",
      to: "0x123",
    });

    expect(result.ok).toBe(true);
    expect(prepareTransferFromTextMock).toHaveBeenCalledTimes(1);
  });
});
