import { beforeEach, describe, expect, it, vi } from "vitest";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn(async (size: number) => new Uint8Array(size).fill(1)),
}));

import * as Crypto from "expo-crypto";

import { KeyringProxySigner, KeyringProxySignerError } from "../keyring-proxy-signer";

const randomBytesMock = vi.mocked(Crypto.getRandomBytesAsync);

function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

function hmacHex(secret: string, payload: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(payload)));
}

describe("KeyringProxySigner", () => {
  const validUntil = Math.floor(Date.now() / 1000) + 3600;

  function createSigner(overrides: Partial<ConstructorParameters<typeof KeyringProxySigner>[0]> = {}) {
    return new KeyringProxySigner({
      proxyUrl: "https://signer.internal:8545",
      accountAddress: "0x1234",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      requestTimeoutMs: 5_000,
      validUntil,
      requester: "starkclaw-mobile",
      tool: "execute_transfer",
      mobileActionId: "mobile_action_default",
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    randomBytesMock.mockResolvedValue(new Uint8Array(16).fill(1));
  });

  it("throws when pubkey requested before first signature", async () => {
    const signer = createSigner();
    await expect(signer.getPubKey()).rejects.toThrow(/unavailable/i);
  });

  it("rejects unsupported sign methods", async () => {
    const signer = createSigner();
    await expect(signer.signMessage({} as never, "0x1234")).rejects.toThrow(/does not support/);
    await expect(signer.signDeclareTransaction({} as never)).rejects.toThrow(/cannot sign declare/);
    await expect(signer.signDeployAccountTransaction({} as never)).rejects.toThrow(
      /cannot sign deploy account/
    );
  });

  it("rejects expired remote signer window before network request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = createSigner({
      validUntil: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x534e5f5345504f4c4941", nonce: "0x7" } as never
      )
    ).rejects.toThrow(/already expired/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs transaction through keyring endpoint with HMAC headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestId: "req-123",
        messageHash: "0xabc",
        signature: ["0x11", "0x22", "0x33", `0x${validUntil.toString(16)}`],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = new KeyringProxySigner({
      proxyUrl: "https://signer.internal:8545",
      accountAddress: "0x1234",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      requestTimeoutMs: 5_000,
      validUntil,
      keyId: "default",
      requester: "starkclaw-mobile",
      tool: "execute_transfer",
      mobileActionId: "mobile_action_1",
    });

    const signature = await signer.signTransaction(
      [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1", "0x2", "0x0"] }],
      { chainId: "0x534e5f5345504f4c4941", nonce: "0x7" } as never
    );

    expect(signature).toEqual(["0x11", "0x22", "0x33", `0x${validUntil.toString(16)}`]);
    expect(signer.getLastRequestId()).toBe("req-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://signer.internal:8545/v1/sign/session-transaction");
    const body = String(init.body);
    const parsedBody = JSON.parse(body);
    expect(parsedBody.accountAddress).toBe("0x1234");
    expect(parsedBody.context.requester).toBe("starkclaw-mobile");
    expect(parsedBody.context.tool).toBe("execute_transfer");
    expect(parsedBody.context.client_id).toBe("mobile-client");
    expect(parsedBody.context.mobile_action_id).toBe("mobile_action_1");

    const headers = init.headers as Record<string, string>;
    expect(headers["x-keyring-client-id"]).toBe("mobile-client");
    expect(headers["x-keyring-nonce"]).toBe("01010101010101010101010101010101");
    expect(headers["x-keyring-timestamp"]).toBeDefined();
    expect(headers["x-keyring-signature"]).toBeDefined();

    const hmacPayload = `${headers["x-keyring-timestamp"]}.${headers["x-keyring-nonce"]}.POST./v1/sign/session-transaction.${sha256Hex(
      body
    )}`;
    expect(headers["x-keyring-signature"]).toBe(hmacHex("super-secret", hmacPayload));
  });

  it("normalizes non-hex chain/nonce and mixed calldata values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signature: ["0x11", "0x22", "0x33", `0x${validUntil.toString(16)}`],
        request_id: "req-snake",
        message_hash: "0xbeef",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = createSigner({
      reason: undefined,
      mobileActionId: "mobile_action_norm",
    });
    await signer.signTransaction(
      [
        {
          contractAddress: "0x99",
          entrypoint: "transfer",
          calldata: [1, 2n, { nested: true }] as never,
        },
        {
          contractAddress: "0x88",
          entrypoint: "noop",
          calldata: undefined as never,
        },
      ],
      { chainId: 123n, nonce: 7 } as never
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.chainId).toBe("0x7b");
    expect(body.nonce).toBe("0x7");
    expect(body.calls[0].calldata).toEqual(["0x1", "0x2", "[object Object]"]);
    expect(body.calls[1].calldata).toEqual([]);
    expect(body.context.reason).toBe("starkclaw mobile transfer execution");
    expect(signer.getLastRequestId()).toBe("req-snake");
    expect(signer.getLastMessageHash()).toBe("0xbeef");
  });

  it("surfaces policy denial from signer endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ error: "policy denied" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = new KeyringProxySigner({
      proxyUrl: "https://signer.internal:8545",
      accountAddress: "0x1234",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      requestTimeoutMs: 5_000,
      validUntil,
      requester: "starkclaw-mobile",
      tool: "execute_transfer",
      mobileActionId: "mobile_action_2",
    });

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1", "0x2", "0x0"] }],
        { chainId: "0x534e5f5345504f4c4941", nonce: "0x7" } as never
      )
    ).rejects.toMatchObject({
      name: "KeyringProxySignerError",
      code: "POLICY_DENIED",
    } satisfies Partial<KeyringProxySignerError>);
  });

  it("maps 401 nonce/replay errors to deterministic auth-replay code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "replay_nonce", message: "nonce already used" }),
    }) as unknown as typeof fetch;

    const signer = createSigner();
    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toMatchObject({
      name: "KeyringProxySignerError",
      code: "AUTH_REPLAY",
    } satisfies Partial<KeyringProxySignerError>);
  });

  it("maps 401 authentication failures to deterministic auth-invalid code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "invalid_signature", message: "bad signature" }),
    }) as unknown as typeof fetch;

    const signer = createSigner();
    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toMatchObject({
      name: "KeyringProxySignerError",
      code: "AUTH_INVALID",
    } satisfies Partial<KeyringProxySignerError>);
  });

  it("formats non-json and empty proxy errors", async () => {
    const signer = createSigner();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "upstream exploded",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "",
      }) as unknown as typeof fetch;

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toThrow(/upstream exploded/);

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x2" } as never
      )
    ).rejects.toThrow(/Keyring proxy error \(503\)$/);
  });

  it("rejects malformed signature response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signature: ["0x11", "0x22", "0x33"], // missing valid_until
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = new KeyringProxySigner({
      proxyUrl: "https://signer.internal:8545",
      accountAddress: "0x1234",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      requestTimeoutMs: 5_000,
      validUntil,
      requester: "starkclaw-mobile",
      tool: "execute_transfer",
      mobileActionId: "mobile_action_3",
    });

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1", "0x2", "0x0"] }],
        { chainId: "0x534e5f5345504f4c4941", nonce: "0x7" } as never
      )
    ).rejects.toThrow(/expected \[pubkey, r, s, valid_until\]/i);
  });

  it("rejects non-hex signature felts", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signature: ["0x11", "0x22", "not-hex", `0x${validUntil.toString(16)}`],
      }),
    }) as unknown as typeof fetch;

    const signer = createSigner();
    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toThrow(/must be hex/i);
  });

  it("rejects if sessionPublicKey conflicts with signature pubkey", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionPublicKey: "0x12",
        signature: ["0x11", "0x22", "0x33", `0x${validUntil.toString(16)}`],
      }),
    }) as unknown as typeof fetch;
    const signer = createSigner();

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toThrow(/does not match signature pubkey/i);
  });

  it("rejects if signature valid_until mismatches request window", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signature: ["0x11", "0x22", "0x33", `0x${(validUntil - 1).toString(16)}`],
      }),
    }) as unknown as typeof fetch;
    const signer = createSigner();

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toThrow(/valid_until does not match/i);
  });

  it("rejects if session public key changes across successful responses", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionPublicKey: "0x11",
          signature: ["0x11", "0x22", "0x33", `0x${validUntil.toString(16)}`],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionPublicKey: "0x12",
          signature: ["0x12", "0x22", "0x33", `0x${validUntil.toString(16)}`],
        }),
      }) as unknown as typeof fetch;

    const signer = createSigner();
    await signer.signTransaction(
      [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
      { chainId: "0x1", nonce: "0x1" } as never
    );
    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x2"] }],
        { chainId: "0x1", nonce: "0x2" } as never
      )
    ).rejects.toThrow(/changed unexpectedly/i);
  });

  it("rethrows non-abort network failures", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const signer = createSigner();
    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1"] }],
        { chainId: "0x1", nonce: "0x1" } as never
      )
    ).rejects.toThrow(/network down/i);
  });

  it("times out when signer endpoint does not respond", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const abortSignal = init.signal;
        abortSignal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as Error & { name: string }).name = "AbortError";
          reject(err);
        });
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const signer = new KeyringProxySigner({
      proxyUrl: "https://signer.internal:8545",
      accountAddress: "0x1234",
      clientId: "mobile-client",
      hmacSecret: "super-secret",
      requestTimeoutMs: 1,
      validUntil,
      requester: "starkclaw-mobile",
      tool: "execute_transfer",
      mobileActionId: "mobile_action_4",
    });

    await expect(
      signer.signTransaction(
        [{ contractAddress: "0x99", entrypoint: "transfer", calldata: ["0x1", "0x2", "0x0"] }],
        { chainId: "0x534e5f5345504f4c4941", nonce: "0x7" } as never
      )
    ).rejects.toMatchObject({
      name: "KeyringProxySignerError",
      code: "TIMEOUT",
    } satisfies Partial<KeyringProxySignerError>);
  });
});
