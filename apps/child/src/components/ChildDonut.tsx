import Svg, { Circle } from "react-native-svg";

/** Severity → slice color (matches the legend: all good / rough / heads up / check in). */
const COLOR = {
  none: "#1CABE2",
  low: "#F59E0B",
  review: "#FF6B6B",
  high: "#FF3B30",
} as const;

export type DonutDay = keyof typeof COLOR;

/**
 * Week-at-a-glance donut: seven equal slices, one per day, each colored by that
 * day's worst severity. No data (or a fully quiet week) renders all-cyan —
 * which is the honest default, not a fabrication.
 */
export function ChildDonut({ size = 64, days }: { size?: number; days?: DonutDay[] }) {
  const slices: DonutDay[] = days?.length === 7 ? days : Array.from({ length: 7 }, () => "none");
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const len = circumference / 7;
  const gap = 2.5; // small notch between days so the ring reads as seven days

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={10} />
      {slices.map((day, i) => (
        <Circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={COLOR[day]}
          strokeWidth={10}
          strokeDasharray={`${len - gap} ${circumference - len + gap}`}
          strokeDashoffset={-(i * len)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </Svg>
  );
}
