import * as React from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "./app-theme";

export function GlassCard(props: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  intensity?: number;
  variant?: "card" | "flat" | "lift";
}) {
  const t = useAppTheme();
  const pad = props.padding ?? 14;
  const intensity = props.intensity ?? (t.scheme === "dark" ? 22 : 40);
  const tint = t.scheme === "dark" ? "dark" : "light";
  const borderA = t.scheme === "dark" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.92)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(8,18,32,0.10)";
  const highlightA = t.scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.45)";
  const highlightB = "rgba(255,255,255,0.0)";
  const variant = props.variant ?? "card";
  const shadow = variant === "lift" ? t.shadow.lift : variant === "flat" ? null : t.shadow.card;

  return (
    <View
      style={[
        { borderRadius: t.radius.xl, borderCurve: "continuous", ...(shadow ? { boxShadow: shadow } : null) },
        props.style,
      ]}
    >
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: t.radius.xl, borderCurve: "continuous", padding: 1 }}
      >
        <View
          style={{
            borderRadius: t.radius.xl - 1,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: t.colors.glassFill,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
          }}
        >
          <BlurView intensity={intensity} tint={tint} style={{ padding: pad }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient colors={[highlightA, highlightB]} start={{ x: 0, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
            </View>
            {props.children}
          </BlurView>
        </View>
      </LinearGradient>
    </View>
  );
}
