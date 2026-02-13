/**
 * OpenAI adapter — streaming chat completions via SSE.
 *
 * The API key is injected at construction time (caller reads from SecureStore).
 * No key is ever logged or included in error messages.
 */

import type {
  ChatStream,
  LlmProvider,
  ModelInfo,
  StreamChunk,
  StreamOptions,
} from "./types";

const OPENAI_BASE = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "gpt-4o-mini";

// ---------------------------------------------------------------------------
// SSE line parser
// ---------------------------------------------------------------------------

function parseSseLine(line: string): StreamChunk | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return { type: "done", finishReason: "stop" };

  try {
    const json = JSON.parse(data);
    const delta = json?.choices?.[0]?.delta;
    const finishReason = json?.choices?.[0]?.finish_reason;

    if (finishReason === "stop" || finishReason === "length") {
      return { type: "done", finishReason };
    }

    const text = delta?.content;
    if (typeof text === "string" && text.length > 0) {
      return { type: "delta", text };
    }
  } catch {
    // Malformed JSON — skip.
  }

  return null;
}

// ---------------------------------------------------------------------------
// Streaming fetch
// ---------------------------------------------------------------------------

async function* streamSse(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs: number,
  signal: AbortSignal
): AsyncGenerator<StreamChunk> {
  const controller = new AbortController();
  const combinedSignal = signal;

  // Timeout via setTimeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortOnParent = () => controller.abort();
  combinedSignal.addEventListener("abort", abortOnParent);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Scrub: never include apiKey in error messages.
      const safeMsg = scrubApiKey(text, apiKey);
      throw new ProviderError(`OpenAI API error (HTTP ${res.status})`, safeMsg);
    }

    if (!res.body) {
      throw new ProviderError("OpenAI returned no response body", "");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep incomplete last line in buffer.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const chunk = parseSseLine(trimmed);
        if (chunk) yield chunk;
        if (chunk?.type === "done") return;
      }
    }

    // Process any remaining buffer.
    if (buffer.trim()) {
      const chunk = parseSseLine(buffer.trim());
      if (chunk) yield chunk;
    }

    // If we never received [DONE], emit one.
    yield { type: "done", finishReason: "stop" };
  } finally {
    clearTimeout(timeoutId);
    combinedSignal.removeEventListener("abort", abortOnParent);
  }
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ProviderError extends Error {
  readonly detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = "ProviderError";
    this.detail = detail;
  }
}

function scrubApiKey(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.replaceAll(apiKey, "[REDACTED]");
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

export function createOpenAiProvider(apiKey: string): LlmProvider {
  if (!apiKey) {
    throw new ProviderError("OpenAI API key is required", "");
  }

  return {
    name: "OpenAI",
    id: "openai",

    streamChat(opts: StreamOptions): ChatStream {
      const model = opts.model || DEFAULT_MODEL;
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const abortController = new AbortController();

      const messages = [
        ...(opts.systemPrompt
          ? [{ role: "system" as const, content: opts.systemPrompt }]
          : []),
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const body: Record<string, unknown> = {
        model,
        messages,
        stream: true,
      };
      if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;
      if (opts.temperature != null) body.temperature = opts.temperature;

      const generator = streamSse(
        `${OPENAI_BASE}/chat/completions`,
        body,
        apiKey,
        timeoutMs,
        abortController.signal
      );

      const stream: ChatStream = Object.assign(generator, {
        cancel: () => abortController.abort(),
      });

      return stream;
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        const res = await fetch(`${OPENAI_BASE}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) return [];

        const json = (await res.json()) as { data?: Array<{ id: string }> };
        return (json.data ?? [])
          .filter((m) => m.id.startsWith("gpt-"))
          .map((m) => ({ id: m.id, name: m.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
      } catch {
        return [];
      }
    },
  };
}
