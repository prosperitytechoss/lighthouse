import { Pressable, View } from "react-native";

import { cn } from "./cn";
import { Text } from "./Text";

export type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Severity-style segmented control: active segment blue/white, inactive gray. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      className={cn(
        "flex-row rounded-md border border-border bg-muted p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            className={cn(
              "flex-1 items-center justify-center rounded-sm py-sm",
              active && "bg-primary",
            )}
          >
            <Text
              variant="button"
              className={cn("text-body-sm", active ? "text-white" : "text-muted-foreground")}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
