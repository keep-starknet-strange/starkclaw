import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/secure-store", () => ({
  secureGet: vi.fn(async () => null),
  secureSet: vi.fn(async () => {}),
  secureDelete: vi.fn(async () => {}),
}));

const hoisted = vi.hoisted(() => {
  const initializeSslPinning = vi.fn(async () => {});
  const isSslPinningAvailable = vi.fn(() => true);
  return {
    initializeSslPinning,
    isSslPinningAvailable,
    loader: vi.fn(async () => ({
      initializeSslPinning,
      isSslPinningAvailable,
    })),
  };
});

import {
  ensureSignerCertificatePinning,
  setPinningModuleLoaderForTests,
  resetSignerCertificatePinningForTests,
} from "../pinning";

describe("signer certificate pinning", () => {
  const baseConfig = {
    proxyUrl: "https://signer.internal:8545",
    pinnedPublicKeyHashes: [
      "CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=",
      "hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
    ],
    pinningIncludeSubdomains: false,
    pinningExpirationDate: undefined,
  };

  beforeEach(() => {
    resetSignerCertificatePinningForTests();
    setPinningModuleLoaderForTests(hoisted.loader);
    hoisted.loader.mockReset();
    hoisted.loader.mockResolvedValue({
      initializeSslPinning: hoisted.initializeSslPinning,
      isSslPinningAvailable: hoisted.isSslPinningAvailable,
    });
    hoisted.initializeSslPinning.mockReset();
    hoisted.initializeSslPinning.mockResolvedValue(undefined);
    hoisted.isSslPinningAvailable.mockReset();
    hoisted.isSslPinningAvailable.mockReturnValue(true);
  });

  it("initializes pinning for signer hostname with configured hashes", async () => {
    await ensureSignerCertificatePinning(baseConfig);

    expect(hoisted.initializeSslPinning).toHaveBeenCalledTimes(1);
    expect(hoisted.initializeSslPinning).toHaveBeenCalledWith({
      "signer.internal": {
        includeSubdomains: false,
        publicKeyHashes: baseConfig.pinnedPublicKeyHashes,
        expirationDate: undefined,
      },
    });
  });

  it("avoids duplicate pinning initialization for same config", async () => {
    await ensureSignerCertificatePinning(baseConfig);
    await ensureSignerCertificatePinning(baseConfig);

    expect(hoisted.initializeSslPinning).toHaveBeenCalledTimes(1);
  });

  it("fails closed when pinning module is unavailable", async () => {
    hoisted.isSslPinningAvailable.mockReturnValue(false);

    await expect(ensureSignerCertificatePinning(baseConfig)).rejects.toMatchObject({
      code: "PINNING_UNAVAILABLE",
    });
  });

  it("surfaces deterministic error when pinning initialization fails", async () => {
    hoisted.initializeSslPinning.mockRejectedValue(new Error("bad pins"));

    await expect(ensureSignerCertificatePinning(baseConfig)).rejects.toMatchObject({
      code: "PINNING_INIT_FAILED",
    });
  });

  it("surfaces deterministic error when pinning module cannot be loaded", async () => {
    hoisted.loader.mockRejectedValue(new Error("module missing"));

    await expect(ensureSignerCertificatePinning(baseConfig)).rejects.toMatchObject({
      code: "PINNING_UNAVAILABLE",
    });
  });
});
