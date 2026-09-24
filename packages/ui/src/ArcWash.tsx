import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { cn } from "./cn";

export type ArcWashProps = {
  /** Wash hue. Defaults to brand cyan. Never purple. */
  tone?: string;
  /** Horizontal center of the glow (0..1). Default 0.5. */
  cx?: number;
  /** Peak opacity at the glow center. Keep it dull (0.06 to 0.12). */
  intensity?: number;
  /** Unique gradient id when more than one wash mounts at once. */
  id?: string;
  className?: string;
};

/**
 * Arc Glass background: a white canvas with one soft, dull radial pastel glow.
 * This is the ONLY sanctioned gradient in the app. No linear left-to-right sweeps,
 * no bold brand panels. Render it as the first child of a screen, behind content.
 */
export function ArcWash({
  tone = "#1CABE2",
  cx = 0.5,
  intensity = 0.1,
  id = "arcwash",
  className,
}: ArcWashProps) {
  return (
    <View pointerEvents="none" className={cn("absolute inset-0", className)}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx={`${cx * 100}%`} cy="0%" r="80%">
            <Stop offset="0%" stopColor={tone} stopOpacity={intensity} />
            <Stop offset="55%" stopColor={tone} stopOpacity={intensity * 0.3} />
            <Stop offset="100%" stopColor={tone} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
