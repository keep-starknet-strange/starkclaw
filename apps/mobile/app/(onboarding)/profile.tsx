import * as React from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useApp } from "@/lib/app/app-provider";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

type Mode = "calm" | "balanced" | "bold";

export default function OnboardingProfileScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useApp();

  const [name, setName] = React.useState(state.onboarding.displayName);
  const [mode, setMode] = React.useState<Mode>(state.onboarding.riskMode);

  const onNext = React.useCallback(async () => {
    await haptic("tap");
    actions.setOnboardingProfile(name, mode);
    router.push("/(onboarding)/limits");
  }, [actions, name, mode, router]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <H1>Set the tone</H1>
        <Muted>Starkclaw is calm by default. You can always change this later.</Muted>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <GlassCard>
          <View style={{ gap: 10 }}>
            <H2>Your name</H2>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Optional"
              placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
              autoCapitalize="words"
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
                fontSize: 16,
              }}
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(420)} style={{ gap: 12 }}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Risk mode</H2>
              <Muted>Recommended: Calm</Muted>
            </Row>

            <View style={{ gap: 10 }}>
              <ModeCard
                title="Calm"
                body="Tight confirmations. Conservative defaults. Fewer surprises."
                selected={mode === "calm"}
                onPress={() => setMode("calm")}
              />
              <ModeCard
                title="Balanced"
                body="More autonomy, still policy-first. Faster trade previews."
                selected={mode === "balanced"}
                onPress={() => setMode("balanced")}
              />
              <ModeCard
                title="Bold"
                body="Higher automation. You’ll rely on alerts and caps to stay safe."
                selected={mode === "bold"}
                onPress={() => setMode("bold")}
              />
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(420)} style={{ gap: 10 }}>
        <PrimaryButton label="Continue" onPress={onNext} />
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

function ModeCard(props: { title: string; body: string; selected: boolean; onPress: () => void }) {
  const t = useAppTheme();
  const borderA = props.selected
    ? t.scheme === "dark"
      ? "rgba(90,169,255,0.38)"
      : "rgba(36,87,255,0.28)"
    : t.scheme === "dark"
      ? "rgba(255,255,255,0.20)"
      : "rgba(255,255,255,0.92)";
  const borderB = props.selected
    ? t.scheme === "dark"
      ? "rgba(106,228,215,0.30)"
      : "rgba(14,142,166,0.20)"
    : t.scheme === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(8,18,32,0.10)";

  return (
    <Pressable
      onPress={async () => {
        await haptic("tap");
        props.onPress();
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
            backgroundColor: props.selected
              ? t.scheme === "dark"
                ? "rgba(90,169,255,0.12)"
                : "rgba(36,87,255,0.10)"
              : t.scheme === "dark"
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.60)",
          }}
        >
          <View style={{ gap: 6 }}>
            <Row>
              <Body style={{ fontFamily: t.font.bodySemibold }}>{props.title}</Body>
              {props.selected ? <AppIcon ios="checkmark.circle.fill" fa="check-circle" color={t.colors.text} size={18} /> : null}
            </Row>
            <Muted>{props.body}</Muted>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
