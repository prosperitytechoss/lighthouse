/**
 * Corner-radius scale. Root radius is 10px (--radius: .625rem); buttons 14px;
 * cards 12–16px; bottom sheets ~20px. From the audit + computed-styles.json.
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  "2xl": 20,
  pill: 9999,
} as const;

export type RadiusToken = keyof typeof radii;
