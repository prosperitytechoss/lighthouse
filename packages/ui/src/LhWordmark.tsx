import { colors, typography } from "@lighthouse/tokens";
import { Text as RNText } from "react-native";


/** "Lighthouse" wordmark — DM Sans Bold, -0.4 tracking. */
export function LhWordmark({ color = "#FFFFFF", size = 18 }: { color?: string; size?: number }) {
  return (
    <RNText
      style={{
        fontFamily: typography.fontFamily.bold,
        fontWeight: "700",
        fontSize: size,
        letterSpacing: -0.4,
        color: color || colors.neutral[900],
      }}
    >
      Lighthouse
    </RNText>
  );
}
