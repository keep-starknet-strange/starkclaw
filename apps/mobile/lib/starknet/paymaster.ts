/**
 * paymaster — AVNU paymaster client for gasless (sponsored) transactions.
 *
 * Eligible actions execute without the user holding gas tokens. Sponsorship
 * eligibility is explicit: only session-key-bounded actions within caps.
 */

// ── Endpoint allowlist ──────────────────────────────────────────────

const PAYMASTER_ENDPOINTS: Record<string, string> = {
  sepolia: "https://sepolia.paymaster.avnu.fi",
  mainnet: "https://starknet.paymaster.avnu.fi",
};

export type PaymasterNetwork = keyof typeof PAYMASTER_ENDPOINTS;

function paymasterUrl(network: PaymasterNetwork): string {
  const url = PAYMASTER_ENDPOINTS[network];
  if (!url) throw new Error(`Unknown paymaster network: ${network}`);
  return url;
}

// ── Error ───────────────────────────────────────────────────────────

export class PaymasterError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "PaymasterError";
    this.statusCode = statusCode;
  }
}

// ── Fetch with timeout ──────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;

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

function classifyError(err: unknown): never {
  if (err instanceof PaymasterError) throw err;
  if (err instanceof DOMException && err.name === "AbortError") {
    throw new PaymasterError("Paymaster request timed out.");
  }
  if (err instanceof TypeError && err.message.includes("abort")) {
    throw new PaymasterError("Paymaster request timed out.");
  }
  if (err instanceof TypeError) {
    throw new PaymasterError("Network error contacting paymaster.");
  }
  throw new PaymasterError("Paymaster request failed.");
}

// ── Types ───────────────────────────────────────────────────────────

export type PaymasterCall = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

export type GasTokenPrice = {
  tokenAddress: string;
  gasFeesInGasToken: string;
  gasFeesInUsd: number;
};

export type PaymasterTypedData = {
  /** SNIP-12 typed data to sign. */
  typedData: Record<string, unknown>;
  /** Available gas token options with prices. */
  gasTokenPrices: GasTokenPrice[];
};

export type PaymasterExecuteResult = {
  transactionHash: string;
};

// ── Eligibility ─────────────────────────────────────────────────────

/** Action kinds eligible for fee sponsorship. */
const ELIGIBLE_KINDS = new Set([
  "transfer",
  "swap",
  "register_session_key",
  "revoke_session_key",
]);

/** High-risk entrypoints that must never be sponsored. */
const BLOCKED_ENTRYPOINTS = new Set([
  "upgrade",
  "set_implementation",
  "emergency_revoke_all",
]);

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
};

export function checkSponsorshipEligibility(params: {
  actionKind: string;
  entrypoints: string[];
}): EligibilityResult {
  if (!ELIGIBLE_KINDS.has(params.actionKind)) {
    return { eligible: false, reason: `Action "${params.actionKind}" is not eligible for sponsorship.` };
  }

  for (const ep of params.entrypoints) {
    if (BLOCKED_ENTRYPOINTS.has(ep)) {
      return { eligible: false, reason: `Entrypoint "${ep}" is blocked from sponsorship.` };
    }
  }

  return { eligible: true, reason: "Eligible for gasless execution." };
}

// ── Build typed data (fee estimation) ───────────────────────────────

export async function buildTypedData(
  network: PaymasterNetwork,
  params: {
    userAddress: string;
    calls: PaymasterCall[];
  },
): Promise<PaymasterTypedData> {
  const url = `${paymasterUrl(network)}/paymaster/v1/build-typed-data`;

  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        userAddress: params.userAddress,
        calls: params.calls.map((c) => ({
          contractAddress: c.contractAddress,
          entrypoint: c.entrypoint,
          calldata: c.calldata,
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new PaymasterError("Paymaster rate limited. Try again.", 429);
      if (res.status >= 500) throw new PaymasterError("Paymaster server error.", res.status);
      throw new PaymasterError(`Paymaster error: ${text || res.statusText}`, res.status);
    }

    return (await res.json()) as PaymasterTypedData;
  } catch (err) {
    classifyError(err);
  }
}

// ── Execute sponsored transaction ───────────────────────────────────

export async function executeSponsored(
  network: PaymasterNetwork,
  params: {
    userAddress: string;
    typedData: Record<string, unknown>;
    signature: string[];
  },
): Promise<PaymasterExecuteResult> {
  const url = `${paymasterUrl(network)}/paymaster/v1/execute`;

  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        userAddress: params.userAddress,
        typedData: params.typedData,
        signature: params.signature,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new PaymasterError("Paymaster rate limited.", 429);
      if (res.status >= 500) throw new PaymasterError("Paymaster server error.", res.status);
      throw new PaymasterError(`Paymaster execute error: ${text || res.statusText}`, res.status);
    }

    return (await res.json()) as PaymasterExecuteResult;
  } catch (err) {
    classifyError(err);
  }
}

// ── Check paymaster availability ────────────────────────────────────

export async function isPaymasterAvailable(network: PaymasterNetwork): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${paymasterUrl(network)}/paymaster/v1/status`,
      { method: "GET", headers: { accept: "application/json" } },
      5_000,
    );
    return res.ok;
  } catch {
    return false;
  }
}
