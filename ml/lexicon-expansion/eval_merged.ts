import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { setActiveLexicon } from "../../apps/child/src/native/classify";

type Term = { text: string; language: string; category: string; severity: string };
type Lex = { version?: number; categories: Record<string, Record<string, Record<string, string[]>>> } & Record<string, unknown>;

const HERE = resolve(new URL(".", import.meta.url).pathname);
const BASE_PATH = resolve(HERE, "../../apps/child/src/native/lexicon.json");
const EXPANSION = resolve(HERE, "expansion.json");
const RESULTS = resolve(HERE, "../guard-eval/results/rules_report.md");
const OUT = resolve(HERE, "eval_report.md");
const LANG_TO_APP: Record<string, string> = { en: "en", pidgin: "pcm", yoruba: "yo", hausa: "ha", igbo: "ig" };

const base = JSON.parse(readFileSync(BASE_PATH, "utf8")) as Lex;
const expansion = JSON.parse(readFileSync(EXPANSION, "utf8")) as Term[];
const merged: Lex = { ...base, version: 999, categories: JSON.parse(JSON.stringify(base.categories)) };
for (const t of expansion) {
  const app = LANG_TO_APP[t.language]!;
  merged.categories[t.category] ??= {};
  merged.categories[t.category]![app] ??= { high: [], review: [], low: [] };
  merged.categories[t.category]![app]![t.severity]!.push(t.text);
}
setActiveLexicon(merged);

async function main() {
  const original = readFileSync(RESULTS, "utf8");
  await import("../guard-eval/ts/score_rules.ts");
  const mergedReport = readFileSync(RESULTS, "utf8");
  writeFileSync(RESULTS, original);
  writeFileSync(OUT, mergedReport.replace("# Rules classifier", "# Rules classifier with expansion.json merged"));
  console.log(`\nwrote ${OUT}; restored ${RESULTS}`);
}
void main();
