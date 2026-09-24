import type { CategoryName, SeverityName } from "@lighthouse/types";

import lexiconData from "./lexicon.json";
import type { TextModel } from "./textmodel";

/**
 * Tier 1 classifier — RULES-BASED (B3-rules). Brain swap over the old keyword
 * stub; the classify() CONTRACT is unchanged: text → { category, severity } | null.
 *
 * Three upgrades over the stub:
 *   1. Token-boundary matching (not substring) with light de-obfuscation
 *      (l33t like p0rn→porn, emoji/punctuation as separators). Whole-word only,
 *      so "popcorn"⊅porn, "method"⊅meth, "begun"⊅gun.
 *   2. Curated multilingual lexicons (en / Nigerian Pidgin / Yoruba / Hausa /
 *      Igbo × our 8 categories) in ./lexicon.json — a STARTER data file, editable
 *      without touching this logic. THIS is what catches "I don stake my school
 *      fees for sporty" — via the lexicon, not comprehension.
 *   3. A few light context rules (negation, sarcasm/idiom, ambiguous-term gating)
 *      to stop crying wolf. Rules are a scalpel, not a model — kept small.
 *
 * Portability: matching is manual tokenisation + phrase containment (no
 * lookbehind, no JS-only regex) so it ports 1:1 to Kotlin. The Kotlin port
 * (LighthouseClassifier.kt) is the FOLLOW-UP — not done here.
 *
 * Privacy: runs on-device. Only the returned {category, severity} ever leaves
 * the phone — never the input text.
 */

export type Classification = { category: CategoryName; severity: SeverityName; tier?: "lexicon" | "model" };

export const MODEL_THRESHOLD = 0.9;
let TEXT_MODEL: TextModel | null = null;

export function setTextModel(model: TextModel | null): void {
  TEXT_MODEL = model;
}

function modelFallback(text: string): Classification | null {
  const p = TEXT_MODEL?.predict(text);
  if (!p || p.confidence < MODEL_THRESHOLD) return null;
  const severity = (p.severity === "high" ? "review" : p.severity) as SeverityName;
  return { category: p.category as CategoryName, severity, tier: "model" };
}

const SEVERITY_RANK: Record<SeverityName, number> = { low: 1, review: 2, high: 3 };
// Tie-break at equal severity: earlier = higher priority (mirrors registry risk).
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

// ---- lexicon compilation (swappable: bundled default → server-synced) -------

type LexContext = {
  negators: string[];
  negatorWindow: number;
  sarcasmEmoji: string[];
  sarcasmWords: string[];
  drugContextTokens: string[];
};
type Lex = {
  version?: number;
  context: LexContext;
  ambiguousTerms: Record<string, { category: CategoryName; severity: SeverityName; requires: string }>;
  categories: Record<string, Record<string, Record<string, string[]>>>;
};

type Term = { tokens: string[]; category: CategoryName; severity: SeverityName; soft: boolean };
type Compiled = {
  version: number;
  terms: Term[];
  negators: Set<string>;
  drugCtx: Set<string>;
  context: LexContext;
  ambiguous: Lex["ambiguousTerms"];
};

// "soft" self-harm terms are downgradable by the sarcasm rule.
const SOFT_SELFHARM = new Set(["kill me", "dey kill me", "go kill me", "killing me"]);

/** Compile a lexicon into fast lookup structures. Pure — safe to call on each sync. */
function compile(lex: Lex): Compiled {
  const terms: Term[] = [];
  for (const category of CATEGORY_ORDER) {
    const byLang = lex.categories?.[category];
    if (!byLang) continue;
    for (const lang of Object.keys(byLang)) {
      const perLang = byLang[lang];
      if (!perLang) continue;
      for (const severity of ["high", "review", "low"] as SeverityName[]) {
        for (const phrase of perLang[severity] ?? []) {
          const tokens = tokenize(phrase);
          if (tokens.length === 0) continue;
          terms.push({
            tokens,
            category,
            severity,
            soft: category === "Self-Harm" && SOFT_SELFHARM.has(tokens.join(" ")),
          });
        }
      }
    }
  }
  const ctx = lex.context;
  return {
    version: lex.version ?? 0,
    terms,
    negators: new Set((ctx.negators ?? []).flatMap((n) => tokenize(n))),
    drugCtx: new Set(ctx.drugContextTokens ?? []),
    context: ctx,
    ambiguous: lex.ambiguousTerms ?? {},
  };
}

// Active lexicon: bundled by default (fresh install / offline), replaced by a
// newer server snapshot once the child syncs. classify()'s contract is unchanged.
const BUNDLED = lexiconData as unknown as Lex;
let COMPILED: Compiled = compile(BUNDLED);

/** Swap in a lexicon fetched from Lexicon Admin. Only the word lists move. */
export function setActiveLexicon(lex: Lex): void {
  COMPILED = compile(lex);
}
/** Version of the currently-active lexicon (0 = bundled default). */
export function activeLexiconVersion(): number {
  return COMPILED.version;
}

// ---- normalisation ---------------------------------------------------------

const L33T: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

function deL33t(s: string): string {
  let out = "";
  for (const ch of s) out += L33T[ch] ?? ch;
  return out;
}

/**
 * Split into lowercase word tokens on any non-(letter|digit). Unicode-aware so
 * Yoruba/Hausa/Igbo letters survive; emoji & punctuation act as separators.
 * `\p{L}\p{N}` + `u` flag ports to Kotlin/Java regex directly.
 */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/** First index where `needle` tokens appear contiguously in `hay`, else -1. */
function seqIndex(hay: string[], needle: string[]): number {
  if (needle.length === 0) return -1;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/** Is there a negator within `window` tokens BEFORE index `start`? */
function negatedBefore(tokens: string[], start: number): boolean {
  const from = Math.max(0, start - COMPILED.context.negatorWindow);
  for (let i = from; i < start; i++) if (COMPILED.negators.has(tokens[i]!)) return true;
  return false;
}

// ---- classify --------------------------------------------------------------

export function classify(text: string): Classification | null {
  if (!text) return null;

  const rawTokens = tokenize(text);
  if (rawTokens.length === 0) return null;
  const l33tTokens = tokenize(deL33t(text));
  const l33tHay = ` ${l33tTokens.join(" ")} `;

  type Match = { category: CategoryName; severity: SeverityName; soft: boolean };
  const matches: Match[] = [];

  for (const term of COMPILED.terms) {
    // Primary match on raw tokens (keeps digits so "bet9ja"/"1xbet" survive).
    const idx = seqIndex(rawTokens, term.tokens);
    if (idx >= 0) {
      // Rule: NEGATION — "not into sports betting", "I no dey watch porn" → skip.
      if (negatedBefore(rawTokens, idx)) continue;
      matches.push({ category: term.category, severity: term.severity, soft: term.soft });
      continue;
    }
    // Secondary match on de-l33ted text (catches p0rn/pr0n). No index → no
    // negation check (obfuscation + negation together is not worth the cost).
    if (l33tHay.includes(` ${term.tokens.join(" ")} `)) {
      matches.push({ category: term.category, severity: term.severity, soft: term.soft });
    }
  }

  // Rule: AMBIGUOUS-TERM GATING — "igbo" is weed slang only with drug-context
  // tokens present; otherwise it's the language/ethnicity and must NOT flag.
  for (const [word, spec] of Object.entries(COMPILED.ambiguous)) {
    if (rawTokens.includes(word) && rawTokens.some((t) => COMPILED.drugCtx.has(t))) {
      matches.push({ category: spec.category, severity: spec.severity, soft: false });
    }
  }

  // Rule: SARCASM / IDIOM — drop "soft" self-harm idiom hits ("dey kill me") when a
  // laughing emoji or lol/haha co-occurs; it's banter, not distress.
  const pool = hasSarcasm(text) ? matches.filter((m) => !m.soft) : matches;
  if (pool.length === 0) return modelFallback(text);

  // Strongest wins: higher severity, then earlier category order on a tie.
  let best: Match = pool[0]!;
  for (const m of pool) {
    if (
      SEVERITY_RANK[m.severity] > SEVERITY_RANK[best.severity] ||
      (SEVERITY_RANK[m.severity] === SEVERITY_RANK[best.severity] &&
        CATEGORY_ORDER.indexOf(m.category) < CATEGORY_ORDER.indexOf(best.category))
    ) {
      best = m;
    }
  }
  return { category: best.category, severity: best.severity, tier: "lexicon" };
}

function hasSarcasm(text: string): boolean {
  const lower = text.toLowerCase();
  if (COMPILED.context.sarcasmEmoji.some((e) => text.includes(e))) return true;
  const toks = new Set(tokenize(lower));
  return COMPILED.context.sarcasmWords.some((w) => {
    const wt = tokenize(w);
    return wt.length === 1 ? toks.has(wt[0]!) : lower.includes(w);
  });
}

/**
 * BLOCK decision — unchanged. Brain-agnostic, rides on classify()'s output.
 * Blocks when severity meets the parent threshold: severe→high, moderate→
 * high+review, all→everything. null never blocks. (Mirrors Kotlin shouldBlock.)
 */
export function shouldBlock(
  result: Classification | null,
  threshold: "severe" | "moderate" | "all" = "severe",
): boolean {
  if (!result) return false;
  const minRank = threshold === "all" ? 1 : threshold === "moderate" ? 2 : 3;
  return SEVERITY_RANK[result.severity] >= minRank;
}
