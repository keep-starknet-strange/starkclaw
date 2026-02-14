/**
 * Audit Export Correlation Tests (#55)
 *
 * TDD-first: These tests FAIL until correlation IDs are included in export.
 *
 * Ensures audit export includes:
 * - mobileActionId
 * - signerRequestId (nullable for local mode)
 * - txHash
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "../activity";
import { buildLiveAuditBundle } from "../audit-export";

// Mock activity module
vi.mock("../activity", () => ({
  listActivity: vi.fn(),
}));

import { listActivity } from "../activity";

const listActivityMock = vi.mocked(listActivity);

describe("Audit Export Correlation (#55)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should include mobileActionId and signerRequestId in audit export (remote signer)", async () => {
    const activities: ActivityItem[] = [
      {
        id: "1",
        createdAt: 1739448000,
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
    ];

    listActivityMock.mockResolvedValue(activities);

    const bundle = await buildLiveAuditBundle("sepolia", "0xabc");

    expect(bundle.activity).toHaveLength(1);
    expect(bundle.activity[0]).toMatchObject({
      createdAt: 1739448000,
      kind: "transfer",
      summary: "Transfer 10 USDC",
      txHash: "0xtx123",
      status: "succeeded",
      mobileActionId: "mobile_action_1",
      signerRequestId: "req-456",
    });
  });

  it("should include mobileActionId with null signerRequestId (local signer)", async () => {
    const activities: ActivityItem[] = [
      {
        id: "2",
        createdAt: 1739448100,
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

    listActivityMock.mockResolvedValue(activities);

    const bundle = await buildLiveAuditBundle("sepolia", "0xabc");

    expect(bundle.activity).toHaveLength(1);
    expect(bundle.activity[0]).toMatchObject({
      mobileActionId: "mobile_action_2",
      signerRequestId: null,
      txHash: "0xtx789",
    });
  });

  it("should handle missing correlation IDs in export (backward compat)", async () => {
    const activities: ActivityItem[] = [
      {
        id: "old-1",
        createdAt: 1739447900,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Old transfer",
        txHash: "0xold",
        status: "succeeded",
        // No mobileActionId or signerRequestId (old records)
      },
    ];

    listActivityMock.mockResolvedValue(activities);

    const bundle = await buildLiveAuditBundle("sepolia", "0xabc");

    expect(bundle.activity).toHaveLength(1);
    expect(bundle.activity[0]).toMatchObject({
      txHash: "0xold",
    });
    // mobileActionId and signerRequestId should be undefined (not in old records)
    expect(bundle.activity[0].mobileActionId).toBeUndefined();
    expect(bundle.activity[0].signerRequestId).toBeUndefined();
  });

  it("should maintain schema consistency: all expected fields present", async () => {
    const activities: ActivityItem[] = [
      {
        id: "1",
        createdAt: 1739448000,
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
    ];

    listActivityMock.mockResolvedValue(activities);

    const bundle = await buildLiveAuditBundle("sepolia", "0xabc");

    expect(bundle).toHaveProperty("schemaVersion");
    expect(bundle).toHaveProperty("appVersion");
    expect(bundle).toHaveProperty("exportedAt");
    expect(bundle).toHaveProperty("mode", "live");
    expect(bundle).toHaveProperty("account");
    expect(bundle).toHaveProperty("activity");

    const activity = bundle.activity[0];
    expect(activity).toHaveProperty("createdAt");
    expect(activity).toHaveProperty("kind");
    expect(activity).toHaveProperty("summary");
    expect(activity).toHaveProperty("txHash");
    expect(activity).toHaveProperty("status");
    expect(activity).toHaveProperty("mobileActionId");
    expect(activity).toHaveProperty("signerRequestId");
  });

  it("should export multiple activities with correlation chain", async () => {
    const activities: ActivityItem[] = [
      {
        id: "1",
        createdAt: 1739448000,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Transfer 10 USDC",
        txHash: "0xtx1",
        status: "succeeded",
        mobileActionId: "mobile_action_1",
        signerRequestId: "req-1",
        executionStatus: "SUCCEEDED",
        revertReason: null,
      },
      {
        id: "2",
        createdAt: 1739448100,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Transfer 5 ETH",
        txHash: "0xtx2",
        status: "succeeded",
        mobileActionId: "mobile_action_2",
        signerRequestId: null,
        executionStatus: "SUCCEEDED",
        revertReason: null,
      },
      {
        id: "3",
        createdAt: 1739448200,
        networkId: "sepolia",
        kind: "transfer",
        summary: "Transfer failed",
        status: "reverted",
        mobileActionId: "mobile_action_3",
        signerRequestId: "req-3",
        revertReason: "Insufficient balance",
      },
    ];

    listActivityMock.mockResolvedValue(activities);

    const bundle = await buildLiveAuditBundle("sepolia", "0xabc");

    expect(bundle.activity).toHaveLength(3);

    // Remote signer success
    expect(bundle.activity[0]).toMatchObject({
      mobileActionId: "mobile_action_1",
      signerRequestId: "req-1",
      txHash: "0xtx1",
    });

    // Local signer success
    expect(bundle.activity[1]).toMatchObject({
      mobileActionId: "mobile_action_2",
      signerRequestId: null,
      txHash: "0xtx2",
    });

    // Remote signer failure (has signerRequestId, no txHash)
    expect(bundle.activity[2]).toMatchObject({
      mobileActionId: "mobile_action_3",
      signerRequestId: "req-3",
      revertReason: "Insufficient balance",
    });
    expect(bundle.activity[2].txHash).toBeUndefined();
  });
});
