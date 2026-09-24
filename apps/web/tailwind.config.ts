/**
 * Web-specific Tailwind config built on @lighthouse/tokens.
 *
 * The shared tailwind-preset targets NativeWind (RN font names, RNR hsl vars),
 * so the web app pulls the raw token values directly instead: brand color
 * scale, neutrals, and the radius scale. Fonts are the web equivalents of the
 * token families (DM Sans + IBM Plex Mono, loaded via Google Fonts in
 * index.html).
 */
import { neutral, primary, radii } from "@lighthouse/tokens";
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary, // bg-primary (#1CABE2), text-primary-700 (#0E7FA8), bg-primary-50 …
        ink: neutral[900], // #1A1A1A
        muted: neutral[500], // #6B7080
        surface: neutral[50], // #F5F7FB
        hairline: neutral[100], // #E8ECF0
        lantern: "#FFD44D",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: Object.fromEntries(
        Object.entries(radii).map(([k, v]) => [k, `${v}px`]),
      ),
    },
  },
  plugins: [],
};

export default config;
