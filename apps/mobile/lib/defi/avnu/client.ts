/**
 * AVNU quote client — safe networking with endpoint allowlist,
 * timeouts, and short-TTL caching.
 */

import type {
  AvnuQuoteRequest,
  AvnuQuoteResponse,
  AvnuBuildSwapRequest,
  AvnuBuildSwapResponse,
} from "./types";

// ── Endpoint allowlist ──────────────────────────────────────────────

const ALLOWED_ENDPOINTS: Record<string, string> = {
  mainnet: "https://starknet.api.avnu.fi",
  sepolia: "https://sepolia.api.avnu.fi",
};

export type AvnuNetwork = keyof typeof ALLOWED_ENDPOINTS;

function baseUrl(network: AvnuNetwork): string {
  const url = ALLOWED_ENDPOINTS[network];
  if (!url) throw new Error(`Unknown AVNU network: ${network}`);
  return url;
}

// ── Fetch with timeout ──────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ── Cache ───────────────────────────────────────────────────────────

type CacheEntry<T> = { data: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 15_000; // 15 seconds

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Error classification ────────────────────────────────────────────

export class AvnuClientError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "AvnuClientError";
    this.statusCode = statusCode;
  }
}

function classifyError(err: unknown): never {
  if (err instanceof AvnuClientError) throw err;
  if (err instanceof TypeError && err.message.includes("abort")) {
    throw new AvnuClientError("AVNU request timed out.");
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    throw new AvnuClientError("AVNU request timed out.");
  }
  if (err instanceof TypeError) {
    throw new AvnuClientError("Network error contacting AVNU.");
  }
  throw new AvnuClientError("AVNU request failed.");
}

// ── Quote fetch ─────────────────────────────────────────────────────

function quoteCacheKey(network: AvnuNetwork, req: AvnuQuoteRequest): string {
  return `avnu:quote:${network}:${req.sellTokenAddress}:${req.buyTokenAddress}:${req.sellAmount}`;
}

export async function fetchQuote(
  network: AvnuNetwork,
  req: AvnuQuoteRequest,
): Promise<AvnuQuoteResponse> {
  const key = quoteCacheKey(network, req);
  const cached = cacheGet<AvnuQuoteResponse>(key);
  if (cached) return cached;

  const url = `${baseUrl(network)}/swap/v2/quotes`;
  const params = new URLSearchParams({
    sellTokenAddress: req.sellTokenAddress,
    buyTokenAddress: req.buyTokenAddress,
    sellAmount: req.sellAmount,
  });
  if (req.takerAddress) params.set("takerAddress", req.takerAddress);
  if (req.size != null) params.set("size", String(req.size));
  if (req.excludeSources?.length) params.set("excludeSources", req.excludeSources.join(","));

  try {
    const res = await fetchWithTimeout(`${url}?${params.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new AvnuClientError("Rate limited by AVNU. Try again in a moment.", 429);
      if (res.status >= 500) throw new AvnuClientError("AVNU server error. Try again later.", res.status);
      throw new AvnuClientError(`AVNU error: ${text || res.statusText}`, res.status);
    }

    const data = (await res.json()) as AvnuQuoteResponse;
    cacheSet(key, data);
    return data;
  } catch (err) {
    classifyError(err);
  }
}

// ── Build swap calldata (quote → calldata, no execution) ────────────

export async function buildSwapCalldata(
  network: AvnuNetwork,
  req: AvnuBuildSwapRequest,
): Promise<AvnuBuildSwapResponse> {
  const url = `${baseUrl(network)}/swap/v2/build`;

  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new AvnuClientError("Rate limited by AVNU. Try again in a moment.", 429);
      if (res.status >= 500) throw new AvnuClientError("AVNU server error. Try again later.", res.status);
      throw new AvnuClientError(`AVNU build error: ${text || res.statusText}`, res.status);
    }

    return (await res.json()) as AvnuBuildSwapResponse;
  } catch (err) {
    classifyError(err);
  }
}

export function clearCache(): void {
  cache.clear();
}
