import { SignerRuntimeConfigError } from "./runtime-config";

type CertificatePinningConfig = {
  proxyUrl: string;
  pinnedPublicKeyHashes: string[];
  pinningIncludeSubdomains: boolean;
  pinningExpirationDate?: string;
};

type PinningModule = {
  isSslPinningAvailable?: () => boolean;
  initializeSslPinning: (options: Record<string, unknown>) => Promise<void>;
};

let lastInitializedConfigFingerprint: string | null = null;
let pinningModuleLoader: (() => Promise<PinningModule>) | null = null;

function buildConfigFingerprint(config: CertificatePinningConfig): string {
  return JSON.stringify({
    proxyUrl: config.proxyUrl,
    pinnedPublicKeyHashes: [...config.pinnedPublicKeyHashes].sort(),
    pinningIncludeSubdomains: config.pinningIncludeSubdomains,
    pinningExpirationDate: config.pinningExpirationDate ?? null,
  });
}

async function loadPinningModule(): Promise<PinningModule> {
  try {
    if (pinningModuleLoader) {
      return await pinningModuleLoader();
    }
    const moduleName = "react-native-ssl-public-key-pinning";
    const module = await import(/* @vite-ignore */ moduleName);
    return module as unknown as PinningModule;
  } catch {
    throw new SignerRuntimeConfigError(
      "PINNING_UNAVAILABLE",
      "SSL pinning module is unavailable. Build with native pinning support enabled."
    );
  }
}

export async function ensureSignerCertificatePinning(
  config: CertificatePinningConfig
): Promise<void> {
  if (config.pinnedPublicKeyHashes.length === 0) return;

  const fingerprint = buildConfigFingerprint(config);
  if (lastInitializedConfigFingerprint === fingerprint) return;

  const hostname = new URL(config.proxyUrl).hostname;
  const pinning = await loadPinningModule();
  const available = pinning.isSslPinningAvailable?.();
  if (available === false) {
    throw new SignerRuntimeConfigError(
      "PINNING_UNAVAILABLE",
      "SSL pinning is unavailable on this app build/runtime."
    );
  }

  try {
    await pinning.initializeSslPinning({
      [hostname]: {
        includeSubdomains: config.pinningIncludeSubdomains,
        publicKeyHashes: config.pinnedPublicKeyHashes,
        expirationDate: config.pinningExpirationDate,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SignerRuntimeConfigError(
      "PINNING_INIT_FAILED",
      `Failed to initialize SSL pinning: ${message}`
    );
  }

  lastInitializedConfigFingerprint = fingerprint;
}

export function resetSignerCertificatePinningForTests(): void {
  lastInitializedConfigFingerprint = null;
}

export function setPinningModuleLoaderForTests(loader: (() => Promise<PinningModule>) | null): void {
  pinningModuleLoader = loader;
}
