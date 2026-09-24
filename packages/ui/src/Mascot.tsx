import * as React from "react";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type MascotMood = "happy" | "alert" | "dim";

export type MascotProps = {
  /** Rendered square size in px. Board sizes: 190 splash, 150 home, 110 empty, 86/76 corner. */
  size?: number;
  /**
   * happy — cyan beams, smile, soft shadow (Home, Splash, Weekly).
   * alert — warm steady beams, flat mouth, dark shadow (block screen).
   * dim   — happy at 45% opacity (the "not watching anything" empty state).
   */
  mood?: MascotMood;
  /** Idle breath + beam alternation per Motion guide board 23. */
  animate?: boolean;
  /** Shadow ellipse fill. Defaults per mood (#E2EDF4, block #232838). */
  shadowColor?: string;
  /** On a brand blue band: white beams, darker cap and shadow. */
  onColor?: boolean;
  style?: ViewStyle;
};

const BREATH_MS = 3200;
const BEAM_MS = 2400;

/**
 * The Lighthouse mascot, reproduced exactly from the Paper boards (viewBox
 * 150x150): white body with #D9E6EE outline, two cyan #1CABE2 stripes, deep
 * blue #0E7FA8 cap, warm #FFD44D lantern, dot eyes and a smile.
 *
 * Motion (board 23): the body bobs ±3px over 3.2s while the shadow ellipse
 * scales 1.0→0.94 in counter-phase; the two beam triangles alternate opacity
 * 0.16→0.06 every 2.4s (a rotating-lamp illusion). In `alert` mood the beams
 * are warm yellow and hold steady. Under reduced motion, transforms stop and
 * only the beam opacity alternation remains.
 */
export function Mascot({ size = 150, mood = "happy", animate = true, shadowColor, onColor = false, style }: MascotProps) {
  const reducedMotion = useReducedMotion();
  const alert = mood === "alert";
  const breathe = animate && !reducedMotion;
  const sweep = animate && !alert;

  // 0→1→0 loop shared by breath (translate) and shadow (counter-scale).
  const breath = useSharedValue(0);
  // 0 = left beam bright, 1 = right beam bright.
  const beam = useSharedValue(0);

  useEffect(() => {
    if (breathe) {
      breath.value = withRepeat(
        withTiming(1, { duration: BREATH_MS / 2, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = 0;
    }
    return () => cancelAnimation(breath);
  }, [breathe, breath]);

  useEffect(() => {
    if (sweep) {
      beam.value = withRepeat(
        withTiming(1, { duration: BEAM_MS, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(beam);
      beam.value = 0.5;
    }
    return () => cancelAnimation(beam);
  }, [sweep, beam]);

  const k = size / 150;
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (breath.value * 2 - 1) * -3 * k }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - breath.value * 0.06 }],
  }));

  const leftBeamProps = useAnimatedProps(() => ({
    opacity: alert ? 0.22 : onColor ? 0.26 - beam.value * 0.14 : 0.16 - beam.value * 0.1,
  }));
  const rightBeamProps = useAnimatedProps(() => ({
    opacity: alert ? 0.22 : onColor ? 0.12 + beam.value * 0.14 : 0.06 + beam.value * 0.1,
  }));

  const shadowFill = shadowColor ?? (alert ? "#232838" : onColor ? "rgba(4,30,46,0.22)" : "#E2EDF4");
  const beamFill = onColor ? "#FFFFFF" : "#1CABE2";
  const capFill = onColor ? "#083B55" : "#0E7FA8";

  return (
    <View
      style={[{ width: size, height: size, opacity: mood === "dim" ? 0.45 : 1 }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Ground shadow stays put while the body bobs (counter-phase scale). */}
      <Animated.View style={[{ position: "absolute", inset: 0 }, shadowStyle]}>
        <Svg width={size} height={size} viewBox="0 0 150 150">
          <Ellipse cx={75} cy={132} rx={44} ry={8} fill={shadowFill} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", inset: 0 }, bodyStyle]}>
        <Svg width={size} height={size} viewBox="0 0 150 150">
          {alert ? (
            <>
              <AnimatedPath d="M62 34 L4 6 L4 56 Z" fill="#FFD44D" animatedProps={leftBeamProps} />
              <AnimatedPath d="M88 34 L146 6 L146 56 Z" fill="#FFD44D" animatedProps={rightBeamProps} />
            </>
          ) : (
            <>
              <AnimatedPath d="M62 34 L10 18 L10 50 Z" fill={beamFill} animatedProps={leftBeamProps} />
              <AnimatedPath d="M88 34 L140 18 L140 50 Z" fill={beamFill} animatedProps={rightBeamProps} />
            </>
          )}
          <Rect x={64} y={24} width={22} height={14} rx={4} fill="#FFD44D" />
          <Path d="M60 22 Q75 8 90 22 Z" fill={capFill} />
          <Circle cx={75} cy={12} r={3.5} fill={capFill} />
          {alert ? (
            <Path d="M58 40 L92 40 L100 128 L50 128 Z" fill="#FFFFFF" />
          ) : (
            <Path d="M58 40 L92 40 L100 128 L50 128 Z" fill="#FFFFFF" stroke="#D9E6EE" strokeWidth={2} />
          )}
          <Path d="M56 56 L94 56 L96 72 L54 72 Z" fill="#1CABE2" />
          <Path d="M52 92 L98 92 L100 108 L50 108 Z" fill="#1CABE2" />
          <Circle cx={68} cy={82} r={3} fill="#1A1A1A" />
          <Circle cx={82} cy={82} r={3} fill="#1A1A1A" />
          {alert ? (
            <Path d="M68 88 L82 88" stroke="#1A1A1A" strokeWidth={2.4} strokeLinecap="round" />
          ) : (
            <Path d="M69 87 Q75 92 81 87" fill="none" stroke="#1A1A1A" strokeWidth={2.4} strokeLinecap="round" />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

export type RiveMascotProps = MascotProps;

/**
 * Rive-ready mascot slot. Renders the hand-authored SVG mascot today; when the
 * .riv file exists (authored in the Rive editor with a state machine exposing
 * `mood` and idle/beam timelines), swap the internals for `rive-react-native`'s
 * <Rive> — the props contract (size / mood / animate) stays identical, so no
 * call site changes.
 */
export function RiveMascot(props: RiveMascotProps) {
  // TODO(rive): replace with <Rive resourceName="lighthouse_mascot" …/> once
  // the .riv asset ships; map mood → state-machine input, animate → autoplay,
  // and keep the SVG as the reduced-motion fallback.
  return <Mascot {...props} />;
}
