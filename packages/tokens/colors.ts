/**
 * Lighthouse color tokens.
 *
 * Source of truth: lighthouse-demo-audit/03-design-system/colors.md, cross-checked
 * against 06-raw/computed-styles.json. Primary brand blue is the only hard-confirmed
 * interactive color (rgb(28,171,226) / #1CABE2). Category-chip tints are documented
 * as approximate in the audit — when building the Activity screen (Checkpoint 2),
 * verify each chip against getComputedStyle(); the live
 * site wins on any conflict.
 */

/** Primary brand blue — CTAs, active tab/toggle/segment, device cards, splash. */
import type { CategoryName } from "@lighthouse/types";

export const primary = {
  50: "#E8F7FC",
  100: "#C5EBF7",
  200: "#8FD9F0",
  300: "#56C6E9",
  400: "#33B8E3",
  /** LH.blue — the confirmed Lighthouse Blue (rgb 28,171,226). */
  DEFAULT: "#1CABE2",
  500: "#1CABE2",
  600: "#1690BF",
  /** LH.blueDeep — top of the device-card / hero gradient. */
  700: "#0E7FA8",
  800: "#0A5C7A",
  /** Deepest splash-flash shade. */
  900: "#0A4A6A",
} as const;

/** Exact LH palette extras used by the prototype (splash flash, gradients). */
export const brandBlue = {
  base: "#1CABE2",
  deep: "#0E7FA8",
  light: "#7DD3FC",
  darkest: "#0A4A6A",
} as const;

/** Neutral scale (audit "Neutrals / Grays" + shadcn light-mode custom props). */
export const neutral = {
  /** Page / card / modal background. */
  white: "#FFFFFF",
  /** LH.surface — muted section background. */
  50: "#F5F7FB",
  /** Border / input fill / divider — oklch(92.9% .013 255.508). */
  100: "#E8ECF0",
  200: "#D9DEE5",
  /** iOS system gray — subheadlines, captions, "Last seen". */
  400: "#8E8E93",
  /** Muted foreground — oklch(55.4% .046 257.417). */
  500: "#6B7080",
  600: "#525766",
  700: "#3C3C43",
  /** Body text / most headings — rgb(26,26,26). */
  900: "#1A1A1A",
  black: "#000000",
} as const;

/** Semantic colors. Success deliberately reuses primary blue — the demo has no green. */
export const semantic = {
  /** LH.safe — success reuses brand blue (no green in the demo). */
  success: "#1CABE2",
  safe: "#1CABE2",
  /** LH.warnText / LH.warnBg. */
  warning: "#F59E0B",
  warningBg: "#FFF3CD",
  /** LH.alertText / LH.alertBg — soft red for warning cards. */
  alert: "#FF6B6B",
  alertBg: "#FFE8E8",
  /** LH.severe — destructive / severe. */
  error: "#FF3B30",
  severe: "#FF3B30",
} as const;

/** Translucent helpers from the demo's computed styles. */
export const alpha = {
  /** Input border — rgba(60,60,67,0.12). */
  inputBorder: "rgba(60,60,67,0.12)",
  /** Bottom-sheet / modal scrim — rgba(0,0,0,0.35). */
  modalOverlay: "rgba(0,0,0,0.35)",
  /** Action buttons on blue device cards. */
  onPrimary: "rgba(255,255,255,0.18)",
} as const;

/** Category chip tints (bg + readable fg). APPROXIMATE — verify vs live demo. */
export const category: Record<CategoryName, { bg: string; fg: string }> = {
  Violence: { bg: "#FFE2DC", fg: "#C2382B" },
  "Sexual Content": { bg: "#FFE6D5", fg: "#C2632B" },
  "Self-Harm": { bg: "#FFE2DC", fg: "#C2382B" },
  "Eating Disorders": { bg: "#DCEEF7", fg: "#1C6E96" },
  "Substance Use": { bg: "#FFE8CC", fg: "#B5651D" },
  "Hate Speech": { bg: "#FFF0CC", fg: "#9A7B1A" },
  Gambling: { bg: "#E3EAF0", fg: "#4A5A6A" },
  "Graphic Content": { bg: "#FFE2DC", fg: "#C2382B" },
};

export const colors = { primary, neutral, semantic, alpha, category } as const;
