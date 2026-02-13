import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/secure-store", () => ({
  secureGet: vi.fn(),
  secureSet: vi.fn(),
  secureDelete: vi.fn(),
}));

import { secureDelete, secureGet, secureSet } from "@/lib/storage/secure-store";

import {
  clearSignerCredentials,
  loadSignerCredentials,
  SignerRuntimeConfigError,
  getSignerMode,
  loadRemoteSignerRuntimeConfig,
  saveSignerCredentials,
} from "../runtime-config";

const secureGetMock = vi.mocked(secureGet);
const secureSetMock = vi.mocked(secureSet);
const secureDeleteMock = vi.mocked(secureDelete);
const originalEnv = process.env;

function resetEnv() {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
  };
  delete process.env.EXPO_PUBLIC_SIGNER_MODE;
  delete process.env.EXPO_PUBLIC_SISNA_PROXY_URL;
  delete process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED;
  delete process.env.EXPO_PUBLIC_SISNA_REQUEST_TIMEOUT_MS;
  delete process.env.EXPO_PUBLIC_SISNA_REQUESTER;
}

describe("runtime-config", () => {
  beforeEach(() => {
    resetEnv();
    secureGetMock.mockReset();
    secureSetMock.mockReset();
    secureDeleteMock.mockReset();
  });

  it("defaults signer mode to local", () => {
    expect(getSignerMode()).toBe("local");
  });

  it("returns remote signer mode when explicitly configured", () => {
    process.env.EXPO_PUBLIC_SIGNER_MODE = "remote";
    expect(getSignerMode()).toBe("remote");
  });

  it("falls back to local signer mode for unknown values", () => {
    process.env.EXPO_PUBLIC_SIGNER_MODE = "REMOTE ";
    expect(getSignerMode()).toBe("remote");
    process.env.EXPO_PUBLIC_SIGNER_MODE = "something-else";
    expect(getSignerMode()).toBe("local");
  });

  it("fails remote mode when proxy url is missing", async () => {
    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      name: "SignerRuntimeConfigError",
      code: "MISSING_PROXY_URL",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("rejects non-https non-loopback transport", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "http://signer.internal:8545";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      code: "INSECURE_TRANSPORT",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("rejects invalid proxy URL", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "://";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      code: "INVALID_PROXY_URL",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("allows http loopback transport in non-production environments", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "http://127.0.0.1:8545";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).resolves.toMatchObject({
      proxyUrl: "http://127.0.0.1:8545/",
      mtlsRequired: false,
      requestTimeoutMs: 8000,
      requester: "starkclaw-mobile",
    });
  });

  it("requires mtls marker in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED = "false";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      code: "MTLS_REQUIRED",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("accepts production mode when mtls marker is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED = "yes";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).resolves.toMatchObject({
      mtlsRequired: true,
    });
  });

  it("fails when signer credentials are missing", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    secureGetMock.mockResolvedValue(null);

    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      code: "MISSING_CREDENTIALS",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("fails when signer credentials are blank", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "   ",
        hmacSecret: "   ",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<SignerRuntimeConfigError>);
  });

  it("loads validated remote config with secure-store credentials", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED = "true";
    process.env.EXPO_PUBLIC_SISNA_REQUEST_TIMEOUT_MS = "9000";
    process.env.EXPO_PUBLIC_SISNA_REQUESTER = "starkclaw-tests";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
        keyId: "ops",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).resolves.toEqual({
      proxyUrl: "https://signer.internal:8545/",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      keyId: "ops",
      requestTimeoutMs: 9000,
      requester: "starkclaw-tests",
      mtlsRequired: true,
    });
  });

  it("uses default timeout/requester when env values are invalid", async () => {
    process.env.EXPO_PUBLIC_SISNA_PROXY_URL = "https://signer.internal:8545";
    process.env.EXPO_PUBLIC_SISNA_REQUEST_TIMEOUT_MS = "-123";
    process.env.EXPO_PUBLIC_SISNA_REQUESTER = "   ";
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
      })
    );

    await expect(loadRemoteSignerRuntimeConfig()).resolves.toMatchObject({
      requestTimeoutMs: 8000,
      requester: "starkclaw-mobile",
    });
  });

  it("can persist and clear credentials in secure storage", async () => {
    await saveSignerCredentials({
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      keyId: "ops",
    });
    expect(secureSetMock).toHaveBeenCalledWith(
      "starkclaw.signer.credentials.v1",
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
        keyId: "ops",
      })
    );

    await clearSignerCredentials();
    expect(secureDeleteMock).toHaveBeenCalledWith("starkclaw.signer.credentials.v1");
  });

  it("loads credentials when secure storage JSON is valid", async () => {
    secureGetMock.mockResolvedValue(
      JSON.stringify({
        clientId: "mobile-client",
        hmacSecret: "super-secret",
        keyId: "ops",
      })
    );

    await expect(loadSignerCredentials()).resolves.toEqual({
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      keyId: "ops",
    });
  });

  it("returns null for malformed or incomplete stored credentials", async () => {
    secureGetMock.mockResolvedValue("not json");
    await expect(loadSignerCredentials()).resolves.toBeNull();

    secureGetMock.mockResolvedValue(JSON.stringify(null));
    await expect(loadSignerCredentials()).resolves.toBeNull();

    secureGetMock.mockResolvedValue(JSON.stringify({}));
    await expect(loadSignerCredentials()).resolves.toBeNull();
  });
});
