import { strings } from "@lighthouse/copy";
import { MONITORED_APPS } from "@lighthouse/types";
import {
  ArcWash,
  BRAND_LOGOS,
  type BrandLogoId,
  ChunkyButton,
  haptics,
  RiveMascot,
  Screen,
  Text,
  useToast,
} from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Portal } from "@rn-primitives/portal";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { pairingApi } from "../api/client";
import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import { setBlockingEnabled, setBlockThreshold, setMonitoredApps } from "../native/capture";
import { clearDeviceToken, getDeviceToken } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const s = strings.child.settings;
const og = strings.child.otpGate;
const hm = strings.child.home;

type Threshold = "severe" | "moderate" | "all";
// severityOptions is authored in enum order [severe, moderate, all].
const SEV_ENUM: readonly Threshold[] = ["severe", "moderate", "all"];

/**
 * Parent settings (board 37): chunky segmented severity, chunky switches,
 * tappable app tiles, SAVE CHANGES, Report a bug / Disconnect links. Turning
 * email alerts OFF walks through the OTP gate (board 39, 403 otp_required).
 */
export function ChildSettings({
  navigation,
}: NativeStackScreenProps<ChildStackParamList, "Settings">) {
  useFocusedStatusBar("dark");
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState<Threshold>("severe");
  const [overlay, setOverlay] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(MONITORED_APPS.map((a) => a.id)));
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getDeviceToken();
      const res = token ? await pairingApi.me(token) : null;
      if (!alive) return;
      if (res?.ok) {
        setThreshold(res.data.alertThreshold);
        setOverlay(res.data.overlayEnabled);
        setEmailAlerts(res.data.emailAlertsEnabled);
        setEnabled(new Set(res.data.monitoredApps));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleApp = (id: string) => {
    haptics.select();
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Save. On 403 otp_required: email the parent a code, open the gate, retry
  // with the entered otp. otp_invalid keeps the gate open with an error.
  const onSave = useCallback(
    async (otp?: string) => {
      if (saving) return;
      setSaving(true);
      setOtpError(null);
      const token = await getDeviceToken();
      const monitoredApps = MONITORED_APPS.map((a) => a.id).filter((id) => enabled.has(id));
      const res = token
        ? await pairingApi.updateSettings(token, {
            alertThreshold: threshold,
            overlayEnabled: overlay,
            emailAlertsEnabled: emailAlerts,
            monitoredApps,
            ...(otp ? { otp } : {}),
          })
        : null;
      setSaving(false);
      if (res?.ok) {
        setOtpOpen(false);
        // Apply to the native gate immediately (don't wait for the next poll).
        setMonitoredApps(res.data.monitoredApps);
        setBlockingEnabled(res.data.overlayEnabled);
        setBlockThreshold(res.data.alertThreshold);
        toast.success(s.saved);
        navigation.goBack();
        return;
      }
      if (res && res.status === 403 && res.error === "otp_required") {
        if (!token) return;
        const sent = await pairingApi.requestSettingsOtp(token);
        if (sent.ok) setOtpOpen(true);
        else toast.error(og.sendError);
        return;
      }
      if (res && res.status === 403 && res.error === "otp_invalid") {
        setOtpOpen(true);
        setOtpError(og.invalid);
        return;
      }
      toast.error(s.saveError);
    },
    [saving, enabled, threshold, overlay, emailAlerts, toast, navigation],
  );

  // Disconnect from parent → unlink this device and return to onboarding.
  const onDisconnect = useCallback(() => {
    Alert.alert(hm.disconnectTitle, hm.disconnectBody, [
      { text: hm.disconnectCancel, style: "cancel" },
      {
        text: hm.disconnectConfirm,
        style: "destructive",
        onPress: async () => {
          await clearDeviceToken();
          navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
        },
      },
    ]);
  }, [navigation]);

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <ArcWash intensity={0.1} />
      <View className="w-full max-w-[480px] flex-1 self-center">
        <View className="flex-row items-center gap-xs px-lg pt-sm">
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeft size={26} color="#1A1A1A" strokeWidth={2} />
          </Pressable>
          <Text className="text-[22px] font-bold leading-7 text-foreground" style={{ letterSpacing: -0.22 }}>
            {s.title}
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1CABE2" />
          </View>
        ) : (
          <>
            <ScrollView contentContainerClassName="px-2xl pb-lg" showsVerticalScrollIndicator={false}>
              <Text className="pt-[10px] text-[13px] leading-[19px] text-muted-foreground">
                {s.subtitle}
              </Text>

              {/* How much to flag — chunky segmented (board 37). */}
              <Text className="pb-sm pt-xl text-[13px] font-bold leading-4 text-foreground">
                {s.severityLabel}
              </Text>
              <View className="flex-row gap-xs rounded-[14px] bg-surface p-xs">
                {s.severityOptions.map((label, i) => {
                  const active = SEV_ENUM[i] === threshold;
                  return (
                    <Pressable
                      key={label}
                      onPressIn={haptics.select}
                      onPress={() => setThreshold(SEV_ENUM[i]!)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={
                        active
                          ? "flex-1 items-center rounded-[11px] bg-primary pb-[7px] pt-[9px]"
                          : "flex-1 items-center rounded-[11px] py-[9px]"
                      }
                      style={active ? { borderBottomWidth: 3, borderBottomColor: "#0E7FA8" } : undefined}
                    >
                      <Text className={`text-[13px] font-bold leading-4 ${active ? "text-white" : "text-muted-foreground"}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Toggles */}
              <View className="mt-xl overflow-hidden rounded-xl bg-white">
                <ToggleRow label={s.overlayLabel} sub={s.overlaySub} value={overlay} onValueChange={setOverlay} border={false} />
                <ToggleRow label={s.emailLabel} sub={s.emailSub} value={emailAlerts} onValueChange={setEmailAlerts} />
              </View>

              {/* Apps to watch — solid tiles watched, dashed off. */}
              <Text className="pb-sm pt-xl text-[13px] font-bold leading-4 text-foreground">
                {s.appsLabel}
              </Text>
              <View className="flex-row flex-wrap gap-sm">
                {MONITORED_APPS.map((app) => (
                  <AppTile
                    key={app.id}
                    id={app.id}
                    name={app.displayName}
                    on={enabled.has(app.id)}
                    onPress={() => toggleApp(app.id)}
                  />
                ))}
              </View>
              <Text className="pt-sm text-[12.5px] leading-[18px] text-muted-foreground">{s.appsSub}</Text>
            </ScrollView>

            <View className="gap-[10px] px-2xl pb-md pt-sm">
              <ChunkyButton label={s.save} onPress={() => onSave()} disabled={saving} />
              <View className="flex-row items-center justify-center gap-lg pt-[6px]">
                <Pressable onPressIn={haptics.select} onPress={() => navigation.navigate("ReportBug")} className="active:opacity-60">
                  <Text className="text-[13px] font-bold leading-4 text-muted-foreground">{s.reportBug}</Text>
                </Pressable>
                <View className="h-1 w-1 rounded-pill bg-hairline" />
                <Pressable onPressIn={haptics.medium} onPress={onDisconnect} className="active:opacity-60">
                  <Text className="text-[13px] font-bold leading-4 text-[#B4231A]">{s.disconnect}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>

      {otpOpen ? (
        <OtpGate
          error={otpError}
          busy={saving}
          onConfirm={(code) => void onSave(code)}
          onKeepOn={() => {
            setEmailAlerts(true);
            setOtpOpen(false);
            setOtpError(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onValueChange,
  border = true,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  border?: boolean;
}) {
  return (
    <View className={`flex-row items-center gap-md px-lg py-[13px] ${border ? "border-t border-hairline" : ""}`}>
      <View className="flex-1 gap-[2px]">
        <Text className="text-[15px] font-bold leading-[18px] text-foreground">{label}</Text>
        <Text className="text-[12.5px] leading-[17px] text-muted-foreground">{sub}</Text>
      </View>
      <ChunkySwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

/** Board-37 switch: 46x28 pill with a 3px darker bottom edge, 22px thumb. */
function ChunkySwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 140 });
  }, [value, progress]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));
  return (
    <Pressable
      onPressIn={haptics.select}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        padding: 2,
        backgroundColor: value ? "#1CABE2" : "#E8ECF0",
        borderBottomWidth: 3,
        borderBottomColor: value ? "#0E7FA8" : "#D9DEE5",
      }}
    >
      <Animated.View
        style={[{ width: 22, height: 22, borderRadius: 999, backgroundColor: "#FFFFFF" }, thumbStyle]}
      />
    </Pressable>
  );
}

/** 42px app tile: solid #F5F7FB + 3px edge when watched; dashed + dim when off. */
function AppTile({
  id,
  name,
  on,
  onPress,
}: {
  id: string;
  name: string;
  on: boolean;
  onPress: () => void;
}) {
  const logo = BRAND_LOGOS[id as BrandLogoId];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={name}
      style={
        on
          ? {
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: "#F5F7FB",
              borderBottomWidth: 3,
              borderBottomColor: "#E8ECF0",
              alignItems: "center",
              justifyContent: "center",
            }
          : {
              width: 42,
              height: 42,
              borderRadius: 12,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "#E8ECF0",
              opacity: 0.55,
              alignItems: "center",
              justifyContent: "center",
            }
      }
    >
      {logo ? (
        <Svg width={on ? 24 : 22} height={on ? 24 : 22} viewBox="0 0 24 24">
          <Path d={logo.d} fill={logo.fill} />
        </Svg>
      ) : null}
    </Pressable>
  );
}

/** OTP gate (board 39): centered card over a dim scrim, 6 chunky digit boxes. */
function OtpGate({
  error,
  busy,
  onConfirm,
  onKeepOn,
}: {
  error: string | null;
  busy: boolean;
  onConfirm: (code: string) => void;
  onKeepOn: () => void;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<TextInput>(null);

  return (
    <Portal name="lh-otp-gate">
      <View className="absolute inset-0 items-center justify-center bg-black/50 px-2xl">
        <View
          className="w-full max-w-[380px] items-center rounded-3xl bg-white p-2xl"
          style={{ shadowColor: "#0A1428", shadowOpacity: 0.25, shadowRadius: 32, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}
        >
          <RiveMascot size={90} animate={false} />
          <Text className="pt-md text-center text-[19px] font-bold leading-[26px] text-foreground">
            {og.title}
          </Text>
          <Text className="pt-sm text-center text-[14px] leading-5 text-[#5A6472]">{og.body}</Text>

          {/* Six digit boxes; a hidden input drives them. */}
          <Pressable className="flex-row gap-sm pt-[18px]" onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < code.length;
              const active = i === code.length;
              const cyan = filled || active;
              return (
                <View
                  key={i}
                  style={{
                    width: 42,
                    height: 50,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderTopWidth: 2,
                    borderLeftWidth: 2,
                    borderRightWidth: 2,
                    borderBottomWidth: 4,
                    borderColor: cyan ? "#1CABE2" : "#E8ECF0",
                  }}
                >
                  <Text
                    className="text-[22px] leading-7"
                    style={{ color: filled ? "#1A1A1A" : "#C2C7D0", fontFamily: "DMSans_500Medium" }}
                  >
                    {filled ? code[i] : active ? "_" : ""}
                  </Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
          />

          {error ? (
            <Text className="pt-md text-center text-[13px] leading-4 text-destructive">{error}</Text>
          ) : null}

          <ChunkyButton
            style={{ marginTop: 20, alignSelf: "stretch" }}
            label={og.confirm}
            disabled={code.length !== 6 || busy}
            onPress={() => onConfirm(code)}
          />
          <Pressable onPress={onKeepOn} className="pt-[14px] active:opacity-60" accessibilityRole="button">
            <Text className="text-[13px] font-bold leading-4 text-muted-foreground">{og.keepOn}</Text>
          </Pressable>
          <Text className="pt-[14px] text-center text-[11.5px] leading-4 text-[#8E8E93]">
            {og.footer}
          </Text>
        </View>
      </View>
    </Portal>
  );
}
