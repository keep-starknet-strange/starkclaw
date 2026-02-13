import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useDemo } from "@/lib/demo/demo-store";
import { GhostButton } from "@/ui/buttons";
import { AppIcon } from "@/ui/app-icon";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { formatPct, formatUsd } from "@/ui/format";
import { Body, H1, H2, Mono, Muted } from "@/ui/typography";

function portfolioTotalUsd(balances: { amount: number; usdPrice: number }[]): number {
  return balances.reduce((sum, b) => sum + b.amount * b.usdPrice, 0);
}

export default function HomeScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { state, actions } = useDemo();

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
            <H1>Starkclaw</H1>
          </View>
          <Pressable
            onPress={async () => {
              await haptic("tap");
              router.push("/modal");
            }}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 10,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.colors.glassBorder,
              backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppIcon ios="gearshape.fill" fa="gear" color={t.colors.text} size={18} />
          </Pressable>
        </Row>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <View style={{ gap: 2 }}>
                <Muted>Portfolio</Muted>
                <Body style={{ fontFamily: t.font.bodySemibold, fontSize: 28, letterSpacing: -0.4, fontVariant: ["tabular-nums"] }}>
                  {formatUsd(total)}
                </Body>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Muted>24h</Muted>
                <Body style={{ fontFamily: t.font.bodyMedium, color: approxChange >= 0 ? t.colors.good : t.colors.bad }}>
                  {formatPct(approxChange)}
                </Body>
              </View>
            </Row>

            <View style={{ height: 1, backgroundColor: t.colors.faint }} />

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

      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <GlassCard>
          <View style={{ gap: 10 }}>
            <Row>
              <H2>Safety status</H2>
              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: state.policy.emergencyLockdown ? "rgba(255,69,58,0.40)" : "rgba(48,209,88,0.32)",
                  backgroundColor: state.policy.emergencyLockdown ? "rgba(255,69,58,0.10)" : "rgba(48,209,88,0.10)",
                }}
              >
                <Body style={{ fontFamily: t.font.bodyMedium, color: state.policy.emergencyLockdown ? t.colors.bad : t.colors.good }}>
                  {state.policy.emergencyLockdown ? "Locked" : "Protected"}
                </Body>
              </View>
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

            <View style={{ height: 1, backgroundColor: t.colors.faint }} />

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

      <Animated.View entering={FadeInDown.delay(200).duration(420)} style={{ gap: 10 }}>
        <Row style={{ gap: 10 }}>
          <QuickAction label="Trade" onPress={() => router.push("/trade")} />
          <QuickAction label="Policies" onPress={() => router.push("/policies")} />
        </Row>
        <Row style={{ gap: 10 }}>
          <QuickAction
            label="Trigger alert"
            onPress={() => actions.triggerAlert("Spend cap warning", "A simulated action hit your per-tx cap.", "warn")}
          />
          <QuickAction
            label={state.policy.emergencyLockdown ? "Unlock" : "Lockdown"}
            onPress={() => actions.setEmergencyLockdown(!state.policy.emergencyLockdown)}
            tone={state.policy.emergencyLockdown ? "good" : "danger"}
          />
        </Row>
      </Animated.View>

      {pending ? (
        <Animated.View entering={FadeInDown.delay(250).duration(420)}>
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

      <Animated.View entering={FadeInDown.delay(280).duration(420)}>
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
                  <View style={{ height: 1, backgroundColor: t.colors.faint }} />
                </View>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    </AppScreen>
  );
}

function QuickAction(props: { label: string; onPress: () => void; tone?: "normal" | "danger" | "good" }) {
  const t = useAppTheme();
  const tone = props.tone ?? "normal";
  const bg =
    tone === "danger"
      ? "rgba(255,69,58,0.12)"
      : tone === "good"
        ? "rgba(48,209,88,0.10)"
        : t.scheme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.6)";
  const border =
    tone === "danger"
      ? "rgba(255,69,58,0.28)"
      : tone === "good"
        ? "rgba(48,209,88,0.22)"
        : t.colors.glassBorder;

  return (
    <Pressable
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Body style={{ textAlign: "center", fontFamily: t.font.bodyMedium }}>{props.label}</Body>
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
