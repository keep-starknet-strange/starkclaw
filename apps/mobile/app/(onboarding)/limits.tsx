import * as React from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/lib/app/app-provider";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { Chip } from "@/ui/chip";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { H1, H2, Muted } from "@/ui/typography";

function toNumberOr(n: string, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default function OnboardingLimitsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useApp();

  const [daily, setDaily] = React.useState(String(state.policy.dailySpendCapUsd));
  const [perTx, setPerTx] = React.useState(String(state.policy.perTxCapUsd));

  const apply = React.useCallback(() => {
    actions.updateSpendCaps(toNumberOr(daily, state.policy.dailySpendCapUsd), toNumberOr(perTx, state.policy.perTxCapUsd));
  }, [actions, daily, perTx, state.policy.dailySpendCapUsd, state.policy.perTxCapUsd]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <H1>Set spend limits</H1>
        <Muted>Limits are enforced before anything executes. This is your default safety net.</Muted>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Daily cap</H2>
              <Muted>$ / day</Muted>
            </Row>
            <TextInput
              value={daily}
              onChangeText={setDaily}
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

            <QuickChips values={[100, 250, 500, 1000]} onPick={(v) => setDaily(String(v))} />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Per-transaction cap</H2>
              <Muted>$ / tx</Muted>
            </Row>
            <TextInput
              value={perTx}
              onChangeText={setPerTx}
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

            <QuickChips values={[25, 50, 75, 150]} onPick={(v) => setPerTx(String(v))} />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(420)} style={{ gap: 10 }}>
        <PrimaryButton
          label="Continue"
          onPress={async () => {
            await haptic("tap");
            apply();
            router.push("/(onboarding)/alerts");
          }}
        />
        <GhostButton
          label="Back"
          onPress={async () => {
            await haptic("tap");
            router.back();
          }}
        />
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
