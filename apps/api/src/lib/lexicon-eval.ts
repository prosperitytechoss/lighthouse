import testset from "../data/eval-testset.json";

import { CATEGORIES, type LexiconPayload } from "./lexicon-defaults";

/**
 * Eval of the CURRENT live lexicon against the canonical hand-labelled test set,
 * so an admin can see whether their edits improved detection.
 *
 * ⚠️ MIRROR: the matching core below is a faithful port of the on-device
 * classifier (apps/child/src/native/classify.ts). It is duplicated here only so
 * the server can score without importing the RN app. Parity is checkable: on the
 * seeded lexicon these numbers match ts/score_rules.ts's "NEW" row (98/0/100/…).
 * If classify.ts's ALGORITHM changes, update this too. (Follow-up: extract the
 * core into a shared package so there's one copy.)
 */
type Sev = "high" | "review" | "low";
const RANK: Record<Sev, number> = { low: 1, review: 2, high: 3 };
const ORDER = ["Self-Harm", "Eating Disorders", "Sexual Content", "Violence", "Graphic Content", "Substance Use", "Hate Speech", "Gambling"];
const SOFT = new Set(["kill me", "dey kill me", "go kill me", "killing me"]);
const L33T: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

const tokenize = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const deL33t = (s: string) => [...s].map((c) => L33T[c] ?? c).join("");
function seqIndex(hay: string[], needle: string[]): number {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

function classifyWith(lex: LexiconPayload, text: string): { category: string; severity: Sev } | null {
  if (!text) return null;
  const terms: { toks: string[]; cat: string; sev: Sev; soft: boolean }[] = [];
  for (const cat of ORDER) {
    const byLang = lex.categories?.[cat];
    if (!byLang) continue;
    for (const lang of Object.keys(byLang)) {
      for (const sev of ["high", "review", "low"] as Sev[]) {
        for (const phrase of byLang[lang]?.[sev] ?? []) {
          const toks = tokenize(phrase);
          if (toks.length) terms.push({ toks, cat, sev, soft: cat === "Self-Harm" && SOFT.has(toks.join(" ")) });
        }
      }
    }
  }
  const ctx = lex.context;
  const negators = new Set((ctx?.negators ?? []).flatMap(tokenize));
  const drugCtx = new Set(ctx?.drugContextTokens ?? []);
  const raw = tokenize(text);
  if (!raw.length) return null;
  const l33tHay = ` ${tokenize(deL33t(text)).join(" ")} `;

  type M = { cat: string; sev: Sev; soft: boolean };
  const matches: M[] = [];
  const negatedBefore = (start: number) => {
    const from = Math.max(0, start - (ctx?.negatorWindow ?? 3));
    for (let i = from; i < start; i++) if (negators.has(raw[i]!)) return true;
    return false;
  };
  for (const t of terms) {
    const idx = seqIndex(raw, t.toks);
    if (idx >= 0) { if (!negatedBefore(idx)) matches.push({ cat: t.cat, sev: t.sev, soft: t.soft }); continue; }
    if (l33tHay.includes(` ${t.toks.join(" ")} `)) matches.push({ cat: t.cat, sev: t.sev, soft: t.soft });
  }
  for (const [word, spec] of Object.entries(lex.ambiguousTerms ?? {})) {
    if (raw.includes(word) && raw.some((x) => drugCtx.has(x))) matches.push({ cat: spec.category, sev: spec.severity as Sev, soft: false });
  }
  const lower = text.toLowerCase();
  const sarcasm =
    (ctx?.sarcasmEmoji ?? []).some((e) => text.includes(e)) ||
    (ctx?.sarcasmWords ?? []).some((w) => { const wt = tokenize(w); return wt.length === 1 ? new Set(tokenize(lower)).has(wt[0]!) : lower.includes(w); });
  const pool = sarcasm ? matches.filter((m) => !m.soft) : matches;
  if (!pool.length) return null;
  let best = pool[0]!;
  for (const m of pool) {
    if (RANK[m.sev] > RANK[best.sev] || (RANK[m.sev] === RANK[best.sev] && ORDER.indexOf(m.cat) < ORDER.indexOf(best.cat))) best = m;
  }
  return { category: best.cat, severity: best.sev };
}

type Row = { id: number; text: string; category: string | null; severity: string | null; lang: string; kind: string };

/** Score `lex` against the canonical set; returns the same metrics as the harness. */
export function evalLexicon(lex: LexiconPayload) {
  const items = testset as Row[];
  const catMatch = (exp: string | null, pred: string | null) => (exp === null ? pred === null : pred === exp);
  const preds = items.map((i) => ({ i, p: classifyWith(lex, i.text) }));
  const pos = preds.filter((x) => x.i.category !== null);
  const safe = preds.filter((x) => x.i.category === null);
  const hard = preds.filter((x) => x.i.kind === "hard_negative");
  const cs = pos.filter((x) => x.i.lang !== "en");
  const frac = (a: typeof preds, ok: (x: (typeof preds)[number]) => boolean) => (a.length ? a.filter(ok).length / a.length : 0);
  const round = (n: number) => Math.round(n * 100);
  return {
    version: lex.version,
    total: items.length,
    accuracy: round(frac(preds, (x) => catMatch(x.i.category, x.p?.category ?? null))),
    safeFalsePositiveRate: round(frac(safe, (x) => x.p !== null)),
    hardNegativePassRate: round(frac(hard, (x) => x.p === null)),
    categoryAccuracy: round(frac(pos, (x) => catMatch(x.i.category, x.p?.category ?? null))),
    codeswitchDetection: round(frac(cs, (x) => x.p !== null)),
    categories: CATEGORIES.length,
  };
}

type DatasetRow = { text: string; category: string | null; kind: string };

/** Score `lex` against approved eval-split dataset examples. Null when there are none. */
export function evalDataset(lex: LexiconPayload, rows: DatasetRow[]) {
  if (!rows.length) return null;
  const catMatch = (exp: string | null, pred: string | null) => (exp === null ? pred === null : pred === exp);
  const preds = rows.map((i) => ({ i, p: classifyWith(lex, i.text) }));
  const pos = preds.filter((x) => x.i.category !== null);
  const safe = preds.filter((x) => x.i.category === null);
  const frac = (a: typeof preds, ok: (x: (typeof preds)[number]) => boolean) => (a.length ? a.filter(ok).length / a.length : 0);
  const round = (n: number) => Math.round(n * 100);
  return {
    total: rows.length,
    accuracy: round(frac(preds, (x) => catMatch(x.i.category, x.p?.category ?? null))),
    safeFalsePositiveRate: round(frac(safe, (x) => x.p !== null)),
    categoryAccuracy: round(frac(pos, (x) => catMatch(x.i.category, x.p?.category ?? null))),
  };
}
