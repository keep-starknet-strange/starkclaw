/**
 * useAgentChat — manages streaming chat conversations with tool-call tracking
 * 
 * Supports both demo (simulated streaming) and live (real LLM) modes.
 */

import * as React from "react";

import { loadApiKey, hasApiKey, createProvider } from "../agent-runtime/provider-store";
import { executeTool } from "../agent-runtime/tools/registry";
import type { ChatMessage as LlmMessage, ChatStream, ParsedToolCall, OpenAITool } from "../agent-runtime/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  /** If set, this message is currently streaming */
  isStreaming?: boolean;
};

export type ToolCall = {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  result?: string;
  timestamp: string;
  operationType: "read" | "write";
  status: "pending" | "success" | "error";
};

export type AgentChatState = {
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  isResponding: boolean;
  /** Whether API key is configured for live mode */
  hasApiKey: boolean;
  /** Error message if live mode fails */
  error?: string;
};

type AgentChatActions = {
  sendMessage: (text: string) => Promise<void>;
  cancelResponse: () => void;
  clearHistory: () => void;
};

/**
 * System prompt for the agent
 */
const AGENT_SYSTEM_PROMPT = `You are Starkclaw, an AI agent for Starknet. You help users with safe Starknet planning.

Available tools:
- get_balances: Read ERC-20 balances (ETH, USDC, STRK) - auto-executable
- estimate_fee: Estimate gas fees - auto-executable

Tools requiring manual approval:
- prepare_transfer: Validate transfer inputs only (cannot execute in chat)
- execute_transfer: Blocked in chat. User must execute from the Transfer tab

Security rules:
- You cannot execute transfers directly from chat.
- If a user wants to transfer funds, direct them to the Transfer tab for manual approval.
- Only get_balances and estimate_fee can be executed automatically.
- Use tools only within the approved execution policy.`;

const READ_ONLY_TOOLS = new Set(["get_balances", "estimate_fee"]);
const AUTO_EXECUTABLE_TOOLS = new Set(["get_balances", "estimate_fee"]);

function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

function toSafeUserError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }
  const msg = err.message.toLowerCase();
  if (msg.includes("manual approval")) {
    return err.message;
  }
  if (msg.includes("timeout")) {
    return "Request timed out. Please try again.";
  }
  if (msg.includes("network")) {
    return "Network error. Please check your connection and retry.";
  }
  return "An unexpected error occurred. Please try again.";
}

function safeSerializeToolResult(data: unknown): string {
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(
      data,
      (_, value) => {
        if (typeof value === "function" || typeof value === "symbol") {
          return undefined;
        }
        if (value && typeof value === "object") {
          const obj = value as object;
          if (seen.has(obj)) {
            return "[Circular]";
          }
          seen.add(obj);
        }
        return value;
      }
    );
    const out = json ?? String(data);
    return out.length > 20_000 ? `${out.slice(0, 20_000)}...[truncated]` : out;
  } catch {
    return "[unserializable tool result]";
  }
}

/**
 * Live implementation that uses real LLM with streaming
 */
export function useAgentChatLive(): [AgentChatState, AgentChatActions] {
  const [state, setState] = React.useState<AgentChatState>({
    messages: [],
    toolCalls: [],
    isResponding: false,
    hasApiKey: false,
  });
  
  const abortRef = React.useRef<(() => void) | null>(null);
  const streamingRef = React.useRef<ChatStream | null>(null);
  const messagesRef = React.useRef<ChatMessage[]>([]);
  const llmMessagesRef = React.useRef<LlmMessage[]>([]);
  const isRespondingRef = React.useRef(false);
  const sendLockRef = React.useRef(false);
  
  // Check for API key on mount
  React.useEffect(() => {
    hasApiKey().then((has) => {
      setState((s) => ({ ...s, hasApiKey: has }));
    });
  }, []);

  React.useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  React.useEffect(() => {
    isRespondingRef.current = state.isResponding;
  }, [state.isResponding]);

  const cancelResponse = React.useCallback(() => {
    if (streamingRef.current) {
      streamingRef.current.cancel();
      streamingRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setState((s) => ({
      ...s,
      isResponding: false,
      messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
    }));
    isRespondingRef.current = false;
    sendLockRef.current = false;
  }, []);

  const clearHistory = React.useCallback(() => {
    cancelResponse();
    setState((s) => ({
      ...s,
      messages: [],
      toolCalls: [],
      isResponding: false,
    }));
    llmMessagesRef.current = [];
  }, [cancelResponse]);

  const sendMessage = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendLockRef.current) return;
    sendLockRef.current = true;
    if (isRespondingRef.current) {
      sendLockRef.current = false;
      return;
    }
    isRespondingRef.current = true;

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
    };

    setState((s) => {
      const nextMessages = [...s.messages, userMsg];
      messagesRef.current = nextMessages;
      return {
        ...s,
        messages: nextMessages,
        isResponding: true,
        error: undefined,
      };
    });

    try {
      // Check for API key
      const apiKey = await loadApiKey();
      if (!apiKey) {
        setState((s) => ({
          ...s,
          isResponding: false,
          hasApiKey: false,
          error: "No API key configured. Please configure your API key in settings.",
        }));
        return;
      }

      const provider = await createProvider();
      if (!provider) {
        setState((s) => ({
          ...s,
          isResponding: false,
          error: "Failed to create LLM provider. Check your configuration.",
        }));
        return;
      }

      // Generate stable assistant message ID before streaming
      const assistantMsgId = `msg-${Date.now()}-assistant`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        createdAt: Date.now(),
        isStreaming: true,
      };

      // Add assistant message placeholder to state
      setState((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
      }));

      // Build LLM conversation from persisted history and current user input.
      llmMessagesRef.current = [...llmMessagesRef.current, { role: "user", content: trimmed }];
      const llmMessages = llmMessagesRef.current;

      // Get tool definitions for LLM
      const toolDefs: OpenAITool[] = [
        {
          type: "function" as const,
          function: {
            name: "get_balances",
            description: "Get ERC-20 token balances for the wallet",
            parameters: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network (sepolia/mainnet)",
                  enum: ["sepolia", "mainnet"],
                },
              },
              required: ["network"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "prepare_transfer",
            description: "Prepare a token transfer (validates without executing)",
            parameters: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network (sepolia/mainnet)",
                  enum: ["sepolia", "mainnet"],
                },
                tokenSymbol: {
                  type: "string",
                  description: "Token symbol (ETH, USDC, STRK)",
                  enum: ["ETH", "USDC", "STRK"],
                },
                amount: { type: "string", description: "Amount to transfer" },
                to: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["network", "tokenSymbol", "amount", "to"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "estimate_fee",
            description: "Estimate gas fee for a transaction",
            parameters: {
              type: "object",
              properties: {
                tokenSymbol: {
                  type: "string",
                  description: "Token symbol (ETH, USDC, STRK)",
                  enum: ["ETH", "USDC", "STRK"],
                },
                amount: { type: "string", description: "Amount to transfer" },
                to: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["tokenSymbol", "amount", "to"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "execute_transfer",
            description: "Execute a prepared token transfer (requires manual approval in Transfer tab)",
            parameters: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network (sepolia/mainnet)",
                  enum: ["sepolia", "mainnet"],
                },
                tokenSymbol: {
                  type: "string",
                  description: "Token symbol (ETH, USDC, STRK)",
                  enum: ["ETH", "USDC", "STRK"],
                },
                amount: { type: "string", description: "Amount to transfer" },
                to: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["network", "tokenSymbol", "amount", "to"],
            },
          },
        },
      ];

      // Helper to call LLM with current messages
      const callLlm = async (msgs: LlmMessage[], tools?: OpenAITool[]) => {
        return provider.streamChat({
          model: "gpt-4o-mini",
          systemPrompt: AGENT_SYSTEM_PROMPT,
          messages: msgs,
          tools,
        });
      };

      // Initial LLM call with tools
      let stream = await callLlm(llmMessages, toolDefs);
      streamingRef.current = stream;

      let fullText = "";
      let currentToolCalls: ParsedToolCall[] = [];

      // Process streaming response
      for await (const chunk of stream) {
        if (chunk.type === "delta") {
          fullText += chunk.text;
          
          // Update existing assistant message in-place instead of duplicating user message
          setState((s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, text: fullText, isStreaming: true }
                : m
            ),
          }));
        } else if (chunk.type === "tool_call") {
          // Add tool call to our list
          const tc = chunk.toolCall;
          currentToolCalls.push(tc);
          
          const operationType: "read" | "write" = isReadOnlyTool(tc.name) ? "read" : "write";
          
          // Add tool call to state
          const toolCallEntry: ToolCall = {
            id: tc.id,
            toolName: tc.name,
            params: tc.arguments,
            timestamp: new Date().toISOString(),
            operationType,
            status: "pending",
          };
          
          setState((s) => ({
            ...s,
            toolCalls: [...s.toolCalls, toolCallEntry],
          }));
        } else if (chunk.type === "done") {
          break;
        }
      }

      // If we have tool calls, execute them and send results back to LLM.
      if (currentToolCalls.length > 0) {
        const toolResults: { tool_call_id: string; content: string }[] = [];

        for (const tc of currentToolCalls) {
          if (!AUTO_EXECUTABLE_TOOLS.has(tc.name)) {
            const blockedResult =
              "Blocked: this tool requires manual approval. Use the Transfer tab to run write operations.";
            toolResults.push({
              tool_call_id: tc.id,
              content: blockedResult,
            });
            setState((s) => ({
              ...s,
              toolCalls: s.toolCalls.map((t) =>
                t.id === tc.id ? { ...t, result: blockedResult, status: "error" } : t
              ),
            }));
            continue;
          }

          const result = await executeTool(tc.name, tc.arguments);
          const resultStr = result.ok 
            ? safeSerializeToolResult(result.data)
            : `Error: ${result.error}`;
          
          toolResults.push({
            tool_call_id: tc.id,
            content: resultStr,
          });

          // Update tool call status in state
          setState((s) => ({
            ...s,
            toolCalls: s.toolCalls.map((t) =>
              t.id === tc.id
                ? { ...t, result: resultStr, status: result.ok ? "success" : "error" }
                : t
            ),
          }));
        }

        // Add assistant message with tool calls to conversation
        const toolContextMsg: LlmMessage = {
          role: "assistant",
          content: fullText || "Using tools...",
          toolCalls: currentToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments ?? {}),
            },
          })),
        };

        // Add tool result messages
        const toolResultMessages: LlmMessage[] = toolResults.map((tr) => ({
          role: "tool" as const,
          content: tr.content,
          toolCallId: tr.tool_call_id,
        }));

        // Call LLM again with tool results and no additional tool execution.
        const updatedMessages = [...llmMessagesRef.current, toolContextMsg, ...toolResultMessages];
        llmMessagesRef.current = updatedMessages;
        stream = await callLlm(updatedMessages, undefined);
        streamingRef.current = stream;

        fullText = "";
        const finalAssistantMsgId = `msg-${Date.now()}-assistant`;
        
        // Add final assistant message placeholder
        const finalAssistantMsg: ChatMessage = {
          id: finalAssistantMsgId,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          isStreaming: true,
        };
        
        setState((s) => ({
          ...s,
          messages: [...s.messages, finalAssistantMsg],
        }));
        
        for await (const chunk of stream) {
          if (chunk.type === "delta") {
            fullText += chunk.text;
            
            // Update assistant message in-place without duplicating
            setState((s) => ({
              ...s,
              messages: s.messages.map((m) =>
                m.id === finalAssistantMsgId
                  ? { ...m, text: fullText, isStreaming: true }
                  : m
              ),
            }));
          } else if (chunk.type === "done") {
            break;
          }
        }
        llmMessagesRef.current = [...llmMessagesRef.current, { role: "assistant", content: fullText }];
      } else {
        llmMessagesRef.current = [...llmMessagesRef.current, { role: "assistant", content: fullText }];
      }

      // Mark as complete
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
        isResponding: false,
      }));

    } catch (err) {
      // Log only non-sensitive context; avoid leaking raw payloads.
      const name = err instanceof Error ? err.name : "UnknownError";
      console.warn("Agent chat error", { name });
      setState((s) => ({
        ...s,
        isResponding: false,
        messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
        error: toSafeUserError(err),
      }));
    } finally {
      if (streamingRef.current) {
        streamingRef.current.cancel();
      }
      streamingRef.current = null;
      abortRef.current = null;
      isRespondingRef.current = false;
      sendLockRef.current = false;
    }
  }, []);

  return [
    state,
    { sendMessage, cancelResponse, clearHistory },
  ];
}

/**
 * Simulates streaming for demo mode
 */
async function* simulateStreaming(text: string, delayMs = 20): AsyncGenerator<string> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield words[i] + (i < words.length - 1 ? " " : "");
  }
}

/**
 * Demo implementation that simulates agent responses
 */
export function useAgentChatDemo(): [AgentChatState, AgentChatActions] {
  const [state, setState] = React.useState<AgentChatState>({
    messages: [],
    toolCalls: [],
    isResponding: false,
    hasApiKey: true, // Demo mode always has "API key"
  });

  const cancelRef = React.useRef(false);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const actions: AgentChatActions = {
    sendMessage: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.isResponding) return;

      cancelRef.current = false;

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: trimmed,
        createdAt: Date.now(),
      };

      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg],
        isResponding: true,
      }));

      // Simulate assistant response after brief delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (cancelRef.current) {
        setState((s) => ({ ...s, isResponding: false }));
        return;
      }

      // Generate demo response based on input
      const lower = trimmed.toLowerCase();
      let responseText = "I understand. Let me help you with that.";
      let toolCall: ToolCall | null = null;

      if (lower.includes("balance") || lower.includes("portfolio")) {
        responseText = "I'll check your current balances.";
        toolCall = {
          id: `tool-${Date.now()}`,
          toolName: "getBalances",
          params: { address: "0x..." },
          result: "ETH: 0.5, STRK: 1000, USDC: 500",
          timestamp: new Date().toISOString(),
          operationType: "read",
          status: "success",
        };
      } else if (lower.includes("send") || lower.includes("transfer")) {
        responseText = "I can help you send tokens. Let me prepare the transaction.";
        toolCall = {
          id: `tool-${Date.now()}`,
          toolName: "transfer",
          params: { amount: "50", token: "USDC", to: "0x..." },
          result: "Transaction prepared, awaiting approval",
          timestamp: new Date().toISOString(),
          operationType: "write",
          status: "pending",
        };
      }

      // Add assistant message with streaming simulation
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: "",
        createdAt: Date.now(),
        isStreaming: true,
      };

      setState((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        toolCalls: toolCall ? [...s.toolCalls, toolCall] : s.toolCalls,
      }));

      // Simulate streaming
      let fullText = "";
      for await (const chunk of simulateStreaming(responseText)) {
        if (cancelRef.current) break;
        fullText += chunk;
        setState((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: fullText } : m
          ),
        }));
      }

      // Mark as complete
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
        ),
        isResponding: false,
      }));
    },

    cancelResponse: () => {
      cancelRef.current = true;
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
        isResponding: false,
      }));
    },

    clearHistory: () => {
      setState({
        messages: [],
        toolCalls: [],
        isResponding: false,
        hasApiKey: true,
      });
    },
  };

  return [state, actions];
}
