/**
 * Seed the lexicon DB from the bundled apps/child/src/native/lexicon.json — marks
 * every existing term status=live, source=human — then publishes version 1 so a
 * fresh app sync gets exactly today's lexicon. Idempotent: skips if terms exist
 * (pass --force to add anyway). Run: `npm run db:seed-lexicon` (from apps/api).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { categoriesToRows, publish, termCount } from "../lib/lexicon";

import { closeDb, db } from "./client";
import { lexiconTerms } from "./schema";

// src/db → repo apps/child/src/native/lexicon.json (CJS __dirname; api emits CJS).
const LEXICON_PATH = resolve(__dirname, "../../../child/src/native/lexicon.json");

async function main() {
  const force = process.argv.includes("--force");
  const existing = await termCount();
  if (existing > 0 && !force) {
    console.log(`lexicon already has ${existing} terms — skipping seed (use --force to add).`);
    return;
  }

  const raw = JSON.parse(readFileSync(LEXICON_PATH, "utf8")) as {
    categories: Record<string, Record<string, Record<string, string[]>>>;
  };
  const rows = categoriesToRows(raw.categories, { status: "live", source: "human", addedBy: "seed" });

  // Insert, ignoring duplicates (so --force is safe to re-run).
  let inserted = 0;
  for (const row of rows) {
    const done = await db.insert(lexiconTerms).values(row).onConflictDoNothing().returning();
    inserted += done.length;
  }
  const { version, liveCount } = await publish("seed@lighthouse");
  console.log(`seeded ${inserted} terms; published version ${version} with ${liveCount} live terms.`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
