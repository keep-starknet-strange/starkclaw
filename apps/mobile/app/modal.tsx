import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useDemo } from "@/lib/demo/demo-store";
import { useWallet } from "@/lib/wallet/wallet-store";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { H1, H2, Mono, Muted } from "@/ui/typography";

export default function DemoSettingsModal() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useDemo();
  const walletStore = useWallet();

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
            UI-only showcase. No RPC calls. No signing. Everything is mocked to demo the full Starkclaw flow.
          </Muted>
          <Row>
            <Muted>Account (demo)</Muted>
            <Mono selectable>
              {state.account.address.slice(0, 10)}…{state.account.address.slice(-6)}
            </Mono>
          </Row>
        </View>
      </GlassCard>

      {walletStore.wallet ? (
        <GlassCard>
          <View style={{ gap: 12 }}>
            <H2>Wallet</H2>
            <Row>
              <Muted>Network</Muted>
              <Mono selectable>{walletStore.wallet.networkId}</Mono>
            </Row>
            <Row>
              <Muted>Address</Muted>
              <Mono selectable>
                {walletStore.wallet.accountAddress.slice(0, 10)}…{walletStore.wallet.accountAddress.slice(-6)}
              </Mono>
            </Row>
            <GhostButton
              label="Reset wallet"
              onPress={async () => {
                await haptic("warn");
                await walletStore.reset();
                actions.reset();
                router.replace("/(onboarding)/welcome");
              }}
            />
          </View>
        </GlassCard>
      ) : null}

      <GlassCard>
        <View style={{ gap: 12 }}>
          <H2>Controls</H2>
          <PrimaryButton
            label="Reset demo state"
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
              actions.triggerAlert("Demo alert", "A calm summary will appear in Inbox.", "info");
            }}
          />
        </View>
      </GlassCard>
    </AppScreen>
  );
}
