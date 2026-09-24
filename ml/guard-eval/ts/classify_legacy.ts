import type { CategoryName, SeverityName } from "@lighthouse/types";

/**
 * Tier 1 classifier — STUB (B3-stub).
 *
 * A dumb, hand-written keyword/rules lookup: text → { category, severity } | null.
 * It exists to prove the REAL capture pipeline (notification + accessibility) end
 * to end on a Tecno BEFORE the real model exists — exactly how synthetic signals
 * proved Stage A. It is deliberately crude: it proves plumbing, not accuracy.
 *
 * Track 2 (the real Tier 1 model + a Nigerian/Kenyan English, pidgin,
 * code-switching labeled dataset) drops into THIS function's signature later;
 * nothing downstream changes.
 *
 * Privacy: this runs on-device. Only the returned {category, severity} ever
 * leaves the phone — never the input text.
 */

export type Classification = { category: CategoryName; severity: SeverityName };

// Per category, keywords grouped by the severity they imply. `high` is checked
// first, then `review`, then `low`. Lowercased, matched on word-ish boundaries.
type Lexicon = Record<CategoryName, Record<SeverityName, string[]>>;

const LEXICON: Lexicon = {
  "Self-Harm": {
    high: ["kill myself", "end my life", "suicide", "want to die", "cut myself", "self harm"],
    review: ["hurt myself", "self-harm", "hopeless", "worthless", "no reason to live"],
    low: ["depressed", "i hate myself", "give up"],
  },
  "Eating Disorders": {
    high: ["pro ana", "pro mia", "starve myself", "purge after"],
    review: ["thinspo", "skip meals", "feel fat", "calorie restrict"],
    low: ["diet", "lose weight", "too fat"],
  },
  "Sexual Content": {
    high: ["send nudes", "nudes", "nude", "naked", "explicit", "porn", "nsfw"],
    review: ["sext", "hook up", "dtf"],
    low: ["sexy", "hot pics"],
  },
  Violence: {
    high: ["kill you", "shoot up", "i will hurt", "beat you up", "gun"],
    review: ["fight after school", "jump him", "threat"],
    low: ["punch", "angry", "hate you"],
  },
  "Graphic Content": {
    high: ["gore", "beheading", "graphic death"],
    review: ["blood everywhere", "dead body"],
    low: ["disturbing", "graphic"],
  },
  "Substance Use": {
    high: ["buy weed", "selling drugs", "cocaine", "meth"],
    review: ["get high", "vape pen", "molly"],
    low: ["drunk", "beer", "smoke"],
  },
  "Hate Speech": {
    high: ["go back to your country", "racial slur", "kill all"],
    review: ["you people", "slur", "subhuman"],
    low: ["stupid race", "hate group"],
  },
  Gambling: {
    high: ["bet your savings", "casino deposit", "place a bet"],
    review: ["sports betting", "odds", "parlay"],
    low: ["lottery", "scratch card"],
  },
};

// Severity precedence — higher wins when multiple categories/keywords match.
const SEVERITY_RANK: Record<SeverityName, number> = { low: 1, review: 2, high: 3 };
// Category order to break ties (earlier = higher priority; mirrors registry risk).
const CATEGORY_ORDER: CategoryName[] = [
  "Self-Harm",
  "Eating Disorders",
  "Sexual Content",
  "Violence",
  "Graphic Content",
  "Substance Use",
  "Hate Speech",
  "Gambling",
];

/**
 * Compile each keyword/phrase to a WORD-BOUNDARY regex (case-insensitive). This
 * is the stub's internal accuracy fix: `\b` stops substrings from false-firing —
 * "gun" no longer matches "begun", "meth" not "method", "porn" not "popcorn".
 * Compiled once at module load (the lexicon is small). The classify() CONTRACT is
 * unchanged — same signature, same { category, severity } | null return shape.
 */
function wordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}
const COMPILED = Object.fromEntries(
  CATEGORY_ORDER.map((cat) => [
    cat,
    {
      high: LEXICON[cat].high.map(wordRegex),
      review: LEXICON[cat].review.map(wordRegex),
      low: LEXICON[cat].low.map(wordRegex),
    },
  ]),
) as Record<CategoryName, Record<SeverityName, RegExp[]>>;

/**
 * Classify a piece of captured text. Returns the single strongest match, or null
 * if nothing in the lexicon hit (benign / sub-threshold). Matching is word-boundary
 * (not substring), so benign words that merely contain a keyword don't fire.
 */
export function classify(text: string): Classification | null {
  if (!text) return null;

  let best: Classification | null = null;
  for (const category of CATEGORY_ORDER) {
    const tiers = COMPILED[category];
    let sev: SeverityName | null = null;
    if (tiers.high.some((re) => re.test(text))) sev = "high";
    else if (tiers.review.some((re) => re.test(text))) sev = "review";
    else if (tiers.low.some((re) => re.test(text))) sev = "low";
    if (!sev) continue;

    if (
      !best ||
      SEVERITY_RANK[sev] > SEVERITY_RANK[best.severity] ||
      (SEVERITY_RANK[sev] === SEVERITY_RANK[best.severity] &&
        CATEGORY_ORDER.indexOf(category) < CATEGORY_ORDER.indexOf(best.category))
    ) {
      best = { category, severity: sev };
    }
  }
  return best;
}

/**
 * BLOCK decision — brain-agnostic, rides on classify()'s output (no hardcoded
 * keywords here). Blocks when the result's severity meets the parent's threshold:
 * severe→high only, moderate→high+review, all→everything. null never blocks. The
 * threshold mirrors the alert threshold, so ONE control drives alerts + blocking.
 * Default "severe" preserves the original high-only behavior. (Mirror of the
 * Kotlin LighthouseClassifier.shouldBlock.)
 */
export function shouldBlock(
  result: Classification | null,
  threshold: "severe" | "moderate" | "all" = "severe",
): boolean {
  if (!result) return false;
  const minRank = threshold === "all" ? 1 : threshold === "moderate" ? 2 : 3;
  return SEVERITY_RANK[result.severity] >= minRank;
}
