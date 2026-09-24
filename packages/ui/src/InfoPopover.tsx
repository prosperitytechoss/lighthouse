import { Portal } from "@rn-primitives/portal";
import { Info } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "./Text";

/**
 * Tappable ⓘ icon that opens a short plain-language popover (rendered via the
 * app Portal). Used to explain product jargon to parents on Settings sections.
 */
export function InfoPopover({
  text,
  label,
  defaultOpen = false,
}: {
  text: string;
  label?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label ?? "More information"}
      >
        <Info size={15} color="#8E8E93" />
      </Pressable>
      {open ? (
        <Portal name="lh-info">
          <Pressable
            className="absolute inset-0 items-center justify-center bg-black/40 px-2xl"
            onPress={() => setOpen(false)}
          >
            <View className="w-full max-w-sm rounded-xl bg-white p-lg">
              <Text variant="body-sm" className="leading-5 text-foreground">
                {text}
              </Text>
              <Text variant="button" className="mt-md self-end text-primary">
                Got it
              </Text>
            </View>
          </Pressable>
        </Portal>
      ) : null}
    </>
  );
}
