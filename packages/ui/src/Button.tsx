import { cva, type VariantProps } from "class-variance-authority";
import * as Haptics from "expo-haptics";
import * as React from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
} from "react-native";

import { cn } from "./cn";
import { Text, TextClassContext } from "./Text";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

// RNR-style cva primitive, themed to our tokens. primary = brand cyan via
// hsl(var(--primary)); active: classes drive the pressed state.
const buttonVariants = cva("flex-row items-center justify-center gap-sm rounded-lg", {
  variants: {
    variant: {
      primary: "bg-primary active:bg-primary-600",
      ghost: "bg-transparent border border-primary active:bg-primary-50",
      danger: "bg-destructive active:opacity-90",
    },
    size: {
      sm: "px-md py-sm",
      md: "px-[22px] py-lg",
      lg: "px-2xl py-lg",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

const buttonTextVariants = cva("text-button font-semibold", {
  variants: {
    variant: {
      primary: "text-primary-foreground",
      ghost: "text-primary",
      danger: "text-destructive-foreground",
    },
    size: { sm: "", md: "", lg: "" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonProps = Omit<PressableProps, "children"> &
  VariantProps<typeof buttonVariants> & {
    /** Convenience label; or pass children (e.g. an RNR <Text>). */
    label?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    className?: string;
  };

const HAPTIC: Record<ButtonVariant, () => void> = {
  primary: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  danger: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  ghost: () => Haptics.selectionAsync(),
};

export function Button({
  label,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  className,
  onPressIn,
  ...props
}: ButtonProps) {
  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled && !loading && variant) HAPTIC[variant]?.();
    onPressIn?.(e);
  };

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        className={cn(buttonVariants({ variant, size }), disabled && "opacity-40", className)}
        {...props}
      >
        {loading ? (
          <ActivityIndicator color={variant === "ghost" ? "#1CABE2" : "#FFFFFF"} />
        ) : (
          <>
            {icon}
            {label ? <Text>{label}</Text> : children}
          </>
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { buttonTextVariants, buttonVariants };
