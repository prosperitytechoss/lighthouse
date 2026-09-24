import type { CategoryName, MonitoredPlatform } from "@lighthouse/types";

/** Per-app row in "Top apps this week". `flagged` is the severe/review slice. */
export type AppUsageRow = {
  platform: MonitoredPlatform;
  signals: number;
  flagged: number;
};

export type CategoryCount = { category: CategoryName; count: number; trend: "up" | "down" | "flat" };

export type ActivityReport = {
  deviceId: string;
  normalPct: number;
  severeCount: number;
  platformsWithSignals: number;
  topApps: AppUsageRow[];
  categories: CategoryCount[];
  /** Five points: Wk1..Wk4 + Now. */
  trend: number[];
};

const allCategories = (counts: Partial<Record<CategoryName, number>>): CategoryCount[] =>
  (
    [
      "Violence",
      "Sexual Content",
      "Self-Harm",
      "Eating Disorders",
      "Substance Use",
      "Hate Speech",
      "Gambling",
      "Graphic Content",
    ] as CategoryName[]
  ).map((category) => ({
    category,
    count: counts[category] ?? 0,
    trend: (counts[category] ?? 0) > 2 ? "up" : (counts[category] ?? 0) > 0 ? "flat" : "down",
  }));

export const activityByDevice: Record<string, ActivityReport> = {
  "device-family-ipad": {
    deviceId: "device-family-ipad",
    normalPct: 92,
    severeCount: 2,
    platformsWithSignals: 3,
    topApps: [
      { platform: "Roblox", signals: 31, flagged: 1 },
      { platform: "TikTok", signals: 23, flagged: 4 },
      { platform: "Chrome", signals: 14, flagged: 2 },
      { platform: "Instagram", signals: 9, flagged: 1 },
      { platform: "WhatsApp", signals: 6, flagged: 0 },
    ],
    categories: allCategories({
      "Graphic Content": 5,
      "Self-Harm": 3,
      "Sexual Content": 4,
      Violence: 2,
      "Substance Use": 2,
      "Hate Speech": 1,
      Gambling: 1,
    }),
    trend: [12, 16, 14, 20, 18],
  },
  "device-tobi-phone": {
    deviceId: "device-tobi-phone",
    normalPct: 95,
    severeCount: 0,
    platformsWithSignals: 3,
    topApps: [
      { platform: "TikTok", signals: 18, flagged: 1 },
      { platform: "WhatsApp", signals: 11, flagged: 1 },
      { platform: "Instagram", signals: 7, flagged: 1 },
      { platform: "Chrome", signals: 4, flagged: 0 },
      { platform: "X", signals: 2, flagged: 0 },
    ],
    categories: allCategories({
      "Hate Speech": 1,
      Violence: 1,
      "Substance Use": 1,
    }),
    trend: [8, 10, 9, 13, 12],
  },
  "device-amara-chromebook": {
    deviceId: "device-amara-chromebook",
    normalPct: 98,
    severeCount: 0,
    platformsWithSignals: 2,
    topApps: [
      { platform: "Roblox", signals: 9, flagged: 0 },
      { platform: "Instagram", signals: 3, flagged: 1 },
      { platform: "Chrome", signals: 2, flagged: 0 },
    ],
    categories: allCategories({ Gambling: 1, "Eating Disorders": 1 }),
    trend: [3, 5, 4, 6, 4],
  },
};
