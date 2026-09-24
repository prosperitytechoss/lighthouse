import { colors } from "@lighthouse/tokens";
import { Signal, Wifi, BatteryFull } from "lucide-react-native";
import { View } from "react-native";


import { cn } from "./cn";
import { Text } from "./Text";

export type StatusBarProps = {
  time?: string;
  /** Render dark glyphs (for light backgrounds) or light (for blue headers). */
  tone?: "dark" | "light";
  className?: string;
};

/**
 * Cosmetic in-mockup status bar (time + signal/wifi/battery). Optional —
 * real device chrome is provided by the OS; this matches the demo's framed look.
 */
export function StatusBar({ time = "9:41", tone = "dark", className }: StatusBarProps) {
  const glyph = tone === "light" ? colors.neutral.white : colors.neutral[900];
  return (
    <View className={cn("flex-row items-center justify-between px-2xl py-xs", className)}>
      <Text
        variant="body-sm"
        className={cn("font-semibold", tone === "light" ? "text-white" : "text-foreground")}
      >
        {time}
      </Text>
      <View className="flex-row items-center gap-1">
        <Signal size={16} color={glyph} />
        <Wifi size={16} color={glyph} />
        <BatteryFull size={16} color={glyph} />
      </View>
    </View>
  );
}
