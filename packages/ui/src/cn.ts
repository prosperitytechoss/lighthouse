import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge doesn't know our custom token classes, so it would mis-group
 * them — e.g. treating the named font sizes `text-body` / `text-button` as text
 * COLORS (dropping the size and clobbering `text-foreground` vs
 * `text-primary-foreground`). Register our scale + DM Sans families so merges
 * are correct (this is why RNR's plain twMerge needed extending for our theme).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading-lg",
            "heading-md",
            "body",
            "body-sm",
            "button",
            "caption",
            "section-label",
            "metric",
          ],
        },
      ],
      "font-family": [{ font: ["sans", "regular", "medium", "semibold", "bold", "mono"] }],
    },
  },
});

/** Join + de-dupe Tailwind classes (RNR convention, extended for our tokens). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
