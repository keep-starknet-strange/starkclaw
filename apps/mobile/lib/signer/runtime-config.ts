import { secureDelete, secureGet, secureSet } from "@/lib/storage/secure-store";

const SIGNER_CREDENTIALS_STORAGE_KEY = "starkclaw.signer.credentials.v1";

export type SignerMode = "local" | "remote";

export type StoredSignerCredentials = {
  clientId: string;
  hmacSecret: string;
  keyId?: string;
};

export type RemoteSignerRuntimeConfig = {
  proxyUrl: string;
  clientId: string;
  hmacSecret: string;
  keyId?: string;
  requestTimeoutMs: number;
  requester: string;
  mtlsRequired: boolean;
  pinnedPublicKeyHashes: string[];
  pinningIncludeSubdomains: boolean;
  pinningExpirationDate?: string;
};

export class SignerRuntimeConfigError extends Error {
  constructor(
    readonly code:
      | "MISSING_PROXY_URL"
      | "MISSING_CREDENTIALS"
      | "INVALID_CREDENTIALS"
      | "INVALID_PROXY_URL"
      | "INSECURE_TRANSPORT"
      | "INVALID_REQUESTER"
      | "MTLS_REQUIRED"
      | "PINNING_REQUIRED"
      | "INVALID_PINNING_CONFIG"
      | "PINNING_UNAVAILABLE"
      | "PINNING_INIT_FAILED",
    message: string
  ) {
    super(message);
    this.name = "SignerRuntimeConfigError";
  }
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parsePinnedPublicKeyHashes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((hash) => hash.trim())
    .filter((hash) => hash.length > 0);
}

function isValidPinnedHash(hash: string): boolean {
  // base64-encoded sha256(SPKI) should be 44 chars ending with "="
  return /^[A-Za-z0-9+/]{43}=$/.test(hash);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function getSignerMode(): SignerMode {
  const mode = (process.env.EXPO_PUBLIC_SIGNER_MODE ?? "local").trim().toLowerCase();
  return mode === "remote" ? "remote" : "local";
}

export async function saveSignerCredentials(credentials: StoredSignerCredentials): Promise<void> {
  await secureSet(SIGNER_CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
}

export async function clearSignerCredentials(): Promise<void> {
  await secureDelete(SIGNER_CREDENTIALS_STORAGE_KEY);
}

export async function loadSignerCredentials(): Promise<StoredSignerCredentials | null> {
  const raw = await secureGet(SIGNER_CREDENTIALS_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSignerCredentials>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.clientId || !parsed.hmacSecret) return null;

    return {
      clientId: parsed.clientId,
      hmacSecret: parsed.hmacSecret,
      keyId: parsed.keyId,
    };
  } catch {
    return null;
  }
}

export async function loadRemoteSignerRuntimeConfig(): Promise<RemoteSignerRuntimeConfig> {
  const proxyUrlRaw = process.env.EXPO_PUBLIC_SISNA_PROXY_URL?.trim();
  if (!proxyUrlRaw) {
    throw new SignerRuntimeConfigError(
      "MISSING_PROXY_URL",
      "Remote signer mode requires EXPO_PUBLIC_SISNA_PROXY_URL."
    );
  }

  let proxyUrl: URL;
  try {
    proxyUrl = new URL(proxyUrlRaw);
  } catch {
    throw new SignerRuntimeConfigError(
      "INVALID_PROXY_URL",
      "EXPO_PUBLIC_SISNA_PROXY_URL is not a valid URL."
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const loopback = isLoopbackHost(proxyUrl.hostname);
  const mtlsRequired = parseBoolean(process.env.EXPO_PUBLIC_SISNA_MTLS_REQUIRED);

  if (proxyUrl.protocol !== "https:" && !(loopback && !isProduction)) {
    throw new SignerRuntimeConfigError(
      "INSECURE_TRANSPORT",
      "Remote signer requires https transport (http is only allowed for local loopback in development)."
    );
  }

  if (isProduction && !mtlsRequired) {
    throw new SignerRuntimeConfigError(
      "MTLS_REQUIRED",
      "Production remote signer mode requires EXPO_PUBLIC_SISNA_MTLS_REQUIRED=true."
    );
  }
  if (isProduction && loopback) {
    throw new SignerRuntimeConfigError(
      "INSECURE_TRANSPORT",
      "Production remote signer mode cannot use loopback signer endpoints."
    );
  }

  const credentials = await loadSignerCredentials();
  if (!credentials) {
    throw new SignerRuntimeConfigError(
      "MISSING_CREDENTIALS",
      "Missing signer credentials. Save clientId/hmacSecret to secure storage first."
    );
  }
  if (!credentials.clientId.trim() || !credentials.hmacSecret.trim()) {
    throw new SignerRuntimeConfigError(
      "INVALID_CREDENTIALS",
      "Signer credentials are invalid (clientId and hmacSecret are required)."
    );
  }

  const requester = process.env.EXPO_PUBLIC_SISNA_REQUESTER?.trim() || "starkclaw-mobile";
  if (isProduction && requester === "starkclaw-mobile") {
    throw new SignerRuntimeConfigError(
      "INVALID_REQUESTER",
      "Production remote signer mode requires explicit EXPO_PUBLIC_SISNA_REQUESTER label."
    );
  }

  const pinnedPublicKeyHashes = parsePinnedPublicKeyHashes(
    process.env.EXPO_PUBLIC_SISNA_PINNED_PUBKEYS
  );
  if (isProduction && pinnedPublicKeyHashes.length === 0) {
    throw new SignerRuntimeConfigError(
      "PINNING_REQUIRED",
      "Production remote signer mode requires EXPO_PUBLIC_SISNA_PINNED_PUBKEYS."
    );
  }
  if (isProduction && pinnedPublicKeyHashes.length < 2) {
    throw new SignerRuntimeConfigError(
      "INVALID_PINNING_CONFIG",
      "Production remote signer mode requires at least two pinned public key hashes."
    );
  }
  if (pinnedPublicKeyHashes.some((hash) => !isValidPinnedHash(hash))) {
    throw new SignerRuntimeConfigError(
      "INVALID_PINNING_CONFIG",
      "EXPO_PUBLIC_SISNA_PINNED_PUBKEYS must contain base64 sha256(SPKI) hashes."
    );
  }

  const pinningIncludeSubdomains = parseBoolean(
    process.env.EXPO_PUBLIC_SISNA_PIN_INCLUDE_SUBDOMAINS
  );
  const pinningExpirationDate = process.env.EXPO_PUBLIC_SISNA_PIN_EXPIRATION_DATE?.trim();
  if (pinningExpirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(pinningExpirationDate)) {
    throw new SignerRuntimeConfigError(
      "INVALID_PINNING_CONFIG",
      "EXPO_PUBLIC_SISNA_PIN_EXPIRATION_DATE must be in yyyy-MM-dd format."
    );
  }

  return {
    proxyUrl: proxyUrl.toString(),
    clientId: credentials.clientId,
    hmacSecret: credentials.hmacSecret,
    keyId: credentials.keyId,
    requestTimeoutMs: parsePositiveInt(process.env.EXPO_PUBLIC_SISNA_REQUEST_TIMEOUT_MS, 8_000),
    requester,
    mtlsRequired,
    pinnedPublicKeyHashes,
    pinningIncludeSubdomains,
    pinningExpirationDate,
  };
}
