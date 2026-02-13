import * as React from "react";
import { Pressable, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
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
          borderWidth: 1,
          borderColor: t.scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(8,18,32,0.10)",
          boxShadow: t.shadow.lift,
        },
        props.style,
      ]}
    >
      <LinearGradient
        colors={t.scheme === "dark" ? [t.colors.accent, t.colors.accent2] : [t.colors.accent2, t.colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 13, paddingHorizontal: 16 }}
      >
        <Label style={[{ textAlign: "center", color: t.scheme === "dark" ? "#06121A" : "white" }, props.textStyle]}>
          {props.label}
        </Label>
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

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: t.radius.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: t.colors.glassBorder,
          backgroundColor: t.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)",
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        props.style,
      ]}
    >
      <Label style={[{ textAlign: "center", color: t.colors.text }, props.textStyle]}>{props.label}</Label>
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
          letterSpacing: 0.2,
          fontSize: 15,
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
