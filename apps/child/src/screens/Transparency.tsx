import { strings } from "@lighthouse/copy";
import { ArcWash, haptics, RiveMascot, Screen, SpeechBubble, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const t = strings.child.transparency;

function CheckBadge() {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-pill bg-primary-50">
      <Svg width={15} height={15} viewBox="0 0 24 24">
        <Path d="M20 6 9 17l-5-5" fill="none" stroke="#1CABE2" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function CrossBadge() {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-pill bg-[#FFF1F1]">
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path d="M18 6 6 18" fill="none" stroke="#E0524B" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="m6 6 12 12" fill="none" stroke="#E0524B" strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function RowCard({ items, can }: { items: readonly string[]; can: boolean }) {
  return (
    <View className="overflow-hidden rounded-xl bg-white">
      {items.map((item, i) => (
        <View
          key={item}
          className={`flex-row items-center gap-md px-lg py-[13px] ${i > 0 ? "border-t border-hairline" : ""}`}
        >
          {can ? <CheckBadge /> : <CrossBadge />}
          <Text className="flex-1 text-[14.5px] leading-5 text-foreground">{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** What I can and can't see (board 40): honest lists + the on-device promise. */
export function Transparency({
  navigation,
}: NativeStackScreenProps<ChildStackParamList, "Transparency">) {
  useFocusedStatusBar("dark");

  return (
    <Screen edges={["top", "left", "right"]}>
      <ArcWash intensity={0.1} />
      <View className="w-full max-w-[480px] flex-1 self-center">
        <View className="flex-row items-center gap-xs px-lg pt-sm">
          <Pressable
            onPressIn={haptics.select}
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={26} color="#1A1A1A" strokeWidth={2} />
          </Pressable>
          <Text className="text-[22px] font-bold leading-7 text-foreground" style={{ letterSpacing: -0.22 }}>
            {t.headline}
          </Text>
        </View>

        <ScrollView contentContainerClassName="px-2xl pb-2xl" showsVerticalScrollIndicator={false}>
          {/* Mascot + speech (76px). */}
          <View className="flex-row items-end gap-[10px] pt-lg">
            <RiveMascot size={76} />
            <SpeechBubble tail="corner" style={{ flex: 1, alignItems: "stretch" }}>
              <Text className="text-[14.5px] font-semibold leading-[21px] text-foreground">
                {t.bubble}
              </Text>
            </SpeechBubble>
          </View>

          {/* Can see */}
          <Text className="pb-sm pt-xl text-[13px] font-bold leading-4 text-primary-700">
            {t.canSeeLabel}
          </Text>
          <RowCard items={t.canSee} can />

          {/* Can never see */}
          <Text className="pb-sm pt-xl text-[13px] font-bold leading-4 text-[#B4231A]">
            {t.cantSeeLabel}
          </Text>
          <RowCard items={t.cantSee} can={false} />

          {/* The on-device promise. */}
          <View className="mt-lg rounded-xl bg-surface px-lg py-[14px]">
            <Text className="text-[13px] leading-[19px] text-foreground">{t.note}</Text>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}
