import { strings } from "@lighthouse/copy";
import { ArcWash, ChunkyButton, RiveMascot, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChildStackParamList } from "../navigation/RootNavigator";

const s = strings.child.onboarding;

/**
 * Child onboarding (board 24): the mascot IS the splash. White canvas, soft
 * wash, breathing lighthouse, wordmark, tagline, one chunky CTA.
 */
export function Splash({ navigation }: NativeStackScreenProps<ChildStackParamList, "Onboarding">) {
  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <ArcWash intensity={0.14} />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1">
        <View className="w-full max-w-[480px] flex-1 self-center px-2xl">
          {/* Hero */}
          <Animated.View entering={FadeIn.duration(420)} className="flex-1 items-center justify-center">
            <RiveMascot size={190} />
            <Text
              className="pt-md text-[34px] font-bold leading-[42px] text-foreground"
              style={{ letterSpacing: -0.61 }}
            >
              {strings.app.name}
            </Text>
            <Text className="pt-xs text-[15px] font-semibold leading-[18px] text-primary">
              {s.tagline}
            </Text>
          </Animated.View>

          {/* Content */}
          <View className="pb-md">
            <Text
              className="text-[22px] font-bold leading-[30px] text-foreground"
              style={{ letterSpacing: -0.33 }}
            >
              {s.headline}
            </Text>
            <Text className="mt-[10px] text-[15px] leading-6 text-muted-foreground">{s.body}</Text>
            <ChunkyButton
              style={{ marginTop: 24 }}
              label={s.scanButton}
              onPress={() => navigation.navigate("ParentContact")}
            />
            <Text className="mt-lg text-center text-[13px] leading-4 text-muted-foreground">
              {s.footer}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
