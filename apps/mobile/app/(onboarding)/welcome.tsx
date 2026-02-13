import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/lib/app/app-provider";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { Badge } from "@/ui/badge";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppBackground } from "@/ui/app-background";
import { Body, Display, H2, Muted } from "@/ui/typography";

export default function WelcomeScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { actions } = useApp();

  const onReset = React.useCallback(async () => {
    await haptic("warn");
    actions.reset();
  }, [actions]);

  return (
    <AppBackground>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 42, paddingBottom: 28, justifyContent: "space-between", gap: 16 }}>
        <View style={{ gap: 14 }}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <Badge label="Demo mode" tone="neutral" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(520)} style={{ gap: 10 }}>
            <Display>Starkclaw</Display>
            <Body style={{ color: t.colors.muted }}>
              A calm, policy-first wallet where an agent can trade and spend, but only within your rules.
            </Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(520)} style={{ gap: 12 }}>
            <GlassCard padding={14}>
              <View style={{ gap: 10 }}>
                <H2>What you’ll see</H2>
                <View style={{ gap: 8 }}>
                  <RowLine title="Onboarding" body="Set limits, turn on alerts, and “create” your agent account." />
                  <RowLine title="Trading simulator" body="Preview swaps with policy checks and clean confirmations." />
                  <RowLine title="Policies" body="Spend caps, allowlists, contract trust settings, emergency lockdown." />
                  <RowLine title="Agent inbox" body="Proposals you can approve or reject with full context." />
                </View>
              </View>
            </GlassCard>

            <GlassCard padding={14} intensity={t.scheme === "dark" ? 16 : 50}>
              <View style={{ gap: 8 }}>
                <H2>Zero network calls</H2>
                <Body style={{ color: t.colors.muted }}>
                  Everything is mocked so the UX can be reviewed end-to-end without wallets, RPCs, or contracts.
                </Body>
              </View>
            </GlassCard>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(220).duration(520)} style={{ gap: 10 }}>
          <PrimaryButton
            label="Get started"
            onPress={async () => {
              await haptic("tap");
              router.push("/(onboarding)/profile");
            }}
          />

          <GhostButton label="Reset demo state" onPress={onReset} />
        </Animated.View>
      </View>
    </AppBackground>
  );
}

function RowLine(props: { title: string; body: string }) {
  const t = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <Body style={{ fontFamily: t.font.bodySemibold }}>{props.title}</Body>
      <Muted>{props.body}</Muted>
    </View>
  );
}
