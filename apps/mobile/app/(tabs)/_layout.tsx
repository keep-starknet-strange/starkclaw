import * as React from "react";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/ui/app-theme";
import { AppIcon } from "@/ui/app-icon";

export default function TabLayout() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.text,
        tabBarInactiveTintColor: t.scheme === "dark" ? "rgba(234,240,246,0.48)" : "rgba(11,18,32,0.48)",
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          backgroundColor: "transparent",
          height: tabBarHeight,
          paddingBottom: Math.max(10, insets.bottom - 6),
          paddingTop: 8,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={t.scheme === "dark" ? 18 : 55}
            tint={t.scheme === "dark" ? "dark" : "light"}
            style={{
              flex: 1,
              borderTopWidth: 1,
              borderColor: t.colors.glassBorder,
            }}
          />
        ),
        tabBarLabelStyle: {
          fontFamily: t.font.bodyMedium,
          fontSize: 11,
          marginTop: -6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <AppIcon ios="house.fill" fa="home" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: "Trade",
          tabBarIcon: ({ color }) => (
            <AppIcon ios="arrow.left.arrow.right" fa="retweet" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: "Agent",
          tabBarIcon: ({ color }) => <AppIcon ios="sparkles" fa="comment" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="policies"
        options={{
          title: "Policies",
          tabBarIcon: ({ color }) => <AppIcon ios="slider.horizontal.3" fa="sliders" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <AppIcon ios="bell.fill" fa="bell" color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
