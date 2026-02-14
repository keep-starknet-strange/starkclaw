/**
 * ToolCallCard — renders tool invocations with clear read/write distinction
 * 
 * Shows:
 * - Tool name
 * - Scrubbed parameters
 * - Result summary
 * - Timestamp
 * - Visual distinction for read vs write operations
 */

import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { GlassCard } from "../glass-card";
import { Badge } from "../badge";
import { Body, Muted } from "../typography";
import { useAppTheme } from "../app-theme";
import { Row } from "../screen";

export type ToolCallCardProps = {
  /** Tool identifier (e.g. "transfer", "swap") */
  toolName: string;
  /** Sanitized parameters (no secrets) */
  params: Record<string, unknown>;
  /** Result summary or error message */
  result?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Operation type affects visual styling */
  operationType: "read" | "write";
  /** Current status */
  status: "pending" | "success" | "error";
};

function scrubParams(params: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Scrub keys that might contain sensitive data
    if (/(key|secret|token|password|mnemonic)/i.test(key)) {
      scrubbed[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      // Truncate long strings
      scrubbed[key] = value.slice(0, 97) + "...";
    } else {
      scrubbed[key] = value;
    }
  }
  
  return scrubbed;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function ToolCallCard(props: ToolCallCardProps) {
  const t = useAppTheme();
  
  const scrubbedParams = scrubParams(props.params);
  const paramString = JSON.stringify(scrubbedParams, null, 2);
  
  const badgeTone =
    props.status === "success" ? "good" :
    props.status === "error" ? "danger" : "neutral";
    
  const operationColor = 
    props.operationType === "write" ? t.colors.warning : t.colors.info;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <GlassCard padding={12} variant="card">
        <View style={{ gap: 8 }}>
          {/* Header */}
          <Row>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: operationColor,
                }}
              />
              <Body style={{ fontWeight: "600", color: t.colors.text }}>
                {props.toolName}
              </Body>
              <Badge
                label={props.operationType}
                tone={props.operationType === "write" ? "warn" : "neutral"}
              />
            </View>
            <Badge label={props.status} tone={badgeTone} />
          </Row>

          {/* Parameters */}
          <View
            style={{
              backgroundColor: t.scheme === "dark" 
                ? "rgba(0,0,0,0.3)" 
                : "rgba(255,255,255,0.5)",
              borderRadius: t.radius.md,
              padding: 8,
              borderWidth: 1,
              borderColor: t.scheme === "dark"
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.08)",
            }}
          >
            <Muted style={{ fontFamily: "monospace", fontSize: 11 }}>
              {paramString}
            </Muted>
          </View>

          {/* Result */}
          {props.result && (
            <View>
              <Muted style={{ fontSize: 12 }}>
                Result: <Body style={{ fontSize: 12 }}>{props.result}</Body>
              </Muted>
            </View>
          )}

          {/* Timestamp */}
          <Muted style={{ fontSize: 11, textAlign: "right" }}>
            {formatTimestamp(props.timestamp)}
          </Muted>
        </View>
      </GlassCard>
    </Animated.View>
  );
}
