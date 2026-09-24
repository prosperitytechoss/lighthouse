import * as React from "react";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Text } from "./Text";

export type SpeechBubbleProps = {
  /** Bubble line. Or pass `children` for custom content. */
  text?: string;
  children?: React.ReactNode;
  /**
   * bottom — centered tail below (mascot underneath, Home / block screen).
   * corner — no tail, bottom-left radius 4 (bubble beside the mascot, Weekly / Setup).
   * none   — plain bubble.
   */
  tail?: "bottom" | "corner" | "none";
  /** Dark translucent style used on the block screen. */
  dark?: boolean;
  /** Spring in (scale 0.9→1 + fade, damping 14) after `delay` ms. Board 23. */
  animateIn?: boolean;
  delay?: number;
  style?: ViewStyle;
  className?: string;
};

/**
 * The mascot's speech bubble: white, radius 16 (bottom-left 4 in corner form),
 * soft #102A43 shadow, 18x10 triangle tail. Enters 250ms after mount with a
 * damping-14 spring per the motion guide; opacity-only under reduced motion.
 */
export function SpeechBubble({
  text,
  children,
  tail = "bottom",
  dark = false,
  animateIn = true,
  delay = 250,
  style,
  className,
}: SpeechBubbleProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(animateIn ? 0 : 1);

  useEffect(() => {
    if (animateIn) {
      progress.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 180 }));
    }
  }, [animateIn, delay, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reducedMotion ? [] : [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  const bubbleStyle: ViewStyle = {
    backgroundColor: dark ? "rgba(255,255,255,0.10)" : "#FFFFFF",
    borderRadius: 16,
    ...(tail === "corner" ? { borderBottomLeftRadius: 4 } : {}),
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...(dark
      ? {}
      : {
          shadowColor: "#102A43",
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }),
  };

  return (
    <Animated.View style={[{ alignItems: "center" }, animStyle, style]} className={className}>
      <View style={bubbleStyle}>
        {children ?? (
          <Text
            style={{
              color: dark ? "#FFFFFF" : "#1A1A1A",
              fontFamily: "DMSans_600SemiBold",
              fontSize: 15,
              lineHeight: 18,
              fontWeight: "600",
            }}
          >
            {text}
          </Text>
        )}
      </View>
      {tail === "bottom" ? (
        <Svg width={18} height={10} viewBox="0 0 18 10">
          <Path d="M0 0 H18 L9 10 Z" fill={dark ? "rgba(255,255,255,0.10)" : "#FFFFFF"} />
        </Svg>
      ) : null}
    </Animated.View>
  );
}
