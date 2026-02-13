/**
 * Provider configuration persistence.
 *
 * Stores the selected provider ID, model ID, and API key in SecureStore.
 * The API key is NEVER logged, exported, or included in error messages.
 */

import { secureDelete, secureGet, secureSet } from "@/lib/storage/secure-store";

import { createOpenAiProvider } from "./openai-adapter";
import type { LlmProvider, ProviderConfig } from "./types";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEY_PROVIDER_CONFIG = "starkclaw.provider_config.v1";
const KEY_API_KEY = "starkclaw.llm_api_key.v1";

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  const raw = await secureGet(KEY_PROVIDER_CONFIG);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { providerId, modelId } = parsed as Record<string, unknown>;
    if (typeof providerId !== "string" || typeof modelId !== "string") return null;
    return { providerId, modelId };
  } catch {
    return null;
  }
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await secureSet(KEY_PROVIDER_CONFIG, JSON.stringify(config));
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

export async function loadApiKey(): Promise<string | null> {
  return secureGet(KEY_API_KEY);
}

export async function saveApiKey(key: string): Promise<void> {
  await secureSet(KEY_API_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await secureDelete(KEY_API_KEY);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await secureGet(KEY_API_KEY);
  return key !== null && key.length > 0;
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/** Known provider IDs. */
export const AVAILABLE_PROVIDERS = [
  { id: "openai", name: "OpenAI" },
] as const;

/**
 * Create an LlmProvider instance from stored config + key.
 * Returns null if no API key is stored or provider ID is unknown.
 */
export async function createProvider(): Promise<LlmProvider | null> {
  const config = await loadProviderConfig();
  const apiKey = await loadApiKey();

  if (!apiKey) return null;

  const providerId = config?.providerId ?? "openai";

  switch (providerId) {
    case "openai":
      return createOpenAiProvider(apiKey);
    default:
      return null;
  }
}
