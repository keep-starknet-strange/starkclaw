import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useDemo } from "@/lib/demo/demo-store";
import { useWallet } from "@/lib/wallet/wallet-store";
import { GhostButton, PrimaryButton } from "@/ui/buttons";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Mono, Muted } from "@/ui/typography";
import { formatUsd } from "@/ui/format";

export default function OnboardingReadyScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useDemo();
  const walletStore = useWallet();
  const [creating, setCreating] = React.useState(false);
  const [step, setStep] = React.useState(0);

  const displayName = state.onboarding.displayName.trim();

  const runCreate = React.useCallback(async () => {
    setCreating(true);
    setStep(0);
    await haptic("tap");

    const steps = [
      "Generating policy keys",
      "Preparing the agent account",
      "Attaching your spend caps",
      "Wiring alerts + inbox",
      "Final checks",
    ];

    for (let i = 0; i < steps.length; i++) {
      setStep(i);
      // Create the real wallet during "Generating policy keys" step.
      if (i === 0 && walletStore.status !== "ready") {
        await walletStore.create();
      }
      await new Promise((r) => setTimeout(r, 420 + i * 110));
    }

    await haptic("success");
    actions.completeOnboarding({
      displayName,
      riskMode: state.onboarding.riskMode,
      dailySpendCapUsd: state.policy.dailySpendCapUsd,
      perTxCapUsd: state.policy.perTxCapUsd,
    });

    router.replace("/(tabs)");
  }, [actions, displayName, router, state.onboarding.riskMode, state.policy.dailySpendCapUsd, state.policy.perTxCapUsd, walletStore]);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 10 }}>
        <H1>Ready to create your account</H1>
        <Muted>Everything is simulated, but the flow is realistic.</Muted>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <H2>Summary</H2>

            <Row>
              <Muted>Name</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>{displayName || "—"}</Body>
            </Row>

            <Row>
              <Muted>Risk mode</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium, textTransform: "capitalize" }}>{state.onboarding.riskMode}</Body>
            </Row>

            <Row>
              <Muted>Spend caps</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>
                {formatUsd(state.policy.dailySpendCapUsd)}/day • {formatUsd(state.policy.perTxCapUsd)}/tx
              </Body>
            </Row>

            <Row>
              <Muted>Network</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>
                {state.account.network} ({state.account.environment})
              </Body>
            </Row>

            <View style={{ gap: 6, marginTop: 2 }}>
              <Muted>{walletStore.wallet ? "Agent account" : "Agent account (mock)"}</Muted>
              <Mono selectable style={{ color: t.colors.muted }}>
                {(walletStore.wallet?.accountAddress ?? state.account.address).slice(0, 18)}…
                {(walletStore.wallet?.accountAddress ?? state.account.address).slice(-6)}
              </Mono>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {creating ? (
        <Animated.View entering={FadeInDown.delay(140).duration(420)}>
          <GlassCard intensity={t.scheme === "dark" ? 18 : 55}>
            <View style={{ gap: 12 }}>
              <Row>
                <H2>Creating</H2>
                <ActivityIndicator />
              </Row>
              {[
                "Generating policy keys",
                "Preparing the agent account",
                "Attaching your spend caps",
                "Wiring alerts + inbox",
                "Final checks",
              ].map((label, i) => (
                <Row key={label}>
                  <Body style={{ color: i <= step ? t.colors.text : t.colors.muted }}>{label}</Body>
                  <Body style={{ fontFamily: t.font.bodyMedium, color: i < step ? t.colors.good : i === step ? t.colors.accent : t.colors.muted }}>
                    {i < step ? "Done" : i === step ? "…" : ""}
                  </Body>
                </Row>
              ))}
            </View>
          </GlassCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(220).duration(420)} style={{ gap: 10 }}>
        <PrimaryButton label={creating ? "Creating…" : "Create Starkclaw account"} onPress={runCreate} disabled={creating} />
        <GhostButton
          label="Back"
          onPress={async () => {
            await haptic("tap");
            router.back();
          }}
          disabled={creating}
        />
      </Animated.View>
    </AppScreen>
  );
}
