/**
 * Activity Correlation Tests (#55)
 *
 * TDD-first: These tests FAIL until correlation IDs are persisted.
 *
 * Tests the full correlation chain:
 * mobile_action_id -> signer_request_id -> tx_hash
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "../activity";
import { appendActivity, listActivity } from "../activity";

// Mock secure storage
vi.mock("@/lib/storage/secure-store", () => ({
  secureGet: vi.fn(),
  secureSet: vi.fn(),
}));

import { secureGet, secureSet } from "@/lib/storage/secure-store";

const secureGetMock = vi.mocked(secureGet);
const secureSetMock = vi.mocked(secureSet);

describe("Activity Correlation (#55)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should persist mobileActionId when activity is appended (remote signer)", async () => {
    secureGetMock.mockResolvedValue(null);

    const activity = await appendActivity({
      networkId: "sepolia",
      kind: "transfer",
      summary: "Transfer 10 USDC",
      txHash: "0xtx123",
      status: "succeeded",
      mobileActionId: "mobile_action_1",
      signerRequestId: "req-456",
    });

    expect(activity.mobileActionId).toBe("mobile_action_1");
    expect(activity.signerRequestId).toBe("req-456");
    expect(activity.txHash).toBe("0xtx123");
  });

  it("should persist mobileActionId with null signerRequestId (local signer)", async () => {
    secureGetMock.mockResolvedValue(null);

    const activity = await appendActivity({
      networkId: "sepolia",
      kind: "transfer",
      summary: "Transfer 10 USDC",
      txHash: "0xtx789",
      status: "succeeded",
      mobileActionId: "mobile_action_2",
      signerRequestId: null,
    });

    expect(activity.mobileActionId).toBe("mobile_action_2");
    expect(activity.signerRequestId).toBe(null);
    expect(activity.txHash).toBe("0xtx789");
  });

  it("should load persisted correlation IDs from storage", async () => {
    const stored: ActivityItem[] = [
      {
        id: "1",
        createdAt: 1739404800,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Transfer 10 USDC",
        txHash: "0xtx123",
        status: "succeeded",
        mobileActionId: "mobile_action_1",
        signerRequestId: "req-456",
        executionStatus: "SUCCEEDED",
        revertReason: null,
      },
      {
        id: "2",
        createdAt: 1739404900,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Transfer 5 ETH",
        txHash: "0xtx789",
        status: "succeeded",
        mobileActionId: "mobile_action_2",
        signerRequestId: null,
        executionStatus: "SUCCEEDED",
        revertReason: null,
      },
    ];

    secureGetMock.mockResolvedValue(JSON.stringify(stored));

    const items = await listActivity();

    expect(items).toHaveLength(2);
    expect(items[0].mobileActionId).toBe("mobile_action_2");
    expect(items[0].signerRequestId).toBe(null);
    expect(items[1].mobileActionId).toBe("mobile_action_1");
    expect(items[1].signerRequestId).toBe("req-456");
  });

  it("should NOT persist fake tx hash when execution fails before submission", async () => {
    secureGetMock.mockResolvedValue(null);

    const activity = await appendActivity({
      networkId: "sepolia",
      kind: "transfer",
      summary: "Transfer 10 USDC (failed)",
      status: "reverted",
      mobileActionId: "mobile_action_3",
      signerRequestId: null,
      // NO txHash - execution failed before submission
    });

    expect(activity.mobileActionId).toBe("mobile_action_3");
    expect(activity.txHash).toBeUndefined();
  });

  it("should handle backward compat: old records without correlation IDs", async () => {
    const oldRecord: ActivityItem = {
      id: "old-1",
      createdAt: 1739404700,
      networkId: "sepolia",
      kind: "transfer",
      summary: "Old transfer",
      txHash: "0xold",
      status: "succeeded",
      // Missing mobileActionId and signerRequestId
    };

    secureGetMock.mockResolvedValue(JSON.stringify([oldRecord]));

    const items = await listActivity();

    expect(items).toHaveLength(1);
    expect(items[0].mobileActionId).toBeUndefined();
    expect(items[0].signerRequestId).toBeUndefined();
    expect(items[0].txHash).toBe("0xold");
  });
});
