import { colors } from "@lighthouse/tokens";
import { Pressable } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

const TRACK_W = 44;
const TRACK_H = 26;
const PAD = 3;
const THUMB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

/**
 * Reanimated-backed switch (React Native Reusables style). Brand-cyan track when
 * on, neutral when off, white thumb that slides. Replaces the old core-RN Switch.
 * Keeps the value/onValueChange API so existing call sites are unchanged.
 */
export function Switch({ value, onValueChange, disabled = false }: SwitchProps) {
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 160 }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.neutral[200], colors.primary.DEFAULT],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, TRAVEL]) }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Animated.View
        style={[
          { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: PAD, justifyContent: "center" },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: colors.neutral.white,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
