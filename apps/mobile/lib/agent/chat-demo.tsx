/**
 * ChatDemo — standalone demo of streaming chat UI with tool-call rendering
 * 
 * This component demonstrates the streaming UI without modifying the main agent screen.
 * Can be integrated into agent.tsx after verification.
 */

import * as React from "react";
import { View, ScrollView, TextInput, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAgentChatDemo } from "./use-agent-chat";
import { StreamingMessage, ToolCallCard } from "@/ui/chat";
import { GlassCard } from "@/ui/glass-card";
import { IconButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Body, H2, Muted } from "@/ui/typography";
import { useAppTheme } from "@/ui/app-theme";
import { haptic } from "@/ui/haptics";
import { Row } from "@/ui/screen";
import { LinearGradient } from "expo-linear-gradient";

export function ChatDemo() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [chatState, chatActions] = useAgentChatDemo();
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<ScrollView>(null);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (chatState.messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatState.messages.length]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 120,
          gap: 14,
        }}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 8 }}>
          <Muted>Agent Chat (Demo)</Muted>
          <H2>Streaming conversation with tool calls</H2>
        </Animated.View>

        {chatState.messages.length === 0 && (
          <GlassCard padding={16}>
            <Body style={{ color: t.colors.textMuted, textAlign: "center" }}>
              Try: "Show my balance" or "Send 50 USDC"
            </Body>
          </GlassCard>
        )}

        {chatState.messages.map((msg, idx) => {
          // Show tool calls after the message that triggered them
          const toolCallsAfter = chatState.toolCalls.filter((tc) =>
            tc.timestamp >= new Date(msg.createdAt).toISOString() &&
            (idx === chatState.messages.length - 1 ||
              tc.timestamp < new Date(chatState.messages[idx + 1]?.createdAt || Date.now()).toISOString())
          );

          return (
            <View key={msg.id} style={{ gap: 10 }}>
              {msg.role === "user" ? (
                <UserMessageBubble text={msg.text} />
              ) : msg.isStreaming ? (
                <StreamingMessage
                  stream={(async function* () {
                    // Since we already have the text in state, just yield it
                    for (const word of msg.text.split(" ")) {
                      yield word + " ";
                    }
                  })()}
                />
              ) : (
                <AssistantMessageBubble text={msg.text} />
              )}

              {toolCallsAfter.map((tc) => (
                <ToolCallCard key={tc.id} {...tc} />
              ))}
            </View>
          );
        })}

        {chatState.isResponding && chatState.messages[chatState.messages.length - 1]?.role === "assistant" && (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Muted style={{ fontSize: 12 }}>Agent is responding...</Muted>
          </View>
        )}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 10 + insets.bottom,
          borderTopWidth: 1,
          borderColor: t.colors.glassBorder,
          backgroundColor: t.colors.glassFill,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask the agent…"
            placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
            multiline
            editable={!chatState.isResponding}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: t.colors.glassBorder,
              backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
              color: t.colors.text,
              fontFamily: t.font.body,
              fontSize: 15,
              maxHeight: 120,
            }}
          />
          <IconButton
            disabled={!draft.trim() || chatState.isResponding}
            tone={draft.trim() && !chatState.isResponding ? "accent" : "neutral"}
            onPress={async () => {
              await haptic("tap");
              chatActions.sendMessage(draft);
              setDraft("");
            }}
            icon={<AppIcon ios="arrow.up" fa="arrow-up" color={t.colors.text} size={18} />}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function UserMessageBubble(props: { text: string }) {
  const t = useAppTheme();
  const borderA = t.scheme === "dark" ? "rgba(90,169,255,0.42)" : "rgba(36,87,255,0.30)";
  const borderB = t.scheme === "dark" ? "rgba(106,228,215,0.26)" : "rgba(14,142,166,0.18)";
  const fill = t.scheme === "dark" ? "rgba(90,169,255,0.14)" : "rgba(36,87,255,0.12)";

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{ alignSelf: "flex-end", maxWidth: "85%" }}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: 20, borderCurve: "continuous", padding: 1 }}
      >
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 19,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            backgroundColor: fill,
          }}
        >
          <Body style={{ color: t.colors.text }}>{props.text}</Body>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function AssistantMessageBubble(props: { text: string }) {
  const t = useAppTheme();
  const borderA = t.scheme === "dark" ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)";
  const borderB = t.colors.glassBorder;
  const fill = t.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.60)";

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{ alignSelf: "flex-start", maxWidth: "85%" }}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: 20, borderCurve: "continuous", padding: 1 }}
      >
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 19,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            backgroundColor: fill,
          }}
        >
          <Body style={{ color: t.colors.text }}>{props.text}</Body>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
