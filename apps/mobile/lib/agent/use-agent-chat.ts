/**
 * useAgentChat — manages streaming chat conversations with tool-call tracking
 * 
 * Supports both demo (simulated streaming) and live (real LLM) modes.
 */

import * as React from "react";

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
};

type AgentChatActions = {
  sendMessage: (text: string) => Promise<void>;
  cancelResponse: () => void;
  clearHistory: () => void;
};

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
  });

  const cancelRef = React.useRef(false);

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
      });
    },
  };

  return [state, actions];
}
