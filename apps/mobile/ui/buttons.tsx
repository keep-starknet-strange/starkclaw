import * as React from "react";
import { StyleSheet, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "./app-theme";

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const t = useAppTheme();
  const disabled = !!props.disabled;
  const borderA = t.scheme === "dark" ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.92)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(8,18,32,0.10)";
  const fillA = t.scheme === "dark" ? "rgba(106,228,215,0.95)" : "rgba(36,87,255,0.95)";
  const fillB = t.scheme === "dark" ? "rgba(90,169,255,0.95)" : "rgba(14,142,166,0.90)";
  const text = t.scheme === "dark" ? "#06121A" : "white";

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: t.radius.lg,
          borderCurve: "continuous",
          overflow: "hidden",
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          boxShadow: t.shadow.lift,
        },
        props.style,
      ]}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: t.radius.lg, borderCurve: "continuous", padding: 1 }}
      >
        <View style={{ borderRadius: t.radius.lg - 1, borderCurve: "continuous", overflow: "hidden" }}>
          <LinearGradient
            colors={[fillA, fillB]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 13, paddingHorizontal: 16 }}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient
                colors={["rgba(255,255,255,0.40)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.00)"]}
                locations={[0, 0.35, 1]}
                start={{ x: 0.0, y: 0.0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Label style={[{ textAlign: "center", color: text }, props.textStyle]}>{props.label}</Label>
          </LinearGradient>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const t = useAppTheme();
  const disabled = !!props.disabled;
  const tint = t.scheme === "dark" ? "dark" : "light";
  const borderA = t.scheme === "dark" ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(8,18,32,0.10)";

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: t.radius.lg,
          borderCurve: "continuous",
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        props.style,
      ]}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: t.radius.lg, borderCurve: "continuous", padding: 1 }}
      >
        <View
          style={{
            borderRadius: t.radius.lg - 1,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: t.colors.glassFill,
          }}
        >
          <BlurView intensity={t.scheme === "dark" ? 16 : 45} tint={tint} style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient
                colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.0, y: 0.0 }}
                end={{ x: 0.0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Label style={[{ textAlign: "center", color: t.colors.text }, props.textStyle]}>{props.label}</Label>
          </BlurView>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function IconButton(props: {
  onPress: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md";
  tone?: "neutral" | "accent" | "good" | "warn" | "danger";
}) {
  const t = useAppTheme();
  const disabled = !!props.disabled;
  const tint = t.scheme === "dark" ? "dark" : "light";
  const size = props.size ?? "md";
  const pad = size === "sm" ? 9 : 10;
  const radius = size === "sm" ? 16 : 18;
  const tone = props.tone ?? "neutral";

  const borderA =
    tone === "good"
      ? "rgba(48,209,88,0.40)"
      : tone === "warn"
        ? "rgba(255,159,10,0.40)"
        : tone === "danger"
          ? "rgba(255,69,58,0.40)"
          : tone === "accent"
            ? "rgba(90,169,255,0.38)"
            : t.scheme === "dark"
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.92)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(8,18,32,0.10)";
  const fill =
    tone === "good"
      ? "rgba(48,209,88,0.10)"
      : tone === "warn"
        ? "rgba(255,159,10,0.10)"
        : tone === "danger"
          ? "rgba(255,69,58,0.10)"
          : tone === "accent"
            ? t.scheme === "dark"
              ? "rgba(90,169,255,0.14)"
              : "rgba(36,87,255,0.12)"
            : t.colors.glassFill;

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: radius,
          borderCurve: "continuous",
          overflow: "hidden",
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        props.style,
      ]}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: radius, borderCurve: "continuous", padding: 1 }}
      >
        <View style={{ borderRadius: radius - 1, borderCurve: "continuous", overflow: "hidden", backgroundColor: fill }}>
          <BlurView intensity={t.scheme === "dark" ? 14 : 40} tint={tint} style={{ padding: pad }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.0, y: 0.0 }}
                end={{ x: 0.0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            {props.icon}
          </BlurView>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function Label(props: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useAppTheme();
  return (
    <Textish
      style={[
        {
          fontFamily: t.font.bodySemibold,
          letterSpacing: 0.1,
          fontSize: 15,
          lineHeight: 20,
          includeFontPadding: false,
        },
        props.style,
      ]}
    >
      {props.children}
    </Textish>
  );
}

function Textish(props: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={props.style}>{props.children}</Text>;
}
