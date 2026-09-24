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

export type DayTileState = "check" | "warn" | "future";

/**
 * sm — Home board 21: 30px circle, single-letter label ABOVE, no edge.
 * lg — Weekly board 25: 40x46 radius-12 tile with a 3px darker bottom edge,
 *      three-letter label BELOW (label turns amber on warn days).
 */
export type DayTileSize = "sm" | "lg";

/** default — on a light surface. onColor — white tiles on a brand blue band. */
export type DayRowTone = "default" | "onColor";

const CHECK = "M20 6 9 17l-5-5";

function Check({ size, color = "#FFFFFF" }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={CHECK} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function tileStyle(state: DayTileState, size: DayTileSize, tone: DayRowTone, today: boolean): ViewStyle {
  const geometry: ViewStyle =
    size === "sm"
      ? { width: 30, height: 30, borderRadius: 999 }
      : { width: 40, height: 46, borderRadius: 12 };
  if (tone === "onColor") {
    if (state === "future") {
      return { ...geometry, backgroundColor: "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.45)" };
    }
    return {
      ...geometry,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: state === "warn" ? "#F59E0B" : "#FFFFFF",
      ...(today ? { borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" } : {}),
    };
  }
  if (state === "future") {
    return {
      ...geometry,
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: "#E8ECF0",
    };
  }
  const warn = state === "warn";
  return {
    ...geometry,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: warn ? "#F59E0B" : "#1CABE2",
    ...(size === "lg"
      ? { borderBottomWidth: 3, borderBottomColor: warn ? "#B45309" : "#0E7FA8" }
      : {}),
  };
}

function DayTile({
  state,
  label,
  size,
  index,
  animate,
  tone,
  today,
}: {
  state: DayTileState;
  label: string;
  size: DayTileSize;
  index: number;
  animate: boolean;
  tone: DayRowTone;
  today: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const pop = animate && !reducedMotion && state !== "future";
  const progress = useSharedValue(pop ? 0 : 1);

  useEffect(() => {
    if (pop) {
      // Board 23: 60ms stagger, scale 0.6→1 spring, once per visit. The extra
      // frame-ish delay dodges Android's cold-start entering stall.
      progress.value = withDelay(50 + index * 60, withSpring(1, { damping: 12, stiffness: 220 }));
    }
  }, [pop, index, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  const onColor = tone === "onColor";
  const labelColor = onColor
    ? today
      ? "#FFFFFF"
      : "rgba(255,255,255,0.72)"
    : size === "lg" && state === "warn"
      ? "#F59E0B"
      : "#8E8E93";
  const labelBold = onColor && today;
  const labelEl = (
    <Text
      style={{
        color: labelColor,
        fontFamily: labelBold ? "DMSans_700Bold" : "DMSans_600SemiBold",
        fontSize: onColor ? 12 : 11,
        lineHeight: 14,
        fontWeight: labelBold ? "700" : "600",
      }}
    >
      {label}
    </Text>
  );

  const tile = (
    <Animated.View style={[tileStyle(state, size, tone, today), animStyle]}>
      {state === "check" ? (
        <Check size={size === "sm" ? 14 : 16} color={onColor ? "#0A7FB8" : "#FFFFFF"} />
      ) : state === "warn" ? (
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: "DMSans_700Bold",
            fontSize: size === "sm" ? 13 : 16,
            lineHeight: size === "sm" ? 16 : 20,
            fontWeight: "700",
          }}
        >
          !
        </Text>
      ) : null}
    </Animated.View>
  );

  return (
    <View style={{ alignItems: "center", gap: size === "sm" ? 4 : 6 }}>
      {size === "sm" ? (
        <>
          {labelEl}
          {tile}
        </>
      ) : (
        <>
          {tile}
          {labelEl}
        </>
      )}
    </View>
  );
}

export type DayRowProps = {
  /** Seven states, oldest→today(+future). */
  days: readonly DayTileState[];
  /** Matching labels ("M","T",… or "Mon","Tue",…). */
  labels: readonly string[];
  size?: DayTileSize;
  /** Staggered pop-in on first view (board 23 guide 4). */
  animate?: boolean;
  tone?: DayRowTone;
  /** Index of today's tile (gets the ring + bold label in onColor tone). */
  today?: number;
  style?: ViewStyle;
};

/** The quiet-days strip: staggered check pops, amber "!" days, dashed future. */
export function DayRow({ days, labels, size = "sm", animate = true, tone = "default", today = -1, style }: DayRowProps) {
  return (
    <View style={[{ flexDirection: "row", gap: tone === "onColor" ? 10 : 8 }, style]}>
      {days.map((state, i) => (
        <DayTile
          key={`${i}-${labels[i] ?? ""}`}
          state={state}
          label={labels[i] ?? ""}
          size={size}
          index={i}
          animate={animate}
          tone={tone}
          today={i === today}
        />
      ))}
    </View>
  );
}
