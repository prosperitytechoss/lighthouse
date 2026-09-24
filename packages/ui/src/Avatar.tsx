import { View } from "react-native";

import { cn } from "./cn";
import { Text } from "./Text";

export type AvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Circular initials avatar for guardians. */
export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <View
      className={cn(
        "items-center justify-center rounded-pill bg-primary-100",
        SIZE[size],
        className,
      )}
    >
      <Text variant="body-sm" className="text-primary-700 font-semibold">
        {initials(name)}
      </Text>
    </View>
  );
}
