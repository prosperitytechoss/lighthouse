/**
 * Elevation tokens — soft, layered shadows for the Apple-calm reskin.
 *
 * The prototype leaned on 1px hairline borders and read flat. These give cards a
 * gentle lift. Shadow color tints toward deep brand blue (#0E2A3A), never neutral
 * black — black shadows look muddy on the warm-white canvas. Apply via
 * `style={shadows.e1}`; Android uses `elevation`, iOS the shadow* props.
 *
 *   e1  resting card / list surface
 *   e2  raised, interactive, or hero (device card, status hero)
 *   e3  sheets, modals, popovers
 */
import type { ViewStyle } from "react-native";

const SHADOW_TINT = "#0E2A3A";

export const shadows = {
  e1: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  e2: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  e3: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  /** Cyan-tinted lift for the gradient hero / device card — glows in-brand. */
  hero: {
    shadowColor: "#0E7FA8",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

export type ElevationToken = keyof typeof shadows;
