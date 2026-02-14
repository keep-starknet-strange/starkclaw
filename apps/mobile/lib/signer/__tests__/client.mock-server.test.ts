/**
 * SISNA signer client integration tests with a deterministic mock HTTP server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import { createSignerClient, SignerClientError, SignerErrorCode } from '../client';
import type { SignSessionTransactionRequest } from '../types';

describe('SignerClient - Mock Server Integration', () => {
  let server: Server;
  let serverPort: number;
  let baseUrl: string;

  // Mock request for all tests
  const mockRequest: SignSessionTransactionRequest = {
    sessionKey: '0x02da7b78f10600379a00f4104ec9045c60b2e7c0494b00ee944f9c75179f29ad',
    transaction: {
      contractAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
      entrypoint: 'transfer',
      calldata: ['0xrecipient', '0x100', '0x0'],
    },
    metadata: {
      requester: 'test-app',
      tool: 'transfer',
    },
  };

  beforeAll(async () => {
    // Create deterministic mock server
    server = createServer((req, res) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        // Parse request
        let requestData;
        try {
          requestData = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_json', message: 'Invalid JSON' }));
          return;
        }

        // Determine response based on correlation ID (for deterministic testing)
        const correlationId = req.headers['x-correlation-id'] as string;

        switch (correlationId) {
          case 'test-success':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                signature: ['0xsig1', '0xsig2'],
                request_id: 'req-mock-123',
              })
            );
            break;

          case 'test-replay-nonce':
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'replay_nonce',
                message: 'Nonce already used',
              })
            );
            break;

          case 'test-invalid-auth':
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'invalid_signature',
                message: 'Signature verification failed',
              })
            );
            break;

          case 'test-policy-denied':
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'policy_denied',
                message: 'Transaction exceeds spending limit',
                details: {
                  limit: '1000',
                  attempted: '2000',
                  policy_id: 'pol_123',
                },
              })
            );
            break;

          case 'test-server-error':
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'internal_server_error',
                message: 'Database connection failed',
              })
            );
            break;

          case 'test-unavailable':
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'service_unavailable',
                message: 'Signer service is temporarily down for maintenance',
              })
            );
            break;

          case 'test-unknown-status':
            res.writeHead(418, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'teapot',
                message: "I'm a teapot",
              })
            );
            break;

          case 'test-malformed-json':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('not valid json{');
            break;

          default:
            // Default success for uncorrelated requests
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                signature: ['0xdefault_sig'],
                request_id: 'req-default',
              })
            );
        }
      });
    });

    // Start server on random available port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
          baseUrl = `http://localhost:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should successfully sign transaction with mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    const result = await client.signSessionTransaction({
      ...mockRequest,
      metadata: {
        ...mockRequest.metadata,
        correlationId: 'test-success',
      },
    });

    expect(result).toEqual({
      signature: ['0xsig1', '0xsig2'],
      requestId: 'req-mock-123',
    });
  });

  it('should handle replay nonce error from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    await expect(
      client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-replay-nonce',
        },
      })
    ).rejects.toMatchObject({
      code: SignerErrorCode.REPLAY_NONCE,
      status: 401,
      message: expect.stringContaining('Nonce already used'),
    });
  });

  it('should handle invalid auth error from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    await expect(
      client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-invalid-auth',
        },
      })
    ).rejects.toMatchObject({
      code: SignerErrorCode.INVALID_AUTH,
      status: 401,
    });
  });

  it('should handle policy denied with details from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    try {
      await client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-policy-denied',
        },
      });
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SignerClientError);
      const signerError = error as SignerClientError;
      expect(signerError.code).toBe(SignerErrorCode.POLICY_DENIED);
      expect(signerError.status).toBe(403);
      expect(signerError.rawBody).toMatchObject({
        details: {
          limit: '1000',
          attempted: '2000',
          policy_id: 'pol_123',
        },
      });
    }
  });

  it('should handle server error from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    await expect(
      client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-server-error',
        },
      })
    ).rejects.toMatchObject({
      code: SignerErrorCode.SERVER_ERROR,
      status: 500,
    });
  });

  it('should handle service unavailable from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    await expect(
      client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-unavailable',
        },
      })
    ).rejects.toMatchObject({
      code: SignerErrorCode.UNAVAILABLE,
      status: 503,
    });
  });

  it('should handle unknown status codes from mock signer', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
    });

    await expect(
      client.signSessionTransaction({
        ...mockRequest,
        metadata: {
          ...mockRequest.metadata,
          correlationId: 'test-unknown-status',
        },
      })
    ).rejects.toMatchObject({
      code: SignerErrorCode.UNKNOWN_ERROR,
      status: 418,
    });
  });

  it('should handle network timeout', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl,
      apiKey: 'test-key',
      timeout: 100, // Very short timeout
    });

    // Create a request that will timeout
    const slowServer = createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end(JSON.stringify({ signature: ['0x1'], request_id: 'req-1' }));
      }, 200); // Longer than timeout
    });

    const slowPort = await new Promise<number>((resolve) => {
      slowServer.listen(0, () => {
        const address = slowServer.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        }
      });
    });

    const slowClient = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl: `http://localhost:${slowPort}`,
      apiKey: 'test-key',
      timeout: 100,
    });

    await expect(slowClient.signSessionTransaction(mockRequest)).rejects.toMatchObject({
      code: SignerErrorCode.TIMEOUT,
    });

    slowServer.close();
  });

  it('should handle connection refused (network error)', async () => {
    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl: 'http://localhost:1', // Port unlikely to be in use
      apiKey: 'test-key',
      timeout: 1000,
    });

    await expect(client.signSessionTransaction(mockRequest)).rejects.toMatchObject({
      code: SignerErrorCode.NETWORK_ERROR,
    });
  });

  it('should send correct request body format', async () => {
    let receivedBody: any;

    const inspectionServer = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        receivedBody = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ signature: ['0x1'], request_id: 'req-1' }));
      });
    });

    const inspectionPort = await new Promise<number>((resolve) => {
      inspectionServer.listen(0, () => {
        const address = inspectionServer.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        }
      });
    });

    const client = createSignerClient({
      _dangerouslyAllowInsecureHttp: true,
      baseUrl: `http://localhost:${inspectionPort}`,
      apiKey: 'test-key',
    });

    await client.signSessionTransaction(mockRequest);

    expect(receivedBody).toMatchObject({
      session_key: mockRequest.sessionKey,
      transaction: {
        contract_address: mockRequest.transaction.contractAddress,
        entrypoint: mockRequest.transaction.entrypoint,
        calldata: mockRequest.transaction.calldata,
      },
      metadata: {
        requester: mockRequest.metadata.requester,
        tool: mockRequest.metadata.tool,
      },
    });

    inspectionServer.close();
  });
});
