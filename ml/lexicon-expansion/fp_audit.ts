import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { classify, setActiveLexicon } from "../../apps/child/src/native/classify";

type Term = { text: string; language: string; category: string; severity: string; note: string };
type Lex = {
  version?: number;
  context: { negators: string[]; negatorWindow: number; sarcasmEmoji: string[]; sarcasmWords: string[]; drugContextTokens: string[] };
  ambiguousTerms: Record<string, unknown>;
  categories: Record<string, Record<string, Record<string, string[]>>>;
};

const HERE = resolve(new URL(".", import.meta.url).pathname);
const SEED_DIR = resolve(HERE, "seed");
const CACHE = resolve(HERE, ".cache");
const BASE_PATH = resolve(HERE, "../../apps/child/src/native/lexicon.json");
const LANG_TO_APP: Record<string, string> = { en: "en", pidgin: "pcm", yoruba: "yo", hausa: "ha", igbo: "ig" };
const APP_TO_LANG: Record<string, string> = { en: "en", pcm: "pidgin", yo: "yoruba", ha: "hausa", ig: "igbo" };
const LANG_ORDER = ["en", "pidgin", "yoruba", "hausa", "igbo"];
const CATEGORIES = ["Self-Harm", "Eating Disorders", "Sexual Content", "Violence", "Graphic Content", "Substance Use", "Hate Speech", "Gambling"];
const PER_10K_LIMIT = 2;
const LINES_PER_CORPUS = 10000;
const OFFLINE = process.argv.includes("--offline");

const L33T: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
const deL33t = (s: string) => [...s].map((c) => L33T[c] ?? c).join("");
const tokenize = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadSeeds(): Term[] {
  const out: Term[] = [];
  for (const f of readdirSync(SEED_DIR).filter((f) => f.endsWith(".json")).sort()) {
    out.push(...(JSON.parse(readFileSync(resolve(SEED_DIR, f), "utf8")) as Term[]));
  }
  const vp = resolve(HERE, "variants.json");
  if (existsSync(vp)) out.push(...(JSON.parse(readFileSync(vp, "utf8")) as Term[]));
  return out;
}

function baseTerms(base: Lex): Term[] {
  const out: Term[] = [];
  for (const [category, byLang] of Object.entries(base.categories)) {
    for (const [app, bySev] of Object.entries(byLang)) {
      for (const [severity, texts] of Object.entries(bySev)) {
        for (const text of texts) out.push({ text, language: APP_TO_LANG[app] ?? app, category, severity, note: "base" });
      }
    }
  }
  return out;
}

async function fetchRows(dataset: string, config: string, split: string, offset: number): Promise<any[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${config}&split=${split}&offset=${offset}&length=100`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url);
    if (res.ok) return ((await res.json()) as { rows: { row: any }[] }).rows.map((r) => r.row);
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.min(60000, 3000 * 2 ** attempt);
      process.stdout.write(`\n${res.status} on ${config}/${split}@${offset}, waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`gave up ${url}`);
}

async function corpus(name: string, dataset: string, config: string, splits: string[], extract: (row: any) => string[]): Promise<string[]> {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, `${name}.jsonl`);
  const partial = resolve(CACHE, `${name}.partial.jsonl`);
  const cursorFile = resolve(CACHE, `${name}.cursor.json`);
  const readLines = (p: string) =>
    readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as string);
  if (existsSync(file)) return readLines(file);
  if (OFFLINE) throw new Error(`no cache for ${name}`);
  const lines: string[] = existsSync(partial) ? readLines(partial) : [];
  let cursor = existsSync(cursorFile) ? (JSON.parse(readFileSync(cursorFile, "utf8")) as { split: number; offset: number }) : { split: 0, offset: 0 };
  for (let s = cursor.split; s < splits.length && lines.length < LINES_PER_CORPUS; s++) {
    for (let offset = s === cursor.split ? cursor.offset : 0; lines.length < LINES_PER_CORPUS; offset += 100) {
      const rows = await fetchRows(dataset, config, splits[s]!, offset);
      if (rows.length === 0) break;
      const fresh: string[] = [];
      for (const row of rows) for (const t of extract(row)) if (t && t.trim().length >= 3) fresh.push(t.trim());
      lines.push(...fresh);
      writeFileSync(partial, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
      writeFileSync(cursorFile, JSON.stringify({ split: s, offset: offset + 100 }));
      process.stdout.write(`\r${name}: ${lines.length}   `);
      await new Promise((r) => setTimeout(r, 400));
    }
    cursor = { split: s + 1, offset: 0 };
  }
  const kept = lines.slice(0, LINES_PER_CORPUS);
  writeFileSync(file, kept.map((l) => JSON.stringify(l)).join("\n") + "\n");
  console.log(`\n${name}: cached ${kept.length}`);
  return kept;
}

type Indexed = Term & { tokens: string[]; key: string; hits: number; perCorpus: Record<string, number>; samples: string[]; isBase: boolean };

function seqAt(hay: string[], i: number, needle: string[]): boolean {
  if (i + needle.length > hay.length) return false;
  for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) return false;
  return true;
}

function buildPayload(base: Lex, extra: Term[]): Lex {
  const categories: Lex["categories"] = {};
  for (const cat of Object.keys(base.categories)) {
    categories[cat] = {};
    for (const app of Object.keys(base.categories[cat]!)) {
      categories[cat]![app] = { high: [...(base.categories[cat]![app]!.high ?? [])], review: [...(base.categories[cat]![app]!.review ?? [])], low: [...(base.categories[cat]![app]!.low ?? [])] };
    }
  }
  for (const t of extra) {
    const app = LANG_TO_APP[t.language]!;
    categories[t.category] ??= {};
    categories[t.category]![app] ??= { high: [], review: [], low: [] };
    categories[t.category]![app]![t.severity]!.push(t.text);
  }
  return { ...base, version: 999, categories };
}

async function main() {
  const base = JSON.parse(readFileSync(BASE_PATH, "utf8")) as Lex;
  const baseList = baseTerms(base);
  const baseKeys = new Set(baseList.map((t) => `${t.text}||${t.category}`));

  const seenKey = new Set<string>();
  const dupBase: Term[] = [];
  const dupSelf: Term[] = [];
  const raw = loadSeeds().map((t) => ({ ...t, text: normalize(t.text) }));
  raw.sort((a, b) => LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language));
  const expansion: Term[] = [];
  for (const t of raw) {
    if (!t.text || tokenize(t.text).length === 0) continue;
    const key = `${t.text}||${t.category}`;
    if (baseKeys.has(key)) {
      dupBase.push(t);
      continue;
    }
    if (seenKey.has(key)) {
      dupSelf.push(t);
      continue;
    }
    seenKey.add(key);
    expansion.push(t);
  }

  const corpora: Record<string, string[]> = {};
  for (const cfg of ["hau", "ibo", "pcm", "yor"]) {
    corpora[`naijasenti_${cfg}`] = await corpus(`naijasenti_${cfg}`, "HausaNLP/NaijaSenti-Twitter", cfg, ["train", "validation", "test"], (r) => [r.tweet ?? r.text]);
  }
  corpora.dailydialog_en = await corpus("dailydialog_en", "roskoN/dailydialog", "full", ["train", "validation"], (r) => r.utterances ?? []);
  const totalLines = Object.values(corpora).reduce((n, c) => n + c.length, 0);
  const maxHits = Math.floor((PER_10K_LIMIT * totalLines) / 10000);

  const indexed: Indexed[] = [...expansion.map((t) => ({ ...t, isBase: false })), ...baseList.map((t) => ({ ...t, isBase: true }))].map((t) => ({
    ...t,
    tokens: tokenize(t.text),
    key: `${t.text}||${t.category}||${t.isBase ? "base" : "new"}`,
    hits: 0,
    perCorpus: {},
    samples: [],
  }));
  const byFirst = new Map<string, Indexed[]>();
  for (const t of indexed) {
    const f = t.tokens[0]!;
    if (!byFirst.has(f)) byFirst.set(f, []);
    byFirst.get(f)!.push(t);
  }
  const negators = new Set(base.context.negators.flatMap((n) => tokenize(n)));
  const window = base.context.negatorWindow;

  for (const [name, lines] of Object.entries(corpora)) {
    for (const line of lines) {
      const rawTokens = tokenize(line);
      const l33tTokens = tokenize(deL33t(line));
      const hit = new Set<Indexed>();
      for (let i = 0; i < rawTokens.length; i++) {
        const cands = byFirst.get(rawTokens[i]!);
        if (!cands) continue;
        for (const t of cands) {
          if (hit.has(t) || !seqAt(rawTokens, i, t.tokens)) continue;
          let negated = false;
          for (let k = Math.max(0, i - window); k < i; k++) if (negators.has(rawTokens[k]!)) negated = true;
          if (!negated) hit.add(t);
        }
      }
      for (let i = 0; i < l33tTokens.length; i++) {
        const cands = byFirst.get(l33tTokens[i]!);
        if (!cands) continue;
        for (const t of cands) if (!hit.has(t) && seqAt(l33tTokens, i, t.tokens)) hit.add(t);
      }
      for (const t of hit) {
        t.hits++;
        t.perCorpus[name] = (t.perCorpus[name] ?? 0) + 1;
        if (t.samples.length < 4) t.samples.push(`[${name}] ${line.slice(0, 160)}`);
      }
    }
  }

  const overridesPath = resolve(HERE, "keep_overrides.json");
  const overrides = existsSync(overridesPath) ? (JSON.parse(readFileSync(overridesPath, "utf8")) as Record<string, string>) : {};

  const newTerms = indexed.filter((t) => !t.isBase);
  const dropped = newTerms.filter((t) => t.hits > maxHits && !overrides[t.text]);
  const keptOver = newTerms.filter((t) => t.hits > maxHits && overrides[t.text]);
  const flagged = newTerms.filter((t) => t.hits > 0 && t.hits <= maxHits);
  const baseOver = indexed.filter((t) => t.isBase && t.hits > maxHits);
  const droppedKeys = new Set(dropped.map((t) => t.key));
  const finalTerms = newTerms
    .filter((t) => !droppedKeys.has(t.key))
    .map(({ text, language, category, severity, note }) => ({ text, language, category, severity, note }))
    .sort((a, b) => a.category.localeCompare(b.category) || LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language) || a.severity.localeCompare(b.severity) || a.text.localeCompare(b.text));

  const flagRate = (lex: Lex) => {
    setActiveLexicon(lex);
    const out: Record<string, { flagged: number; total: number; byCat: Record<string, number> }> = {};
    for (const [name, lines] of Object.entries(corpora)) {
      const byCat: Record<string, number> = {};
      let flagged = 0;
      for (const line of lines) {
        const r = classify(line);
        if (r) {
          flagged++;
          byCat[r.category] = (byCat[r.category] ?? 0) + 1;
        }
      }
      out[name] = { flagged, total: lines.length, byCat };
    }
    return out;
  };
  const rateBefore = flagRate(base);
  const rateAfter = flagRate(buildPayload(base, finalTerms));

  const count = (list: Term[]) => {
    const m: Record<string, Record<string, number>> = {};
    for (const c of CATEGORIES) m[c] = Object.fromEntries(LANG_ORDER.map((l) => [l, 0]));
    for (const t of list) m[t.category]![t.language]! += 1;
    return m;
  };

  const report = {
    generatedAt: new Date().toISOString(),
    corpora: Object.fromEntries(Object.entries(corpora).map(([k, v]) => [k, v.length])),
    totalLines,
    perTenKLimit: PER_10K_LIMIT,
    maxHits,
    seedsLoaded: raw.length,
    duplicatesOfBase: dupBase.length,
    duplicatesWithinExpansion: dupSelf.length,
    candidates: newTerms.length,
    dropped: dropped.map((t) => ({ text: t.text, language: t.language, category: t.category, severity: t.severity, hits: t.hits, perCorpus: t.perCorpus, samples: t.samples })),
    keptByOverride: keptOver.map((t) => ({ text: t.text, category: t.category, hits: t.hits, reason: overrides[t.text] })),
    flagged: flagged.map((t) => ({ text: t.text, language: t.language, category: t.category, severity: t.severity, hits: t.hits, samples: t.samples.slice(0, 2) })).sort((a, b) => b.hits - a.hits),
    baseOverLimit: baseOver.map((t) => ({ text: t.text, category: t.category, severity: t.severity, hits: t.hits, samples: t.samples.slice(0, 2) })),
    final: finalTerms.length,
    countsBase: count(baseList),
    countsExpansion: count(finalTerms),
    countsMerged: count([...baseList, ...finalTerms]),
    flagRateBefore: rateBefore,
    flagRateAfter: rateAfter,
  };
  writeFileSync(resolve(HERE, "audit_report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(HERE, "expansion.json"), `[\n${finalTerms.map((t) => JSON.stringify(t)).join(",\n")}\n]\n`);

  console.log(`\nlines=${totalLines} maxHits=${maxHits} seeds=${raw.length} dupBase=${dupBase.length} dupSelf=${dupSelf.length} candidates=${newTerms.length}`);
  console.log(`dropped=${dropped.length} keptByOverride=${keptOver.length} flagged(1..${maxHits})=${flagged.length} baseOverLimit=${baseOver.length} final=${finalTerms.length} merged=${baseList.length + finalTerms.length}`);
  for (const name of Object.keys(corpora)) {
    const b = rateBefore[name]!;
    const a = rateAfter[name]!;
    console.log(`  ${name}: flagged before ${b.flagged}/${b.total} (${((100 * b.flagged) / b.total).toFixed(2)}%) after ${a.flagged}/${a.total} (${((100 * a.flagged) / a.total).toFixed(2)}%)`);
  }
  console.log("\nDROPPED:");
  for (const t of dropped) console.log(`  ${t.hits}\t${t.category}\t${t.language}\t${t.severity}\t${t.text}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
