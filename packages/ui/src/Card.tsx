import { shadows } from "@lighthouse/tokens";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { cn } from "./cn";

export type CardVariant =
  | "device"
  | "notification-request"
  | "notification-warning"
  | "notification-toast"
  | "feature";

export type CardProps = ViewProps & {
  variant?: CardVariant;
  className?: string;
};

const VARIANT: Record<CardVariant, string> = {
  // Device card: full blue, 16px radius, lifted with an in-brand glow.
  device: "bg-primary rounded-xl p-lg",
  // Request: card surface, accent border, soft lift.
  "notification-request": "bg-card border border-primary/30 rounded-xl p-lg",
  // Warning: amber tint (color carries it; no shadow).
  "notification-warning": "bg-[#FEF6E0] rounded-xl p-lg",
  // Toast: very light blue tint.
  "notification-toast": "bg-primary-50 rounded-xl p-md",
  // Feature ("how it works"): warm-white, soft elevation, no hairline.
  feature: "bg-card rounded-xl p-lg",
};

// Elevation per variant. Tinted (warning/toast) surfaces lean on color, not shadow.
const ELEVATION: Partial<Record<CardVariant, ViewStyle>> = {
  device: shadows.hero,
  "notification-request": shadows.e1,
  feature: shadows.e1,
};

export function Card({ variant = "feature", className, style, ...props }: CardProps) {
  return <View className={cn(VARIANT[variant], className)} style={[ELEVATION[variant], style]} {...props} />;
}
