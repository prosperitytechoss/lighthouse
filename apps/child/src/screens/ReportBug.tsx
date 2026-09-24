import { strings } from "@lighthouse/copy";
import { ArcWash, ChunkyButton, haptics, RiveMascot, Screen, SpeechBubble, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { toast } from "sonner-native";

import { feedbackApi, type FeedbackType } from "../api/client";
import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import { getDeviceToken } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const r = strings.child.reportBug;

const CHIPS: { type: FeedbackType; label: string }[] = [
  { type: "bug", label: r.chips.bug },
  { type: "wrong_flag", label: r.chips.wrong_flag },
  { type: "idea", label: r.chips.idea },
];

/**
 * Report a bug (board 30): chip picker (App problem / Wrong flag / An idea),
 * one text box, POST /feedback, sonner toast on success.
 */
export function ReportBug({ navigation }: NativeStackScreenProps<ChildStackParamList, "ReportBug">) {
  useFocusedStatusBar("dark");
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const onSend = async () => {
    if (sending.current) return;
    const body = message.trim();
    if (!body) {
      toast.error(r.empty);
      return;
    }
    sending.current = true;
    setBusy(true);
    const token = await getDeviceToken();
    const res = token ? await feedbackApi.send(token, type, body) : null;
    setBusy(false);
    sending.current = false;
    if (res?.ok) {
      toast.success(r.sent);
      navigation.goBack();
      return;
    }
    toast.error(r.sendError);
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <ArcWash intensity={0.1} />
      <View className="w-full max-w-[480px] flex-1 self-center">
        <View className="flex-row items-center gap-xs px-lg pt-sm">
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeft size={26} color="#1A1A1A" strokeWidth={2} />
          </Pressable>
          <Text className="text-[22px] font-bold leading-7 text-foreground" style={{ letterSpacing: -0.22 }}>
            {r.title}
          </Text>
        </View>

        <KeyboardAwareScrollView
          contentContainerClassName="grow px-2xl pb-lg"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mascot + speech (76px). */}
          <View className="flex-row items-end gap-[10px] pt-xl">
            <RiveMascot size={76} />
            <SpeechBubble tail="corner" style={{ flex: 1, alignItems: "stretch" }}>
              <Text className="text-[14.5px] font-semibold leading-[21px] text-foreground">
                {r.bubble}
              </Text>
            </SpeechBubble>
          </View>

          {/* Type chips */}
          <View className="flex-row gap-sm pt-2xl">
            {CHIPS.map((chip) => {
              const active = chip.type === type;
              return (
                <Pressable
                  key={chip.type}
                  onPressIn={haptics.select}
                  onPress={() => setType(chip.type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={
                    active
                      ? "rounded-pill bg-primary px-lg py-sm"
                      : "rounded-pill border-2 border-hairline px-[14px] py-[6px]"
                  }
                >
                  <Text className={`text-[13px] font-bold leading-4 ${active ? "text-white" : "text-muted-foreground"}`}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Message box */}
          <TextInput
            className="mt-lg h-[140px] rounded-[14px] bg-white px-lg py-[14px] text-[15px] leading-[20px] text-foreground font-regular"
            multiline
            textAlignVertical="top"
            placeholder={r.placeholder}
            placeholderTextColor="#A8AEB8"
            value={message}
            onChangeText={setMessage}
          />
          <Text className="pt-sm text-[12.5px] leading-[18px] text-muted-foreground">{r.note}</Text>
        </KeyboardAwareScrollView>

        <View className="px-2xl pb-md">
          <ChunkyButton label={r.send} onPress={onSend} disabled={busy} />
        </View>
      </View>
    </Screen>
  );
}
