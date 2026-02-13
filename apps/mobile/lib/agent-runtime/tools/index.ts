export type { AuditEntry, JsonSchema, ToolDefinition, ToolResult } from "./types";

export {
  clearAuditLog,
  executeTool,
  getAuditLog,
  getTool,
  listTools,
  registerTool,
} from "./registry";

export {
  CORE_TOOLS,
  estimateFeeTool,
  executeTransferTool,
  getBalancesTool,
  prepareTransferTool,
} from "./core-tools";

// ---------------------------------------------------------------------------
// Boot — register all core tools on import.
// ---------------------------------------------------------------------------

import { registerTool } from "./registry";
import { CORE_TOOLS } from "./core-tools";

for (const tool of CORE_TOOLS) {
  registerTool(tool);
}
