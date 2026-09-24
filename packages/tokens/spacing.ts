/**
 * Spacing scale — 4px base unit (Tailwind v4 default), from
 * lighthouse-demo-audit/03-design-system/spacing-and-layout.md.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export type SpacingToken = keyof typeof spacing;
