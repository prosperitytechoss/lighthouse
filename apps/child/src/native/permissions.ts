import * as Location from "expo-location";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";

/** Grants the native bridge can check + the extra settings pages it can open. */
export type NativeKind =
  | "notificationListener"
  | "accessibility"
  | "usageAccess"
  | "overlay"
  | "battery"
  | "backgroundLocation";
export type SettingsTarget = NativeKind | "appInfo" | "location" | "settings";

export type DeviceInfo = { manufacturer: string; brand: string; model: string };

type Bridge = {
  isGranted(kind: NativeKind): Promise<boolean>;
  openSettings(kind: SettingsTarget): Promise<boolean> | void;
  openAutostart(): Promise<boolean>;
  deviceInfo(): Promise<DeviceInfo>;
};

const LH = NativeModules.LighthouseNative as Bridge | undefined;

/** True when the compiled app actually ships the native permissions bridge. */
export const nativeBridgeReady = !!LH;

/** Real on-device check for a special grant (notification listener, etc.). */
export async function isGranted(kind: NativeKind): Promise<boolean> {
  if (!LH) return false;
  try {
    return !!(await LH.isGranted(kind));
  } catch {
    return false;
  }
}

/** Deep-link to the exact system settings page for a target. */
export async function openSettings(kind: SettingsTarget): Promise<boolean> {
  if (!LH) return false;
  try {
    const r = await LH.openSettings(kind);
    return r === undefined ? true : !!r;
  } catch {
    return false;
  }
}

/**
 * Open the OEM autostart / auto-launch manager (Xiaomi, Oppo, Vivo, etc.) so the
 * parent can whitelist the app from background-killing. Returns true if a manager
 * actually opened; false on OEMs with no known intent (e.g. Transsion) — callers
 * then fall back to Settings search + DontKillMyApp steps.
 */
export async function openAutostart(): Promise<boolean> {
  if (!LH) return false;
  try {
    return !!(await LH.openAutostart());
  } catch {
    return false;
  }
}

/** Build.MANUFACTURER / BRAND / MODEL, for choosing OEM-specific guidance. */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const empty = { manufacturer: "", brand: "", model: "" };
  if (!LH) return empty;
  try {
    return (await LH.deviceInfo()) ?? empty;
  } catch {
    return empty;
  }
}

/** Runtime FINE location prompt (returns whether it ended up granted). */
export async function requestFineLocation(): Promise<boolean> {
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasFineLocation(): Promise<boolean> {
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
}

/**
 * Background ("Allow all the time") location — required for Location part A so the
 * parent can see the child even when the app is closed. Android 11+ only grants
 * this from Settings (never the one-tap runtime prompt), so the wizard pairs this
 * request with a deep-link to the app's Location settings page. Foreground
 * location must already be granted first (enforced by step order + the OS).
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  try {
    const r = await Location.requestBackgroundPermissionsAsync();
    return r.status === "granted";
  } catch {
    return false;
  }
}

export async function hasBackgroundLocation(): Promise<boolean> {
  try {
    const r = await Location.getBackgroundPermissionsAsync();
    return r.status === "granted";
  } catch {
    return false;
  }
}

/** Best-effort POST_NOTIFICATIONS runtime prompt (Android 13+). */
export async function requestPostNotifications(): Promise<void> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    try {
      await PermissionsAndroid.request(
        "android.permission.POST_NOTIFICATIONS" as Parameters<typeof PermissionsAndroid.request>[0],
      );
    } catch {
      // ignore — not required to proceed
    }
  }
}
