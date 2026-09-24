import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { publish } from "../lib/lexicon";

import { closeDb, db } from "./client";
import { lexiconTerms, type NewLexiconTerm } from "./schema";

const EXPANSION_PATH = resolve(__dirname, "../../../../ml/lexicon-expansion/expansion.json");
const BATCH = 500;

type Row = { text: string; language: NewLexiconTerm["language"]; category: string; severity: string; note?: string };

async function main() {
  const rows = JSON.parse(readFileSync(EXPANSION_PATH, "utf8")) as Row[];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk: NewLexiconTerm[] = rows.slice(i, i + BATCH).map((r) => ({
      text: r.text,
      language: r.language,
      category: r.category,
      severity: r.severity,
      status: "live",
      source: "curated",
      addedBy: "expansion-v1",
      note: r.note ?? null,
    }));
    const done = await db.insert(lexiconTerms).values(chunk).onConflictDoNothing().returning({ id: lexiconTerms.id });
    inserted += done.length;
  }
  console.log(`inserted ${inserted} of ${rows.length} expansion terms`);
  if (inserted === 0 && !process.argv.includes("--publish")) {
    console.log("nothing new; skipping publish (pass --publish to force)");
    return;
  }
  const { version, liveCount } = await publish("expansion-v1@lighthouse");
  console.log(`published version ${version} with ${liveCount} live terms`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
