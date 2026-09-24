import { strings } from "@lighthouse/copy";
import { useToast } from "@lighthouse/ui";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { pairingApi } from "../api/client";
import {
  setBlockingEnabled,
  setBlockThreshold,
  setMonitoredApps,
  startCapture,
  stopCapture,
} from "../native/capture";
import { initLexicon, refreshLexicon } from "../native/lexiconStorage";
import { startLocationUpdates, stopLocationUpdates } from "../native/location";
import { clearDeviceToken, getDeviceToken, getSetupDone } from "../native/session";
import { ActiveBadge } from "../screens/ActiveBadge";
import { ChildHome } from "../screens/ChildHome";
import { ChildSettings } from "../screens/ChildSettings";
import { Linked } from "../screens/Linked";
import { Overlay } from "../screens/Overlay";
import { ParentContact } from "../screens/ParentContact";
import { ReportBug } from "../screens/ReportBug";
import { Setup } from "../screens/Setup";
import { Splash } from "../screens/Splash";
import { Transparency } from "../screens/Transparency";
import { Weekly } from "../screens/Weekly";

export type ChildStackParamList = {
  Onboarding: undefined;
  ParentContact: undefined;
  Linked: { emailSent?: boolean; needsConfirmation?: boolean } | undefined;
  Setup: { focus?: "accessibility" | "notificationListener" } | undefined;
  Home: undefined;
  Settings: undefined;
  Weekly: undefined;
  Transparency: undefined;
  ReportBug: undefined;
  ActiveBadge: undefined;
  Overlay: undefined;
};

const Stack = createNativeStackNavigator<ChildStackParamList>();

// Where a fresh boot lands. "setup" = paired but the permission wizard wasn't
// finished (Android restarts the app mid-wizard on accessibility/overlay grants).
type BootState = "loading" | "onboarding" | "setup" | "home";

export function RootNavigator() {
  const toast = useToast();
  const navigationRef = useNavigationContainerRef<ChildStackParamList>();
  const [state, setState] = useState<BootState>("loading");

  // Drop to unpaired: clear the token, warn, and reset to the welcome/scanner.
  const handleUnlinked = useCallback(async () => {
    await clearDeviceToken();
    toast.error(strings.child.scan.unlinked);
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: "Onboarding" }] });
    }
    setState("onboarding");
  }, [toast, navigationRef]);

  // Boot gate: the device token in secure-store is the source of truth for
  // "paired". We render OPTIMISTICALLY — a present token goes straight into the
  // app (resuming Setup if the wizard never finished), so an OS-initiated restart
  // mid-wizard or a slow/offline network never dumps a linked device back to
  // onboarding. The server check runs in the background; only a confirmed 401
  // (revoked/unlinked) sends us back.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getDeviceToken();
      if (!token) {
        if (alive) setState("onboarding");
        return;
      }
      const done = await getSetupDone();
      if (alive) setState(done ? "home" : "setup");
      // Lexicon Admin sync: load the on-device cache into the classifier, then
      // check the server for a newer published version. Never blocks the UI.
      void initLexicon().then(() => refreshLexicon());
      const res = await pairingApi.me(token);
      if (alive && res.status === 401) await handleUnlinked();
      // Sync the parent's per-app monitoring choice + overlay gate to native.
      if (alive && res.ok) {
        setMonitoredApps(res.data.monitoredApps);
        setBlockingEnabled(res.data.overlayEnabled);
        setBlockThreshold(res.data.alertThreshold);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleUnlinked]);

  // Runtime revalidation: a parent can unpair (or delete the account) while the
  // child is open. Re-check on a timer and whenever the app returns to the
  // foreground; a 401 means we were unlinked → drop to the scanner.
  useEffect(() => {
    if (state === "loading" || state === "onboarding") return;
    let cancelled = false;
    const check = async () => {
      const token = await getDeviceToken();
      if (!token) return;
      const res = await pairingApi.me(token);
      if (!cancelled && res.status === 401) await handleUnlinked();
      // Also poll for a newer lexicon on the same cadence + on foreground.
      void refreshLexicon();
    };
    const interval = setInterval(check, 30_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [state, handleUnlinked]);

  // Stage B capture (Track 1): run the native-buffer drain→classify→enqueue loop
  // while paired. No-ops without the native bridge (Expo Go / old build).
  useEffect(() => {
    if (state === "loading" || state === "onboarding") return;
    void startCapture();
    // Location part A: starts only if fg + bg location are both granted (no-op
    // until the wizard's background-location disclosure step is completed).
    void startLocationUpdates();
    return () => {
      stopCapture();
      void stopLocationUpdates();
    };
  }, [state]);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#1CABE2" />
      </View>
    );
  }

  const initialRouteName = state === "home" ? "Home" : state === "setup" ? "Setup" : "Onboarding";

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen name="Onboarding" component={Splash} />
        <Stack.Screen name="ParentContact" component={ParentContact} options={{ animation: "fade" }} />
        <Stack.Screen name="Linked" component={Linked} />
        <Stack.Screen name="Setup" component={Setup} />
        <Stack.Screen name="Home" component={ChildHome} />
        <Stack.Screen name="Settings" component={ChildSettings} />
        <Stack.Screen name="Weekly" component={Weekly} />
        <Stack.Screen name="Transparency" component={Transparency} />
        <Stack.Screen name="ReportBug" component={ReportBug} />
        {/* System-overlay states (shown by the foreground service in production) */}
        <Stack.Screen name="ActiveBadge" component={ActiveBadge} options={{ animation: "fade" }} />
        <Stack.Screen name="Overlay" component={Overlay} options={{ animation: "fade" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
