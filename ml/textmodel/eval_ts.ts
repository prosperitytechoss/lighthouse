import { readFileSync, writeFileSync } from "node:fs";

import { classify } from "../../apps/child/src/native/classify";
import { HYBRID_THRESHOLD, loadTextModel } from "../../apps/child/src/native/textmodel";

const HERE = new URL(".", import.meta.url);
const out: string[] = [];
const log = (...a: unknown[]) => {
  const line = a.map(String).join(" ");
  out.push(line);
  console.log(line);
};
const read = (rel: string) => readFileSync(new URL(rel, HERE));
const jsonl = (rel: string) =>
  read(rel)
    .toString("utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

const bin = read("../../apps/child/models/textmodel.bin");
const model = loadTextModel(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

type Fix = { text: string; category: string; severity: string; confidence: number; sevConfidence: number };
const fixture: Fix[] = JSON.parse(read("parity.json").toString("utf8"));

let argmaxMiss = 0;
let sevMiss = 0;
let confMiss = 0;
let maxDelta = 0;
for (const f of fixture) {
  const r = model.raw(f.text);
  if (!r) {
    if (f.category !== undefined && f.text.trim() !== "" && f.confidence > 0) {
      argmaxMiss++;
      log("TS returned null:", JSON.stringify(f.text));
    }
    continue;
  }
  if (r.category !== f.category) {
    argmaxMiss++;
    log("argmax mismatch:", JSON.stringify(f.text), "py", f.category, "ts", r.category);
  }
  if (r.severity !== f.severity) {
    sevMiss++;
    log("severity mismatch:", JSON.stringify(f.text), "py", f.severity, "ts", r.severity);
  }
  const d = Math.abs(r.confidence - f.confidence);
  maxDelta = Math.max(maxDelta, d);
  if (d > 1e-3) {
    confMiss++;
    log("confidence mismatch:", JSON.stringify(f.text), f.confidence, r.confidence);
  }
}
log(
  `parity: ${fixture.length} rows, argmax mismatches ${argmaxMiss}, severity mismatches ${sevMiss}, confidence > 1e-3 ${confMiss}, max delta ${maxDelta.toExponential(2)}`,
);

type Row = { id: number; text: string; category: string | null; severity: string | null; lang: string; kind: string };
const rows: Row[] = [...jsonl("../guard-eval/testset.jsonl"), ...jsonl("../guard-eval/testset_hard.jsonl")];

const SEV_RANK: Record<string, number> = { low: 1, review: 2, high: 3 };
function hybrid(text: string) {
  const lex = classify(text);
  if (lex) return { ...lex, via: "lexicon" as const };
  const p = model.predict(text);
  if (!p || p.confidence < HYBRID_THRESHOLD) return null;
  const severity = SEV_RANK[p.severity]! > SEV_RANK.review! ? "review" : p.severity;
  return { category: p.category, severity, via: "model" as const };
}

function score(name: string, fn: (t: string) => { category: string; severity: string } | null) {
  const pos = rows.filter((r) => r.category);
  const safe = rows.filter((r) => !r.category);
  const hard = rows.filter((r) => r.kind === "hard_negative");
  const cs = pos.filter((r) => r.lang !== "en");
  const preds = new Map(rows.map((r) => [r.id, fn(r.text)]));
  const ok = (r: Row) => (preds.get(r.id)?.category ?? null) === r.category;
  const frac = (a: Row[], f: (r: Row) => boolean) => (a.length ? a.filter(f).length / a.length : 0);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  log(
    `${name}: acc=${pct(frac(rows, ok))} safeFP=${pct(frac(safe, (r) => preds.get(r.id) != null))} hardPass=${pct(frac(hard, (r) => preds.get(r.id) == null))} posDetect=${pct(frac(pos, (r) => preds.get(r.id) != null))} posCat=${pct(frac(pos, ok))} codeswitch=${pct(frac(cs, (r) => preds.get(r.id) != null))}`,
  );
  return preds;
}

score("lexicon only", classify);
score("model only (0.85)", (t) => {
  const p = model.predict(t);
  return p && p.confidence >= HYBRID_THRESHOLD ? p : null;
});
const hy = score("hybrid", hybrid);
const viaModel = rows.filter((r) => hy.get(r.id)?.via === "model");
log(`hybrid: ${viaModel.length} rows decided by the model:`);
for (const r of viaModel) {
  const p = hy.get(r.id)!;
  log(`  [${r.category ? "pos" : "SAFE"}] ${r.text} -> ${p.category}/${p.severity}`);
}

const t0 = performance.now();
const N = 2000;
for (let i = 0; i < N; i++) model.predict(rows[i % rows.length]!.text);
log(`ts latency: ${((performance.now() - t0) / N).toFixed(3)} ms per message`);

writeFileSync(new URL("data/eval_ts.txt", HERE), out.join("\n") + "\n");
if (argmaxMiss || confMiss) process.exit(1);
