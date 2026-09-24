import { Portal } from "@rn-primitives/portal";
import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "./cn";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes for the scrollable content container. */
  contentClassName?: string;
  /** Optional full-width element above the scrollable body (e.g. a colored
   *  banner). When set, it replaces the default grab handle. */
  header?: React.ReactNode;
};

/**
 * Bottom sheet rendered through the app Portal (NOT React Native's <Modal>).
 *
 * Why not <Modal>: on Android a <Modal> opens its own window that ignores the
 * activity's `adjustResize`, so the keyboard covers inputs and KeyboardAvoidingView
 * inside it does nothing. A Portal renders into the MAIN window, so when the
 * keyboard opens the window resizes and this bottom-anchored sheet rides above it.
 * On iOS (no adjustResize) we add KeyboardAvoidingView padding to get the same lift.
 *
 * The content is always scrollable, so tall forms stay reachable above the keyboard.
 */
export function Sheet({ visible, onClose, children, contentClassName, header }: SheetProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Portal name="lh-sheet">
      <View className="absolute inset-0">
        {/* keyboard-controller's KeyboardAvoidingView lifts the sheet above the
            keyboard on BOTH iOS and Android (works inside a Portal, unlike RN's). */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Pressable className="flex-1 bg-black/40" onPress={onClose} />
          <View
            className={cn(
              "max-h-[88%]",
              // Square top — no radius, so a colored header sits flush with no
              // white container corner peeking behind it.
              header ? "bg-primary" : "bg-white",
            )}
          >
            {header ?? (
              <View className="mb-md mt-sm h-1 w-10 self-center rounded-pill bg-neutral-200" />
            )}
            <ScrollView
              className="bg-white"
              contentContainerClassName={cn("px-2xl pb-sm pt-lg", contentClassName)}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}
