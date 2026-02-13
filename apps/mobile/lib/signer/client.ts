/**
 * SISNA Signer Client Implementation
 *
 * Issue: #54
 * Scope: Groundwork only - NO execution wiring
 *
 * This module provides typed HTTP client for remote session transaction signing.
 * It does NOT wire into actual transfer execution paths (that's in #51).
 */

import {
  SignerClientConfig,
  SignSessionTransactionRequest,
  SignSessionTransactionResponse,
  SignerClientError,
  SignerErrorCode,
  SignerErrorResponse,
} from './types';

/**
 * Internal: Validate request before sending
 */
function validateRequest(request: SignSessionTransactionRequest): void {
  // Session key must be hex string starting with 0x
  if (!request.sessionKey || !/^0x[0-9a-fA-F]+$/.test(request.sessionKey)) {
    throw new SignerClientError(
      SignerErrorCode.VALIDATION_ERROR,
      `Invalid session key format: ${request.sessionKey}`,
      0
    );
  }

  // Metadata fields are required
  if (!request.metadata?.requester || !request.metadata?.tool) {
    throw new SignerClientError(
      SignerErrorCode.VALIDATION_ERROR,
      'Request metadata must include requester and tool',
      0
    );
  }

  // Transaction must have required fields
  if (
    !request.transaction?.contractAddress ||
    !request.transaction?.entrypoint ||
    !Array.isArray(request.transaction?.calldata)
  ) {
    throw new SignerClientError(
      SignerErrorCode.VALIDATION_ERROR,
      'Transaction must include contractAddress, entrypoint, and calldata array',
      0
    );
  }
}

/**
 * Internal: Map HTTP error response to typed SignerClientError
 */
async function mapHttpErrorToSignerError(
  response: Response
): Promise<SignerClientError> {
  const status = response.status;
  let body: SignerErrorResponse | undefined;

  try {
    body = (await response.json()) as SignerErrorResponse;
  } catch {
    // Failed to parse JSON, continue with undefined body
  }

  const message = body?.message || `HTTP ${status} error`;

  // Map status codes to error codes
  if (status === 401) {
    // Check error type for replay vs invalid auth
    if (body?.error === 'replay_nonce' || body?.message?.toLowerCase().includes('nonce')) {
      return new SignerClientError(SignerErrorCode.REPLAY_NONCE, message, status, body);
    }
    return new SignerClientError(SignerErrorCode.INVALID_AUTH, message, status, body);
  }

  if (status === 403) {
    return new SignerClientError(SignerErrorCode.POLICY_DENIED, message, status, body);
  }

  if (status === 503) {
    return new SignerClientError(SignerErrorCode.UNAVAILABLE, message, status, body);
  }

  if (status >= 500) {
    return new SignerClientError(SignerErrorCode.SERVER_ERROR, message, status, body);
  }

  // Unknown status code
  return new SignerClientError(SignerErrorCode.UNKNOWN_ERROR, message, status, body);
}

/**
 * Internal: Map network/fetch error to typed SignerClientError
 */
function mapNetworkErrorToSignerError(error: unknown): SignerClientError {
  const message = error instanceof Error ? error.message : 'Unknown network error';

  // Check for timeout
  if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('aborted')) {
    return new SignerClientError(SignerErrorCode.TIMEOUT, message, 0);
  }

  // General network error
  return new SignerClientError(SignerErrorCode.NETWORK_ERROR, message, 0);
}

/**
 * Create a SISNA signer client instance
 *
 * @param config - Client configuration
 * @returns Client with signSessionTransaction method
 *
 * @example
 * ```ts
 * const client = createSignerClient({
 *   baseUrl: 'https://signer.example.com',
 *   apiKey: 'sk_...',
 *   timeout: 5000,
 * });
 *
 * const result = await client.signSessionTransaction({
 *   sessionKey: '0x123...',
 *   transaction: {
 *     contractAddress: '0xabc...',
 *     entrypoint: 'transfer',
 *     calldata: ['0x1', '0x100', '0x0'],
 *   },
 *   metadata: {
 *     requester: 'starkclaw-mobile',
 *     tool: 'transfer',
 *   },
 * });
 * ```
 */
export function createSignerClient(config: SignerClientConfig) {
  const timeout = config.timeout || 10000;

  return {
    /**
     * Sign a session transaction via remote SISNA signer
     *
     * @param request - Transaction signing request
     * @returns Signature and request ID
     * @throws SignerClientError for all failure modes
     */
    async signSessionTransaction(
      request: SignSessionTransactionRequest
    ): Promise<SignSessionTransactionResponse> {
      // Validate request before sending
      validateRequest(request);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...config.headers,
      };

      // Add correlation ID if provided
      if (request.metadata.correlationId) {
        headers['X-Correlation-ID'] = request.metadata.correlationId;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${config.baseUrl}/v1/sign-session-transaction`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_key: request.sessionKey,
            transaction: {
              contract_address: request.transaction.contractAddress,
              entrypoint: request.transaction.entrypoint,
              calldata: request.transaction.calldata,
            },
            metadata: {
              requester: request.metadata.requester,
              tool: request.metadata.tool,
              correlation_id: request.metadata.correlationId,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle error responses
        if (!response.ok) {
          throw await mapHttpErrorToSignerError(response);
        }

        // Parse success response
        const data = await response.json();

        return {
          signature: data.signature,
          requestId: data.request_id,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        // Re-throw if already a SignerClientError
        if (error instanceof SignerClientError) {
          throw error;
        }

        // Map network/fetch errors
        throw mapNetworkErrorToSignerError(error);
      }
    },
  };
}

// Re-export types for convenience
export { SignerClientError, SignerErrorCode };
export type {
  SignerClientConfig,
  SignSessionTransactionRequest,
  SignSessionTransactionResponse,
};
