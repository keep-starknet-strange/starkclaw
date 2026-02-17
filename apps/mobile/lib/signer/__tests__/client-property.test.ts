/**
 * Property-based tests for the SISNA signer client.
 * Verifies validation and mapping invariants across broad input ranges.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';

describe('SignerClient - Property-Based Tests', () => {
  describe('Session Key Format Invariants', () => {
    it('should accept any valid hex string with 0x prefix', () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      // Generate various length hex strings
      const hexLengths = [2, 4, 8, 16, 32, 64, 128, 256];

      hexLengths.forEach((length) => {
        const hexString =
          '0x' +
          Array(length)
            .fill(0)
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('');

        expect(() =>
          client.signSessionTransaction({
            sessionKey: hexString,
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          })
        ).not.toThrow(SignerClientError);
      });
    });

    it('should reject any string without 0x prefix', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      // Generate invalid strings
      const invalidPrefixes = ['', '0X', '0o', '0b', '1x', 'x', '00x'];

      for (const prefix of invalidPrefixes) {
        await expect(
          client.signSessionTransaction({
            sessionKey: prefix + 'abc123',
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          })
        ).rejects.toThrow(SignerClientError);
      }
    });

    it('should reject hex strings with non-hex characters', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      const invalidChars = ['g', 'h', 'z', ' ', '!', '@', '#'];

      for (const char of invalidChars) {
        await expect(
          client.signSessionTransaction({
            sessionKey: `0xabc${char}def`,
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          })
        ).rejects.toThrow(SignerClientError);
      }
    });
  });

  describe('HTTP Status Code Mapping Invariants', () => {
    it('should map all 4xx codes (except specific ones) to appropriate errors', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      // Test all 4xx status codes
      const codes4xx = [400, 402, 404, 405, 406, 408, 409, 410, 429];

      for (const code of codes4xx) {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: code,
          json: async () => ({ error: 'client_error', message: `Error ${code}` }),
        });
        global.fetch = mockFetch;

        try {
          await client.signSessionTransaction({
            sessionKey: '0x123',
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          });
          throw new Error('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(SignerClientError);
          expect((error as SignerClientError).status).toBe(code);
        }
      }
    });

    it('should map all 5xx codes to SERVER_ERROR or UNAVAILABLE', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      const codes5xx = [500, 501, 502, 504, 505, 507, 508, 510, 511];

      for (const code of codes5xx) {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: code,
          json: async () => ({ error: 'server_error', message: `Error ${code}` }),
        });
        global.fetch = mockFetch;

        try {
          await client.signSessionTransaction({
            sessionKey: '0x123',
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          });
          throw new Error('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(SignerClientError);
          const signerError = error as SignerClientError;
          expect(signerError.status).toBe(code);
          expect([SignerErrorCode.SERVER_ERROR, SignerErrorCode.UNAVAILABLE]).toContain(
            signerError.code
          );
        }
      }
    });

    it('should always throw SignerClientError for non-ok responses', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      // Test random non-ok status codes
      const allCodes = Array(100)
        .fill(0)
        .map(() => 300 + Math.floor(Math.random() * 300));

      for (const code of allCodes) {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: code,
          json: async () => ({ error: 'error', message: 'Error' }),
        });
        global.fetch = mockFetch;

        try {
          await client.signSessionTransaction({
            sessionKey: '0x123',
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          });
          throw new Error('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(SignerClientError);
        }
      }
    });
  });

  describe('Calldata Array Invariants', () => {
    it('should accept calldata arrays of any length', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
      });
      global.fetch = mockFetch;

      const lengths = [0, 1, 5, 10, 50, 100, 500];

      for (const length of lengths) {
        const calldata = Array(length)
          .fill(0)
          .map((_, i) => `0x${i}`);

        await client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata,
          },
          metadata: { requester: 'test', tool: 'transfer' },
        });

        expect(mockFetch).toHaveBeenCalled();
      }
    });

    it('should preserve calldata element order', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      let sentBody: any;
      const mockFetch = vi.fn().mockImplementation(async (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
        };
      });
      global.fetch = mockFetch;

      const calldata = ['0x1', '0x2', '0x3', '0x4', '0x5'];

      await client.signSessionTransaction({
        sessionKey: '0x123',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata,
        },
        metadata: { requester: 'test', tool: 'transfer' },
      });

      expect(sentBody.transaction.calldata).toEqual(calldata);
    });
  });

  describe('Timeout Invariant', () => {
    it('should respect any timeout value > 0', async () => {
      const timeouts = [1, 10, 100, 500, 1000];

      for (const timeout of timeouts) {
        const client = createSignerClient({
          baseUrl: 'https://test.com',
          apiKey: 'key',
          timeout,
        });

        const mockFetch = vi.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
                });
              }, timeout / 2)
            )
        );
        global.fetch = mockFetch;

        // Should succeed because delay is less than timeout
        await expect(
          client.signSessionTransaction({
            sessionKey: '0x123',
            transaction: {
              contractAddress: '0xabc',
              entrypoint: 'transfer',
              calldata: [],
            },
            metadata: { requester: 'test', tool: 'transfer' },
          })
        ).resolves.toBeDefined();
      }
    });

    it('should timeout for any delay > timeout value', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
        timeout: 100,
      });

      const mockFetch = vi.fn().mockImplementation((_url, opts) => {
        const signal = (opts as { signal?: AbortSignal } | undefined)?.signal;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
            });
          }, 200);

          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('Request timeout'));
            },
            { once: true }
          );
        });
      });
      global.fetch = mockFetch;

      await expect(
        client.signSessionTransaction({
          sessionKey: '0x123',
          transaction: {
            contractAddress: '0xabc',
            entrypoint: 'transfer',
            calldata: [],
          },
          metadata: { requester: 'test', tool: 'transfer' },
        })
      ).rejects.toMatchObject({
        code: SignerErrorCode.TIMEOUT,
      });
    });
  });

  describe('Request Serialization Invariants', () => {
    it('should always send valid JSON', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      let sentBody: string;
      const mockFetch = vi.fn().mockImplementation(async (url, opts) => {
        sentBody = opts.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
        };
      });
      global.fetch = mockFetch;

      await client.signSessionTransaction({
        sessionKey: '0x123',
        transaction: {
          contractAddress: '0xabc',
          entrypoint: 'transfer',
          calldata: ['0x1', '0x2'],
        },
        metadata: {
          requester: 'test',
          tool: 'transfer',
          correlationId: 'corr-123',
        },
      });

      // Should be parseable JSON
      expect(() => JSON.parse(sentBody!)).not.toThrow();

      const parsed = JSON.parse(sentBody!);
      expect(parsed).toHaveProperty('session_key');
      expect(parsed).toHaveProperty('transaction');
      expect(parsed).toHaveProperty('metadata');
    });

    it('should use snake_case for API fields', async () => {
      const client = createSignerClient({
        baseUrl: 'https://test.com',
        apiKey: 'key',
      });

      let sentBody: any;
      const mockFetch = vi.fn().mockImplementation(async (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ signature: ['0x1'], request_id: 'req-1' }),
        };
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

      // Check snake_case fields
      expect(sentBody).toHaveProperty('session_key');
      expect(sentBody.transaction).toHaveProperty('contract_address');
      expect(sentBody.metadata).toHaveProperty('correlation_id');
    });
  });

  describe('Error Helper Method Invariants', () => {
    it('isRetryable() should return boolean for all error codes', () => {
      const allCodes = Object.values(SignerErrorCode);

      allCodes.forEach((code) => {
        const error = new SignerClientError(code, 'test', 0);
        expect(typeof error.isRetryable()).toBe('boolean');
      });
    });

    it('isPolicyError() should return boolean for all error codes', () => {
      const allCodes = Object.values(SignerErrorCode);

      allCodes.forEach((code) => {
        const error = new SignerClientError(code, 'test', 0);
        expect(typeof error.isPolicyError()).toBe('boolean');
      });
    });

    it('isAuthError() should return boolean for all error codes', () => {
      const allCodes = Object.values(SignerErrorCode);

      allCodes.forEach((code) => {
        const error = new SignerClientError(code, 'test', 0);
        expect(typeof error.isAuthError()).toBe('boolean');
      });
    });

    it('error categories should be mutually exclusive', () => {
      const allCodes = Object.values(SignerErrorCode);

      allCodes.forEach((code) => {
        const error = new SignerClientError(code, 'test', 0);

        // An error can be retryable OR auth OR policy, but not multiple
        const categories = [
          error.isAuthError(),
          error.isPolicyError(),
          // Note: retryable can overlap with others
        ];

        const authAndPolicy = error.isAuthError() && error.isPolicyError();
        expect(authAndPolicy).toBe(false);
      });
    });
  });
});
