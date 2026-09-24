import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "./haptics";
import { Text } from "./Text";

export type ChunkyButtonVariant = "primary" | "ghost" | "danger-outline";
export type ChunkyButtonSize = "lg" | "md" | "sm";

/**
 * The signature 3D-edge button from the approved boards (Duolingo press).
 *
 * Geometry: a darker "edge" layer sits under the face, peeking out `edge`px at
 * the bottom. On press-in the face translates down (edge collapses to ~1px) in
 * 80ms; release springs back. Light haptic on press-down.
 *
 * Board values —
 *   primary: face #1CABE2, edge #0E7FA8, white 16/700 uppercase 0.02em label
 *   ghost:   white face, 2px hairline border, hairline edge (4px bottom total)
 *   danger-outline: ghost geometry, soft-red border + label
 */
export type ChunkyButtonProps = Omit<PressableProps, "children" | "style"> & {
  label?: string;
  /** Custom face content; overrides `label`. */
  children?: React.ReactNode;
  variant?: ChunkyButtonVariant;
  size?: ChunkyButtonSize;
  disabled?: boolean;
  /**
   * Busy state: face keeps its full color and shows a spinner beside the label.
   * Never the washed-out disabled look — a working button should look alive.
   */
  loading?: boolean;
  /** Overrides the variant's label color. */
  labelColor?: string;
  /** Uppercase the label (board default). */
  uppercase?: boolean;
  style?: ViewStyle;
  className?: string;
};

type Palette = {
  face: string;
  edge: string;
  label: string;
  border?: string;
  borderWidth?: number;
};

const PALETTES: Record<ChunkyButtonVariant, Palette> = {
  primary: { face: "#1CABE2", edge: "#0E7FA8", label: "#FFFFFF" },
  ghost: { face: "#FFFFFF", edge: "#E8ECF0", label: "#1A1A1A", border: "#E8ECF0", borderWidth: 2 },
  "danger-outline": {
    face: "#FFFFFF",
    edge: "#FFD9D6",
    label: "#FF3B30",
    border: "#FFD9D6",
    borderWidth: 2,
  },
};

/** Per-size face padding / radius / edge depth / press travel, from the boards. */
const SIZES: Record<
  ChunkyButtonSize,
  { radius: number; edge: number; travel: number; padTop: number; padBottom: number; padX: number; font: number; lineHeight: number }
> = {
  /* Splash / wizard full-width CTA: pt16 pb14 + 4px edge, radius 16. */
  lg: { radius: 16, edge: 4, travel: 3, padTop: 16, padBottom: 14, padX: 22, font: 16, lineHeight: 20 },
  /* Block-screen card CTA: pt14 pb12 + 4px edge, radius 16. */
  md: { radius: 16, edge: 4, travel: 3, padTop: 14, padBottom: 12, padX: 18, font: 16, lineHeight: 20 },
  /* "TALK TO A PARENT" / "CHOOSE APPS": pt10 pb8 + 3px edge, radius 12, 13px. */
  sm: { radius: 12, edge: 3, travel: 2, padTop: 10, padBottom: 8, padX: 18, font: 13, lineHeight: 16 },
};

export function ChunkyButton({
  label,
  children,
  variant = "primary",
  size = "lg",
  disabled = false,
  loading = false,
  labelColor,
  uppercase = true,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ChunkyButtonProps) {
  const palette = PALETTES[variant];
  const s = SIZES[size];
  const pressed = useSharedValue(0);

  // The press is a key-cap tip, not a flat sink: the face travels down INTO the
  // edge while tipping forward a few degrees (perspective rotateX), so the
  // motion reads diagonal — like pressing a physical key.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 420 },
      { rotateX: `${pressed.value * 6}deg` },
      { translateY: pressed.value * s.travel },
      { scale: 1 - pressed.value * 0.015 },
    ],
  }));

  const textStyle: TextStyle = {
    color: labelColor ?? palette.label,
    fontFamily: "DMSans_700Bold",
    fontSize: s.font,
    lineHeight: s.lineHeight,
    fontWeight: "700",
    letterSpacing: uppercase ? s.font * 0.02 : 0,
    textAlign: "center",
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 80 });
        haptics.light();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 14, stiffness: 320 });
        onPressOut?.(e);
      }}
      style={[{ opacity: disabled && !loading ? 0.55 : 1 }, style]}
      {...props}
    >
      {/* Edge: same footprint as the face, shifted down `edge`px. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: s.edge,
          bottom: 0,
          borderRadius: s.radius,
          backgroundColor: palette.edge,
        }}
      />
      <Animated.View
        style={[
          {
            marginBottom: s.edge,
            borderRadius: s.radius,
            backgroundColor: palette.face,
            paddingTop: s.padTop,
            paddingBottom: s.padBottom,
            paddingHorizontal: s.padX,
            alignItems: "center",
            justifyContent: "center",
            ...(palette.border
              ? { borderWidth: palette.borderWidth, borderColor: palette.border }
              : {}),
          },
          faceStyle,
        ]}
      >
        {children ?? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {loading ? <ActivityIndicator size="small" color={labelColor ?? palette.label} /> : null}
            <Text style={textStyle} numberOfLines={1}>
              {uppercase ? label?.toUpperCase() : label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
