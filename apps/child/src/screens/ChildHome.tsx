import { strings } from "@lighthouse/copy";
import {
  ChunkyButton,
  DayRow,
  haptics,
  LhMark,
  RiveMascot,
  Screen,
  Skeleton,
  SpeechBubble,
  Text,
  useToast,
} from "@lighthouse/ui";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CalendarDays, ChevronRight, Eye, Mail, ScanEye, SlidersHorizontal } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { pairingApi, type WeeklyResponse } from "../api/client";
import { Grain } from "../components/Grain";
import { WaveEdge } from "../components/WaveEdge";
import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import { calendarWeek, quietDayCount } from "../lib/week";
import { getVisionStatus, type VisionStatus } from "../native/capture";
import { isGranted } from "../native/permissions";
import { clearDeviceToken, getDeviceToken } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const h = strings.child.home;

type Status = {
  accessibility: boolean;
  notifications: boolean;
};

/**
 * Child home (board 21): mascot hero + speech bubble, quiet-days metric and
 * day row from GET /devices/weekly, chunky link cards, honest footer.
 */
export function ChildHome({ navigation }: NativeStackScreenProps<ChildStackParamList, "Home">) {
  useFocusedStatusBar("light");
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [week, setWeek] = useState<WeeklyResponse | null>(null);
  const [vision, setVision] = useState<VisionStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load REAL status: actual permission grants on this phone + this device's
  // last-7-days picture. We never surface the guardian's raw email.
  const load = useCallback(async () => {
    const [accessibility, notifications] = await Promise.all([
      isGranted("accessibility"),
      isGranted("notificationListener"),
    ]);
    setStatus({ accessibility, notifications });
    setVision(await getVisionStatus());
    const token = await getDeviceToken();
    if (token) {
      const res = await pairingApi.weekly(token);
      if (res.ok) setWeek(res.data);
    }
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Pull to refresh: re-check link + status. Unpaired (401) → back to onboarding.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const token = await getDeviceToken();
    const res = token ? await pairingApi.me(token) : null;
    setRefreshing(false);
    if (!token || res?.status === 401) {
      await clearDeviceToken();
      toast.error(strings.child.scan.unlinked);
      navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
      return;
    }
    if (res && !res.ok && res.status === 0) toast.error(strings.child.scan.networkError);
    void load();
  }, [navigation, toast, load]);

  const monitoringOn = !!status && status.accessibility && status.notifications;
  const tiles = calendarWeek(week?.days, "short");
  const quiet = quietDayCount(tiles);
  let todayIndex = -1;
  tiles.forEach((t, i) => {
    if (t.state !== "future") todayIndex = i;
  });
  const flagged = (week?.total ?? 0) > 0;

  const bubble =
    status === null
      ? h.bubbleChecking
      : !monitoringOn
        ? h.bubblePaused
        : flagged
          ? h.bubbleFlagged
          : h.bubbleAllClear;

  return (
    <Screen edges={["left", "right", "bottom"]} className="bg-white">
      <ScrollView
        contentContainerClassName="w-full pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={["#0A7FB8"]}
            progressViewOffset={insets.top}
          />
        }
      >
        <View style={{ backgroundColor: BAND, paddingTop: insets.top, paddingBottom: 40, overflow: "visible" }}>
          <Grain />
          <View className="w-full max-w-[480px] self-center px-2xl">
            {/* Top bar */}
            <View className="flex-row items-center pt-sm">
              <View className="flex-1 flex-row items-center gap-sm">
                <LhMark size={24} />
                <Text className="text-[18px] font-bold leading-[22px] text-white" style={{ letterSpacing: -0.18 }}>
                  {strings.app.name}
                </Text>
              </View>
              <Pressable
                onPressIn={haptics.select}
                onPress={() => navigation.navigate("Settings")}
                hitSlop={10}
                className="p-1 active:opacity-60"
                accessibilityLabel={strings.child.settings.open}
              >
                <SlidersHorizontal size={22} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            {!loaded ? (
              <View className="items-center pt-xl">
                <Skeleton width={120} height={120} radius={999} />
                <Skeleton width={140} height={44} radius={12} style={{ marginTop: 14 }} />
                <Skeleton width={220} height={16} radius={999} style={{ marginTop: 14 }} />
                <View className="flex-row gap-sm pt-[14px]">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} width={30} height={30} radius={999} />
                  ))}
                </View>
              </View>
            ) : (
              <>
                {/* Mascot hero: bubble speaks the real state. */}
                <View className="items-center pt-xl">
                  <SpeechBubble text={bubble} />
                  <RiveMascot
                    size={150}
                    onColor
                    animate={monitoringOn || status === null}
                    mood={monitoringOn || status === null ? "happy" : "dim"}
                  />
                  {status !== null && !monitoringOn ? (
                    <ChunkyButton
                      size="sm"
                      label={h.statusFix}
                      style={{ marginTop: 12 }}
                      onPress={() =>
                        navigation.navigate(
                          "Setup",
                          !status.accessibility
                            ? { focus: "accessibility" }
                            : !status.notifications
                              ? { focus: "notificationListener" }
                              : undefined,
                        )
                      }
                    />
                  ) : null}
                </View>

                {/* Quiet days metric + day row (board 21b). */}
                <View className="items-center pt-md">
                  <Text
                    className="text-[72px] font-bold leading-[72px] text-white"
                    style={{ letterSpacing: -2.5, fontVariant: ["tabular-nums"] }}
                  >
                    {quiet}
                  </Text>
                  <Text className="pt-[4px] text-[19px] font-bold leading-6 text-white">{h.quietDaysLabel(quiet)}</Text>
                  <DayRow
                    days={tiles.map((t) => t.state)}
                    labels={tiles.map((t) => t.label)}
                    size="sm"
                    tone="onColor"
                    today={todayIndex}
                    style={{ paddingTop: 20 }}
                  />
                </View>
              </>
            )}
          </View>
          <WaveEdge />
        </View>

        {loaded ? (
          <View className="w-full max-w-[480px] self-center px-2xl">
            {/* Link cards */}
            <View className="gap-md pt-[28px]">
              <LinkCard
                icon={<CalendarDays size={22} color="#1CABE2" strokeWidth={2.2} />}
                label={h.weekCard}
                onPress={() => navigation.navigate("Weekly")}
              />
              <LinkCard
                icon={<Eye size={22} color="#1CABE2" strokeWidth={2.2} />}
                label={h.transparencyCard}
                onPress={() => navigation.navigate("Transparency")}
              />
              {vision ? (
                <LinkCard
                  icon={<ScanEye size={22} color="#1CABE2" strokeWidth={2.2} />}
                  label={h.visionCard}
                  onPress={() => navigation.navigate("Transparency")}
                  trailing={
                    <View className="rounded-pill bg-primary-50 px-[10px] py-xs">
                      <Text className="text-[12px] font-bold leading-4 text-primary-700">
                        {!vision.supported ? h.visionOld : !vision.enabled || !vision.running ? h.visionOff : h.visionCount(vision.framesChecked)}
                      </Text>
                    </View>
                  }
                />
              ) : null}
              <LinkCard
                icon={<Mail size={22} color="#1CABE2" strokeWidth={2.2} />}
                label={h.linkedCard}
                onPress={() => navigation.navigate("Transparency")}
                trailing={
                  <View className={`rounded-pill px-[10px] py-xs ${monitoringOn ? "bg-primary-50" : "bg-warning-bg"}`}>
                    <Text className={`text-[12px] font-bold leading-4 ${monitoringOn ? "text-primary-700" : "text-[#B45309]"}`}>
                      {monitoringOn ? h.linkedActive : h.linkedPaused}
                    </Text>
                  </View>
                }
              />
            </View>

            <Text className="px-2xl pb-xl pt-xl text-center text-[12.5px] leading-[18px] text-muted-foreground">
              {h.footer}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const BAND = "#0A7FB8";

/** Board-21 link card: white radius 16, 22px cyan icon, 16/700 label. */
function LinkCard({
  icon,
  label,
  onPress,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPressIn={haptics.select}
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-md rounded-xl bg-white px-lg py-[14px] active:opacity-80"
    >
      {icon}
      <Text className="flex-1 text-[16px] font-bold leading-5 text-foreground">{label}</Text>
      {trailing ?? <ChevronRight size={20} color="#C2C7D0" strokeWidth={2.4} />}
    </Pressable>
  );
}
