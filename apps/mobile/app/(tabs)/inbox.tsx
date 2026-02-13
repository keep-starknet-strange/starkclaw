import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useDemo } from "@/lib/demo/demo-store";
import { GhostButton } from "@/ui/buttons";
import { GlassCard } from "@/ui/glass-card";
import { haptic } from "@/ui/haptics";
import { useAppTheme } from "@/ui/app-theme";
import { AppScreen, Row } from "@/ui/screen";
import { Body, H1, H2, Muted } from "@/ui/typography";

type InboxTab = "alerts" | "activity";

export default function InboxScreen() {
  const { state, actions } = useDemo();
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
              <Segment tab={tab} setTab={setTab} />
            </Row>

            {tab === "alerts" ? (
              <View style={{ gap: 12 }}>
                <Row>
                  <Muted>{unread ? `${unread} unread` : "All caught up"}</Muted>
                  <GhostButton label="Mark all read" onPress={() => actions.markAllAlertsRead()} />
                </Row>

                <View style={{ gap: 10 }}>
                  {state.alerts.map((a) => (
                    <AlertRow key={a.id} title={a.title} body={a.body} read={a.read} when={timeAgo(a.createdAt)} severity={a.severity} />
                  ))}
                </View>

                <GhostButton
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

function Segment(props: { tab: InboxTab; setTab: (t: InboxTab) => void }) {
  const t = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.55)",
        overflow: "hidden",
      }}
    >
      <SegButton label="Alerts" selected={props.tab === "alerts"} onPress={() => props.setTab("alerts")} />
      <SegButton label="Activity" selected={props.tab === "activity"} onPress={() => props.setTab("activity")} />
    </View>
  );
}

function SegButton(props: { label: string; selected: boolean; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      onPress={async () => {
        await haptic("tap");
        props.onPress();
      }}
      style={({ pressed }) => ({
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: props.selected
          ? t.scheme === "dark"
            ? "rgba(106,228,215,0.12)"
            : "rgba(36,87,255,0.10)"
          : "transparent",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Body style={{ fontFamily: t.font.bodyMedium, color: props.selected ? t.colors.text : t.colors.muted }}>{props.label}</Body>
    </Pressable>
  );
}

function AlertRow(props: { title: string; body: string; read: boolean; when: string; severity: "info" | "warn" | "danger" }) {
  const t = useAppTheme();
  const color =
    props.severity === "danger" ? t.colors.bad : props.severity === "warn" ? t.colors.warn : t.colors.accent2;
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        backgroundColor: props.read ? (t.scheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)") : (t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.70)"),
      }}
    >
      <View style={{ gap: 6 }}>
        <Row>
          <Body style={{ fontFamily: t.font.bodyMedium }}>{props.title}</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!props.read ? <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} /> : null}
            <Muted>{props.when}</Muted>
          </View>
        </Row>
        <Muted>{props.body}</Muted>
      </View>
    </View>
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
      <View style={{ height: 1, backgroundColor: t.colors.faint }} />
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
