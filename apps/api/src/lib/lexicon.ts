import { desc, eq } from "drizzle-orm";

import { db } from "../db/client";
import { lexiconPublications, lexiconTerms, type NewLexiconTerm } from "../db/schema";

import {
  AMBIGUOUS_DEFAULTS,
  CATEGORIES,
  CONTEXT_DEFAULTS,
  LANG_TO_APP,
  type Language,
  type LexiconPayload,
  SEVERITIES,
} from "./lexicon-defaults";

type CategoryMap = LexiconPayload["categories"];

/** Empty categories[cat][appLang][sev] scaffold. */
function emptyCategories(): CategoryMap {
  const out: CategoryMap = {};
  for (const cat of CATEGORIES) {
    out[cat] = {};
    for (const app of Object.values(LANG_TO_APP)) {
      out[cat][app] = { high: [], review: [], low: [] };
    }
  }
  return out;
}

/** Build categories[cat][appLang][sev] = [terms] from all status=live rows. */
export async function assembleLiveCategories(): Promise<{ categories: CategoryMap; liveCount: number }> {
  // Deterministic order so the published snapshot and the working-set comparison
  // (pendingChanges) are byte-identical when the content is the same.
  const rows = await db
    .select()
    .from(lexiconTerms)
    .where(eq(lexiconTerms.status, "live"))
    .orderBy(lexiconTerms.category, lexiconTerms.language, lexiconTerms.severity, lexiconTerms.text);
  const categories = emptyCategories();
  let liveCount = 0;
  for (const r of rows) {
    const cat = categories[r.category];
    const app = LANG_TO_APP[r.language as Language];
    if (!cat || !app || !cat[app]) continue; // unknown category/lang — skip defensively
    const sev = SEVERITIES.includes(r.severity as never) ? (r.severity as "high" | "review" | "low") : null;
    if (!sev) continue;
    cat[app][sev].push(r.text);
    liveCount++;
  }
  return { categories, liveCount };
}

function buildPayload(categories: CategoryMap, version: number, publishedAt: string | null): LexiconPayload {
  return {
    version,
    _meta: { status: version > 0 ? "published" : "unpublished-working-set", publishedAt },
    context: CONTEXT_DEFAULTS,
    ambiguousTerms: AMBIGUOUS_DEFAULTS,
    categories,
  };
}

/** Latest published version number, or 0 if never published. */
export async function getCurrentVersion(): Promise<number> {
  const [row] = await db
    .select({ version: lexiconPublications.version })
    .from(lexiconPublications)
    .orderBy(desc(lexiconPublications.version))
    .limit(1);
  return row?.version ?? 0;
}

/**
 * What the app syncs: the latest published snapshot. If nothing is published yet,
 * fall back to the assembled working set at version 0 (so dev never 404s).
 */
export async function getLivePayload(): Promise<LexiconPayload> {
  const [pub] = await db
    .select()
    .from(lexiconPublications)
    .orderBy(desc(lexiconPublications.version))
    .limit(1);
  if (pub) return pub.snapshot as LexiconPayload;
  const { categories } = await assembleLiveCategories();
  return buildPayload(categories, 0, null);
}

/** Snapshot all live terms + bump the version. Returns the new version. */
export async function publish(publishedBy: string): Promise<{ version: number; liveCount: number }> {
  const current = await getCurrentVersion();
  const version = current + 1;
  const { categories, liveCount } = await assembleLiveCategories();
  const snapshot = buildPayload(categories, version, new Date().toISOString());
  await db.insert(lexiconPublications).values({ version, snapshot, liveCount, publishedBy });
  return { version, liveCount };
}

/** Count of working-set terms (used to decide whether to seed). */
export async function termCount(): Promise<number> {
  const rows = await db.select({ id: lexiconTerms.id }).from(lexiconTerms);
  return rows.length;
}

/**
 * Flatten a lexicon.json-shaped object's `categories` into DB rows. App language
 * codes (pcm/yo/ha/ig) map back to full DB languages. Used by the seed script.
 */
export function categoriesToRows(
  categories: Record<string, Record<string, Record<string, string[]>>>,
  base: Pick<NewLexiconTerm, "status" | "source" | "addedBy">,
): NewLexiconTerm[] {
  const appToLang: Record<string, Language> = { en: "en", pcm: "pidgin", yo: "yoruba", ha: "hausa", ig: "igbo" };
  const rows: NewLexiconTerm[] = [];
  for (const [category, byLang] of Object.entries(categories)) {
    for (const [appLang, bySev] of Object.entries(byLang)) {
      const language = appToLang[appLang];
      if (!language) continue;
      for (const severity of ["high", "review", "low"]) {
        for (const text of bySev[severity] ?? []) {
          rows.push({ text, language, category, severity, ...base });
        }
      }
    }
  }
  return rows;
}
