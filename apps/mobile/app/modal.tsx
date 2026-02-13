import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useDemo } from "@/lib/demo/demo-store";
import { useWallet } from "@/lib/wallet/wallet-store";
import { useDeployStatus } from "@/lib/wallet/use-deploy-status";
import { GhostButton, IconButton, PrimaryButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Mono, Muted } from "@/ui/typography";

export default function DemoSettingsModal() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useDemo();
  const walletStore = useWallet();
  const deployStatus = useDeployStatus(walletStore.wallet);

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
            <Muted>Account</Muted>
            <Mono selectable>
              {state.account.address.slice(0, 10)}…{state.account.address.slice(-6)}
            </Mono>
          </Row>
        </View>
      </GlassCard>

      {walletStore.wallet ? (
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Agent account</H2>
              <Badge
                label={
                  deployStatus.phase === "deployed" ? "Deployed"
                    : deployStatus.phase === "deploying" ? "Deploying"
                    : deployStatus.phase === "ready" ? "Ready"
                    : deployStatus.phase === "needs-funding" ? "Needs funding"
                    : "Checking"
                }
                tone={
                  deployStatus.phase === "deployed" ? "good"
                    : deployStatus.phase === "deploying" ? "warn"
                    : deployStatus.phase === "ready" ? "accent"
                    : "neutral"
                }
              />
            </Row>

            <Row>
              <Muted>Address</Muted>
              <Mono selectable>
                {walletStore.wallet.accountAddress.slice(0, 10)}…{walletStore.wallet.accountAddress.slice(-6)}
              </Mono>
            </Row>
            <Row>
              <Muted>Network</Muted>
              <Mono>{walletStore.wallet.networkId}</Mono>
            </Row>

            {deployStatus.fundingMessage ? (
              <View style={{ gap: 8 }}>
                <Body style={{ color: t.colors.warn }}>{deployStatus.fundingMessage}</Body>
                {walletStore.wallet.networkId === "sepolia" ? (
                  <Muted>Copy the address above and use the Starknet Sepolia faucet to fund it.</Muted>
                ) : null}
                <GhostButton label="Check again" onPress={deployStatus.checkFunding} />
              </View>
            ) : null}

            {deployStatus.error ? (
              <Body style={{ color: t.colors.bad }}>{deployStatus.error}</Body>
            ) : null}

            {deployStatus.phase === "ready" ? (
              <PrimaryButton
                label="Deploy account"
                onPress={async () => {
                  await haptic("tap");
                  await deployStatus.deploy();
                }}
              />
            ) : null}

            {deployStatus.deployTxHash ? (
              <Row>
                <Muted>Deploy tx</Muted>
                <Mono selectable style={{ fontSize: 11 }}>
                  {deployStatus.deployTxHash.slice(0, 14)}…{deployStatus.deployTxHash.slice(-8)}
                </Mono>
              </Row>
            ) : null}
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
