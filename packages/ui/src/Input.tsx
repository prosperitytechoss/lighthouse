import { colors } from "@lighthouse/tokens";
import { TextInput, type TextInputProps, View } from "react-native";


import { cn } from "./cn";
import { Text } from "./Text";

export type InputProps = TextInputProps & {
  /** Convenience preset: email sets keyboard + disables autocapitalize. */
  type?: "text" | "email";
  label?: string;
  className?: string;
};

/** Text / email input. 12px radius, subtle border (rgba(60,60,67,0.12)). */
export function Input({ type = "text", label, className, ...props }: InputProps) {
  const emailProps =
    type === "email"
      ? ({
          keyboardType: "email-address",
          autoCapitalize: "none",
          autoComplete: "email",
          autoCorrect: false,
        } as const)
      : {};

  return (
    <View className={cn("gap-xs", className)}>
      {label ? (
        <Text variant="body-sm" className="text-foreground font-medium">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.neutral[400]}
        className="rounded-md border border-input bg-background px-md py-md text-body text-foreground font-regular"
        {...emailProps}
        {...props}
      />
    </View>
  );
}
