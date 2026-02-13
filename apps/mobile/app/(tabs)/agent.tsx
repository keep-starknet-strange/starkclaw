import * as React from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDemo } from "@/lib/demo/demo-store";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppBackground } from "@/ui/app-background";
import { Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

export default function AgentScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state, actions } = useDemo();

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
              paddingTop: 14,
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
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: state.policy.emergencyLockdown ? "rgba(255,69,58,0.35)" : "rgba(48,209,88,0.28)",
                        backgroundColor: state.policy.emergencyLockdown ? "rgba(255,69,58,0.10)" : "rgba(48,209,88,0.10)",
                      }}
                    >
                      <Body style={{ fontFamily: t.font.bodyMedium, color: state.policy.emergencyLockdown ? t.colors.bad : t.colors.good }}>
                        {state.policy.emergencyLockdown ? "Locked" : "Active"}
                      </Body>
                    </View>
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
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor:
                              p.risk === "high"
                                ? "rgba(255,69,58,0.35)"
                                : p.risk === "medium"
                                  ? "rgba(255,159,10,0.35)"
                                  : "rgba(48,209,88,0.28)",
                            backgroundColor:
                              p.risk === "high"
                                ? "rgba(255,69,58,0.10)"
                                : p.risk === "medium"
                                  ? "rgba(255,159,10,0.10)"
                                  : "rgba(48,209,88,0.10)",
                          }}
                        >
                          <Body
                            style={{
                              fontFamily: t.font.bodyMedium,
                              color: p.risk === "high" ? t.colors.bad : p.risk === "medium" ? t.colors.warn : t.colors.good,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              fontSize: 12,
                            }}
                          >
                            {p.risk} risk
                          </Body>
                        </View>
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
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                  color: t.colors.text,
                  fontFamily: t.font.body,
                  fontSize: 15,
                  maxHeight: 120,
                }}
              />
              <Pressable
                disabled={!draft.trim()}
                onPress={async () => {
                  await haptic("tap");
                  actions.sendAgentMessage(draft);
                  setDraft("");
                }}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  opacity: !draft.trim() ? 0.45 : pressed ? 0.85 : 1,
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(106,228,215,0.14)" : "rgba(36,87,255,0.12)",
                })}
              >
                <Body style={{ fontFamily: t.font.bodySemibold }}>Send</Body>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

function PromptChip(props: { label: string; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
      style={({ pressed }) => ({
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Body style={{ fontFamily: t.font.bodyMedium }}>{props.label}</Body>
    </Pressable>
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
      <View style={{ height: 1, backgroundColor: t.colors.faint }} />
    </View>
  );
}

function MessageBubble(props: { role: "user" | "assistant"; text: string }) {
  const t = useAppTheme();
  const isUser = props.role === "user";
  return (
    <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "92%" }}>
      <View
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: isUser ? "rgba(90,169,255,0.30)" : t.colors.glassBorder,
          backgroundColor: isUser
            ? t.scheme === "dark"
              ? "rgba(90,169,255,0.14)"
              : "rgba(36,87,255,0.10)"
            : t.scheme === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,255,255,0.55)",
        }}
      >
        <Body style={{ color: t.colors.text }}>{props.text}</Body>
      </View>
    </View>
  );
}
