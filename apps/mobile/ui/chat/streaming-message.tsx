/**
 * StreamingMessage — renders assistant messages token-by-token
 * 
 * Features:
 * - Smooth progressive rendering (no jank)
 * - Cancelable via exposed ref
 * - Glass aesthetic matching app theme
 */

import * as React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { GlassCard } from "../glass-card";
import { Body } from "../typography";
import { useAppTheme } from "../app-theme";

export type StreamingMessageProps = {
  /** Async iterable of text chunks */
  stream: AsyncIterable<string>;
  /** Called when streaming completes or errors */
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
};

export const StreamingMessage = React.forwardRef<
  { cancel: () => void },
  StreamingMessageProps
>((props, ref) => {
  const t = useAppTheme();
  const [text, setText] = React.useState("");
  const [isComplete, setIsComplete] = React.useState(false);
  const cancelRef = React.useRef(false);

  React.useImperativeHandle(ref, () => ({
    cancel: () => {
      cancelRef.current = true;
    },
  }));

  React.useEffect(() => {
    let mounted = true;
    let accumulated = "";

    (async () => {
      try {
        for await (const chunk of props.stream) {
          if (cancelRef.current || !mounted) break;
          accumulated += chunk;
          setText(accumulated);
        }

        if (mounted && !cancelRef.current) {
          setIsComplete(true);
          props.onComplete?.(accumulated);
        }
      } catch (err) {
        if (mounted && !cancelRef.current) {
          props.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [props.stream]);

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <GlassCard padding={12} variant="flat">
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isComplete ? t.colors.good : t.colors.accent,
              marginTop: 6,
            }}
          />
          <View style={{ flex: 1 }}>
            <Body style={{ color: t.colors.text }}>
              {text}
              {!isComplete && (
                <Body style={{ color: t.colors.muted }}> ▊</Body>
              )}
            </Body>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

StreamingMessage.displayName = "StreamingMessage";
