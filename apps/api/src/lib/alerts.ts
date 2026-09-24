/**
 * Maps a parent's alert threshold to the severities that trigger a push.
 *   severe   → high only            (default)
 *   moderate → high + review
 *   all      → high + review + low
 */
export type AlertThreshold = "severe" | "moderate" | "all";

export const ALERT_THRESHOLDS: readonly AlertThreshold[] = ["severe", "moderate", "all"];

export function isAlertThreshold(v: string): v is AlertThreshold {
  return (ALERT_THRESHOLDS as readonly string[]).includes(v);
}

export function thresholdSeverities(threshold: string): string[] {
  switch (threshold) {
    case "all":
      return ["high", "review", "low"];
    case "moderate":
      return ["high", "review"];
    case "severe":
    default:
      return ["high"];
  }
}
