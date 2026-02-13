import * as React from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/lib/app/app-provider";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { Chip } from "@/ui/chip";
import { Divider } from "@/ui/divider";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

export default function OnboardingAlertsScreen() {
  const router = useRouter();
  const { state, actions } = useApp();

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <H1>Turn on alerts</H1>
        <Muted>Alerts keep you calm. You’ll know what happened, why it happened, and what to do next.</Muted>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <H2>Security</H2>
            <ToggleRow
              title="Spend cap reached"
              body="When daily or per-tx cap blocks a transaction."
              value={state.alertPrefs.spendCap}
              onChange={(v) => actions.setAlertPref("spendCap", v)}
            />
            <ToggleRow
              title="Blocked action"
              body="When a policy denies a trade, transfer, or contract call."
              value={state.alertPrefs.blockedAction}
              onChange={(v) => actions.setAlertPref("blockedAction", v)}
            />
            <ToggleRow
              title="New contract interaction"
              body="When an action touches an unknown contract."
              value={state.alertPrefs.newContract}
              onChange={(v) => actions.setAlertPref("newContract", v)}
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <H2>Market + agent</H2>
            <ToggleRow
              title="Large price move"
              body="If watchlisted assets move quickly."
              value={state.alertPrefs.priceMove}
              onChange={(v) => actions.setAlertPref("priceMove", v)}
            />
            <ToggleRow
              title="Daily agent digest"
              body="One calm summary instead of constant spam."
              value={state.alertPrefs.agentDigest}
              onChange={(v) => actions.setAlertPref("agentDigest", v)}
            />
            <Row style={{ marginTop: 4 }}>
              <Chip
                label="Trigger test alert"
                onPress={async () => {
                  await haptic("tap");
                  actions.triggerAlert("Test alert", "This is a demo notification preview.");
                }}
              />
              <Muted>Optional</Muted>
            </Row>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(420)} style={{ gap: 10 }}>
        <PrimaryButton
          label="Continue"
          onPress={async () => {
            await haptic("tap");
            router.push("/(onboarding)/ready");
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

function ToggleRow(props: {
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
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
          thumbColor={t.scheme === "dark" ? "#FFFFFF" : "#FFFFFF"}
        />
      </Row>
      <Divider />
    </View>
  );
}
