import type { TextVariant } from "@lighthouse/tokens";
import * as Slot from "@rn-primitives/slot";
import * as React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "./cn";

/**
 * RNR pattern: a parent (e.g. Button) sets label classes via this context so any
 * Text descendant inherits them. Our variant system layers on top.
 */
export const TextClassContext = React.createContext<string | undefined>(undefined);

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  asChild?: boolean;
  className?: string;
};

/** Maps each typography role to its size + DM Sans weight + default color. */
const VARIANT_CLASS: Record<TextVariant, string> = {
  display: "text-display font-bold text-foreground",
  "heading-lg": "text-heading-lg font-bold text-foreground",
  "heading-md": "text-heading-md font-bold text-foreground",
  body: "text-body font-regular text-foreground",
  "body-sm": "text-body-sm font-regular text-muted-foreground",
  button: "text-button font-semibold text-foreground",
  caption: "text-caption font-regular text-muted-foreground",
  "section-label": "text-section-label font-semibold text-muted-foreground",
  metric: "text-metric font-bold text-foreground",
};

/** Typed text with DM Sans applied via the design-token type scale. */
export function Text({ variant = "body", asChild = false, className, ...props }: TextProps) {
  const contextClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return <Component className={cn(VARIANT_CLASS[variant], contextClass, className)} {...props} />;
}
