import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Term = { text: string; language: string; category: string; severity: string; note: string };

const HERE = resolve(new URL(".", import.meta.url).pathname);
const SEED_DIR = resolve(HERE, "seed");
const OUT = resolve(HERE, "variants.json");

const PER_TERM_CAP = 2;
const GLOBAL_CAP = 2500;

const MISSPELL: Record<string, string[]> = {
  suicide: ["sucide", "suiside"],
  suicidal: ["sucidal", "suisidal"],
  myself: ["maself", "mysef", "myslef"],
  yourself: ["urself", "yoself"],
  nudes: ["nuds", "nudz"],
  nude: ["nud"],
  naked: ["nakid", "neked"],
  pictures: ["pix"],
  pics: ["pix"],
  video: ["vid", "vidio"],
  dying: ["dieing"],
  wanna: ["wana"],
  gonna: ["gona"],
  tonight: ["tonite", "2nite"],
  tomorrow: ["tmrw", "2moro"],
  because: ["bcos", "becos"],
  school: ["skool", "sch"],
  money: ["moni"],
  pregnant: ["pregnat"],
  virgin: ["vergin"],
  codeine: ["codine", "codein"],
  cocaine: ["cocain"],
  marijuana: ["marihuana"],
  depressed: ["depresed"],
  worthless: ["worthles"],
  hopeless: ["hopless"],
  please: ["pls", "plz"],
  people: ["ppl"],
  something: ["sumtin", "smth"],
  anything: ["anytin"],
  nothing: ["notin", "nuthin"],
  everything: ["everytin"],
  anymore: ["anymor"],
  forever: ["4ever"],
  before: ["b4"],
  tired: ["tyred"],
  cigarette: ["cigarete"],
  alcohol: ["alcohol", "alcohol"],
};

const PRONOUN: Record<string, string[]> = {
  you: ["u"],
  your: ["ur"],
  are: ["r"],
  to: ["2"],
  for: ["4"],
  and: ["n"],
  with: ["wit"],
  the: ["d"],
  that: ["dat"],
  this: ["dis"],
  them: ["dem"],
  there: ["dere"],
  my: ["ma"],
};

const PIDGIN_SWAP: [string, string][] = [
  ["i wan", "i want"],
  ["i wan", "i wana"],
  ["i go", "i wan"],
  ["make we", "mek we"],
  ["make i", "mek i"],
  ["dey", "de"],
  ["comot", "commot"],
  ["commot", "comot"],
  ["abeg", "pls"],
  [" am", " him"],
  [" am", " her"],
];

const DROP_VOWEL: Record<string, string> = {
  nudes: "nds",
  send: "snd",
  naked: "nkd",
  myself: "myslf",
  kill: "kll",
  tonight: "tnght",
  school: "schl",
  money: "mny",
};

function loadSeeds(): Term[] {
  const out: Term[] = [];
  for (const f of readdirSync(SEED_DIR).filter((f) => f.endsWith(".json")).sort()) {
    out.push(...(JSON.parse(readFileSync(resolve(SEED_DIR, f), "utf8")) as Term[]));
  }
  return out;
}

function replaceToken(tokens: string[], i: number, alt: string): string {
  const copy = tokens.slice();
  copy[i] = alt;
  return copy.join(" ");
}

const DOUBLE_LAST = new Set(["die", "dead", "nudes", "pls", "please", "now", "alone", "sad", "high", "kpai", "abeg", "sex", "horny", "me", "help"]);

function candidates(term: Term): string[] {
  const text = term.text;
  const tokens = text.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const alts = MISSPELL[tokens[i]!];
    if (alts) for (const a of alts) out.push(replaceToken(tokens, i, a));
  }
  if (term.language === "pidgin") {
    for (const [from, to] of PIDGIN_SWAP) {
      const padded = ` ${text} `;
      if (padded.includes(` ${from.trim()} `)) {
        const v = padded.replace(` ${from.trim()} `, ` ${to.trim()} `).trim();
        if (v !== text) out.push(v);
      }
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    const alts = PRONOUN[tokens[i]!];
    if (alts) for (const a of alts) out.push(replaceToken(tokens, i, a));
  }
  for (let i = 0; i < tokens.length; i++) {
    const d = DROP_VOWEL[tokens[i]!];
    if (d) out.push(replaceToken(tokens, i, d));
  }
  return out;
}

function doubled(term: Term): string[] {
  const tokens = term.text.split(" ");
  const last = tokens[tokens.length - 1]!;
  if (!DOUBLE_LAST.has(last)) return [];
  return [replaceToken(tokens, tokens.length - 1, last + last[last.length - 1])];
}

function main() {
  const seeds = loadSeeds();
  const known = new Set(seeds.map((t) => t.text));
  const eligible = seeds
    .filter((t) => (t.language === "en" || t.language === "pidgin") && (t.severity === "high" || t.severity === "review"))
    .filter((t) => t.text.split(" ").length >= 2 && !t.text.includes("'"))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  const variants: Term[] = [];
  const add = (term: Term, v: string) => {
    if (known.has(v) || variants.length >= GLOBAL_CAP) return false;
    known.add(v);
    variants.push({ text: v, language: term.language, category: term.category, severity: term.severity, note: `variant of ${term.text}` });
    return true;
  };
  for (const term of eligible) {
    let n = 0;
    for (const v of candidates(term)) {
      if (n >= PER_TERM_CAP) break;
      if (add(term, v)) n++;
    }
  }
  for (const term of eligible) {
    if (term.severity !== "high") continue;
    for (const v of doubled(term)) add(term, v);
  }
  writeFileSync(OUT, `${JSON.stringify(variants, null, 0).replace(/\},\{/g, "},\n{")}\n`);
  console.log(`eligible=${eligible.length} variants=${variants.length} -> ${OUT}`);
}

main();
