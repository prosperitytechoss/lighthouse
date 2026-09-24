import { Pressable, View } from "react-native";

import { cn } from "./cn";
import { haptics } from "./haptics";
import { Text } from "./Text";

export type PillProps = {
  label: string;
  /** Selected state for toggle-style chips (e.g. geofence Arrive/Leave). */
  selected?: boolean;
  onPress?: () => void;
  /** Override container classes (e.g. category tint: "bg-category-violence"). */
  className?: string;
  /** Override label classes (e.g. "text-category-violence-fg"). */
  textClassName?: string;
};

/**
 * Capsule chip used for category labels and geofence Arrive/Leave toggles.
 * Pass tint classes for category chips; pass `selected` for toggle chips.
 */
export function Pill({ label, selected, onPress, className, textClassName }: PillProps) {
  const container = cn(
    "self-start rounded-pill px-md py-1",
    selected === undefined
      ? "bg-muted"
      : selected
        ? "bg-primary"
        : "bg-white border border-border",
    className,
  );
  const text = cn(
    "text-body-sm font-medium",
    selected === undefined
      ? "text-foreground"
      : selected
        ? "text-white"
        : "text-muted-foreground",
    textClassName,
  );

  const content = (
    <Text variant="body-sm" className={text}>
      {label}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        onPressIn={haptics.select}
        onPress={onPress}
        className={container}
      >
        {content}
      </Pressable>
    );
  }
  return <View className={container}>{content}</View>;
}
