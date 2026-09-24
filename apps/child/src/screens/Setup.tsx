import { strings } from "@lighthouse/copy";
import {
  ArcWash,
  ChunkyButton,
  RiveMascot,
  Screen,
  Sheet,
  SpeechBubble,
  Text,
} from "@lighthouse/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Confetti } from "react-native-fast-confetti";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";

import { useFocusedStatusBar } from "../hooks/useFocusedStatusBar";
import { type DkmaGuide, fetchDkmaGuide } from "../native/dontkillmyapp";
import {
  type DeviceInfo,
  type NativeKind,
  getDeviceInfo,
  hasBackgroundLocation,
  hasFineLocation,
  isGranted,
  nativeBridgeReady,
  openAutostart,
  openSettings,
  requestBackgroundLocation,
  requestFineLocation,
  requestPostNotifications,
} from "../native/permissions";
import { setSetupDone } from "../native/session";
import type { ChildStackParamList } from "../navigation/RootNavigator";

const p = strings.child.permissions;
const ps = p.steps;

type Guided = {
  title: string;
  bubble: string;
  note: string;
  do: readonly string[];
  cta: string;
  search?: string;
};
type AutostartCopy = typeof ps.autostart;
type WizardStep =
  | ({ type: "grant"; native: NativeKind } & Guided)
  | ({ type: "location" } & Guided)
  | ({ type: "backgroundLocation" } & Guided)
  | ({ type: "autostart" } & AutostartCopy)
  | { type: "done" };

const STEPS: WizardStep[] = [
  { type: "grant", native: "notificationListener", ...ps.notifications },
  { type: "grant", native: "accessibility", ...ps.accessibility },
  { type: "grant", native: "usageAccess", ...ps.usage },
  { type: "location", ...ps.location },
  { type: "backgroundLocation", ...ps.backgroundLocation },
  { type: "grant", native: "overlay", ...ps.overlay },
  { type: "grant", native: "battery", ...ps.battery },
  { type: "autostart", ...ps.autostart },
  { type: "done" },
];

const NUMBERED = new Set(["grant", "location", "backgroundLocation", "autostart"]);
const TOTAL = STEPS.filter((s) => NUMBERED.has(s.type)).length;

/**
 * Sequential permission wizard, boards 27 + 31 to 35: segmented progress, the
 * mascot asks for each permission in a speech bubble, a surface privacy note
 * (carries the Play-required disclosures), numbered "Once settings open" rows,
 * chunky CTA + quiet text secondary. All real grant/verify logic retained.
 */
export function Setup({ navigation, route }: NativeStackScreenProps<ChildStackParamList, "Setup">) {
  useFocusedStatusBar("dark");
  // Deep-link from the child self-heal prompt: jump straight to the off permission.
  const focus = route.params?.focus;
  const focusIndex = focus
    ? STEPS.findIndex((s) => s.type === "grant" && s.native === focus)
    : -1;
  const [index, setIndex] = useState(focusIndex >= 0 ? focusIndex : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Explicit consent gate for the AccessibilityService (Google Play requires an
  // affirmative two-button choice before the permission is requested).
  const [consentOpen, setConsentOpen] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [dkma, setDkma] = useState<DkmaGuide>(null);
  const [dkmaLoading, setDkmaLoading] = useState(false);
  // This phone has no OEM autostart manager (Samsung, Pixel, …): nothing to set,
  // so we say so instead of dead-ending the parent in generic Settings.
  const [autostartMissing, setAutostartMissing] = useState(false);

  const step = STEPS[index]!;

  // Learn the OEM once, so the autostart step can pull device-specific steps.
  useEffect(() => {
    getDeviceInfo().then(setDevice);
  }, []);

  // On the autostart step, fetch DontKillMyApp guidance for this manufacturer.
  useEffect(() => {
    if (step.type !== "autostart" || !device?.manufacturer) return;
    let alive = true;
    setDkmaLoading(true);
    fetchDkmaGuide(device.manufacturer).then((g) => {
      if (!alive) return;
      setDkma(g);
      setDkmaLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [step.type, device]);
  const stepNo = STEPS.slice(0, index + 1).filter((s) => NUMBERED.has(s.type)).length;
  const numbered = NUMBERED.has(step.type);

  const advance = () => {
    setError(null);
    setBusy(false);
    setAutostartMissing(false);
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const verify = async (check: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await check();
    setBusy(false);
    if (ok) advance();
    else setError(p.notYetError);
  };

  // Open the system settings page for a "grant" permission.
  const openGrant = async (native: NativeKind) => {
    setError(null);
    if (!nativeBridgeReady) return setError(p.bridgeMissing);
    if (native === "notificationListener") await requestPostNotifications();
    const exact = await openSettings(native);
    if (!exact) setError(p.openFallback(("search" in step && step.search) || p.appLabel));
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <ArcWash intensity={0.1} />
      <View className="w-full max-w-[480px] flex-1 self-center px-2xl">
        {/* Segmented progress (boards 27/31/32/33): filled cyan up to here. */}
        {numbered ? (
          <View className="flex-row items-center gap-[6px] pt-sm">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View
                key={i}
                className={`h-2 flex-1 rounded-pill ${i < stepNo ? "bg-primary" : "bg-hairline"}`}
              />
            ))}
          </View>
        ) : null}

        {step.type === "done" ? (
          <DoneStep
            onDone={async () => {
              await setSetupDone();
              navigation.replace("Home");
            }}
          />
        ) : (
          <>
            <ScrollView
              className="flex-1"
              contentContainerClassName="grow pb-lg"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View key={index} entering={FadeIn.duration(300)}>
                {/* Mascot asks (86px + corner bubble). */}
                <View className="flex-row items-end gap-[10px] pt-2xl">
                  <RiveMascot size={86} />
                  <SpeechBubble tail="corner" style={{ flex: 1, alignItems: "stretch" }}>
                    <Text className="text-[14.5px] font-semibold leading-[21px] text-foreground">
                      {step.bubble}
                    </Text>
                  </SpeechBubble>
                </View>

                {/* Privacy note / prominent disclosure (surface card). */}
                {step.type !== "autostart" ? (
                  <NoteCard text={step.note} />
                ) : autostartMissing ? (
                  <NoteCard text={step.noManager} />
                ) : null}

                {/* Once settings open */}
                <Text className="pb-sm pt-xl text-[13px] font-semibold leading-4 text-muted-foreground">
                  {p.howLabel}
                </Text>
                {step.type === "autostart" ? (
                  <AutostartBody
                    step={step}
                    dkma={dkma}
                    loading={dkmaLoading}
                    missing={autostartMissing}
                  />
                ) : (
                  <StepRows rows={step.do} />
                )}

                {error ? (
                  <Text className="pt-lg text-[13px] leading-[18px] text-destructive">{error}</Text>
                ) : null}
              </Animated.View>
            </ScrollView>

            {/* Actions (pinned): chunky CTA + quiet text secondary. */}
            <View className="gap-[10px] pb-md pt-sm">
              {step.type === "grant" ? (
                <>
                  <ChunkyButton
                    label={step.cta}
                    onPress={() => {
                      setError(null);
                      // Accessibility requires an explicit consent gate first; every
                      // other permission goes straight to its settings page.
                      if (step.native === "accessibility") {
                        setConsentOpen(true);
                        return;
                      }
                      openGrant(step.native);
                    }}
                  />
                  <TextAction label={p.granted} busy={busy} onPress={() => verify(() => isGranted(step.native))} />
                </>
              ) : step.type === "location" ? (
                <>
                  <ChunkyButton
                    label={step.cta}
                    onPress={async () => {
                      setError(null);
                      await requestFineLocation();
                    }}
                  />
                  <TextAction label={p.granted} busy={busy} onPress={() => verify(hasFineLocation)} />
                </>
              ) : step.type === "backgroundLocation" ? (
                <>
                  <ChunkyButton
                    label={step.cta}
                    onPress={async () => {
                      setError(null);
                      // Try the runtime request; on Android 11+ it can't grant "all the
                      // time" directly, so fall back to the Location settings page.
                      const granted = await requestBackgroundLocation();
                      if (!granted) {
                        if (!nativeBridgeReady) return setError(p.bridgeMissing);
                        openSettings("backgroundLocation");
                      }
                    }}
                  />
                  <TextAction label={p.granted} busy={busy} onPress={() => verify(hasBackgroundLocation)} />
                </>
              ) : autostartMissing ? (
                <>
                  <ChunkyButton label={ps.autostart.noManagerCta} onPress={advance} />
                  <TextAction
                    label={ps.autostart.openAnyway}
                    onPress={() => {
                      if (!nativeBridgeReady) return setError(p.bridgeMissing);
                      openSettings("battery");
                    }}
                  />
                </>
              ) : (
                <>
                  <ChunkyButton
                    label={ps.autostart.cta}
                    onPress={async () => {
                      setError(null);
                      if (!nativeBridgeReady) return setError(p.bridgeMissing);
                      // Try the OEM autostart manager. If none exists on this phone,
                      // don't dead-end in generic Settings — say there's nothing to
                      // set and offer Continue instead.
                      const opened = await openAutostart();
                      if (!opened) setAutostartMissing(true);
                    }}
                  />
                  <TextAction label={p.playProtectDone} onPress={advance} />
                </>
              )}
            </View>
          </>
        )}
      </View>

      <ConsentDialog
        visible={consentOpen}
        onAccept={() => {
          setConsentOpen(false);
          openGrant("accessibility");
        }}
        onDecline={() => setConsentOpen(false)}
      />
    </Screen>
  );
}

/** Quiet text-only secondary action ("I've turned it on"). */
function TextAction({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="items-center rounded-xl pb-[11px] pt-[13px] active:opacity-60"
    >
      {busy ? (
        <ActivityIndicator size="small" color="#1CABE2" />
      ) : (
        <Text className="text-[15px] font-bold leading-[18px] text-muted-foreground">{label}</Text>
      )}
    </Pressable>
  );
}

/** Surface privacy note (boards 27/31/32/33: radius 16, 16/18 padding, 13/19 ink). */
function NoteCard({ text }: { text: string }) {
  return (
    <View className="mt-xl rounded-xl bg-surface px-[18px] py-lg">
      <Text className="text-[13px] leading-[19px] text-foreground">{text}</Text>
    </View>
  );
}

/** Numbered rows on a white radius-16 card, hairline separators. */
function StepRows({ rows }: { rows: readonly string[] }) {
  return (
    <View className="overflow-hidden rounded-xl bg-white">
      {rows.map((line, i) => (
        <View
          key={line}
          className={`flex-row items-center gap-md px-lg py-[13px] ${i > 0 ? "border-t border-hairline" : ""}`}
        >
          <View className="h-6 w-6 items-center justify-center rounded-pill bg-primary-50">
            <Text className="text-[12px] font-bold leading-4 text-primary">{i + 1}</Text>
          </View>
          <Text className="flex-1 text-[14px] leading-5 text-foreground">{line}</Text>
        </View>
      ))}
    </View>
  );
}

/** Autostart step body: our short steps, plus collapsible DontKillMyApp detail. */
function AutostartBody({
  step,
  dkma,
  loading,
  missing,
}: {
  step: AutostartCopy;
  dkma: DkmaGuide;
  loading: boolean;
  missing: boolean;
}) {
  const [showExact, setShowExact] = useState(false);
  if (missing) return <StepRows rows={step.noManagerSteps} />;
  return (
    <>
      <StepRows rows={step.fallback} />

      {loading ? (
        <View className="flex-row items-center gap-sm pt-lg">
          <ActivityIndicator size="small" color="#1CABE2" />
          <Text className="text-[13px] leading-[18px] text-muted-foreground">{step.dkmaLoading}</Text>
        </View>
      ) : dkma ? (
        <View className="mt-lg overflow-hidden rounded-xl border border-hairline bg-white">
          <Pressable
            onPress={() => setShowExact((v) => !v)}
            accessibilityRole="button"
            className="flex-row items-center justify-between p-md active:bg-neutral-50"
          >
            <Text className="flex-1 text-[13px] font-semibold leading-[18px] text-foreground">
              {step.dkmaLabel(dkma.name)}
            </Text>
            {showExact ? (
              <ChevronDown size={18} color="#94A3B8" />
            ) : (
              <ChevronRight size={18} color="#94A3B8" />
            )}
          </Pressable>
          {showExact ? (
            <View className="gap-sm px-md pb-md">
              {dkma.steps.map((line, i) => (
                <View key={line} className="flex-row items-start gap-md">
                  <View className="h-6 w-6 items-center justify-center rounded-pill bg-primary-50">
                    <Text className="text-[12px] font-bold leading-4 text-primary">{i + 1}</Text>
                  </View>
                  <Text className="flex-1 text-[14px] leading-5 text-foreground">{line}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/**
 * Explicit consent dialog for the AccessibilityService (Google Play User Data
 * policy). Two distinct choices; backdrop/back = decline, never consent.
 */
function ConsentDialog({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const c = ps.accessibility.consent;
  // Rendered through the app Portal (Sheet), NOT React Native's <Modal>: on
  // Android a <Modal> opens a separate window where NativeWind styles crash.
  return (
    <Sheet visible={visible} onClose={onDecline}>
      <View className="items-center">
        <RiveMascot size={90} animate={false} />
      </View>
      <Text className="pt-md text-center text-[19px] font-bold leading-[26px] text-foreground">
        {c.title}
      </Text>
      <Text className="pt-sm text-[14px] leading-5 text-muted-foreground">{c.body}</Text>
      <ChunkyButton style={{ marginTop: 20 }} label={c.accept} onPress={onAccept} />
      <TextAction label={c.decline} onPress={onDecline} />
    </Sheet>
  );
}

/** Wizard 6 (board 35): bubble + big mascot + confetti + one chunky CTA. */
function DoneStep({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotion();
  const fired = useRef(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (reducedMotion || fired.current) return;
    fired.current = true;
    setConfetti(true);
  }, [reducedMotion]);

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <SpeechBubble text={p.allSet.bubble} />
        <RiveMascot size={170} />
        <Animated.View entering={FadeInDown.duration(350)} className="items-center">
          <Text
            className="pt-xl text-center text-[28px] font-bold leading-[34px] text-foreground"
            style={{ letterSpacing: -0.5 }}
          >
            {p.allSet.headline}
          </Text>
          <Text className="max-w-[300px] pt-sm text-center text-[15px] leading-[23px] text-muted-foreground">
            {p.allSet.body}
          </Text>
        </Animated.View>
      </View>
      <View className="pb-md">
        <ChunkyButton label={p.allSet.button} onPress={onDone} />
      </View>
      {confetti ? (
        <Confetti
          count={120}
          autoStartDelay={250}
          infinite={false}
          reduceMotion="system"
          colors={["#1CABE2", "#0E7FA8", "#FFD44D", "#E8F7FC"]}
          onAnimationEnd={() => setConfetti(false)}
        />
      ) : null}
    </View>
  );
}
