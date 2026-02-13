import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ThemeProvider } from "@react-navigation/native";
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans";
import { PlaywriteNZBasic_300Light, PlaywriteNZBasic_400Regular } from "@expo-google-fonts/playwrite-nz-basic";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { DemoProvider, useDemo } from "@/lib/demo/demo-store";
import { navThemeFromAppTheme, useAppTheme } from "@/ui/app-theme";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    PlaywriteNZBasic_300Light,
    PlaywriteNZBasic_400Regular,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <DemoProvider>
      <RootLayoutNav />
    </DemoProvider>
  );
}

function RootLayoutNav() {
  const theme = useAppTheme();
  const navTheme = navThemeFromAppTheme(theme);

  useOnboardingGate();

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="llm-settings" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}

function useOnboardingGate() {
  const { bootStatus, state } = useDemo();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (bootStatus !== "ready") return;
    const group = segments[0];
    const inOnboarding = group === "(onboarding)";

    if (!state.onboarding.completed && !inOnboarding) {
      router.replace("/(onboarding)/welcome");
      return;
    }

    if (state.onboarding.completed && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [bootStatus, state.onboarding.completed, segments, router]);
}
