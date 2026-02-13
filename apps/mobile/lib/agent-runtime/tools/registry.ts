/**
 * Tool registry — strict allowlist with schema validation and audit logging.
 *
 * Unknown tools are rejected. Invalid args are rejected with a safe error.
 * Every call is logged to a persistent audit trail.
 */

import { secureGet, secureSet } from "@/lib/storage/secure-store";

import type { AuditEntry, JsonSchema, ToolDefinition, ToolResult } from "./types";

const AUDIT_STORAGE_KEY = "starkclaw.tool_audit.v1";
const MAX_AUDIT_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const tools = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  tools.set(def.name, def);
}

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

// ---------------------------------------------------------------------------
// Schema validation (minimal but sufficient for flat objects)
// ---------------------------------------------------------------------------

function validateArgs(args: unknown, schema: JsonSchema): string | null {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return "Arguments must be a plain object.";
  }

  const obj = args as Record<string, unknown>;

  // Check required fields.
  for (const key of schema.required ?? []) {
    if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
      return `Missing required argument: "${key}".`;
    }
  }

  // Check types for provided fields.
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const value = obj[key];
    if (value === undefined || value === null) continue;

    if (propSchema.type === "string" && typeof value !== "string") {
      return `Argument "${key}" must be a string.`;
    }
    if (propSchema.type === "number" && typeof value !== "number") {
      return `Argument "${key}" must be a number.`;
    }
    if (propSchema.type === "boolean" && typeof value !== "boolean") {
      return `Argument "${key}" must be a boolean.`;
    }

    if (propSchema.enum && typeof value === "string" && !propSchema.enum.includes(value)) {
      return `Argument "${key}" must be one of: ${propSchema.enum.join(", ")}.`;
    }
  }

  // Reject unknown keys.
  for (const key of Object.keys(obj)) {
    if (!(key in schema.properties)) {
      return `Unknown argument: "${key}".`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  "privateKey",
  "private_key",
  "apiKey",
  "api_key",
  "secret",
  "password",
  "mnemonic",
  "seed",
]);

function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function loadAuditLog(): Promise<AuditEntry[]> {
  const raw = await secureGet(AUDIT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const log = await loadAuditLog();
  log.unshift(entry);
  // Trim to max size.
  const trimmed = log.slice(0, MAX_AUDIT_ENTRIES);
  await secureSet(AUDIT_STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  return loadAuditLog();
}

export async function clearAuditLog(): Promise<void> {
  await secureSet(AUDIT_STORAGE_KEY, "[]").catch(() => {});
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/**
 * Execute a tool by name with the given arguments.
 *
 * - Unknown tools are rejected.
 * - Invalid args are rejected with a safe error.
 * - Every call is logged to the audit trail.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const def = tools.get(name);
  if (!def) {
    return { ok: false, error: `Unknown tool: "${name}". Available: ${Array.from(tools.keys()).join(", ")}.` };
  }

  const validationError = validateArgs(args, def.argsSchema);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const start = Date.now();
  let result: ToolResult;
  try {
    result = await def.handler(args);
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : "Tool execution failed.",
    };
  }
  const durationMs = Date.now() - start;

  const entry: AuditEntry = {
    id: `tool_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Math.floor(Date.now() / 1000),
    toolName: name,
    args: redactArgs(args),
    result,
    durationMs,
  };

  // Fire and forget — don't block the caller.
  appendAuditEntry(entry).catch(() => {});

  return result;
}
