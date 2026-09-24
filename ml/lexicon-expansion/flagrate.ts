import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { classify, setActiveLexicon } from "../../apps/child/src/native/classify";

type Term = { text: string; language: string; category: string; severity: string };
const HERE = resolve(new URL(".", import.meta.url).pathname);
const LANG_TO_APP: Record<string, string> = { en: "en", pidgin: "pcm", yoruba: "yo", hausa: "ha", igbo: "ig" };
const base = JSON.parse(readFileSync(resolve(HERE, "../../apps/child/src/native/lexicon.json"), "utf8"));
const expansion = JSON.parse(readFileSync(resolve(HERE, "expansion.json"), "utf8")) as Term[];

function payload(extra: Term[]) {
  const categories = JSON.parse(JSON.stringify(base.categories));
  for (const t of extra) {
    const app = LANG_TO_APP[t.language]!;
    categories[t.category] ??= {};
    categories[t.category][app] ??= { high: [], review: [], low: [] };
    categories[t.category][app][t.severity].push(t.text);
  }
  return { ...base, version: 999, categories };
}

const corpora = readdirSync(resolve(HERE, ".cache")).filter((f) => f.endsWith(".jsonl") && !f.includes("partial"));
for (const label of ["base", "merged"]) {
  setActiveLexicon(label === "base" ? base : payload(expansion));
  const row: string[] = [];
  for (const f of corpora) {
    const lines = readFileSync(resolve(HERE, ".cache", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as string);
    let n = 0;
    for (const l of lines) if (classify(l)) n++;
    row.push(`${f.replace(".jsonl", "")}=${n}/${lines.length}`);
  }
  console.log(label, row.join("  "));
}
