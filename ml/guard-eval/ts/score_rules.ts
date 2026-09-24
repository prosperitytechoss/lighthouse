/**
 * Before/after scoreboard: OLD keyword stub (classify_legacy.ts, a frozen copy of
 * the pre-upgrade classify.ts) vs the NEW rules-based classify.ts — same metric
 * definitions as run_eval.py, same testset.jsonl, so it's apples-to-apples in one
 * runtime. Run:  npx tsx ml/guard-eval/ts/score_rules.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import { classify as classifyNew } from "../../../apps/child/src/native/classify";
import { runClassifierHarness } from "../../../apps/child/src/native/classify.cases";
import { classify as classifyLegacy } from "./classify_legacy";

type Row = { id: number; text: string; category: string | null; severity: string | null; lang: string; kind: string };
type Pred = { category: string | null; severity: string | null };

const HERE = new URL(".", import.meta.url);
const read = (rel: string): Row[] =>
  readFileSync(new URL(rel, HERE), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

const ORIGINAL = read("../testset.jsonl");
const HARD = read("../testset_hard.jsonl");

const asPred = (c: { category: string; severity: string } | null): Pred =>
  c ? { category: c.category, severity: c.severity } : { category: null, severity: null };

function catMatch(expected: string | null, pred: string | null): boolean {
  if (expected === null) return pred === null;
  return pred === expected;
}

function metrics(items: Row[], fn: (t: string) => any) {
  const preds = new Map<number, Pred>(items.map((i) => [i.id, asPred(fn(i.text))]));
  const pos = items.filter((i) => i.category !== null);
  const safe = items.filter((i) => i.category === null);
  const hard = items.filter((i) => i.kind === "hard_negative");
  const p = (i: Row) => preds.get(i.id)!;
  const frac = (arr: Row[], ok: (i: Row) => boolean) => (arr.length ? arr.filter(ok).length / arr.length : 0);
  const catOK = pos.filter((i) => catMatch(i.category, p(i).category));
  const cs = pos.filter((i) => i.lang !== "en");
  return {
    overall: frac(items, (i) => catMatch(i.category, p(i).category)),
    safeFP: frac(safe, (i) => p(i).category !== null),
    hardPass: frac(hard, (i) => p(i).category === null),
    posDetect: frac(pos, (i) => p(i).category !== null),
    posCat: frac(pos, (i) => catMatch(i.category, p(i).category)),
    codeswitch: frac(cs, (i) => p(i).category !== null),
    sevExact: catOK.length ? catOK.filter((i) => p(i).severity === i.severity).length / catOK.length : 0,
    n: items.length,
    preds,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmt = (p: Pred) => (p.category ? `${p.category}/${p.severity}` : "SAFE");

function scoreboard(title: string, items: Row[]) {
  const L = metrics(items, classifyLegacy);
  const N = metrics(items, classifyNew);
  const rows: [string, keyof typeof L, boolean][] = [
    ["overall accuracy", "overall", true],
    ["SAFE false-positive rate", "safeFP", false],
    ["hard-negative pass rate", "hardPass", true],
    ["positive detection", "posDetect", true],
    ["positive category accuracy", "posCat", true],
    ["code-switched detection", "codeswitch", true],
    ["severity exact-match", "sevExact", true],
  ];
  let out = `\n## ${title}  (n=${items.length})\n\n`;
  out += `| metric | OLD stub | NEW rules | Δ |\n|---|---|---|---|\n`;
  for (const [label, key, up] of rows) {
    const o = L[key] as number;
    const n = N[key] as number;
    const d = n - o;
    const arrow = Math.abs(d) < 0.005 ? "—" : (d > 0) === up ? "✅" : "🔻";
    out += `| ${label} | ${pct(o)} | ${pct(n)} | ${d >= 0 ? "+" : ""}${pct(d)} ${arrow} |\n`;
  }
  return { out, L, N };
}

function perMessage(items: Row[]) {
  const L = metrics(items, classifyLegacy);
  const N = metrics(items, classifyNew);
  let out = `\n## Per-message (${items.length})\n\n| # | lang | message | expected | OLD stub | NEW rules |\n|---|---|---|---|---|---|\n`;
  for (const i of items) {
    const exp = i.category ? `${i.category}/${i.severity}` : "SAFE";
    const lp = L.preds.get(i.id)!;
    const np = N.preds.get(i.id)!;
    const lm = catMatch(i.category, lp.category) ? "✓" : "✗";
    const nm = catMatch(i.category, np.category) ? "✓" : "✗";
    const txt = i.text.replace(/\|/g, "\\|");
    out += `| ${i.id} | ${i.lang} | ${txt} | ${exp} | ${fmt(lp)} ${lm} | ${fmt(np)} ${nm} |\n`;
  }
  return out;
}

// unit-harness (the app's own regression cases)
const h = runClassifierHarness();

let report = `# Rules classifier — before/after scoreboard\n\n`;
report += `_OLD keyword stub vs NEW rules-based classify(). Metrics identical to guard-eval/run_eval.py._\n`;
report += `\napp unit harness (classify.cases.ts): **${h.passed}/${h.passed + h.failed} pass**`;
if (h.failed) report += ` — FAILURES: ${JSON.stringify(h.failures)}`;
report += `\n`;

const A = scoreboard("A · Original guard-eval set (apples-to-apples)", ORIGINAL);
const B = scoreboard("B · Held-out hard set (negation / sarcasm / l33t / more code-switch)", HARD);
const C = scoreboard("C · Combined", [...ORIGINAL, ...HARD]);
report += A.out + B.out + C.out;
report += perMessage(ORIGINAL);
report += perMessage(HARD);

mkdirSync(new URL("../results/", HERE), { recursive: true });
writeFileSync(new URL("../results/rules_report.md", HERE), report);

// stdout summary
console.log(`app unit harness: ${h.passed}/${h.passed + h.failed} pass` + (h.failed ? " ❌" : " ✅"));
for (const [name, S] of [["ORIGINAL", A], ["HARD", B], ["COMBINED", C]] as const) {
  console.log(
    `\n[${name}] n=${S.L.n}` +
      `\n  OLD: acc=${pct(S.L.overall)} safeFP=${pct(S.L.safeFP)} hardPass=${pct(S.L.hardPass)} catAcc=${pct(S.L.posCat)} codeswitch=${pct(S.L.codeswitch)}` +
      `\n  NEW: acc=${pct(S.N.overall)} safeFP=${pct(S.N.safeFP)} hardPass=${pct(S.N.hardPass)} catAcc=${pct(S.N.posCat)} codeswitch=${pct(S.N.codeswitch)}`,
  );
}
console.log("\nwrote results/rules_report.md");
