import { strings } from "@lighthouse/copy";
import { ArcWash, ChunkyButton, RiveMascot, SpeechBubble, Text, useToast } from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { pairingApi } from "../api/client";
import { getDeviceInfo } from "../native/permissions";
import { getInstallId, setDeviceToken } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const s = strings.child.pairing;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

/**
 * Normalize what a parent actually types into E.164-ish: strip spaces/dashes/
 * parens, and convert the Nigerian local format (0803…) to +234803… — the
 * pilot cohort types local numbers, and the server regex rejects a leading 0.
 */
export function normalizePhone(raw: string): string {
  const w = raw.trim().replace(/[\s\-()]/g, "");
  if (/^0\d{10}$/.test(w)) return `+234${w.slice(1)}`;
  return w;
}

/** Pretty-print +2348031234567 → "+234 803 123 4567" for the live pill. */
function formatE164(e164: string): string {
  const m = e164.match(/^(\+234)(\d{3})(\d{3})(\d{4})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}

/** Board-26 input: 13/700 label, white radius-14 field, 15px text. */
function BoardField({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text className="text-[13px] font-bold leading-4 text-foreground">{label}</Text>
      {children}
    </View>
  );
}

const inputClass = "mt-sm rounded-[14px] bg-white px-lg py-[14px] text-[15px] leading-[18px] text-foreground font-regular";

/**
 * Set up with a parent (board 26) — the parent enters their email + optional
 * WhatsApp on the child's phone. Self-registers via /register and stores the
 * device token. Keeps +234 normalization with live inline feedback.
 */
export function ParentContact({
  navigation,
}: NativeStackScreenProps<ChildStackParamList, "ParentContact">) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const normalized = normalizePhone(whatsapp);
  const phoneValid = !!whatsapp.trim() && PHONE_RE.test(normalized);

  const onSubmit = async () => {
    if (submitting.current) return;
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      toast.error(s.invalidEmail);
      return;
    }
    if (whatsapp.trim() && !phoneValid) {
      toast.error(s.invalidWhatsapp);
      return;
    }

    submitting.current = true;
    setBusy(true);
    const di = await getDeviceInfo();
    const installId = await getInstallId();
    const res = await pairingApi.register(
      e,
      phoneValid ? normalized : undefined,
      { model: di.model, manufacturer: di.manufacturer, os: `Android ${Platform.Version}` },
      installId,
    );

    if (res.ok) {
      await setDeviceToken(res.data.deviceToken);
      navigation.replace("Linked", { emailSent: res.data.emailSent !== false, needsConfirmation: res.data.needsConfirmation });
      return;
    }

    setBusy(false);
    submitting.current = false;
    toast.error(res.status === 0 ? s.networkError : res.error || s.genericError);
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <ArcWash intensity={0.1} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1">
          <View className="w-full max-w-[480px] flex-1 self-center">
            <View className="px-lg pt-sm">
              <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
                <ChevronLeft size={26} color="#1A1A1A" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerClassName="grow px-2xl pb-lg"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Mascot + speech (board 26) */}
              <View className="flex-row items-end gap-[10px] pt-md">
                <RiveMascot size={76} />
                <SpeechBubble tail="corner" style={{ flex: 1, alignItems: "stretch" }}>
                  <Text className="text-[14.5px] font-semibold leading-[21px] text-foreground">
                    {s.bubble}
                  </Text>
                </SpeechBubble>
              </View>

              <BoardField label={s.emailLabel} style={{ paddingTop: 24 }}>
                <TextInput
                  className={inputClass}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  placeholder={s.emailPlaceholder}
                  placeholderTextColor="#A8AEB8"
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="next"
                />
              </BoardField>

              <BoardField label={s.whatsappLabel} style={{ paddingTop: 20 }}>
                <View className="mt-sm flex-row items-center gap-sm rounded-[14px] bg-white px-lg">
                  <TextInput
                    className="flex-1 py-[14px] text-[15px] leading-[18px] text-foreground font-regular"
                    keyboardType="phone-pad"
                    placeholder={s.whatsappPlaceholder}
                    placeholderTextColor="#A8AEB8"
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                  />
                  {/* Live normalization pill — the board's "+234 803 123 4567" chip. */}
                  {phoneValid ? (
                    <View className="rounded-pill bg-primary-50 px-[10px] py-[3px]">
                      <Text className="text-[11px] font-bold leading-[14px] text-primary-700">
                        {formatE164(normalized)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </BoardField>
              {/* Live inline feedback — don't wait for submit to say the number is off. */}
              {whatsapp.trim() && !phoneValid ? (
                <Text className="pt-sm text-[12.5px] leading-[18px] text-destructive">
                  {s.invalidWhatsapp}
                </Text>
              ) : (
                <Text className="pt-sm text-[12.5px] leading-[18px] text-muted-foreground">
                  {s.whatsappHint}
                </Text>
              )}
            </ScrollView>

            <View className="px-2xl pb-md">
              <ChunkyButton
                label={busy ? s.linking : s.submit}
                onPress={onSubmit}
                loading={busy}
              />
              <Text className="pt-[14px] text-center text-[12.5px] leading-4 text-muted-foreground">
                {s.footer}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
