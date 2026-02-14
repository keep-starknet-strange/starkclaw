import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = new Map<string, string>();

vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: async (length: number) => new Uint8Array(randomBytes(length)),
}));

vi.mock("@/lib/storage/secure-store", () => ({
  secureGet: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  secureSet: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  secureDelete: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

import { executeTransfer, type TransferAction } from "@/lib/agent/transfer";
import { saveSignerCredentials } from "@/lib/signer/runtime-config";
import type { WalletSnapshot } from "@/lib/wallet/wallet";

const liveEnabled = process.env.LIVE_SEPOLIA_E2E === "1";

const requiredEnv = [
  "DEMO_SEPOLIA_RPC_URL",
  "DEMO_ACCOUNT_ADDRESS",
  "DEMO_TOKEN_ADDRESS",
  "KEYRING_HMAC_SECRET",
  "EXPO_PUBLIC_SISNA_PROXY_URL",
] as const;

function requireEnv(name: (typeof requiredEnv)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

describe("live sepolia remote signer e2e", () => {
  beforeEach(() => {
    secureStore.clear();
  });

  it.runIf(liveEnabled)(
    "captures mobile_action_id -> signer_request_id -> tx_hash",
    async () => {
    for (const key of requiredEnv) {
      requireEnv(key);
    }

    const rpcUrl = requireEnv("DEMO_SEPOLIA_RPC_URL");
    const accountAddress = requireEnv("DEMO_ACCOUNT_ADDRESS");
    const tokenAddress = requireEnv("DEMO_TOKEN_ADDRESS");

    process.env.EXPO_PUBLIC_SIGNER_MODE = "remote";
    process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
    process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED = process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED ?? "false";
    process.env.EXPO_PUBLIC_SISNA_REQUESTER = process.env.EXPO_PUBLIC_SISNA_REQUESTER ?? "starkclaw-live-e2e";

    await saveSignerCredentials({
      clientId: process.env.KEYRING_CLIENT_ID ?? "default",
      hmacSecret: requireEnv("KEYRING_HMAC_SECRET"),
      keyId: process.env.KEYRING_KEY_ID,
    });

    const wallet: WalletSnapshot = {
      networkId: "sepolia",
      rpcUrl,
      chainIdHex: "0x534e5f5345504f4c4941",
      ownerPublicKey: process.env.OWNER_PUBKEY ?? "0x0",
      accountAddress,
    };

    const validUntil = Math.floor(Date.now() / 1000) + 180;
    const mobileActionId = `mobile_action_live_${Date.now()}`;

    const action: TransferAction = {
      kind: "erc20_transfer",
      tokenSymbol: "STRK",
      tokenAddress,
      to: accountAddress,
      amount: "0.000000000000000001",
      amountBaseUnits: "1",
      balanceBaseUnits: "0",
      calldata: [accountAddress, "0x1", "0x0"],
      sessionPublicKey: process.env.SESSION_PUBLIC_KEY ?? "0x0",
      warnings: [],
      policy: {
        spendingLimitBaseUnits: "1",
        validUntil,
      },
    };

    const result = await executeTransfer({
      wallet,
      action,
      mobileActionId,
      requester: "starkclaw-live-e2e",
      tool: "execute_transfer",
    });

    expect(result.signerMode).toBe("remote");
    expect(result.mobileActionId).toBe(mobileActionId);
    expect(result.signerRequestId).toBeTruthy();
    expect(result.txHash.startsWith("0x")).toBe(true);

    const artifact = {
      network: "starknet-sepolia",
      account_address: accountAddress,
      mobile_action_id: result.mobileActionId,
      signer_request_id: result.signerRequestId,
      tx_hash: result.txHash,
      execution_status: result.executionStatus,
      revert_reason: result.revertReason,
      timestamp: new Date().toISOString(),
    };

    const outDir = path.join(
      process.cwd(),
      "tmp",
      "artifacts",
      new Date().toISOString().replace(/[:.]/g, "-")
    );
    await mkdir(outDir, { recursive: true });
    const artifactPath = path.join(outDir, "live-sepolia-remote-proof.json");
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

    // eslint-disable-next-line no-console
    console.log(`LIVE_E2E_ARTIFACT=${artifactPath}`);
    // eslint-disable-next-line no-console
    console.log(`mobile_action_id=${artifact.mobile_action_id}`);
    // eslint-disable-next-line no-console
    console.log(`signer_request_id=${artifact.signer_request_id}`);
    // eslint-disable-next-line no-console
    console.log(`tx_hash=${artifact.tx_hash}`);
    },
    180_000
  );
});
