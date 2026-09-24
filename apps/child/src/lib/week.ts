import type { WeeklyWorst } from "../api/client";

export type WeekTileState = "check" | "warn" | "future";
export type WeekTile = { state: WeekTileState; label: string; severity: WeeklyWorst | null };

const SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const LONG = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const RANK: Record<WeeklyWorst, number> = { none: 0, low: 1, review: 2, high: 3 };

/**
 * Map the API's trailing-7-days array (days[6] = today) onto the boards'
 * calendar week (Mon..Sun, future days dashed). Quiet day = "none" → check;
 * anything flagged → warn "!"; days after today → future.
 */
export function calendarWeek(
  days: readonly WeeklyWorst[] | undefined,
  labels: "short" | "long" = "short",
  today: Date = new Date(),
): WeekTile[] {
  const names = labels === "short" ? SHORT : LONG;
  const todayPos = (today.getDay() + 6) % 7; // 0 = Monday
  return names.map((label, i) => {
    const delta = i - todayPos;
    if (delta > 0 || !days) return { state: "future", label, severity: null };
    const idx = 6 + delta;
    const severity = days[idx] ?? "none";
    return { state: severity === "none" ? "check" : "warn", label, severity };
  });
}

/** Count of quiet ("none") days among the elapsed days of the calendar week. */
export function quietDayCount(tiles: readonly WeekTile[]): number {
  return tiles.filter((t) => t.state === "check").length;
}

/** Full name of the loudest day so far this week ("Thursday"), or null if quiet. */
export function worstDayName(tiles: readonly WeekTile[]): string | null {
  let best: { rank: number; i: number } | null = null;
  tiles.forEach((t, i) => {
    if (!t.severity || t.severity === "none") return;
    const rank = RANK[t.severity];
    if (!best || rank > best.rank) best = { rank, i };
  });
  return best ? FULL[(best as { i: number }).i]! : null;
}

/** Count of flagged (non quiet, non future) days. */
export function flaggedDayCount(tiles: readonly WeekTile[]): number {
  return tiles.filter((t) => t.state === "warn").length;
}
