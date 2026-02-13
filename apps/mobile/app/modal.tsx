import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useApp } from "@/lib/app/app-provider";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { H1, H2, Mono, Muted } from "@/ui/typography";

export default function SettingsModal() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions, mode, setMode } = useApp();

  return (
    <AppScreen>
      <Row>
        <View style={{ gap: 4 }}>
          <Muted>Demo</Muted>
          <H1>Settings</H1>
        </View>
        <IconButton
          onPress={async () => {
            await haptic("tap");
            router.back();
          }}
          icon={<AppIcon ios="xmark" fa="times" color={t.colors.text} size={18} />}
        />
      </Row>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>About this build</H2>
          <Muted>
            {mode === "demo"
              ? "UI-only showcase. No RPC calls. No signing. Everything is mocked to demo the full Starkclaw flow."
              : "Live mode (Sepolia). Real RPC calls and on-chain transactions. Some features are still being wired."}
          </Muted>
          <Row>
            <Muted>Mode</Muted>
            <Mono>{mode}</Mono>
          </Row>
          <Row>
            <Muted>Account</Muted>
            <Mono selectable>
              {state.account.address.slice(0, 10)}…{state.account.address.slice(-6)}
            </Mono>
          </Row>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>Agent runtime</H2>
          <GhostButton
            label="LLM provider settings"
            onPress={async () => {
              await haptic("tap");
              router.push("/llm-settings");
            }}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>Controls</H2>
          <GhostButton
            label={mode === "demo" ? "Switch to Live mode" : "Switch to Demo mode"}
            onPress={async () => {
              await haptic("warn");
              const next = mode === "demo" ? "live" : "demo";
              setMode(next);
              actions.reset();
              router.replace("/(onboarding)/welcome");
            }}
          />
          <PrimaryButton
            label="Reset state"
            onPress={async () => {
              await haptic("warn");
              actions.reset();
              router.replace("/(onboarding)/welcome");
            }}
          />
          <GhostButton
            label="Trigger sample alert"
            onPress={async () => {
              await haptic("tap");
              actions.triggerAlert("Sample alert", "A calm summary will appear in Inbox.", "info");
            }}
          />
        </View>
      </GlassCard>
    </AppScreen>
  );
}
