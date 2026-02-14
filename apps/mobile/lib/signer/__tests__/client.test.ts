/**
 * SISNA Signer Client Unit Tests
 *
 * TDD-first: These tests define the contract for the signer client.
 * All tests should FAIL until implementation is complete.
 *
 * Scope: #54 groundwork only (no execution wiring)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';
import type { SignerClientConfig, SignSessionTransactionRequest } from '../types';

describe('SignerClient - Error Mapping', () => {
  let client: ReturnType<typeof createSignerClient>;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig: SignerClientConfig = {
    baseUrl: 'https://signer.example.com',
    apiKey: 'test-api-key',
    timeout: 5000,
  };

  const mockRequest: SignSessionTransactionRequest = {
    sessionKey: '0x123',
    transaction: {
      contractAddress: '0xabc',
      entrypoint: 'transfer',
      calldata: ['0x1', '0x100', '0x0'],
    },
    metadata: {
      requester: 'test-app',
      tool: 'transfer',
    },
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = createSignerClient(mockConfig);
  });

  it('should map 200 success to SignSessionTransactionResponse', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signature: ['0xsig1', '0xsig2'],
        request_id: 'req-123',
      }),
    });

    const result = await client.signSessionTransaction(mockRequest);

    expect(result).toEqual({
      signature: ['0xsig1', '0xsig2'],
      requestId: 'req-123',
    });
  });

  it('should map 401 replay nonce to REPLAY_NONCE error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'replay_nonce',
        message: 'Nonce already used',
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(SignerClientError);
      expect((error as SignerClientError).code).toBe(SignerErrorCode.REPLAY_NONCE);
      expect((error as SignerClientError).status).toBe(401);
      expect((error as SignerClientError).message).toContain('Nonce already used');
    }
  });

  it('should map 401 invalid signature/auth to INVALID_AUTH error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'invalid_signature',
        message: 'Signature verification failed',
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.INVALID_AUTH);
      expect((error as SignerClientError).status).toBe(401);
    }
  });

  it('should map 403 policy denied to POLICY_DENIED error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'policy_denied',
        message: 'Transaction exceeds spending limit',
        details: { limit: '1000', attempted: '2000' },
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.POLICY_DENIED);
      expect((error as SignerClientError).status).toBe(403);
      expect((error as SignerClientError).rawBody).toHaveProperty('details');
    }
  });

  it('should map 500 server error to SERVER_ERROR', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'internal_server_error',
        message: 'Database connection failed',
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.SERVER_ERROR);
      expect((error as SignerClientError).status).toBe(500);
    }
  });

  it('should map 503 unavailable to UNAVAILABLE error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'service_unavailable',
        message: 'Signer service is temporarily unavailable',
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.UNAVAILABLE);
      expect((error as SignerClientError).status).toBe(503);
    }
  });

  it('should map network timeout to TIMEOUT error', async () => {
    mockFetch.mockRejectedValue(new Error('Request timeout'));

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.TIMEOUT);
      expect((error as SignerClientError).status).toBe(0);
    }
  });

  it('should map network error to NETWORK_ERROR', async () => {
    mockFetch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.NETWORK_ERROR);
    }
  });

  it('should map unknown status codes to UNKNOWN_ERROR', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 418, // I'm a teapot
      json: async () => ({
        error: 'unexpected',
      }),
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toThrow(SignerClientError);

    try {
      await client.signSessionTransaction(mockRequest);
    } catch (error) {
      expect((error as SignerClientError).code).toBe(SignerErrorCode.UNKNOWN_ERROR);
      expect((error as SignerClientError).status).toBe(418);
    }
  });

  it('should include correlation ID in request if provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signature: ['0xsig'],
        request_id: 'req-456',
      }),
    });

    const requestWithCorrelation = {
      ...mockRequest,
      metadata: {
        ...mockRequest.metadata,
        correlationId: 'corr-789',
      },
    };

    await client.signSessionTransaction(requestWithCorrelation);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Correlation-ID': 'corr-789',
        }),
      })
    );
  });

  it('should respect timeout configuration', async () => {
    const timeoutClient = createSignerClient({ ...mockConfig, timeout: 100 });

    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );

    await expect(timeoutClient.signSessionTransaction(mockRequest)).rejects.toThrow(
      SignerClientError
    );
  });
});

describe('SignerClient - Request Validation', () => {
  let client: ReturnType<typeof createSignerClient>;

  const mockConfig: SignerClientConfig = {
    baseUrl: 'https://signer.example.com',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    client = createSignerClient(mockConfig);
  });

  it('should reject invalid session key format', async () => {
    const invalidRequest = {
      sessionKey: 'invalid',
      transaction: {
        contractAddress: '0xabc',
        entrypoint: 'transfer',
        calldata: ['0x1'],
      },
      metadata: {
        requester: 'test',
        tool: 'transfer',
      },
    };

    await expect(client.signSessionTransaction(invalidRequest as any)).rejects.toThrow();
  });

  it('should reject missing metadata fields', async () => {
    const invalidRequest = {
      sessionKey: '0x123',
      transaction: {
        contractAddress: '0xabc',
        entrypoint: 'transfer',
        calldata: ['0x1'],
      },
      metadata: {} as any,
    };

    await expect(client.signSessionTransaction(invalidRequest)).rejects.toThrow();
  });
});
