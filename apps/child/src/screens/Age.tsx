import { strings } from "@lighthouse/copy";
import { ArcWash, ChunkyButton, Mascot, Text, useToast } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { pairingApi } from "../api/client";
import { getDeviceToken, setAgeDone } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const s = strings.child.age;
const MAX_AGE = 15;

export function Age({ navigation, route }: NativeStackScreenProps<ChildStackParamList, "Age">) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [tooOld, setTooOld] = useState(false);
  const [busy, setBusy] = useState(false);
  const returning = route.params?.returning === true;

  const onNext = async () => {
    const age = Number(value.trim());
    if (!value.trim() || !Number.isInteger(age) || age < 1 || age > 99) {
      toast.error(s.invalid);
      return;
    }
    if (age > MAX_AGE) {
      setTooOld(true);
      return;
    }
    if (!returning) {
      navigation.navigate("ParentContact", { age });
      return;
    }
    const token = await getDeviceToken();
    if (!token) return;
    setBusy(true);
    const res = await pairingApi.setAge(token, age);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.status === 0 ? strings.child.pairing.networkError : res.error || strings.child.pairing.genericError);
      return;
    }
    await setAgeDone();
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  if (tooOld) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar style="dark" />
        <ArcWash intensity={0.1} />
        <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1">
          <View className="w-full max-w-[480px] flex-1 items-center justify-center self-center px-2xl">
            <Mascot size={150} mood="dim" />
            <Text
              className="pt-xl text-center text-[26px] font-bold leading-[32px] text-foreground"
              style={{ letterSpacing: -0.39 }}
            >
              {s.tooOld}
            </Text>
          </View>
          <View className="w-full max-w-[480px] self-center px-2xl pb-md">
            <ChunkyButton label={s.back} onPress={() => { setTooOld(false); setValue(""); }} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <ArcWash intensity={0.1} />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1">
        <View className="w-full max-w-[480px] flex-1 self-center">
          <View className="h-[34px] px-lg pt-sm">
            {returning ? null : (
              <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
                <ChevronLeft size={26} color="#1A1A1A" />
              </Pressable>
            )}
          </View>

          <KeyboardAwareScrollView
            contentContainerClassName="grow px-2xl pb-lg"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center gap-md pt-md">
              <Mascot size={76} />
              <Text
                className="flex-1 text-[26px] font-bold leading-[32px] text-foreground"
                style={{ letterSpacing: -0.39 }}
              >
                {s.title}
              </Text>
            </View>

            <TextInput
              className="mt-2xl rounded-[18px] bg-white px-lg py-[18px] text-center text-[34px] font-bold leading-[40px] text-foreground"
              keyboardType="number-pad"
              maxLength={2}
              placeholder={s.placeholder}
              placeholderTextColor="#A8AEB8"
              value={value}
              onChangeText={(t) => setValue(t.replace(/[^0-9]/g, ""))}
              onSubmitEditing={() => void onNext()}
              returnKeyType="next"
              autoFocus
            />
          </KeyboardAwareScrollView>

          <KeyboardStickyView>
            <View className="px-2xl pb-md">
              <ChunkyButton label={s.next} onPress={() => void onNext()} disabled={!value || busy} loading={busy} />
            </View>
          </KeyboardStickyView>
        </View>
      </SafeAreaView>
    </View>
  );
}
