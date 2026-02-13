import * as React from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useDemo } from "@/lib/demo/demo-store";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Chip } from "@/ui/chip";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { formatUsd } from "@/ui/format";
import { Body, H1, H2, Muted } from "@/ui/typography";

function toNumberOr(n: string, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default function PoliciesScreen() {
  const t = useAppTheme();
  const { state, actions } = useDemo();

  const [dailyText, setDailyText] = React.useState(String(state.policy.dailySpendCapUsd));
  const [perTxText, setPerTxText] = React.useState(String(state.policy.perTxCapUsd));
  const [newRecipient, setNewRecipient] = React.useState("");

  const onSaveCaps = React.useCallback(async () => {
    await haptic("tap");
    actions.updateSpendCaps(
      toNumberOr(dailyText, state.policy.dailySpendCapUsd),
      toNumberOr(perTxText, state.policy.perTxCapUsd)
    );
  }, [actions, dailyText, perTxText, state.policy.dailySpendCapUsd, state.policy.perTxCapUsd]);

  const onAddRecipient = React.useCallback(async () => {
    await haptic("tap");
    const trimmed = newRecipient.trim();
    if (!trimmed) return;
    actions.addAllowlistedRecipient(trimmed);
    setNewRecipient("");
  }, [actions, newRecipient]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Muted>Policies</Muted>
        <H1>Define the boundaries</H1>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Spend caps</H2>
              <Muted>{formatUsd(state.policy.dailySpendCapUsd)}/day</Muted>
            </Row>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Daily</Muted>
                <Muted>$ / day</Muted>
              </Row>
              <TextInput
                value={dailyText}
                onChangeText={setDailyText}
                keyboardType="decimal-pad"
                placeholder="250"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.bodyMedium,
                  fontSize: 18,
                  fontVariant: ["tabular-nums"],
                }}
              />
              <QuickChips values={[100, 250, 500, 1000]} onPick={(v) => setDailyText(String(v))} />
            </View>

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Per transaction</Muted>
                <Muted>$ / tx</Muted>
              </Row>
              <TextInput
                value={perTxText}
                onChangeText={setPerTxText}
                keyboardType="decimal-pad"
                placeholder="75"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.bodyMedium,
                  fontSize: 18,
                  fontVariant: ["tabular-nums"],
                }}
              />
              <QuickChips values={[25, 50, 75, 150]} onPick={(v) => setPerTxText(String(v))} />
            </View>

            <Row style={{ gap: 10 }}>
              <PrimaryButton label="Save caps" onPress={onSaveCaps} style={{ flex: 1 }} />
              <GhostButton
                label="Reset"
                onPress={async () => {
                  await haptic("warn");
                  setDailyText(String(state.policy.dailySpendCapUsd));
                  setPerTxText(String(state.policy.perTxCapUsd));
                }}
                style={{ flex: 1 }}
              />
            </Row>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Recipients</H2>
              <Muted>{state.policy.allowlistedRecipients.length} allowlisted</Muted>
            </Row>

            <View style={{ gap: 10 }}>
              <TextInput
                value={newRecipient}
                onChangeText={setNewRecipient}
                placeholder="Add allowlisted address (mock)"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                autoCapitalize="none"
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
                  color: t.colors.text,
                  fontFamily: t.font.body,
                  fontSize: 15,
                }}
              />
              <PrimaryButton label="Add recipient" onPress={onAddRecipient} disabled={!newRecipient.trim()} />
            </View>

            <View style={{ gap: 10 }}>
              {state.policy.allowlistedRecipients.map((r) => (
                <Row key={r}>
                  <Body selectable style={{ fontFamily: t.font.mono, color: t.colors.muted }}>
                    {r}
                  </Body>
                  <Pressable
                    onPress={async () => {
                      await haptic("warn");
                      actions.removeAllowlistedRecipient(r);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "rgba(255,69,58,0.30)",
                      backgroundColor: "rgba(255,69,58,0.10)",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.bad }}>Remove</Body>
                  </Pressable>
                </Row>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Contracts</H2>
              <Muted style={{ textTransform: "capitalize" }}>{state.policy.contractAllowlistMode.replace("-", " ")}</Muted>
            </Row>
            <Segment
              value={state.policy.contractAllowlistMode}
              onChange={(v) => actions.setContractMode(v)}
              items={[
                { id: "trusted-only", label: "Trusted-only", caption: "Block unknown contracts." },
                { id: "warn", label: "Warn", caption: "Allow, but alert first." },
                { id: "open", label: "Open", caption: "Fast, higher risk." },
              ]}
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Emergency lockdown</H2>
              <Switch
                value={state.policy.emergencyLockdown}
                onValueChange={async (v) => {
                  try {
                    await requireOwnerAuth({ reason: "Toggle emergency lockdown" });
                  } catch (e) {
                    await haptic("warn");
                    actions.triggerAlert(
                      "Lockdown not changed",
                      e instanceof Error ? e.message : "Owner confirmation failed.",
                      "warn"
                    );
                    return;
                  }
                  await haptic("warn");
                  actions.setEmergencyLockdown(v);
                }}
                trackColor={{ false: t.scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(11,18,32,0.16)", true: "rgba(255,69,58,0.55)" }}
                thumbColor="#FFFFFF"
              />
            </Row>
            <Muted>
              When enabled, Starkclaw will block all agent actions, even if they would normally be allowed.
            </Muted>
          </View>
        </GlassCard>
      </Animated.View>
    </AppScreen>
  );
}

function QuickChips(props: { values: number[]; onPick: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {props.values.map((v) => (
        <Chip
          key={v}
          label={`$${v}`}
          onPress={async () => {
            await haptic("tap");
            props.onPick(v);
          }}
        />
      ))}
    </View>
  );
}

function Segment<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; caption: string }[];
}) {
  const t = useAppTheme();
  return (
    <View style={{ gap: 10 }}>
      {props.items.map((it) => {
        const selected = it.id === props.value;
        const borderA = selected
          ? t.scheme === "dark"
            ? "rgba(90,169,255,0.38)"
            : "rgba(36,87,255,0.28)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.20)"
            : "rgba(255,255,255,0.92)";
        const borderB = selected
          ? t.scheme === "dark"
            ? "rgba(106,228,215,0.26)"
            : "rgba(14,142,166,0.18)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.08)"
            : "rgba(8,18,32,0.10)";
        const fill = selected
          ? t.scheme === "dark"
            ? "rgba(90,169,255,0.12)"
            : "rgba(36,87,255,0.10)"
          : t.scheme === "dark"
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.60)";

        return (
          <Pressable
            key={it.id}
            onPress={async () => {
              await haptic("tap");
              props.onChange(it.id);
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={[borderA, borderB]}
              start={{ x: 0.1, y: 0.0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ borderRadius: t.radius.lg, borderCurve: "continuous", padding: 1 }}
            >
              <View
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.lg - 1,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: fill,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Row>
                    <Body style={{ fontFamily: t.font.bodyMedium }}>{it.label}</Body>
                    {selected ? <AppIcon ios="checkmark.circle.fill" fa="check-circle" color={t.colors.text} size={18} /> : null}
                  </Row>
                  <Muted>{it.caption}</Muted>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}
