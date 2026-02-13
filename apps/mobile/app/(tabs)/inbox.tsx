import * as React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/lib/app/app-provider";
import { AppIcon } from "@/ui/app-icon";
import { Chip } from "@/ui/chip";
import { Divider } from "@/ui/divider";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

type InboxTab = "alerts" | "activity";

export default function InboxScreen() {
  const { state, actions } = useApp();
  const [tab, setTab] = React.useState<InboxTab>("alerts");

  const unread = state.alerts.filter((a) => !a.read).length;

  return (
    <AppScreen>
      <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 8 }}>
        <Muted>Inbox</Muted>
        <H1>Alerts and activity</H1>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Row>
              <H2>View</H2>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Chip
                  label="Alerts"
                  selected={tab === "alerts"}
                  tone="accent"
                  onPress={async () => {
                    await haptic("tap");
                    setTab("alerts");
                  }}
                />
                <Chip
                  label="Activity"
                  selected={tab === "activity"}
                  tone="accent"
                  onPress={async () => {
                    await haptic("tap");
                    setTab("activity");
                  }}
                />
              </View>
            </Row>

            {tab === "alerts" ? (
              <View style={{ gap: 12 }}>
                <Row>
                  <Muted>{unread ? `${unread} unread` : "All caught up"}</Muted>
                  <Chip
                    label="Mark all read"
                    onPress={async () => {
                      await haptic("tap");
                      actions.markAllAlertsRead();
                    }}
                  />
                </Row>

                <View style={{ gap: 10 }}>
                  {state.alerts.map((a) => (
                    <AlertRow key={a.id} title={a.title} body={a.body} read={a.read} when={timeAgo(a.createdAt)} severity={a.severity} />
                  ))}
                </View>

                <Chip
                  label="Trigger sample alert"
                  onPress={async () => {
                    await haptic("tap");
                    actions.triggerAlert("Untrusted contract warning", "A simulated action touched an unknown contract.", "warn");
                  }}
                />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {state.activity.map((it) => (
                  <ActivityRow key={it.id} title={it.title} subtitle={it.subtitle ?? ""} when={timeAgo(it.createdAt)} meta={it.meta ?? ""} />
                ))}
              </View>
            )}
          </View>
        </GlassCard>
      </Animated.View>
    </AppScreen>
  );
}

function AlertRow(props: { title: string; body: string; read: boolean; when: string; severity: "info" | "warn" | "danger" }) {
  const t = useAppTheme();
  const color =
    props.severity === "danger" ? t.colors.bad : props.severity === "warn" ? t.colors.warn : t.colors.accent2;
  const borderA = props.read
    ? t.scheme === "dark"
      ? "rgba(255,255,255,0.18)"
      : "rgba(255,255,255,0.92)"
    : props.severity === "danger"
      ? "rgba(255,69,58,0.40)"
      : props.severity === "warn"
        ? "rgba(255,159,10,0.40)"
        : "rgba(90,169,255,0.38)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(8,18,32,0.10)";
  const fill = props.read
    ? t.scheme === "dark"
      ? "rgba(255,255,255,0.04)"
      : "rgba(255,255,255,0.55)"
    : t.scheme === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(255,255,255,0.70)";

  const iosIcon =
    props.severity === "danger" ? "xmark.octagon.fill" : props.severity === "warn" ? "exclamationmark.triangle.fill" : "info.circle.fill";
  const faIcon: React.ComponentProps<typeof AppIcon>["fa"] =
    props.severity === "danger" ? "times-circle" : props.severity === "warn" ? "exclamation-triangle" : "info-circle";

  return (
    <LinearGradient
      colors={[borderA, borderB]}
      start={{ x: 0.1, y: 0.0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ borderRadius: 20, borderCurve: "continuous", padding: 1 }}
    >
      <View
        style={{
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 19,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: t.colors.glassBorder,
          backgroundColor: fill,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 14,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                props.severity === "danger"
                  ? "rgba(255,69,58,0.12)"
                  : props.severity === "warn"
                    ? "rgba(255,159,10,0.12)"
                    : t.scheme === "dark"
                      ? "rgba(90,169,255,0.14)"
                      : "rgba(36,87,255,0.12)",
              borderWidth: 1,
              borderColor: t.colors.glassBorder,
            }}
          >
            <AppIcon ios={iosIcon} fa={faIcon} color={color} size={18} />
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Row>
              <Body style={{ fontFamily: t.font.bodyMedium, flex: 1 }}>{props.title}</Body>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {!props.read ? <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} /> : null}
                <Muted>{props.when}</Muted>
              </View>
            </Row>
            <Muted>{props.body}</Muted>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function ActivityRow(props: { title: string; subtitle: string; when: string; meta: string }) {
  const t = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Row>
        <Body style={{ fontFamily: t.font.bodyMedium }}>{props.title}</Body>
        <Muted>{props.when}</Muted>
      </Row>
      {props.subtitle ? <Muted>{props.subtitle}</Muted> : null}
      {props.meta ? <Muted style={{ color: t.colors.muted }}>{props.meta}</Muted> : null}
      <Divider />
    </View>
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
