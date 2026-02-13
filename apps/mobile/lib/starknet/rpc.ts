// ---------------------------------------------------------------------------
// Starknet JSON-RPC client with retry, fallback endpoints, and user-safe errors
// ---------------------------------------------------------------------------

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: number | null;
  error: { code: number; message: string; data?: unknown };
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class StarknetRpcError extends Error {
  readonly code?: number;
  readonly data?: unknown;

  constructor(message: string, opts?: { code?: number; data?: unknown }) {
    super(message);
    this.name = "StarknetRpcError";
    this.code = opts?.code;
    this.data = opts?.data;
  }
}

/** Error kinds surfaced to the UI. */
export type RpcErrorKind =
  | "timeout"
  | "network_offline"
  | "rate_limited"
  | "insufficient_funds"
  | "nonce_mismatch"
  | "chain_id_mismatch"
  | "policy_revert"
  | "contract_not_found"
  | "unknown";

/**
 * Classify a raw error into a kind + user-safe message.
 * Callers can show `userMessage` directly in the UI without leaking internals.
 */
export function classifyRpcError(err: unknown): {
  kind: RpcErrorKind;
  userMessage: string;
} {
  const msg =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = err instanceof StarknetRpcError ? err.code : undefined;

  if (isAbortError(err) || msg.includes("timeout") || msg.includes("aborted")) {
    return {
      kind: "timeout",
      userMessage: "Request timed out. Check your connection and try again.",
    };
  }
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("enetunreach")) {
    return {
      kind: "network_offline",
      userMessage: "Unable to reach the network. Check your internet connection.",
    };
  }
  if (code === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return {
      kind: "rate_limited",
      userMessage: "Too many requests. Please wait a moment and try again.",
    };
  }
  if (msg.includes("insufficient") && msg.includes("fund")) {
    return {
      kind: "insufficient_funds",
      userMessage: "Insufficient funds to complete this transaction.",
    };
  }
  if (msg.includes("nonce")) {
    return {
      kind: "nonce_mismatch",
      userMessage:
        "Transaction nonce mismatch. A previous transaction may still be pending.",
    };
  }
  if (msg.includes("chain") && msg.includes("id")) {
    return {
      kind: "chain_id_mismatch",
      userMessage: "Chain ID mismatch. Make sure you are on the correct network.",
    };
  }
  if (msg.includes("session") || msg.includes("policy") || msg.includes("spending limit") || msg.includes("not allowed")) {
    return {
      kind: "policy_revert",
      userMessage:
        "Transaction denied by your security policy. Adjust your policy or use owner approval.",
    };
  }
  if (msg.includes("contract not found") || msg.includes("requested contract address") || msg.includes("invalid contract address")) {
    return {
      kind: "contract_not_found",
      userMessage: "Contract not found at the given address.",
    };
  }

  return {
    kind: "unknown",
    userMessage: "Something went wrong. Please try again.",
  };
}

// ---------------------------------------------------------------------------
// Retry policy (centralized)
// ---------------------------------------------------------------------------

/** Default retry config. Callers can override per-call. */
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5_000;

export type RetryOpts = {
  /** Maximum number of retry attempts (0 = no retries). Default: 2. */
  maxRetries?: number;
  /** Initial backoff delay in ms. Default: 500. */
  baseDelayMs?: number;
  /** Maximum backoff delay in ms. Default: 5000. */
  maxDelayMs?: number;
};

/** Returns true for errors that are safe to retry. */
function isRetryable(err: unknown): boolean {
  if (isAbortError(err)) return true; // timeout → retry

  if (err instanceof StarknetRpcError) {
    // HTTP 429, 500, 502, 503, 504 are retryable
    const httpStatus = extractHttpStatus(err.message);
    if (httpStatus !== null && [429, 500, 502, 503, 504].includes(httpStatus)) {
      return true;
    }
    // JSON-RPC internal error (-32000 to -32099) can be transient
    if (err.code !== undefined && err.code <= -32000 && err.code >= -32099) {
      return true;
    }
  }

  const msg =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("enetunreach")) {
    return true;
  }

  return false;
}

function extractHttpStatus(message: string): number | null {
  const m = message.match(/^HTTP (\d{3})/);
  return m ? Number(m[1]) : null;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/** Sleep with exponential backoff + jitter. */
function backoffDelay(
  attempt: number,
  baseMs: number,
  maxMs: number
): Promise<void> {
  const exp = Math.min(baseMs * 2 ** attempt, maxMs);
  const jitter = exp * 0.5 * Math.random();
  return new Promise((resolve) => setTimeout(resolve, exp + jitter));
}

// ---------------------------------------------------------------------------
// Core RPC call
// ---------------------------------------------------------------------------

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Single-shot RPC call against one URL (no retries). */
async function rpcOnce<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number
): Promise<T> {
  const res = await fetchJsonWithTimeout(
    rpcUrl,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new StarknetRpcError(`HTTP ${res.status} from RPC`, { data: text });
  }

  const json = (await res.json()) as JsonRpcResponse<T>;
  if ("error" in json) {
    throw new StarknetRpcError(json.error.message, {
      code: json.error.code,
      data: json.error.data,
    });
  }

  return json.result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RpcCallOpts = {
  timeoutMs?: number;
  /** Additional URLs to try if the primary fails with a retryable error. */
  fallbackUrls?: string[];
} & RetryOpts;

/**
 * Make a Starknet JSON-RPC call with automatic retry and optional fallback.
 *
 * Retry policy:
 *  - Only retryable errors (timeouts, 5xx, network failures) are retried.
 *  - Exponential backoff with jitter between attempts.
 *  - After exhausting retries on the primary URL, each fallback URL is tried
 *    with the same retry budget.
 *  - Total attempts = (1 + maxRetries) * (1 + fallbackUrls.length).
 */
export async function starknetRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  opts?: RpcCallOpts
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const urls = [rpcUrl, ...(opts?.fallbackUrls ?? [])];

  let lastError: unknown;

  for (const url of urls) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await rpcOnce<T>(url, method, params, timeoutMs);
      } catch (err) {
        lastError = err;
        const retriesLeft = attempt < maxRetries;
        if (retriesLeft && isRetryable(err)) {
          await backoffDelay(attempt, baseDelayMs, maxDelayMs);
          continue;
        }
        // Non-retryable or retries exhausted for this URL → try next URL
        break;
      }
    }
  }

  // All URLs and retries exhausted.
  throw lastError;
}

// ---------------------------------------------------------------------------
// Convenience wrappers (unchanged signatures, now inherit retry behaviour)
// ---------------------------------------------------------------------------

export async function getChainId(rpcUrl: string): Promise<string> {
  return starknetRpc<string>(rpcUrl, "starknet_chainId", []);
}

export type StarknetCallRequest = {
  contract_address: string;
  entry_point_selector: string;
  calldata: string[];
};

export async function callContract(
  rpcUrl: string,
  req: StarknetCallRequest,
  blockId: "latest" | "pending" = "latest"
): Promise<string[]> {
  return starknetRpc<string[]>(rpcUrl, "starknet_call", [req, blockId]);
}

export async function getClassHashAt(
  rpcUrl: string,
  contractAddress: string,
  blockId: "latest" | "pending" = "latest"
): Promise<string> {
  return starknetRpc<string>(rpcUrl, "starknet_getClassHashAt", [blockId, contractAddress]);
}

export async function isContractDeployed(
  rpcUrl: string,
  contractAddress: string
): Promise<boolean> {
  try {
    const classHash = await getClassHashAt(rpcUrl, contractAddress, "latest");
    return BigInt(classHash) !== 0n;
  } catch (e) {
    // Avoid masking random network issues by only treating "not found" as false.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("contract not found")) return false;
    if (msg.toLowerCase().includes("requested contract address")) return false;
    if (msg.toLowerCase().includes("invalid contract address")) return false;
    throw e;
  }
}
