import { MONITORED_APPS, type MonitoredPlatform } from "@lighthouse/types";

/**
 * Android package names for the monitored platforms — DERIVED from the central
 * registry (MONITORED_APPS), so there is no duplicate list to keep in sync.
 */
export const PLATFORM_PACKAGE = Object.fromEntries(
  MONITORED_APPS.map((a) => [a.displayName, a.androidPackage]),
) as Record<MonitoredPlatform, string>;
