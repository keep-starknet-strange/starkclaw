import * as React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useDemo } from "@/lib/demo/demo-store";
import { useBalances } from "@/lib/starknet/use-balances";
import { useWallet } from "@/lib/wallet/wallet-store";
import { GhostButton, IconButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { Chip } from "@/ui/chip";
import { Divider } from "@/ui/divider";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { formatPct, formatUsd } from "@/ui/format";
import { Body, Display, H2, Metric, Mono, Muted } from "@/ui/typography";

function portfolioTotalUsd(balances: { amount: number; usdPrice: number }[]): number {
  return balances.reduce((sum, b) => sum + b.amount * b.usdPrice, 0);
}

export default function HomeScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useDemo();
  const walletStore = useWallet();
  const liveBalances = useBalances(
    walletStore.wallet?.rpcUrl ?? null,
    walletStore.wallet?.accountAddress ?? null,
    walletStore.wallet?.networkId ?? null,
  );
  const hasWallet = walletStore.status === "ready" && walletStore.wallet != null;
  const [draft, setDraft] = React.useState("");

  const name = state.onboarding.displayName.trim();
  const total = portfolioTotalUsd(state.portfolio.balances);
  const pending = state.agent.proposals.find((p) => p.status === "pending");

  const approxChange =
    state.portfolio.balances.reduce((sum, b) => sum + b.change24hPct * (b.amount * b.usdPrice), 0) /
    Math.max(1, total);

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Row>
          <View style={{ gap: 4 }}>
            <Muted>{name ? `Welcome back, ${name}` : "Welcome back"}</Muted>
            <Display>Starkclaw</Display>
          </View>
          <IconButton
            onPress={async () => {
              await haptic("tap");
              router.push("/modal");
            }}
            icon={<AppIcon ios="gearshape.fill" fa="gear" color={t.colors.text} size={18} />}
          />
        </Row>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -140,
                right: -170,
                width: 340,
                height: 340,
                borderRadius: 999,
                backgroundColor: t.scheme === "dark" ? "rgba(90,169,255,0.18)" : "rgba(36,87,255,0.14)",
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -220,
                left: -220,
                width: 440,
                height: 440,
                borderRadius: 999,
                backgroundColor: t.scheme === "dark" ? "rgba(106,228,215,0.12)" : "rgba(14,142,166,0.10)",
              }}
            />
            <Row>
              <View style={{ gap: 2 }}>
                <Muted>Portfolio</Muted>
                <Metric>{formatUsd(total)}</Metric>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Muted>24h</Muted>
                <Body style={{ fontFamily: t.font.bodyMedium, color: approxChange >= 0 ? t.colors.good : t.colors.bad }}>
                  {formatPct(approxChange)}
                </Body>
              </View>
            </Row>

            <Divider />

            <View style={{ gap: 10 }}>
              {state.portfolio.balances.map((b) => {
                const usd = b.amount * b.usdPrice;
                return (
                  <Row key={b.symbol}>
                    <View style={{ gap: 2 }}>
                      <Body style={{ fontFamily: t.font.bodyMedium }}>{b.symbol}</Body>
                      <Muted>{b.name}</Muted>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Body style={{ fontFamily: t.font.bodyMedium, fontVariant: ["tabular-nums"] }}>
                        {b.amount.toLocaleString(undefined, { maximumFractionDigits: b.symbol === "USDC" ? 2 : 4 })}
                      </Body>
                      <Muted style={{ fontVariant: ["tabular-nums"] }}>{formatUsd(usd)}</Muted>
                    </View>
                  </Row>
                );
              })}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {hasWallet ? (
        <Animated.View entering={FadeInDown.delay(105).duration(420)}>
          <GlassCard>
            <View style={{ gap: 12 }}>
              <Row>
                <H2>Live balances</H2>
                {liveBalances.status === "loading" ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Chip label="Refresh" onPress={liveBalances.refresh} />
                )}
              </Row>

              {liveBalances.error ? (
                <View style={{ gap: 6 }}>
                  <Body style={{ color: t.colors.bad }}>{liveBalances.error}</Body>
                  <GhostButton label="Retry" onPress={liveBalances.refresh} />
                </View>
              ) : null}

              {liveBalances.balances.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {liveBalances.balances.map((b) => (
                    <Row key={b.symbol}>
                      <View style={{ gap: 2 }}>
                        <Body style={{ fontFamily: t.font.bodyMedium }}>{b.symbol}</Body>
                        <Muted>{b.name}</Muted>
                      </View>
                      <Mono style={{ fontVariant: ["tabular-nums"] }}>{b.formatted}</Mono>
                    </Row>
                  ))}
                </View>
              ) : liveBalances.status === "success" ? (
                <Muted>All balances are zero.</Muted>
              ) : null}

              <Divider />
              <Row>
                <Muted>Account</Muted>
                <Mono selectable>
                  {walletStore.wallet!.accountAddress.slice(0, 10)}…{walletStore.wallet!.accountAddress.slice(-6)}
                </Mono>
              </Row>
            </View>
          </GlassCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <GlassCard>
          <View style={{ gap: 10 }}>
            <Row>
              <H2>Safety status</H2>
              <Badge
                label={state.policy.emergencyLockdown ? "Locked" : "Protected"}
                tone={state.policy.emergencyLockdown ? "danger" : "good"}
              />
            </Row>

            <Row>
              <Muted>Spend caps</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>
                {formatUsd(state.policy.dailySpendCapUsd)}/day • {formatUsd(state.policy.perTxCapUsd)}/tx
              </Body>
            </Row>

            <Row>
              <Muted>Recipients</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>{state.policy.allowlistedRecipients.length} allowlisted</Body>
            </Row>

            <Row>
              <Muted>Contracts</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium, textTransform: "capitalize" }}>
                {state.policy.contractAllowlistMode.replace("-", " ")}
              </Body>
            </Row>

            <Row>
              <Muted>Autopilot</Muted>
              <Body style={{ fontFamily: t.font.bodyMedium }}>{state.agent.autopilotEnabled ? "On" : "Off"}</Body>
            </Row>

            <Divider />

            <View style={{ gap: 10 }}>
              <Row>
                <Muted>Agent account</Muted>
                <Mono selectable>
                  {state.account.address.slice(0, 10)}…{state.account.address.slice(-6)}
                </Mono>
              </Row>
              <Muted>Demo only. No RPC, no signing, no deployments.</Muted>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Ask Starkclaw</H2>
              <Badge label="Mocked" tone="neutral" />
            </Row>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Try: swap 50 STRK to USDC…"
                placeholderTextColor={t.scheme === "dark" ? "rgba(234,240,246,0.35)" : "rgba(11,18,32,0.35)"}
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={async () => {
                  if (!draft.trim()) return;
                  await haptic("tap");
                  actions.sendAgentMessage(draft);
                  setDraft("");
                  router.push("/agent");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.md,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: t.colors.glassBorder,
                  backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                  color: t.colors.text,
                  fontFamily: t.font.body,
                  fontSize: 15,
                }}
              />

              <IconButton
                disabled={!draft.trim()}
                tone={draft.trim() ? "accent" : "neutral"}
                onPress={async () => {
                  await haptic("tap");
                  actions.sendAgentMessage(draft);
                  setDraft("");
                  router.push("/agent");
                }}
                icon={<AppIcon ios="arrow.up" fa="arrow-up" color={t.colors.text} size={18} />}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <PromptChip label="rebalance" onPress={() => setDraft("rebalance")} />
              <PromptChip label="set caps to 200/day, 60/tx" onPress={() => setDraft("set caps to $200/day and $60/tx")} />
              <PromptChip label="lockdown on" onPress={() => setDraft("enable emergency lockdown")} />
              <PromptChip label="allowlist 0xabc…" onPress={() => setDraft("allowlist 0xabc123…")} />
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(230).duration(420)} style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionTile
            label="Trade"
            caption="Preview a swap"
            iconIos="arrow.left.arrow.right"
            iconFa="retweet"
            onPress={() => router.push("/trade")}
          />
          <ActionTile
            label="Policies"
            caption="Caps + allowlists"
            iconIos="slider.horizontal.3"
            iconFa="sliders"
            onPress={() => router.push("/policies")}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionTile
            label="Alert"
            caption="Simulate a warning"
            iconIos="bell.badge.fill"
            iconFa="bell"
            onPress={() => actions.triggerAlert("Spend cap warning", "A simulated action hit your per-tx cap.", "warn")}
            tone="warn"
          />
          <ActionTile
            label={state.policy.emergencyLockdown ? "Unlock" : "Lockdown"}
            caption={state.policy.emergencyLockdown ? "Resume activity" : "Block all actions"}
            iconIos={state.policy.emergencyLockdown ? "lock.open.fill" : "lock.fill"}
            iconFa={state.policy.emergencyLockdown ? "unlock" : "lock"}
            onPress={() => actions.setEmergencyLockdown(!state.policy.emergencyLockdown)}
            tone={state.policy.emergencyLockdown ? "good" : "danger"}
          />
        </View>
      </Animated.View>

      {pending ? (
        <Animated.View entering={FadeInDown.delay(280).duration(420)}>
          <GlassCard>
            <View style={{ gap: 10 }}>
              <Row>
                <H2>Pending proposal</H2>
                <Muted>Agent</Muted>
              </Row>
              <Body style={{ fontFamily: t.font.bodySemibold }}>{pending.title}</Body>
              <Muted>{pending.summary}</Muted>
              <GhostButton
                label="Review in Agent"
                onPress={async () => {
                  await haptic("tap");
                  router.push("/agent");
                }}
              />
            </View>
          </GlassCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(320).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>Recent activity</H2>
              <Pressable
                onPress={async () => {
                  await haptic("tap");
                  router.push("/inbox");
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Body style={{ fontFamily: t.font.bodyMedium, color: t.colors.accent2 }}>View all</Body>
              </Pressable>
            </Row>

            <View style={{ gap: 10 }}>
              {state.activity.slice(0, 4).map((it) => (
                <View key={it.id} style={{ gap: 4 }}>
                  <Row>
                    <Body style={{ fontFamily: t.font.bodyMedium }}>{it.title}</Body>
                    <Muted>{timeAgo(it.createdAt)}</Muted>
                  </Row>
                  {it.subtitle ? <Muted>{it.subtitle}</Muted> : null}
                  <Divider />
                </View>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    </AppScreen>
  );
}

function ActionTile(props: {
  label: string;
  caption: string;
  iconIos: string;
  iconFa: React.ComponentProps<typeof AppIcon>["fa"];
  onPress: () => void;
  tone?: "normal" | "danger" | "good" | "warn";
}) {
  const t = useAppTheme();
  const tone = props.tone ?? "normal";
  const iconBg =
    tone === "danger"
      ? "rgba(255,69,58,0.12)"
      : tone === "warn"
        ? "rgba(255,159,10,0.12)"
      : tone === "good"
        ? "rgba(48,209,88,0.10)"
        : tone === "normal"
          ? t.scheme === "dark"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.72)"
          : t.scheme === "dark"
            ? "rgba(90,169,255,0.14)"
            : "rgba(36,87,255,0.12)";
  const iconBorder =
    tone === "danger"
      ? "rgba(255,69,58,0.30)"
      : tone === "warn"
        ? "rgba(255,159,10,0.30)"
      : tone === "good"
        ? "rgba(48,209,88,0.22)"
        : "rgba(255,255,255,0.14)";

  return (
    <Pressable
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <GlassCard variant="flat" padding={14} intensity={t.scheme === "dark" ? 18 : 55} style={{ flex: 1 }}>
        <View style={{ gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: iconBg,
              borderWidth: 1,
              borderColor: iconBorder,
            }}
          >
            <AppIcon ios={props.iconIos} fa={props.iconFa} color={t.colors.text} size={20} />
          </View>
          <View style={{ gap: 2 }}>
            <Body style={{ fontFamily: t.font.bodyMedium }}>{props.label}</Body>
            <Muted>{props.caption}</Muted>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

function timeAgo(createdAtSec: number): string {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - createdAtSec);
  if (delta < 60) return "now";
  const m = Math.floor(delta / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function PromptChip(props: { label: string; onPress: () => void }) {
  return (
    <Chip
      label={props.label}
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
    />
  );
}
