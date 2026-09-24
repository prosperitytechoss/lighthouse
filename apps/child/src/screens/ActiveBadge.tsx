import { strings } from "@lighthouse/copy";
import { LhMark, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Eye } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const a = strings.child.activeBadge;

export function ActiveBadge({
  navigation,
}: NativeStackScreenProps<ChildStackParamList, "ActiveBadge">) {
  useFocusedStatusBar("light");

  // Gentle "watching" pulse on the eye, so the active pill feels alive.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const eyeStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      {/* Simulated app content behind the system overlay; tap to dismiss. */}
      <Pressable className="flex-1" onPress={() => navigation.goBack()}>
        <SafeAreaView edges={["top"]}>
          <Text className="mt-lg text-center text-body-sm text-white/50">{a.simulatedContent}</Text>
        </SafeAreaView>
      </Pressable>

      {/* Floating "active" pill */}
      <View className="absolute inset-x-0 bottom-56 items-center">
        <View className="flex-row items-center gap-sm rounded-pill bg-primary py-1.5 pl-md pr-md shadow-lg">
          <Animated.View style={eyeStyle}>
            <Eye size={15} color="#fff" strokeWidth={2.5} />
          </Animated.View>
          <Text className="text-body-sm font-semibold text-white">{a.pill}</Text>
        </View>
      </View>

      {/* Bottom info sheet */}
      <View className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-2xl pt-md">
        <SafeAreaView edges={["bottom"]}>
          <View className="mb-md mt-sm h-1 w-10 self-center rounded-pill bg-neutral-200" />
          <View className="flex-row items-center gap-md">
            <View className="rounded-lg bg-white p-1">
              <LhMark size={26} />
            </View>
            <View className="flex-1">
              <Text variant="button" className="text-foreground">
                {a.sheetTitle}
              </Text>
              <Text className="mt-0.5 text-body-sm text-muted-foreground">{a.sheetBody}</Text>
            </View>
          </View>
          <Text className="mb-md mt-md text-body-sm text-muted-foreground">{a.reportsNote}</Text>
        </SafeAreaView>
      </View>
    </View>
  );
}
