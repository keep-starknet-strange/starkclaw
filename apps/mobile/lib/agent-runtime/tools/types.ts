/**
 * Tool runtime types.
 *
 * Every tool is defined by a JSON-schema for its arguments, a handler,
 * and metadata for display. The runtime validates inputs before execution
 * and logs every call to a persistent audit log.
 */

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/** JSON Schema subset sufficient for flat tool arguments. */
export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
};

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ToolDefinition = {
  /** Machine-readable tool name (e.g. "get_balances"). */
  name: string;
  /** Human-readable description shown to the model. */
  description: string;
  /** JSON Schema for validating the tool's arguments. */
  argsSchema: JsonSchema;
  /** Execute the tool. Must never throw — returns ToolResult. */
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditEntry = {
  id: string;
  timestamp: number;
  toolName: string;
  /** Redacted copy of the arguments (secrets stripped). */
  args: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
};
