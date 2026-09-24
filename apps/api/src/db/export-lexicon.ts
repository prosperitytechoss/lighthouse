/**
 * Export the current PUBLISHED lexicon from the DB → the child's bundled
 * apps/child/src/native/lexicon.json. The DB is the single source of truth
 * (edited via Lighthouse Lexicon Admin); this JSON is only the bundled OFFLINE
 * DEFAULT the app ships with. Run this before a child build so a fresh install
 * starts from the latest published lexicon. Do NOT hand-edit the JSON.
 *
 *   npm run db:export-lexicon    (from apps/api)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getLivePayload } from "../lib/lexicon";

import { closeDb } from "./client";

const OUT = resolve(__dirname, "../../../child/src/native/lexicon.json");

async function main() {
  const p = await getLivePayload();
  const out = {
    version: p.version,
    _meta: {
      generated: true,
      note: "GENERATED from the lexicon DB via `npm run db:export-lexicon`. Do NOT hand-edit — edit in Lighthouse Lexicon Admin and re-export before a child build.",
      exportedAt: p._meta.publishedAt,
    },
    context: p.context,
    ambiguousTerms: p.ambiguousTerms,
    categories: p.categories,
  };
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`exported published lexicon v${p.version} → ${OUT}`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
