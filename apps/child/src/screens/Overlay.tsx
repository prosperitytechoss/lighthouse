import { strings } from "@lighthouse/copy";
import { ChunkyButton, RiveMascot, SpeechBubble, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const o = strings.child.overlay;

/**
 * Block screen (board 22): dark scrim, alert mascot with steady warm beams,
 * white card with category pill, chunky GO BACK, quiet hold-to-continue.
 * Entrance per motion guide 6: scrim fades 200ms, mascot slides up 24px with a
 * spring, bubble follows. (The production overlay is native: OverlayManager.kt.
 * This screen is the in-app preview of the same design.)
 */
export function Overlay({ navigation }: NativeStackScreenProps<ChildStackParamList, "Overlay">) {
  useFocusedStatusBar("light");
  const reducedMotion = useReducedMotion();
  const rise = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    rise.value = withDelay(80, withSpring(1, { damping: 15, stiffness: 160 }));
  }, [rise]);

  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: reducedMotion ? [] : [{ translateY: (1 - rise.value) * 24 }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="flex-1 items-center justify-center bg-[#12141F] px-2xl"
    >
      <View className="w-full max-w-[420px] items-center">
        <Animated.View style={riseStyle} className="items-center">
          <SpeechBubble dark animateIn delay={250}>
            <Text className="text-[15px] font-semibold leading-[18px] text-white">{o.bubble}</Text>
          </SpeechBubble>
          <RiveMascot size={140} mood="alert" />
        </Animated.View>

        <Animated.View style={riseStyle} className="mt-xl w-full items-center rounded-3xl bg-white px-2xl pb-xl pt-2xl">
          <View className="rounded-pill bg-[#FFE8E8] px-md py-[5px]">
            <Text className="text-[12px] font-bold leading-4 text-[#C2382B]">{o.category}</Text>
          </View>
          <Text className="pt-md text-center text-[20px] font-bold leading-[27px] text-foreground">
            {o.title}
          </Text>
          <Text className="pt-sm text-center text-[14px] leading-5 text-[#5A6472]">{o.body}</Text>

          <ChunkyButton
            size="md"
            label={o.goBack}
            style={{ marginTop: 20, alignSelf: "stretch" }}
            onPress={() => navigation.goBack()}
          />

          {/* Continue anyway: quiet ghost, hold 3s to pass. */}
          <ChunkyButton
            variant="ghost"
            size="md"
            style={{ marginTop: 10, alignSelf: "stretch" }}
            delayLongPress={3000}
            onLongPress={() => navigation.goBack()}
            onPress={() => {}}
          >
            <View className="flex-row items-baseline gap-[6px]">
              <Text className="text-[15px] font-bold leading-[18px] text-[#8E8E93]">
                {o.continueAnyway}
              </Text>
              <Text className="text-[11px] leading-[14px] text-[#C2C7D0]">{o.continueHold}</Text>
            </View>
          </ChunkyButton>

          <Text className="pt-[14px] text-center text-[11.5px] leading-4 text-[#8E8E93]">
            {o.footer}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
