/**
 * API key sanitization tests for signer client error handling.
 * Ensures secrets are redacted from surfaced error messages.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';
import type { SignerClientConfig } from '../types';

describe('API Key Sanitization', () => {
  const validRequest = {
    sessionKey: '0xabcdef123456',
    transaction: {
      contractAddress: '0x123',
      entrypoint: 'transfer',
      calldata: ['0x1', '0x100', '0x0'],
    },
    metadata: {
      requester: 'test',
      tool: 'transfer',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bearer Token Sanitization', () => {
    it('should sanitize Bearer token from error message (lowercase)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'secret-api-key-12345',
      };

      // Mock fetch to throw error with Bearer token in message
      global.fetch = vi.fn().mockRejectedValue(
        new Error('Request failed: Authorization: Bearer secret-api-key-12345')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;

        // Error message should NOT contain the actual API key
        expect(signerError.message).not.toContain('secret-api-key-12345');

        // Error message SHOULD contain redacted version
        expect(signerError.message).toContain('[REDACTED]');
        expect(signerError.message).toMatch(/Bearer\s+\[REDACTED\]/i);
      }
    });

    it('should sanitize Bearer token with uppercase BEARER', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'secret-key-xyz',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Auth failed: BEARER secret-key-xyz')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('secret-key-xyz');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should sanitize Bearer token with mixed case BeArEr', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'my-secret-token',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Header: BeArEr my-secret-token failed')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('my-secret-token');
        expect(signerError.message).toMatch(/BeArEr\s+\[REDACTED\]/i);
      }
    });

    it('should sanitize multiple Bearer tokens in error message', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'first-key',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Bearer first-key invalid, tried Bearer another-key')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('first-key');
        expect(signerError.message).not.toContain('another-key');

        // Both should be redacted
        const redactedCount = (signerError.message.match(/\[REDACTED\]/g) || []).length;
        expect(redactedCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('API Key Pattern Sanitization', () => {
    it('should sanitize sk_ prefixed keys', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_live_12345abcdef',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Invalid API key: sk_live_12345abcdef')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_live_12345abcdef');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should sanitize sk_ with different suffixes', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_test_xyz789',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Key sk_test_xyz789 expired')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_test_xyz789');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should sanitize multiple sk_ keys in same error', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_primary',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Keys sk_primary, sk_backup both invalid')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_primary');
        expect(signerError.message).not.toContain('sk_backup');

        const redactedCount = (signerError.message.match(/\[REDACTED\]/g) || []).length;
        expect(redactedCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Combined Sanitization', () => {
    it('should sanitize both Bearer and sk_ patterns', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_secret_key',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Bearer sk_secret_key failed authentication')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_secret_key');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should preserve non-sensitive parts of error message', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_key123',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Network error: timeout after 5000ms with Bearer sk_key123')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;

        // Sensitive data removed
        expect(signerError.message).not.toContain('sk_key123');

        // Non-sensitive parts preserved
        expect(signerError.message).toContain('Network error');
        expect(signerError.message).toContain('timeout');
        expect(signerError.message).toContain('5000ms');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle error with no sensitive data (passthrough)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'test-key',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Generic network error')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).toBe('Generic network error');
        expect(signerError.message).not.toContain('[REDACTED]');
      }
    });

    it('should sanitize API keys in multiline error messages', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_multiline',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Error details:\nAPI Key: sk_multiline\nStatus: Invalid')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_multiline');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should sanitize from AbortError messages', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_abort',
      };

      const abortError = new DOMException('Request aborted: Bearer sk_abort', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_abort');
        expect(signerError.message).toContain('[REDACTED]');
      }
    });

    it('should sanitize from TypeError messages (invalid URL, etc)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_type_error',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new TypeError('Failed to fetch with key sk_type_error')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).not.toContain('sk_type_error');
      }
    });
  });

  describe('Security Invariants', () => {
    it('should never leak API key regardless of error type', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_must_not_leak',
      };

      // Test various error types
      const errorTypes = [
        new Error('Bearer sk_must_not_leak'),
        new TypeError('sk_must_not_leak in TypeError'),
        new DOMException('AbortError with sk_must_not_leak', 'AbortError'),
        { message: 'Plain object with sk_must_not_leak' },
      ];

      for (const errorToThrow of errorTypes) {
        global.fetch = vi.fn().mockRejectedValue(errorToThrow);
        const client = createSignerClient(config);

        try {
          await client.signSessionTransaction(validRequest);
          expect.fail('Should have thrown error');
        } catch (error) {
          const signerError = error as SignerClientError;
          expect(signerError.message).not.toContain('sk_must_not_leak');
        }
      }
    });

    it('should sanitize API key from nested error properties', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_nested',
      };

      const nestedError = new Error('Fetch failed');
      (nestedError as any).cause = new Error('Bearer sk_nested invalid');

      global.fetch = vi.fn().mockRejectedValue(nestedError);
      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        // Should sanitize from main message (which includes cause in some environments)
        expect(signerError.message).not.toContain('sk_nested');
      }
    });
  });

  describe('Error Code Preservation', () => {
    it('should preserve TIMEOUT error code after sanitization', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_timeout',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Request timeout with Bearer sk_timeout')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;

        // Should be classified as TIMEOUT (message contains "timeout")
        expect(signerError.code).toBe(SignerErrorCode.TIMEOUT);

        // But API key should be sanitized
        expect(signerError.message).not.toContain('sk_timeout');
      }
    });

    it('should preserve NETWORK_ERROR code after sanitization', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'sk_network',
      };

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Network failure Bearer sk_network')
      );

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;

        // Should be classified as NETWORK_ERROR
        expect(signerError.code).toBe(SignerErrorCode.NETWORK_ERROR);

        // But API key should be sanitized
        expect(signerError.message).not.toContain('sk_network');
      }
    });
  });
});
