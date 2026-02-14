/**
 * HTTPS Enforcement Security Tests (#65)
 *
 * TDD-first: These tests FAIL until HTTPS enforcement is implemented.
 *
 * Security Issue: H-1 (HIGH)
 * OWASP: API2:2023 Broken Authentication
 * CWE: CWE-319 Cleartext Transmission of Sensitive Information
 *
 * Ensures that the signer client rejects insecure HTTP URLs and only
 * accepts HTTPS URLs to prevent bearer token exposure via MITM attacks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';
import type { SignerClientConfig } from '../types';

describe('HTTPS Enforcement (#65)', () => {
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

  describe('HTTP URL Rejection', () => {
    it('should reject baseUrl with http:// protocol', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with HTTP (uppercase)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'HTTP://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with mixed case HtTp', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'HtTp://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl without protocol (assumes http)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject localhost HTTP URL', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://localhost:8080',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject 127.0.0.1 HTTP URL', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://127.0.0.1:3000',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });
  });

  describe('HTTPS URL Acceptance', () => {
    beforeEach(() => {
      // Mock fetch to return success
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          signature: ['0x1', '0x2'],
          request_id: 'req-123',
        }),
      });
    });

    it('should accept baseUrl with https:// protocol', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result).toMatchObject({
        signature: ['0x1', '0x2'],
        requestId: 'req-123',
      });
    });

    it('should accept baseUrl with HTTPS (uppercase)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'HTTPS://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result.requestId).toBe('req-123');
    });

    it('should accept baseUrl with mixed case HtTpS', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'HtTpS://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result.requestId).toBe('req-123');
    });

    it('should accept localhost HTTPS URL (for testing)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://localhost:8443',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result.requestId).toBe('req-123');
    });

    it('should accept 127.0.0.1 HTTPS URL (for testing)', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://127.0.0.1:8443',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result.requestId).toBe('req-123');
    });

    it('should accept production HTTPS URL with subdomain', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'https://signer.prod.starkclaw.io',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);
      const result = await client.signSessionTransaction(validRequest);

      expect(result.requestId).toBe('req-123');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable error message for HTTP rejection', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(SignerClientError);
        const signerError = error as SignerClientError;

        // Error message should be actionable
        expect(signerError.message).toMatch(/HTTPS/i);
        expect(signerError.message).toMatch(/protocol|secure|encrypted|TLS|SSL/i);

        // Should have correct error code
        expect(signerError.code).toBe(SignerErrorCode.VALIDATION_ERROR);

        // Should have zero status (not an HTTP error)
        expect(signerError.status).toBe(0);
      }
    });

    it('should mention the rejected URL in error message', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://insecure-signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const signerError = error as SignerClientError;
        expect(signerError.message).toContain('http://');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty baseUrl', async () => {
      const config: SignerClientConfig = {
        baseUrl: '',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with only whitespace', async () => {
      const config: SignerClientConfig = {
        baseUrl: '   ',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with javascript: protocol', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'javascript:alert(1)',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with data: protocol', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'data:text/html,<script>alert(1)</script>',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should reject baseUrl with file: protocol', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'file:///etc/passwd',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      await expect(client.signSessionTransaction(validRequest)).rejects.toMatchObject({
        code: SignerErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('HTTPS'),
      });
    });
  });

  describe('Security Invariants', () => {
    it('should validate HTTPS before making any network request', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const config: SignerClientConfig = {
        baseUrl: 'http://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      try {
        await client.signSessionTransaction(validRequest);
      } catch {
        // Expected to throw
      }

      // fetch should NOT have been called (validation happened before)
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should validate HTTPS before any other request validation', async () => {
      const config: SignerClientConfig = {
        baseUrl: 'http://signer.example.com',
        apiKey: 'test-key',
      };

      const client = createSignerClient(config);

      // Invalid request (bad session key) + HTTP URL
      const invalidRequest = {
        sessionKey: 'invalid',
        transaction: {
          contractAddress: '0x123',
          entrypoint: 'transfer',
          calldata: [],
        },
        metadata: {
          requester: 'test',
          tool: 'transfer',
        },
      };

      try {
        await client.signSessionTransaction(invalidRequest);
        expect.fail('Should have thrown');
      } catch (error) {
        const signerError = error as SignerClientError;
        // HTTPS validation should happen FIRST (not session key validation)
        expect(signerError.message).toMatch(/HTTPS/i);
      }
    });
  });
});
