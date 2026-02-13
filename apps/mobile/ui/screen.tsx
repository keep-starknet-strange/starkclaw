import * as React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBackground } from "./app-background";

export function AppScreen(props: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const padTop = 14 + (process.env.EXPO_OS === "ios" ? 0 : insets.top);

  return (
    <AppBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: padTop,
          paddingBottom: 110 + insets.bottom,
          gap: 14,
        }}
      >
        {props.children}
      </ScrollView>
    </AppBackground>
  );
}

export function Row(props: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, props.style]}>
      {props.children}
    </View>
  );
}
