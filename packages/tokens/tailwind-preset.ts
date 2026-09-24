/**
 * Tailwind preset consumed by both apps' tailwind.config.ts.
 *
 * NativeWind v4 targets Tailwind CSS v3.4 config shape. Each app does:
 *   presets: [require("nativewind/preset"), require("@lighthouse/tokens/tailwind-preset")]
 * and sets its own `content` globs.
 */
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

import { primary, neutral, semantic, category } from "./colors";
import { radii } from "./radii";
import { spacing } from "./spacing";
import { fontFamily, textStyles } from "./typography";

const KEBAB: Record<string, string> = {
  Violence: "violence",
  "Sexual Content": "sexual-content",
  "Self-Harm": "self-harm",
  "Eating Disorders": "eating-disorders",
  "Substance Use": "substance-use",
  "Hate Speech": "hate-speech",
  Gambling: "gambling",
  "Graphic Content": "graphic-content",
};

// category-<name> => { bg, fg } -> bg-category-violence / text-category-violence-fg
const categoryColors = Object.fromEntries(
  Object.entries(category).map(([name, { bg, fg }]) => [
    KEBAB[name],
    { DEFAULT: bg, fg },
  ]),
);

// textStyles -> fontSize entries: ["26px", { lineHeight, letterSpacing }]
const fontSize = Object.fromEntries(
  Object.entries(textStyles).map(([role, s]) => [
    role,
    [
      `${s.fontSize}px`,
      {
        lineHeight: `${s.lineHeight}px`,
        ...("letterSpacing" in s && s.letterSpacing
          ? { letterSpacing: `${s.letterSpacing}px` }
          : {}),
      },
    ],
  ]),
) as Config["theme"];

const preset: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Brand primary scale kept (bg-primary-600 etc.); DEFAULT + foreground come
        // from the RNR --primary var (also our cyan) so RNR + brand classes agree.
        primary: {
          ...primary,
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        neutral,
        // Brand-only semantics (no RNR equivalent) — kept as direct token values.
        success: semantic.success,
        safe: semantic.safe,
        warning: { DEFAULT: semantic.warning, bg: semantic.warningBg },
        alert: { DEFAULT: semantic.alert, bg: semantic.alertBg },
        error: semantic.error,
        severe: semantic.severe,
        category: categoryColors,
        surface: neutral[50],
        hairline: neutral[100],
        // RNR semantic colors → our tokens via CSS variables (light mode only).
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: [fontFamily.regular],
        regular: [fontFamily.regular],
        medium: [fontFamily.medium],
        semibold: [fontFamily.semibold],
        bold: [fontFamily.bold],
        mono: [fontFamily.mono],
      },
      fontSize: fontSize as never,
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      borderRadius: Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, `${v}px`])),
    },
  },
  plugins: [tailwindcssAnimate],
};

export default preset;
