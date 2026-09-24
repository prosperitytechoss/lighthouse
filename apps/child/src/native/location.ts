import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { BASE_URL } from "../api/client";

import { getDeviceToken } from "./session";

/**
 * Location capture (Location part A).
 *
 * Mirrors the signal pipeline's privacy posture: coordinates are POSTed to the
 * encrypted /locations endpoint and never stored in plaintext server-side. The
 * parent map (part B) and geofencing are out of scope here — this only captures
 * and sends.
 *
 * Background updates run under expo-location's own foreground service, so fixes
 * keep arriving when the app is backgrounded or swiped away (same resilience
 * goal as the native monitor service). Updates are THROTTLED — at most one fix
 * per interval or per N metres of movement — to protect battery and avoid a
 * dense movement trail.
 *
 * The TaskManager task is DEFINED at module load (this file is imported for its
 * side-effect from RootNavigator) so Android can invoke it headlessly after a
 * process restart.
 */

export const LH_LOCATION_TASK = "lighthouse-location-task";

// Throttle. Tighter in dev so on-device verification doesn't wait 15 min.
const TIME_INTERVAL_MS = __DEV__ ? 30_000 : 15 * 60 * 1000;
const DISTANCE_M = __DEV__ ? 0 : 100;

type Point = { lat: number; lng: number; accuracy?: number; capturedAt: string };

/** POST a batch of points to the encrypted endpoint. Best-effort; drops on failure. */
async function uploadLocations(points: Point[]): Promise<void> {
  if (points.length === 0) return;
  const token = await getDeviceToken();
  if (!token) return; // not paired — nothing to report against
  const res = await fetch(`${BASE_URL}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ locations: points }),
  });
  if (__DEV__) {
    console.log(`[LH location] POST /locations x${points.length} <- ${res.status}`);
  }
}

function toPoint(l: Location.LocationObject): Point {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracy: l.coords.accuracy ?? undefined,
    capturedAt: new Date(l.timestamp).toISOString(),
  };
}

// Headless background task — receives batched fixes from the OS.
TaskManager.defineTask(LH_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.log("[LH location] task error:", error.message);
    return;
  }
  const locs = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locs?.length) return;
  try {
    await uploadLocations(locs.map(toPoint));
  } catch {
    // Best-effort: a dropped batch is fine, the next fix retries naturally.
  }
});

/**
 * Start throttled background location updates — but ONLY if both foreground and
 * background ("all the time") location are granted. Background can only be
 * granted from Settings on Android 11+, so until the wizard's disclosure step is
 * completed this is a no-op (no silent capture without consent).
 */
export async function startLocationUpdates(): Promise<void> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return;
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") return;

    // Seed an immediate foreground fix so the parent sees a point without waiting
    // for the first throttled background update.
    try {
      const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await uploadLocations([toPoint(now)]);
    } catch {
      // ignore — the periodic updates will catch up
    }

    if (await Location.hasStartedLocationUpdatesAsync(LH_LOCATION_TASK)) return;
    await Location.startLocationUpdatesAsync(LH_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_M,
      deferredUpdatesInterval: TIME_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: "Lighthouse is on",
        notificationBody: "Sharing this phone's location with your parent.",
        notificationColor: "#1CABE2",
      },
    });
    if (__DEV__) console.log("[LH location] background updates started");
  } catch (e) {
    if (__DEV__) console.log("[LH location] start failed:", e instanceof Error ? e.message : e);
  }
}

/** Stop background updates (on unpair / monitoring off). */
export async function stopLocationUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LH_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LH_LOCATION_TASK);
    }
  } catch {
    // ignore
  }
}
