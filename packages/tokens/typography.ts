/**
 * Lighthouse typography tokens — DM Sans across all weights.
 * Source: lighthouse-demo-audit/03-design-system/typography.md + computed-styles.json.
 *
 * Font family strings match the names exported by @expo-google-fonts/dm-sans,
 * which is how the fonts are registered at runtime (see each app's font loading).
 */

export const fontFamily = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  /** IBM Plex Mono — used for numerals/codes (signal counts, pairing code). */
  mono: "IBMPlexMono_500Medium",
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** Numeric weight kept for reference; RN renders weight via the named font file. */
  fontWeight: string;
  letterSpacing?: number;
  textTransform?: "uppercase";
};

/**
 * Named roles from the brief: display, heading-lg, heading-md, body, body-sm,
 * button, caption, section-label. `metric` is added for the large signal counts.
 */
export const textStyles = {
  /** H1 splash headline — 26/700/32. */
  display: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, fontWeight: "700" },
  /** Section heading ("What Lighthouse does") — 22/700/30. */
  "heading-lg": { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 30, fontWeight: "700" },
  /** Card title (device / app name) — 18/700/24. */
  "heading-md": { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  /** Body / list title — 15/400/22. (Use the semibold font for emphasized list titles.) */
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, fontWeight: "400" },
  /** Secondary body / small print — 13/400/18. */
  "body-sm": { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, fontWeight: "400" },
  /** Button label — 16/600/20. */
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  /** Metadata / timestamp — 13/400. */
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, fontWeight: "400" },
  /** Sentence-case section label, 13/600. No auto-uppercasing. */
  "section-label": {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  /** Large signal count / percentage — 30/700. */
  metric: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 34, fontWeight: "700" },
} as const satisfies Record<string, TypeStyle>;

export type TextVariant = keyof typeof textStyles;

export const typography = { fontFamily, fontWeight, textStyles } as const;
