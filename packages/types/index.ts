/**
 * Shared domain types for Lighthouse. Names are verbatim from the Phase 0–2 brief —
 * they bind to later phases (backend, classifier, sync). Do not rename without a
 * coordinated migration.
 */

export type CategoryName =
  | "Violence"
  | "Sexual Content"
  | "Self-Harm"
  | "Eating Disorders"
  | "Substance Use"
  | "Hate Speech"
  | "Gambling"
  | "Graphic Content";

export type PersonTag = {
  id: string;
  name: string;
  age?: number;
  isShared?: boolean;
};

export type Device = {
  id: string;
  name: string;
  model: string;
  /** Last-reported battery % (via heartbeat). null = never reported. */
  batteryPct: number | null;
  /** Last-reported charging state. null = unknown/never reported. */
  batteryCharging?: boolean | null;
  usedBy: PersonTag[];
  lastSeenAt: string;
  signalsThisWeek: number;
  status: "active" | "paused" | "stale";
  /** Server-derived health: monitoring on, disabled (tamper), or not reporting. */
  health?: "active" | "monitoring_off" | "not_reporting";
  /** Parent-set per-app monitoring filter (MONITORED_APPS ids). Resolved = all 8 by default. */
  monitoredApps?: string[];
  /** Parent-set protective-overlay (real-time blocking) on/off. Default on. */
  overlayEnabled?: boolean;
};

export type Incident = {
  id: string;
  deviceId: string;
  sourcePackage: string;
  category: CategoryName;
  severity: "high" | "review" | "low";
  confidence: number;
  ts: string;
  flaggedText: string;
  classifierVersion: string;
};

export type Guardian = {
  id: string;
  email: string;
  displayName: string;
  role: "primary" | "co" | "view-only";
};

export type Geofence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  alertOnArrive: boolean;
  alertOnLeave: boolean;
};

export type NotificationCard = {
  id: string;
  type: "request" | "warning" | "toast";
  body: string;
  deviceId?: string;
  actions?: { label: string; variant: "primary" | "ghost" }[];
};

/**
 * The monitored-app registry — the SINGLE source of truth for which apps
 * Lighthouse watches. Every consumer derives from this list: the parent's
 * per-app toggles, the child signal producer, signal validation (allowed `app`
 * values), feed/card display + icons, and Stage B capture filtering. Add an app
 * here once and it propagates everywhere.
 */
export type MonitoredApp = {
  /** Canonical slug. The signal `app` value and the validation key. */
  id: string;
  /** UI label, e.g. "WhatsApp". */
  displayName: string;
  /** Android package name — REQUIRED for Stage B capture filtering. */
  androidPackage: string;
  /** Other packages that count as this app (Business, Lite, Go variants). */
  aliasPackages?: readonly string[];
  /** Brand accent color (UI). */
  brandColor: string;
  /** Whether monitoring is on by default for this app. */
  defaultEnabled: boolean;
};

export const MONITORED_APPS = [
  { id: "tiktok", displayName: "TikTok", androidPackage: "com.zhiliaoapp.musically", aliasPackages: ["com.zhiliaoapp.musically.go"], brandColor: "#111111", defaultEnabled: true },
  { id: "instagram", displayName: "Instagram", androidPackage: "com.instagram.android", aliasPackages: ["com.instagram.lite"], brandColor: "#E1306C", defaultEnabled: true },
  { id: "chrome", displayName: "Chrome", androidPackage: "com.android.chrome", brandColor: "#4285F4", defaultEnabled: true },
  { id: "snapchat", displayName: "Snapchat", androidPackage: "com.snapchat.android", brandColor: "#FFFC00", defaultEnabled: true },
  { id: "roblox", displayName: "Roblox", androidPackage: "com.roblox.client", brandColor: "#E2231A", defaultEnabled: true },
  { id: "whatsapp", displayName: "WhatsApp", androidPackage: "com.whatsapp", aliasPackages: ["com.whatsapp.w4b"], brandColor: "#25D366", defaultEnabled: true },
  { id: "x", displayName: "X", androidPackage: "com.twitter.android", brandColor: "#111111", defaultEnabled: false },
  { id: "facebook", displayName: "Facebook", androidPackage: "com.facebook.katana", aliasPackages: ["com.facebook.lite"], brandColor: "#1877F2", defaultEnabled: false },
  { id: "messages", displayName: "Messages", androidPackage: "com.google.android.apps.messaging", aliasPackages: ["com.samsung.android.messaging", "com.android.mms"], brandColor: "#1A73E8", defaultEnabled: true },
] as const satisfies readonly MonitoredApp[];

/** Canonical id union (e.g. "tiktok"), derived from the registry. */
export type MonitoredAppId = (typeof MONITORED_APPS)[number]["id"];

/** Runtime id list — for validation enums and iteration. */
export const MONITORED_APP_IDS = MONITORED_APPS.map((a) => a.id) as MonitoredAppId[];

const APP_BY_ID = new Map<string, MonitoredApp>(MONITORED_APPS.map((a) => [a.id, a]));

/** Look up an app by id. Case-insensitive, so legacy display-name values resolve too. */
export function appById(id: string): MonitoredApp | undefined {
  return APP_BY_ID.get(id.toLowerCase());
}

/** Every Android package name — the Stage B capture filter set. */
export function allAndroidPackages(): string[] {
  return MONITORED_APPS.map((a) => a.androidPackage);
}

const APP_BY_PACKAGE = new Map<string, MonitoredApp>(
  MONITORED_APPS.map((a) => [a.androidPackage, a]),
);

/** Look up an app by its Android package name (Stage B capture → registry id). */
export function appByPackage(pkg: string): MonitoredApp | undefined {
  return APP_BY_PACKAGE.get(pkg);
}

/** Display-name union, derived from the registry (used by the dummy-data layer). */
export type MonitoredPlatform = (typeof MONITORED_APPS)[number]["displayName"];

/** The three signal severities (matches Incident.severity). */
export const SEVERITY_NAMES = ["high", "review", "low"] as const;

export type SeverityName = (typeof SEVERITY_NAMES)[number];

/** The eight content categories, in demo order. */
export const CATEGORY_NAMES = [
  "Violence",
  "Sexual Content",
  "Self-Harm",
  "Eating Disorders",
  "Substance Use",
  "Hate Speech",
  "Gambling",
  "Graphic Content",
] as const satisfies readonly CategoryName[];
