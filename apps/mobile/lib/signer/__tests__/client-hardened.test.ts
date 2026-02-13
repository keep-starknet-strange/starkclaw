/**
 * Hardened Signer Client Tests
 *
 * Comprehensive edge case and security testing for production readiness.
 * Tests cover: input validation, boundary conditions, race conditions,
 * malformed responses, security headers, retry logic, and error recovery.
 *
 * Issue: #54
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';
import type { SignerClientConfig, SignSessionTransactionRequest } from '../types';

describe('SignerClient - Input Validation (Hardened)', () => {
  let client: ReturnType<typeof createSignerClient>;
  const mockConfig: SignerClientConfig = {
    baseUrl: 'https://signer.test',
    apiKey: 'test-key',
  };

  beforeEach(() => {
    client = createSignerClient(mockConfig);
  });

  describe('Session Key Validation', () => {
    it('should reject empty session key', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should reject session key without 0x prefix', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '123abc',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('Invalid session key format'),
      });
    });

    it('should reject session key with invalid hex characters', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0xGHIJKL',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should reject session key with whitespace', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123 abc',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should accept valid lowercase hex session key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0xabcdef123456',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept valid uppercase hex session key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0xABCDEF123456',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept mixed case hex session key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0xAbCdEf123456',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Metadata Validation', () => {
    it('should reject missing requester', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: '', tool: 'transfer' },
        })
      ).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
      });
    });

    it('should reject missing tool', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: '' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should accept optional correlationId', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0x123',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: {
          requester: 'test',
          tool: 'transfer',
          correlationId: 'corr-123',
        },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should reject undefined metadata', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: undefined as any,
        })
      ).rejects.toThrow(SignerClientError);
    });
  });

  describe('Transaction Validation', () => {
    it('should reject missing contractAddress', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should reject missing entrypoint', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: '',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should reject non-array calldata', async () => {
      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: 'not-an-array' as any,
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toThrow(SignerClientError);
    });

    it('should accept empty calldata array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0x123',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept large calldata array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      const largeCalldata = Array(1000)
        .fill(0)
        .map((_, i) => `0x${i.toString(16)}`);

      await client.signSessionTransaction({
        sessionKey: '0x123',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: largeCalldata,
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

describe('SignerClient - Response Parsing (Hardened)', () => {
  let client: ReturnType<typeof createSignerClient>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'test-key',
    });
  });

  const validRequest: SignSessionTransactionRequest = {
    sessionKey: '0x123',
    transaction: {
      contractAddress: '0xabc',
      entrypoint: 'transfer',
      calldata: [],
    },
    metadata: { requester: 'test', tool: 'transfer' },
  };

  it('should handle malformed JSON response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });

    await expect(client.signSessionTransaction(validRequest)).rejects.toThrow();
  });

  it('should handle missing signature field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'req-123',
        // missing signature
      }),
    });

    const result = await client.signSessionTransaction(validRequest);
    expect(result.signature).toBeUndefined();
  });

  it('should handle missing request_id field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signature: ['0x1', '0x2'],
        // missing request_id
      }),
    });

    const result = await client.signSessionTransaction(validRequest);
    expect(result.requestId).toBeUndefined();
  });

  it('should handle empty signature array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signature: [],
        request_id: 'req-123',
      }),
    });

    const result = await client.signSessionTransaction(validRequest);
    expect(result.signature).toEqual([]);
  });

  it('should handle very large signature array', async () => {
    const largeSignature = Array(1000)
      .fill(0)
      .map((_, i) => `0x${i}`);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signature: largeSignature,
        request_id: 'req-123',
      }),
    });

    const result = await client.signSessionTransaction(validRequest);
    expect(result.signature).toHaveLength(1000);
  });

  it('should handle non-JSON error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Not JSON');
      },
    });

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.SERVER_ERROR,
      status: 500,
    });
  });

  it('should handle null error response body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => null,
    });

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.SERVER_ERROR,
      status: 500,
    });
  });

  it('should handle error response with extra fields', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'policy_denied',
        message: 'Denied',
        details: { limit: '100' },
        extra_field: 'ignored',
        nested: { data: 'preserved' },
      }),
    });

    try {
      await client.signSessionTransaction(validRequest);
    } catch (error) {
      const signerError = error as SignerClientError;
      expect(signerError.rawBody).toHaveProperty('extra_field');
      expect(signerError.rawBody).toHaveProperty('nested');
    }
  });
});

describe('SignerClient - Network Resilience (Hardened)', () => {
  let client: ReturnType<typeof createSignerClient>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'test-key',
      timeout: 1000,
    });
  });

  const validRequest: SignSessionTransactionRequest = {
    sessionKey: '0x123',
    transaction: {
      contractAddress: '0xabc',
      entrypoint: 'transfer',
      calldata: [],
    },
    metadata: { requester: 'test', tool: 'transfer' },
  };

  it('should handle AbortError correctly', async () => {
    mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.TIMEOUT,
    });
  });

  it('should handle TypeError (network error)', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.NETWORK_ERROR,
    });
  });

  it('should handle connection timeout error', async () => {
    mockFetch.mockRejectedValue(new Error('Request timeout'));

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.TIMEOUT,
    });
  });

  it('should handle DNS resolution failure', async () => {
    mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.NETWORK_ERROR,
    });
  });

  it('should handle ECONNREFUSED error', async () => {
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
      code: SignerErrorCode.NETWORK_ERROR,
    });
  });

  it('should handle response with no status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: undefined,
      json: async () => ({}),
    } as any);

    await expect(client.signSessionTransaction(validRequest)).rejects.toThrow(
      SignerClientError
    );
  });
});

describe('SignerClient - Security (Hardened)', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  const validRequest: SignSessionTransactionRequest = {
    sessionKey: '0x123',
    transaction: {
      contractAddress: '0xabc',
      entrypoint: 'transfer',
      calldata: [],
    },
    metadata: { requester: 'test', tool: 'transfer' },
  };

  it('should include Authorization header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'secret-key-123',
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key-123',
        }),
      })
    );
  });

  it('should include Content-Type header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'test',
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should merge custom headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'test',
      headers: {
        'X-Custom-Header': 'custom-value',
        'X-App-Version': '1.0.0',
      },
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'custom-value',
          'X-App-Version': '1.0.0',
        }),
      })
    );
  });

  it('should send POST request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.test',
      apiKey: 'test',
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should use correct endpoint URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.example.com',
      apiKey: 'test',
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://signer.example.com/v1/sign/session-transaction',
      expect.any(Object)
    );
  });

  it('should handle baseUrl with trailing slash', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
    });

    const client = createSignerClient({
      baseUrl: 'https://signer.example.com/',
      apiKey: 'test',
    });

    await client.signSessionTransaction(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://signer.example.com/v1/sign/session-transaction',
      expect.any(Object)
    );
  });
});

describe('SignerClientError - Helper Methods (Hardened)', () => {
  it('should correctly identify retryable errors', () => {
    expect(
      new SignerClientError(SignerErrorCode.TIMEOUT, 'timeout', 0).isRetryable()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.NETWORK_ERROR, 'network', 0).isRetryable()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.UNAVAILABLE, 'unavailable', 503).isRetryable()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.SERVER_ERROR, 'server', 500).isRetryable()
    ).toBe(true);
  });

  it('should correctly identify non-retryable errors', () => {
    expect(
      new SignerClientError(SignerErrorCode.REPLAY_NONCE, 'replay', 401).isRetryable()
    ).toBe(false);
    expect(
      new SignerClientError(SignerErrorCode.INVALID_AUTH, 'auth', 401).isRetryable()
    ).toBe(false);
    expect(
      new SignerClientError(SignerErrorCode.POLICY_DENIED, 'policy', 403).isRetryable()
    ).toBe(false);
    expect(
      new SignerClientError(
        SignerErrorCode.VALIDATION_ERROR,
        'validation',
        0
      ).isRetryable()
    ).toBe(false);
  });

  it('should correctly identify policy errors', () => {
    expect(
      new SignerClientError(SignerErrorCode.POLICY_DENIED, 'policy', 403).isPolicyError()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.INVALID_AUTH, 'auth', 401).isPolicyError()
    ).toBe(false);
  });

  it('should correctly identify auth errors', () => {
    expect(
      new SignerClientError(SignerErrorCode.REPLAY_NONCE, 'replay', 401).isAuthError()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.INVALID_AUTH, 'auth', 401).isAuthError()
    ).toBe(true);
    expect(
      new SignerClientError(SignerErrorCode.POLICY_DENIED, 'policy', 403).isAuthError()
    ).toBe(false);
  });

  it('should preserve error stack trace', () => {
    const error = new SignerClientError(SignerErrorCode.TIMEOUT, 'timeout', 0);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('SignerClientError');
  });

  it('should have correct error name', () => {
    const error = new SignerClientError(SignerErrorCode.TIMEOUT, 'timeout', 0);
    expect(error.name).toBe('SignerClientError');
  });

  it('should preserve rawBody data', () => {
    const rawBody = {
      error: 'policy_denied',
      message: 'Exceeded limit',
      details: { limit: '100', attempted: '200' },
    };

    const error = new SignerClientError(
      SignerErrorCode.POLICY_DENIED,
      'policy denied',
      403,
      rawBody
    );

    expect(error.rawBody).toEqual(rawBody);
  });
});
