import * as React from "react";
import { KeyboardAvoidingView, ScrollView, Switch, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/lib/app/app-provider";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { Chip } from "@/ui/chip";
import { Divider } from "@/ui/divider";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppBackground } from "@/ui/app-background";
import { Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

export default function AgentScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state, actions } = useApp();

  const [draft, setDraft] = React.useState("");

  const pending = state.agent.proposals.filter((p) => p.status === "pending");

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={process.env.EXPO_OS === "ios" ? 8 : 0}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 14 + (process.env.EXPO_OS === "ios" ? 0 : insets.top),
              paddingBottom: 150 + insets.bottom,
              gap: 14,
            }}
          >
            <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
              <Muted>Agent</Muted>
              <H1>Ask, preview, approve</H1>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(70).duration(420)}>
              <GlassCard>
                <View style={{ gap: 12 }}>
                  <Row>
                    <H2>Status</H2>
                    <Badge label={state.policy.emergencyLockdown ? "Locked" : "Active"} tone={state.policy.emergencyLockdown ? "danger" : "good"} />
                  </Row>

                  <ToggleRow
                    title="Autopilot"
                    body="Let the agent execute low-risk actions automatically."
                    value={state.agent.autopilotEnabled}
                    onChange={(v) => actions.setAutopilotEnabled(v)}
                  />
                  <ToggleRow
                    title="Quiet hours"
                    body="Suppress non-critical alerts outside focus time."
                    value={state.agent.quietHoursEnabled}
                    onChange={(v) => actions.setQuietHoursEnabled(v)}
                  />
                </View>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(420)}>
              <GlassCard>
                <View style={{ gap: 10 }}>
                  <H2>Quick prompts</H2>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    <PromptChip label="Preview a trade" onPress={() => actions.sendAgentMessage("preview a trade")} />
                    <PromptChip label="Rebalance" onPress={() => actions.sendAgentMessage("rebalance")} />
                    <PromptChip label="Tighten caps" onPress={() => actions.sendAgentMessage("tighten policy caps")} />
                    <PromptChip label="Send USDC" onPress={() => actions.sendAgentMessage("send 40 usdc")} />
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {pending.length ? (
              <Animated.View entering={FadeInDown.delay(160).duration(420)} style={{ gap: 12 }}>
                {pending.map((p) => (
                  <GlassCard key={p.id} padding={16} intensity={t.scheme === "dark" ? 18 : 55}>
                    <View style={{ gap: 10 }}>
                      <Row>
                        <H2>Proposal</H2>
                        <Badge label={`${p.risk} risk`} tone={p.risk === "high" ? "danger" : p.risk === "medium" ? "warn" : "good"} />
                      </Row>

                      <View style={{ gap: 4 }}>
                        <Body style={{ fontFamily: t.font.bodySemibold, fontSize: 18 }}>{p.title}</Body>
                        <Muted>{p.summary}</Muted>
                      </View>

                      <View style={{ gap: 8 }}>
                        {Object.entries(p.details).map(([k, v]) => (
                          <Row key={k}>
                            <Muted>{k}</Muted>
                            <Body style={{ fontFamily: t.font.bodyMedium }}>{v}</Body>
                          </Row>
                        ))}
                      </View>

                      <Row style={{ gap: 10 }}>
                        <PrimaryButton
                          label="Approve"
                          onPress={async () => {
                            try {
                              await requireOwnerAuth({ reason: "Approve agent action" });
                            } catch (e) {
                              await haptic("warn");
                              actions.triggerAlert(
                                "Approval cancelled",
                                e instanceof Error ? e.message : "Owner confirmation failed.",
                                "warn"
                              );
                              return;
                            }
                            await haptic("success");
                            actions.approveProposal(p.id);
                          }}
                          style={{ flex: 1 }}
                        />
                        <GhostButton
                          label="Reject"
                          onPress={async () => {
                            await haptic("warn");
                            actions.rejectProposal(p.id);
                          }}
                          style={{ flex: 1 }}
                        />
                      </Row>
                    </View>
                  </GlassCard>
                ))}
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(220).duration(420)}>
              <GlassCard>
                <View style={{ gap: 10 }}>
                  <Row>
                    <H2>Conversation</H2>
                    <Muted>{state.agent.messages.length} messages</Muted>
                  </Row>
                  <View style={{ gap: 10 }}>
                    {state.agent.messages.map((m) => (
                      <MessageBubble key={m.id} role={m.role} text={m.text} />
                    ))}
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          </ScrollView>

          <BlurView
            intensity={t.scheme === "dark" ? 18 : 55}
            tint={t.scheme === "dark" ? "dark" : "light"}
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
                placeholder="Ask Starkclaw…"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                multiline
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
                disabled={!draft.trim()}
                tone={draft.trim() ? "accent" : "neutral"}
                onPress={async () => {
                  await haptic("tap");
                  actions.sendAgentMessage(draft);
                  setDraft("");
                }}
                icon={<AppIcon ios="arrow.up" fa="arrow-up" color={t.colors.text} size={18} />}
              />
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

function PromptChip(props: { label: string; onPress: () => void }) {
  return (
    <Chip
      label={props.label}
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
    />
  );
}

function ToggleRow(props: { title: string; body: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Row>
        <View style={{ flex: 1, gap: 2 }}>
          <Body style={{ fontFamily: t.font.bodyMedium }}>{props.title}</Body>
          <Muted>{props.body}</Muted>
        </View>
        <Switch
          value={props.value}
          onValueChange={async (v) => {
            await haptic("tap");
            props.onChange(v);
          }}
          trackColor={{ false: t.scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(11,18,32,0.16)", true: t.colors.accent2 }}
          thumbColor="#FFFFFF"
        />
      </Row>
      <Divider />
    </View>
  );
}

function MessageBubble(props: { role: "user" | "assistant"; text: string }) {
  const t = useAppTheme();
  const isUser = props.role === "user";
  const borderA = isUser
    ? t.scheme === "dark"
      ? "rgba(90,169,255,0.42)"
      : "rgba(36,87,255,0.30)"
    : t.scheme === "dark"
      ? "rgba(255,255,255,0.20)"
      : "rgba(255,255,255,0.92)";
  const borderB = isUser ? (t.scheme === "dark" ? "rgba(106,228,215,0.26)" : "rgba(14,142,166,0.18)") : t.colors.glassBorder;
  const fill = isUser
    ? t.scheme === "dark"
      ? "rgba(90,169,255,0.14)"
      : "rgba(36,87,255,0.12)"
    : t.scheme === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(255,255,255,0.60)";
  return (
    <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "92%" }}>
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
    </View>
  );
}
