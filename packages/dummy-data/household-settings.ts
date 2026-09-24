import { type CategoryName, MONITORED_APPS, type MonitoredPlatform } from "@lighthouse/types";

export type SeverityThreshold = "Mild" | "Moderate" | "Severe Only";

export type HouseholdSettings = {
  overlayEnabled: boolean;
  severityThreshold: SeverityThreshold;
  perPlatform: Record<MonitoredPlatform, boolean>;
  /** Which of the 8 canonical risk categories are watched. Single source of
   *  truth for the Activity screen — only ENABLED categories are shown there. */
  contentFilters: Record<CategoryName, boolean>;
};

// Per-platform defaults DERIVED from the central registry (no duplicate list).
const perPlatformDefaults = Object.fromEntries(
  MONITORED_APPS.map((a) => [a.displayName, a.defaultEnabled]),
) as Record<MonitoredPlatform, boolean>;

export const householdSettings: HouseholdSettings = {
  overlayEnabled: true,
  severityThreshold: "Moderate",
  perPlatform: perPlatformDefaults,
  contentFilters: {
    Violence: true,
    "Sexual Content": true,
    "Self-Harm": true,
    "Eating Disorders": true,
    "Substance Use": true,
    "Hate Speech": true,
    Gambling: true,
    "Graphic Content": true,
  },
};
