import { NativeModules } from "react-native";

import { BASE_URL } from "../api/client";

import { getDeviceToken } from "./session";

/**
 * Capture bootstrap (Stage B).
 *
 * The whole background loop — capture → classify → POST /signals — now lives in a
 * native foreground service (LighthouseMonitorService), so it keeps running while
 * the child app is backgrounded or swiped away (Android pauses JS timers; native
 * doesn't). JS's only job here is to hand native the config it can't read (the
 * device token + API base URL) and to start/stop the service.
 *
 * There is intentionally NO JS drain/classify/upload loop anymore — a single
 * native send path means a captured item can't be classified+sent twice.
 */

type MonitorBridge = {
  setBackgroundConfig?: (token: string, baseUrl: string) => void;
  startMonitoring?: () => void;
  stopMonitoring?: () => void;
  /** Per-app capture filter: only these MONITORED_APPS ids are captured. */
  setMonitoredApps?: (ids: string[]) => void;
  /** Protective-overlay gate: when false, high-severity hits flag but don't block. */
  setBlockingEnabled?: (enabled: boolean) => void;
  /** Severity threshold that decides which hits block: severe|moderate|all. */
  setBlockThreshold?: (threshold: string) => void;
  setVisionEnabled?: (enabled: boolean) => void;
  visionStatus?: () => Promise<VisionStatus>;
};

export type VisionStatus = {
  supported: boolean;
  running: boolean;
  enabled: boolean;
  tier: "fast" | "mid" | "slow";
  intervalMs: number;
  ocrReady: boolean;
  imageReady: boolean;
  framesChecked: number;
  framesSkipped: number;
  textHits: number;
  imageHits: number;
  lastFrameAt: number;
  lastOcrMs: number;
  lastImageMs: number;
  lastTotalMs: number;
};

const LH = NativeModules.LighthouseNative as MonitorBridge | undefined;

/**
 * Push the parent's per-app monitoring choice to the native capture filter.
 * Persisted natively (survives a JS-less restart); the filter then only captures
 * enabled apps. No-op without the native bridge (Expo Go / old build).
 */
export function setMonitoredApps(ids: string[]): void {
  LH?.setMonitoredApps?.(ids);
}

/** Push the parent's protective-overlay (blocking) on/off to the native gate. */
export function setBlockingEnabled(enabled: boolean): void {
  LH?.setBlockingEnabled?.(enabled);
}

/** Push the severity threshold that decides which hits block (severe|moderate|all). */
export function setBlockThreshold(threshold: string): void {
  LH?.setBlockThreshold?.(threshold);
}

export function setVisionEnabled(enabled: boolean): void {
  LH?.setVisionEnabled?.(enabled);
}

export async function getVisionStatus(): Promise<VisionStatus | null> {
  if (!LH?.visionStatus) return null;
  try {
    return await LH.visionStatus();
  } catch {
    return null;
  }
}

/** Push config to native and start the always-on monitor service. */
export async function startCapture(): Promise<void> {
  if (!LH?.startMonitoring) return; // no native bridge (Expo Go / old build)
  const token = await getDeviceToken();
  if (!token) return; // not paired — nothing to send against
  LH.setBackgroundConfig?.(token, BASE_URL);
  LH.startMonitoring();
}

/** Stop the service and clear persisted config (on unpair). */
export function stopCapture(): void {
  LH?.stopMonitoring?.();
}
