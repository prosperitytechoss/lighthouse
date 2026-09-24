/**
 * Server-side lexicon constants. The DB-managed part is the category TERMS (what
 * admins grow). The context rules + ambiguous-term gate are classifier CONFIG —
 * they live in code on both the server and the device — so we merge them into
 * every published snapshot to keep the app's lexicon payload complete.
 *
 * Keep these in sync with apps/child/src/native/classify.ts's expectations.
 */

export const CATEGORIES = [
  "Violence",
  "Sexual Content",
  "Self-Harm",
  "Eating Disorders",
  "Substance Use",
  "Hate Speech",
  "Gambling",
  "Graphic Content",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["high", "review", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const LANGUAGES = ["en", "pidgin", "yoruba", "hausa", "igbo"] as const;
export type Language = (typeof LANGUAGES)[number];

/** DB language (full) → on-device app language code used in the lexicon payload. */
export const LANG_TO_APP: Record<Language, string> = {
  en: "en",
  pidgin: "pcm",
  yoruba: "yo",
  hausa: "ha",
  igbo: "ig",
};

/** Context rules config — merged verbatim into every snapshot. */
export const CONTEXT_DEFAULTS = {
  negators: ["no", "not", "never", "dont", "don't", "nor", "without", "cant", "cannot", "neither", "no dey", "nor dey"],
  negatorWindow: 3,
  sarcasmEmoji: ["😂", "🤣", "💀", "😭", "😅", "😹", "🙃"],
  sarcasmWords: ["lol", "lmao", "lmfao", "haha", "hehe", "jk", "just kidding", "abi"],
  drugContextTokens: ["buy", "get", "got", "sell", "selling", "smoke", "blaze", "light", "wrap", "wraps", "high", "stuff", "gimme", "supply", "score", "roll"],
};

export const AMBIGUOUS_DEFAULTS = {
  igbo: {
    category: "Substance Use",
    severity: "high",
    requires: "drugContext",
    note: "weed slang only when drug-context present; otherwise the language/ethnicity — do not flag",
  },
};

/** The exact JSON shape the on-device classifier consumes. */
export type LexiconPayload = {
  version: number;
  _meta: { status: string; publishedAt: string | null };
  context: typeof CONTEXT_DEFAULTS;
  ambiguousTerms: typeof AMBIGUOUS_DEFAULTS;
  categories: Record<string, Record<string, { high: string[]; review: string[]; low: string[] }>>;
};
