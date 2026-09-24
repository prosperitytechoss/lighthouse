import { strings } from "@lighthouse/copy";
import { ArcWash, ChunkyButton, RiveMascot, Screen, SpeechBubble, Text } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import type { ChildStackParamList } from "../navigation/RootNavigator";

/** Phone linked — mascot celebrates, then straight into the permission wizard. */
export function Linked({ navigation, route }: NativeStackScreenProps<ChildStackParamList, "Linked">) {
  const s = strings.child.linked;
  const body =
    route.params?.needsConfirmation === false ? s.bodyAlreadyConfirmed : route.params?.emailSent === false ? s.bodyNoEmail : s.body;
  return (
    <Screen>
      <ArcWash intensity={0.12} />
      <StatusBar style="dark" />
      <View className="w-full max-w-[480px] flex-1 self-center px-2xl">
        <View className="flex-1 items-center justify-center">
          <SpeechBubble text={s.title} />
          <RiveMascot size={150} />
          <Text variant="heading-lg" className="pt-xl text-center text-foreground">
            {s.title}
          </Text>
          <Text variant="body" className="mt-md max-w-[300px] text-center leading-6 text-muted-foreground">
            {body}
          </Text>
        </View>
        {/* In normal flow so it always rides above the bottom / side safe area */}
        <ChunkyButton style={{ marginBottom: 16 }} label={s.button} onPress={() => navigation.replace("Setup")} />
      </View>
    </Screen>
  );
}
