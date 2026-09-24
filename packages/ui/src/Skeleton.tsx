import * as React from "react";
import { useEffect } from "react";
import { type DimensionValue, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius; pass 999 for a pill/circle. */
  radius?: number;
  style?: ViewStyle;
  className?: string;
};

/**
 * Loading placeholder per board 45: a --color-surface block that shimmers on a
 * 1.4s loop. Placeholders hold the real layout's spots so nothing jumps when
 * content lands. (The sweep is rendered as an opacity pulse — the brand rules
 * allow no gradients beyond ArcWash.) Static under reduced motion.
 */
export function Skeleton({ width, height, radius = 12, style, className }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [reducedMotion, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : 0.55 + pulse.value * 0.45,
  }));

  return (
    <Animated.View
      className={className}
      style={[
        { width, height, borderRadius: radius, backgroundColor: "#F5F7FB" },
        animStyle,
        style,
      ]}
    />
  );
}
