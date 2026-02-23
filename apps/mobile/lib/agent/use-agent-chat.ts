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
- get_balances: Read ERC-20 balances (ETH, USDC, STRK)
- prepare_transfer: Validate and prepare a transfer without executing
- estimate_fee: Estimate gas fees
- execute_transfer: Requires manual user approval in the Transfer tab

Security rules:
- Never claim to execute transfers directly.
- execute_transfer requires explicit manual approval in the Transfer tab.
- Read-only tools (get_balances, prepare_transfer, estimate_fee) can be executed automatically.
- Use tools only within the approved execution policy.`;

function messageToLlmFormat(messages: ChatMessage[]): LlmMessage[] {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

const READ_ONLY_TOOLS = new Set(["get_balances", "prepare_transfer", "estimate_fee"]);
const AUTO_EXECUTABLE_TOOLS = new Set(["get_balances", "prepare_transfer", "estimate_fee"]);

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
  const isRespondingRef = React.useRef(false);
  
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
    }
    if (abortRef.current) {
      abortRef.current();
    }
    setState((s) => ({
      ...s,
      isResponding: false,
      messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
    }));
    isRespondingRef.current = false;
  }, []);

  const clearHistory = React.useCallback(() => {
    cancelResponse();
    setState((s) => ({
      ...s,
      messages: [],
      toolCalls: [],
      isResponding: false,
    }));
  }, [cancelResponse]);

  const sendMessage = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isRespondingRef.current) return;
    isRespondingRef.current = true;

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
    };

    let allMessages: ChatMessage[] = [];
    setState((s) => {
      allMessages = [...s.messages, userMsg];
      messagesRef.current = allMessages;
      return {
        ...s,
        messages: allMessages,
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

      // Build conversation messages including current user input
      const llmMessages = messageToLlmFormat(allMessages);

      // Get tool definitions for LLM
      const toolDefs: OpenAITool[] = [
        {
          type: "function" as const,
          function: {
            name: "get_balances",
            description: "Get ERC-20 token balances for the wallet",
            parameters: {
              type: "object",
              properties: {},
              required: [],
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
                token: { type: "string", description: "Token symbol (ETH, USDC, STRK)" },
                amount: { type: "string", description: "Amount to transfer" },
                recipient: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["token", "amount", "recipient"],
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
                token: { type: "string", description: "Token symbol (ETH, USDC, STRK)" },
                amount: { type: "string", description: "Amount to transfer" },
                recipient: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["token", "amount", "recipient"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "execute_transfer",
            description: "Execute a prepared token transfer",
            parameters: {
              type: "object",
              properties: {
                token: { type: "string", description: "Token symbol (ETH, USDC, STRK)" },
                amount: { type: "string", description: "Amount to transfer" },
                recipient: { type: "string", description: "Recipient address (0x...)" },
              },
              required: ["token", "amount", "recipient"],
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
          tools: (tools && tools.length > 0) ? tools : toolDefs,
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

      // If we have tool calls, execute them and send results back to LLM
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
            ? JSON.stringify(result.data) 
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

        // Call LLM again with tool results
        const updatedMessages = [...llmMessages, toolContextMsg, ...toolResultMessages];
        stream = await callLlm(updatedMessages, toolDefs);
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
      isRespondingRef.current = false;
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
