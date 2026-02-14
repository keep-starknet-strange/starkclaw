import * as React from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useApp } from "@/lib/app/app-provider";
import { requireOwnerAuth } from "@/lib/security/owner-auth";
import {
  TARGET_PRESETS,
  MAX_ALLOWED_TARGETS,
  labelForAddress,
  type TargetPresetId,
} from "@/lib/policy/target-presets";
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
  const { state, actions } = useApp();

  const [dailyText, setDailyText] = React.useState(String(state.policy.dailySpendCapUsd));
  const [perTxText, setPerTxText] = React.useState(String(state.policy.perTxCapUsd));
  const [newRecipient, setNewRecipient] = React.useState("");

  // ── Allowed Apps state ──
  const [selectedPreset, setSelectedPreset] = React.useState<TargetPresetId>("transfers");
  const [customTargets, setCustomTargets] = React.useState<string[]>([]);
  const [newTarget, setNewTarget] = React.useState("");

  const resolvedTargets = React.useMemo(() => {
    if (selectedPreset === "custom") return customTargets;
    const preset = TARGET_PRESETS.find((p) => p.id === selectedPreset);
    if (!preset) return [];
    const network = state.account.environment === "mainnet" ? "mainnet" : "sepolia";
    return preset.resolve(network as "mainnet" | "sepolia");
  }, [selectedPreset, customTargets, state.account.environment]);

  const onAddCustomTarget = React.useCallback(async () => {
    await haptic("tap");
    const trimmed = newTarget.trim();
    if (!trimmed) return;
    if (customTargets.length >= MAX_ALLOWED_TARGETS) return;
    if (customTargets.includes(trimmed)) return;
    setCustomTargets((prev) => [...prev, trimmed]);
    setNewTarget("");
  }, [newTarget, customTargets]);

  const onRemoveCustomTarget = React.useCallback(async (addr: string) => {
    await haptic("warn");
    setCustomTargets((prev) => prev.filter((a) => a !== addr));
  }, []);

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

      {/* Allowed Apps Card - Session Key Multi-Target Presets */}
      <Animated.View entering={FadeInDown.delay(200).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Allowed Apps</H2>
              <Muted>
                {resolvedTargets.length === 0
                  ? "Any contract"
                  : `${resolvedTargets.length} contract${resolvedTargets.length === 1 ? "" : "s"}`}
              </Muted>
            </Row>

            {/* Preset Selector */}
            <View style={{ gap: 8 }}>
              {TARGET_PRESETS.map((preset) => {
                const selected = selectedPreset === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={async () => {
                      await haptic("tap");
                      setSelectedPreset(preset.id);
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <LinearGradient
                      colors={
                        selected
                          ? t.scheme === "dark"
                            ? ["rgba(90,169,255,0.38)", "rgba(106,228,215,0.26)"]
                            : ["rgba(36,87,255,0.28)", "rgba(14,142,166,0.18)"]
                          : t.scheme === "dark"
                            ? ["rgba(255,255,255,0.20)", "rgba(255,255,255,0.08)"]
                            : ["rgba(255,255,255,0.92)", "rgba(8,18,32,0.10)"]
                      }
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
                          backgroundColor: selected
                            ? t.scheme === "dark"
                              ? "rgba(90,169,255,0.12)"
                              : "rgba(36,87,255,0.10)"
                            : t.scheme === "dark"
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(255,255,255,0.60)",
                        }}
                      >
                        <Row>
                          <Body style={{ fontFamily: t.font.bodyMedium }}>{preset.label}</Body>
                          {selected ? (
                            <AppIcon ios="checkmark.circle.fill" fa="check-circle" color={t.colors.text} size={18} />
                          ) : null}
                        </Row>
                        <Muted>{preset.description}</Muted>
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Targets - only show when Custom is selected */}
            {selectedPreset === "custom" && (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={newTarget}
                  onChangeText={setNewTarget}
                  placeholder="Add contract address (0x...)"
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
                    fontFamily: t.font.mono,
                    fontSize: 14,
                  }}
                />
                <PrimaryButton
                  label="Add Target"
                  onPress={onAddCustomTarget}
                  disabled={!newTarget.trim() || customTargets.length >= MAX_ALLOWED_TARGETS}
                />
                <Muted>{customTargets.length}/{MAX_ALLOWED_TARGETS} slots used</Muted>

                {/* Custom targets list */}
                <View style={{ gap: 8 }}>
                  {customTargets.map((addr) => (
                    <Row key={addr}>
                      <Body selectable style={{ fontFamily: t.font.mono, fontSize: 13 }} numberOfLines={1}>
                        {addr}
                      </Body>
                      <Pressable
                        onPress={async () => {
                          await haptic("warn");
                          onRemoveCustomTarget(addr);
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: "rgba(255,69,58,0.30)",
                          backgroundColor: "rgba(255,69,58,0.10)",
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Body style={{ fontFamily: t.font.bodyMedium, fontSize: 12, color: t.colors.bad }}>
                          Remove
                        </Body>
                      </Pressable>
                    </Row>
                  ))}
                </View>
              </View>
            )}

            {/* Resolved targets preview - show for non-custom presets */}
            {selectedPreset !== "custom" && resolvedTargets.length > 0 && (
              <View style={{ gap: 6 }}>
                <Muted>Allowed contracts:</Muted>
                {resolvedTargets.map((addr, idx) => {
                  const network = state.account.environment === "mainnet" ? "mainnet" : "sepolia";
                  const label = labelForAddress(addr, network);
                  return (
                    <Row key={idx}>
                      <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.accent }}>{label}</Body>
                      <Body selectable style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.muted }}>
                        {addr.slice(0, 10)}…{addr.slice(-6)}
                      </Body>
                    </Row>
                  );
                })}
              </View>
            )}

            {/* Save button - saves the selected preset for session key creation */}
            <Row style={{ gap: 10, marginTop: 8 }}>
              <PrimaryButton
                label="Save Configuration"
                onPress={async () => {
                  await haptic("tap");
                  const targetCount = resolvedTargets.length;
                  const presetName = TARGET_PRESETS.find(p => p.id === selectedPreset)?.label ?? "Custom";
                  actions.triggerAlert(
                    "Configuration Saved",
                    `Default targets set to "${presetName}" (${targetCount === 0 ? "any contract" : `${targetCount} contract(s)`})`,
                    "info"
                  );
                }}
                style={{ flex: 1 }}
              />
            </Row>
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
