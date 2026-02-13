/**
 * SISNA Signer Client Type Definitions
 *
 * Issue: #54
 * Scope: Groundwork only (no execution wiring)
 */

/**
 * Transaction to be signed by the remote signer
 */
export interface SessionTransaction {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

/**
 * Request metadata for tracking and correlation
 */
export interface SignerRequestMetadata {
  /** Identifier of the requesting application/tool */
  requester: string;

  /** Specific tool/operation being performed */
  tool: string;

  /** Optional correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Request to sign a session transaction
 */
export interface SignSessionTransactionRequest {
  /** Session key public key (felt252 as hex string) */
  sessionKey: string;

  /** Transaction to be signed */
  transaction: SessionTransaction;

  /** Request metadata */
  metadata: SignerRequestMetadata;
}

/**
 * Successful signature response
 */
export interface SignSessionTransactionResponse {
  /** Transaction signature components */
  signature: string[];

  /** Unique request identifier from signer service */
  requestId: string;
}

/**
 * Signer client configuration
 */
export interface SignerClientConfig {
  /** Base URL of the SISNA signer service */
  baseUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Optional custom headers */
  headers?: Record<string, string>;
}

/**
 * Typed error codes for signer client failures
 */
export enum SignerErrorCode {
  /** Nonce has been replayed (401) */
  REPLAY_NONCE = 'REPLAY_NONCE',

  /** Invalid signature or authentication (401) */
  INVALID_AUTH = 'INVALID_AUTH',

  /** Policy denied the transaction (403) */
  POLICY_DENIED = 'POLICY_DENIED',

  /** Server error (5xx) */
  SERVER_ERROR = 'SERVER_ERROR',

  /** Service unavailable (503) */
  UNAVAILABLE = 'UNAVAILABLE',

  /** Request timeout */
  TIMEOUT = 'TIMEOUT',

  /** Network/transport error */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Unknown/unmapped error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  /** Request validation failed */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Raw error response from signer service
 */
export interface SignerErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Typed error class for signer client operations
 */
export class SignerClientError extends Error {
  constructor(
    /** Error code */
    public readonly code: SignerErrorCode,

    /** Human-readable error message */
    message: string,

    /** HTTP status code (0 for network errors) */
    public readonly status: number,

    /** Raw response body (if available) */
    public readonly rawBody?: SignerErrorResponse | unknown
  ) {
    super(message);
    this.name = 'SignerClientError';

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignerClientError);
    }
  }

  /**
   * Check if error is retryable (network, timeout, unavailable)
   */
  isRetryable(): boolean {
    return [
      SignerErrorCode.TIMEOUT,
      SignerErrorCode.NETWORK_ERROR,
      SignerErrorCode.UNAVAILABLE,
      SignerErrorCode.SERVER_ERROR,
    ].includes(this.code);
  }

  /**
   * Check if error is due to policy enforcement
   */
  isPolicyError(): boolean {
    return this.code === SignerErrorCode.POLICY_DENIED;
  }

  /**
   * Check if error is due to authentication/authorization
   */
  isAuthError(): boolean {
    return [SignerErrorCode.REPLAY_NONCE, SignerErrorCode.INVALID_AUTH].includes(this.code);
  }
}
