import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { LhMark } from "./LhMark";

/**
 * The Lighthouse mark emitting soft, looping "signal" pulses. Used for the
 * no-device empty state (calm) and the monitoring state (a touch livelier).
 */
export function AnimatedLighthouse({
  size = 88,
  monitoring = false,
}: {
  size?: number;
  monitoring?: boolean;
}) {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const duration = monitoring ? 1900 : 2800;

  useEffect(() => {
    const make = (v: Animated.Value) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
    const loop1 = make(r1);
    loop1.start();
    // Second ring offset by half a cycle for a continuous ripple.
    const t = setTimeout(() => make(r2).start(), duration / 2);
    return () => {
      loop1.stop();
      clearTimeout(t);
      r2.stopAnimation();
    };
  }, [r1, r2, duration]);

  const ring = (v: Animated.Value) => ({
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "rgba(28,171,226,0.18)",
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.75] }) }],
  });

  return (
    <View style={{ width: size * 1.8, height: size * 1.8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={ring(r1)} />
      <Animated.View style={ring(r2)} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <LhMark size={size * 0.78} />
      </View>
    </View>
  );
}
