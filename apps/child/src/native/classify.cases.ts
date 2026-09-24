import type { CategoryName, SeverityName } from "@lighthouse/types";

import { classify } from "./classify";

/**
 * Classifier test cases — also the SEED for Track 2's eval harness.
 *
 * Each case is captured-style text with the expected stub output (or null for
 * benign text). When the real Tier 1 model replaces classify(), this set grows
 * into the labeled eval set; the runner below becomes its regression gate.
 */
export type ClassifierCase = {
  text: string;
  expect: { category: CategoryName; severity: SeverityName } | null;
};

export const CLASSIFIER_CASES: ClassifierCase[] = [
  // One per category at a representative severity.
  { text: "honestly I want to kill myself tonight", expect: { category: "Self-Harm", severity: "high" } },
  { text: "looking for thinspo, gonna skip meals today", expect: { category: "Eating Disorders", severity: "review" } },
  { text: "send nudes rn", expect: { category: "Sexual Content", severity: "high" } },
  { text: "nude - Google Search", expect: { category: "Sexual Content", severity: "high" } },
  { text: "i will hurt you, i have a gun", expect: { category: "Violence", severity: "high" } },
  { text: "there was a dead body in the clip", expect: { category: "Graphic Content", severity: "review" } },
  { text: "let's get high after school", expect: { category: "Substance Use", severity: "review" } },
  { text: "you people are subhuman", expect: { category: "Hate Speech", severity: "review" } },
  { text: "just bought a lottery ticket", expect: { category: "Gambling", severity: "low" } },

  // Severity precedence: high beats the low keyword in the same text.
  { text: "i'm so depressed and i want to die", expect: { category: "Self-Harm", severity: "high" } },
  // B3-rules precision fix: bare "diet" no longer flags as Eating Disorders (dieting
  // isn't an ED per taxonomy), so only "lottery" remains → now Gambling/low.
  { text: "new diet plus a lottery habit", expect: { category: "Gambling", severity: "low" } },

  // Word-boundary hardening: a keyword that is only a SUBSTRING must NOT fire.
  { text: "we've begun studying for exams", expect: null }, // 'gun' ⊄ 'begun'
  { text: "this method works really well", expect: null }, // 'meth' ⊄ 'method'
  { text: "i love popcorn at the cinema", expect: null }, // 'porn' ⊄ 'popcorn'
  { text: "the team from Scunthorpe won", expect: null }, // classic substring trap
  // ...but the real word, on a boundary, still matches.
  { text: "he brought a gun to school", expect: { category: "Violence", severity: "high" } },

  // Benign / sub-threshold → null.
  { text: "let's meet for lunch tomorrow", expect: null },
  { text: "great game last night, well played", expect: null },
  { text: "happy birthday! see you at the party", expect: null },
  { text: "", expect: null },
];

export type HarnessResult = {
  passed: number;
  failed: number;
  failures: { text: string; expected: unknown; got: unknown }[];
};

/** Run all cases through classify() and report pass/fail. */
export function runClassifierHarness(): HarnessResult {
  const failures: HarnessResult["failures"] = [];
  for (const c of CLASSIFIER_CASES) {
    const got = classify(c.text);
    const ok = JSON.stringify(got) === JSON.stringify(c.expect);
    if (!ok) failures.push({ text: c.text, expected: c.expect, got });
  }
  return { passed: CLASSIFIER_CASES.length - failures.length, failed: failures.length, failures };
}
