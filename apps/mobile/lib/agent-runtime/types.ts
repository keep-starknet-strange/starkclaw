/**
 * LLM provider interface for the Starkclaw agent runtime.
 *
 * Providers must support streaming chat completions.
 * The interface is intentionally minimal to allow multiple adapters.
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** A single chunk emitted during streaming. */
export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; finishReason: "stop" | "length" | "error" };

export type StreamOptions = {
  /** Model ID to use (e.g. "gpt-4o-mini"). */
  model: string;
  /** System prompt prepended to the conversation. */
  systemPrompt?: string;
  /** Conversation messages. */
  messages: ChatMessage[];
  /** Max tokens to generate. Default: provider-specific. */
  maxTokens?: number;
  /** Sampling temperature. Default: provider-specific. */
  temperature?: number;
  /** Request timeout in ms. Default: 30000. */
  timeoutMs?: number;
};

/** Async iterable of stream chunks. Call `cancel()` to abort early. */
export type ChatStream = AsyncIterable<StreamChunk> & {
  cancel: () => void;
};

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export type ModelInfo = {
  id: string;
  name: string;
};

export type LlmProvider = {
  /** Human-readable provider name (e.g. "OpenAI"). */
  readonly name: string;
  /** Provider identifier used in config (e.g. "openai"). */
  readonly id: string;
  /** Start a streaming chat completion. */
  streamChat: (opts: StreamOptions) => ChatStream;
  /** List available models. Returns empty array on error. */
  listModels: () => Promise<ModelInfo[]>;
};

// ---------------------------------------------------------------------------
// Provider config (persisted to SecureStore)
// ---------------------------------------------------------------------------

export type ProviderConfig = {
  providerId: string;
  modelId: string;
};
