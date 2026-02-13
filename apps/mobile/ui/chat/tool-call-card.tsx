/**
 * ToolCallCard — structured visualization of a tool call event.
 *
 * Shows tool name, scrubbed parameters, result summary, duration, and timestamp.
 * Uses the glass design system with accent colors for read vs write operations.
 */

import * as React from "react";
import { View } from "react-native";

import { AppIcon } from "@/ui/app-icon";
import { Badge } from "@/ui/badge";
import { GlassCard } from "@/ui/glass-card";
import { useAppTheme } from "@/ui/app-theme";
import { Row } from "@/ui/screen";
import { Body, Mono, Muted } from "@/ui/typography";

type ToolCallStatus = "running" | "success" | "error";

type Props = {
  /** Tool name (e.g. "get_balances"). */
  toolName: string;
  /** Scrubbed parameter key-value pairs for display. */
  params: Record<string, string>;
  /** Result summary (null while running). */
  resultSummary: string | null;
  /** Execution status. */
  status: ToolCallStatus;
  /** Duration in ms (null while running). */
  durationMs: number | null;
  /** ISO timestamp string. */
  timestamp: string;
  /** Whether this is a read-only or mutating operation. */
  kind: "read" | "write";
};

function statusBadge(status: ToolCallStatus): { label: string; tone: "good" | "danger" | "neutral" } {
  switch (status) {
    case "success":
      return { label: "Done", tone: "good" };
    case "error":
      return { label: "Error", tone: "danger" };
    case "running":
      return { label: "Running", tone: "neutral" };
  }
}

export function ToolCallCard(props: Props) {
  const t = useAppTheme();
  const badge = statusBadge(props.status);

  const iconName = props.kind === "read" ? "magnifyingglass" : "arrow.right.circle.fill";
  const faIcon = props.kind === "read" ? "search" : "arrow-circle-right";

  return (
    <GlassCard padding={14} intensity={t.scheme === "dark" ? 18 : 55}>
      <View style={{ gap: 10 }}>
        <Row>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  props.kind === "read"
                    ? t.scheme === "dark"
                      ? "rgba(90,169,255,0.14)"
                      : "rgba(36,87,255,0.12)"
                    : t.scheme === "dark"
                      ? "rgba(255,159,10,0.14)"
                      : "rgba(255,159,10,0.12)",
                borderWidth: 1,
                borderColor: t.colors.glassBorder,
              }}
            >
              <AppIcon
                ios={iconName}
                fa={faIcon}
                color={props.kind === "read" ? t.colors.accent2 : t.colors.warn}
                size={16}
              />
            </View>
            <Body style={{ fontFamily: t.font.bodyMedium }}>
              {props.toolName.replace(/_/g, " ")}
            </Body>
          </View>
          <Badge label={badge.label} tone={badge.tone} />
        </Row>

        {Object.keys(props.params).length > 0 ? (
          <View style={{ gap: 4 }}>
            {Object.entries(props.params).map(([key, value]) => (
              <Row key={key}>
                <Muted>{key}</Muted>
                <Mono style={{ color: t.colors.text }}>{value}</Mono>
              </Row>
            ))}
          </View>
        ) : null}

        {props.resultSummary ? (
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              borderCurve: "continuous",
              backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            }}
          >
            <Body style={{ color: props.status === "error" ? t.colors.bad : t.colors.text }}>
              {props.resultSummary}
            </Body>
          </View>
        ) : null}

        <Row>
          <Muted>{props.timestamp}</Muted>
          {props.durationMs != null ? (
            <Muted>{props.durationMs}ms</Muted>
          ) : null}
        </Row>
      </View>
    </GlassCard>
  );
}
