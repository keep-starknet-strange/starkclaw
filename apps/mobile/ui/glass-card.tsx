import * as React from "react";
import { type StyleProp, type ViewStyle, View } from "react-native";
import { BlurView } from "expo-blur";

import { useAppTheme } from "./app-theme";

export function GlassCard(props: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  intensity?: number;
}) {
  const t = useAppTheme();
  const pad = props.padding ?? 14;
  const intensity = props.intensity ?? (t.scheme === "dark" ? 22 : 40);
  const tint = t.scheme === "dark" ? "dark" : "light";

  return (
      <View style={[{ borderRadius: t.radius.xl, boxShadow: t.shadow.card }, props.style]}>
      <View
        style={{
          borderRadius: t.radius.xl,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: t.colors.glassBorder,
          backgroundColor: t.colors.glassFill,
        }}
      >
        <BlurView intensity={intensity} tint={tint} style={{ padding: pad }}>
          {props.children}
        </BlurView>
      </View>
    </View>
  );
}
