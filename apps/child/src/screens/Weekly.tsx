import { strings } from "@lighthouse/copy";
import { MONITORED_APPS } from "@lighthouse/types";
import {
  AppIcon,
  ArcWash,
  ChunkyButton,
  DayRow,
  haptics,
  RiveMascot,
  Screen,
  Skeleton,
  SpeechBubble,
  Text,
} from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";

import { pairingApi, type WeeklyResponse, type WeeklyWorst } from "../api/client";
import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import { calendarWeek, flaggedDayCount, quietDayCount, worstDayName } from "../lib/week";
import { getDeviceToken } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const w = strings.child.weekly;

/** Severity → underline tint for the per-app strip (quiet apps stay cyan). */
const TINT: Record<WeeklyWorst, string> = {
  none: "#1CABE2",
  low: "#F59E0B",
  review: "#FF6B6B",
  high: "#FF3B30",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Your week (board 25): mascot comments on the real week, big quiet-days stat,
 * chunky day tiles, per-app strip, and a "talk to a parent" card that opens the
 * dialer with the parent's real number. Boards 45 empty states included.
 */
export function Weekly({ navigation }: NativeStackScreenProps<ChildStackParamList, "Weekly">) {
  useFocusedStatusBar("dark");
  const [week, setWeek] = useState<WeeklyResponse | null>(null);
  const [watched, setWatched] = useState<string[] | null>(null);
  const [parentPhone, setParentPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const token = await getDeviceToken();
    if (!token) return;
    const [me, wk] = await Promise.all([pairingApi.me(token), pairingApi.weekly(token)]);
    if (me.ok) {
      setWatched(me.data.monitoredApps);
      setParentPhone(me.data.parentPhone);
    }
    if (wk.ok) setWeek(wk.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apps = watched ? MONITORED_APPS.filter((a) => watched.includes(a.id)) : MONITORED_APPS;
  const noApps = watched !== null && watched.length === 0;
  const tiles = calendarWeek(week?.days, "long");
  const quiet = quietDayCount(tiles);
  const flaggedDays = flaggedDayCount(tiles);
  const worstDay = worstDayName(tiles);
  // First week: the device linked under 6 days ago — no fake data, dashed future.
  const daysSince = week ? Math.floor((Date.now() - new Date(week.since).getTime()) / DAY_MS) : 7;
  const firstWeek = !!week && daysSince < 6 && (week.total ?? 0) === 0;

  const bubble = !week
    ? w.bubbleQuiet
    : flaggedDays === 0
      ? w.bubbleQuiet
      : flaggedDays === 1 && worstDay
        ? w.bubbleFlagged(worstDay)
        : w.bubbleFlaggedMany;

  const onTalk = useCallback(() => {
    if (parentPhone) void Linking.openURL(`tel:${parentPhone}`);
  }, [parentPhone]);

  return (
    <Screen edges={["top", "left", "right"]}>
      <ArcWash intensity={0.12} />
      <View className="w-full max-w-[480px] flex-1 self-center">
        {/* Header (board 25): back chevron + 22/700 title. */}
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
            {w.title}
          </Text>
        </View>

        <ScrollView contentContainerClassName="px-2xl pb-2xl" showsVerticalScrollIndicator={false}>
          {!loaded ? (
            <View className="pt-xl">
              <View className="flex-row items-end gap-[10px]">
                <Skeleton width={86} height={86} radius={999} />
                <Skeleton width="100%" height={64} radius={16} style={{ flex: 1 }} />
              </View>
              <View className="items-center">
                <Skeleton width={150} height={52} radius={12} style={{ marginTop: 24 }} />
                <Skeleton width={100} height={16} radius={999} style={{ marginTop: 10 }} />
                <View className="flex-row gap-sm pt-xl">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} width={40} height={46} radius={12} />
                  ))}
                </View>
              </View>
            </View>
          ) : noApps ? (
            /* Board 45 "No apps watched": the mascot dims when it can't help. */
            <View className="items-center pt-3xl">
              <RiveMascot size={110} mood="dim" />
              <Text className="pt-md text-center text-[18px] font-bold leading-[22px] text-foreground">
                {w.noAppsTitle}
              </Text>
              <Text className="max-w-[300px] pt-[6px] text-center text-[13.5px] leading-5 text-muted-foreground">
                {w.noAppsBody}
              </Text>
              <ChunkyButton
                size="sm"
                label={w.noAppsButton}
                style={{ marginTop: 14 }}
                onPress={() => navigation.navigate("Settings")}
              />
            </View>
          ) : firstWeek ? (
            /* Board 45 "Weekly, first week": day one filled, the rest dashed. */
            <View className="items-center pt-3xl">
              <RiveMascot size={110} />
              <Text className="pt-md text-center text-[18px] font-bold leading-[22px] text-foreground">
                {w.firstWeekTitle}
              </Text>
              <Text className="max-w-[300px] pt-[6px] text-center text-[13.5px] leading-5 text-muted-foreground">
                {w.firstWeekBody}
              </Text>
              <View className="flex-row gap-[6px] pt-lg">
                {Array.from({ length: 7 }).map((_, i) => (
                  <View
                    key={i}
                    style={
                      i <= daysSince
                        ? {
                            width: 30,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: "#1CABE2",
                            borderBottomWidth: 3,
                            borderBottomColor: "#0E7FA8",
                          }
                        : {
                            width: 30,
                            height: 34,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderStyle: "dashed",
                            borderColor: "#E8ECF0",
                          }
                    }
                  />
                ))}
              </View>
            </View>
          ) : (
            <>
              {/* Mascot comment (86px + corner bubble). */}
              <View className="flex-row items-end gap-[10px] pt-xl">
                <RiveMascot size={86} />
                <SpeechBubble tail="corner" style={{ flex: 1, alignItems: "stretch" }}>
                  <Text className="text-[14.5px] font-semibold leading-[21px] text-foreground">
                    {bubble}
                  </Text>
                </SpeechBubble>
              </View>

              {/* Big stat: "5 / 7 quiet days". */}
              <View className="items-center pt-2xl">
                <Text
                  className="text-[56px] font-bold leading-[60px] text-[#8FA1AE]"
                  style={{ letterSpacing: -1.12 }}
                >
                  {quiet} / 7
                </Text>
                <Text className="pt-[2px] text-[16px] font-bold leading-5 text-foreground">
                  {w.quietDays}
                </Text>
              </View>

              {/* Day tiles (lg: 40x46, 3px bottom edge, labels below). */}
              <View className="items-center pt-xl">
                <DayRow
                  days={tiles.map((t) => t.state)}
                  labels={tiles.map((t) => t.label)}
                  size="lg"
                />
              </View>

              {/* Across your apps — watched set, underline tinted by worst moment. */}
              <Text
                className="pb-sm pt-[28px] text-[13px] font-semibold leading-4 text-muted-foreground"
                style={{ letterSpacing: 0.1 }}
              >
                {w.acrossApps}
              </Text>
              <View className="flex-row flex-wrap gap-sm">
                {apps.map((app) => (
                  <View key={app.id} className="items-center gap-[6px]">
                    <AppIcon app={app.id} size={42} />
                    <View
                      className="h-[3px] w-5 rounded-pill"
                      style={{ backgroundColor: TINT[week?.apps[app.id] ?? "none"] }}
                    />
                  </View>
                ))}
              </View>

              {/* Talk card (primary-50) — only when something actually came up. */}
              {flaggedDays > 0 ? (
                <View className="mt-2xl rounded-xl bg-primary-50 p-lg">
                  <Text className="text-[14px] font-bold leading-[18px] text-primary-700">
                    {worstDay && flaggedDays === 1 ? w.talkTitle(worstDay) : w.talkTitleGeneric}
                  </Text>
                  <Text className="pt-xs text-[13px] leading-[19px] text-foreground">{w.talkBody}</Text>
                  {parentPhone ? (
                    <ChunkyButton
                      size="sm"
                      label={w.talkButton}
                      style={{ marginTop: 12 }}
                      onPress={onTalk}
                    />
                  ) : (
                    <Text className="pt-md text-[13px] font-semibold leading-4 text-primary-700">
                      {w.noPhone}
                    </Text>
                  )}
                </View>
              ) : null}

              <Text className="px-sm pt-[18px] text-center text-[12.5px] leading-[18px] text-muted-foreground">
                {w.footer}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
