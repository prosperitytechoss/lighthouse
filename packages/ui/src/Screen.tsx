import { type Edge, SafeAreaView } from "react-native-safe-area-context";

import { cn } from "./cn";

export type ScreenProps = {
  children: React.ReactNode;
  /** Safe-area edges to inset. Defaults to ALL — incl. left/right for landscape. */
  edges?: readonly Edge[];
  className?: string;
};

/**
 * Universal screen container. Insets ALL edges by default so content never sits
 * under the notch, home indicator, or (in landscape) side gesture bars / the
 * Samsung taskbar. Use this as the root of every screen; put bottom CTAs in
 * normal flow inside it (not absolutely positioned) so they ride above the inset.
 */
export function Screen({
  children,
  edges = ["top", "bottom", "left", "right"],
  className,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-background", className)}>
      {children}
    </SafeAreaView>
  );
}
