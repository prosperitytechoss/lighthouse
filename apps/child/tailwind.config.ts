import lighthousePreset from "@lighthouse/tokens/tailwind-preset";
import nativewindPreset from "nativewind/preset";
import type { Config } from "tailwindcss";

export default {
  content: [
    "./App.tsx",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [nativewindPreset, lighthousePreset],
} satisfies Config;
