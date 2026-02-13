/**
 * StreamingMessage — renders assistant tokens as they arrive.
 *
 * Accepts a `text` prop that grows over time (caller appends deltas).
 * Shows a blinking cursor while streaming and fades it out on completion.
 * Includes a cancel button to abort the stream.
 */

import * as React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/ui/app-theme";
import { Chip } from "@/ui/chip";
import { haptic } from "@/ui/haptics";
import { Row } from "@/ui/screen";
import { Body, Muted } from "@/ui/typography";

type Props = {
  /** The accumulated text so far (caller appends deltas). */
  text: string;
  /** Whether tokens are still arriving. */
  streaming: boolean;
  /** Called when the user taps "Stop". */
  onCancel?: () => void;
};

function BlinkingCursor() {
  const t = useAppTheme();
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.2, { duration: 500 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 18,
          borderRadius: 2,
          backgroundColor: t.colors.accent2,
          marginLeft: 2,
        },
        style,
      ]}
    />
  );
}

export function StreamingMessage(props: Props) {
  const t = useAppTheme();

  const borderA = t.scheme === "dark" ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.92)";
  const borderB = t.scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(8,18,32,0.10)";
  const fill = t.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.60)";

  return (
    <View style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
      <LinearGradient
        colors={[borderA, borderB]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ borderRadius: 20, borderCurve: "continuous", padding: 1 }}
      >
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 19,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            backgroundColor: fill,
          }}
        >
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
              <Body style={{ color: t.colors.text }}>
                {props.text || (props.streaming ? "" : "...")}
              </Body>
              {props.streaming ? <BlinkingCursor /> : null}
            </View>

            {props.streaming && props.onCancel ? (
              <Row>
                <Muted>Streaming</Muted>
                <Chip
                  label="Stop"
                  onPress={async () => {
                    await haptic("tap");
                    props.onCancel?.();
                  }}
                />
              </Row>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
