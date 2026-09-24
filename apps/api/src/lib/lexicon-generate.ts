import { and, eq } from "drizzle-orm";

import { db } from "../db/client";
import { lexiconTerms, type LexiconTerm } from "../db/schema";

import { generateCandidates } from "./gemini";
import { CATEGORIES, LANGUAGES, type Category, type Language } from "./lexicon-defaults";

export type GenerateResult = {
  source: "gemini" | "dev-stub";
  generated: number;
  added: number;
  terms: LexiconTerm[];
};

/**
 * Ask Gemini for lexicon candidates for one category x language cell and insert
 * them as status=candidate, source=gemini (never live). Deduped against every
 * existing term in the cell. Throws on Gemini failure.
 */
export async function generateLexiconCandidates(
  category: Category,
  language: Language,
  count: number,
  addedBy: string,
): Promise<GenerateResult> {
  const existing = await db
    .select({ text: lexiconTerms.text })
    .from(lexiconTerms)
    .where(and(eq(lexiconTerms.category, category), eq(lexiconTerms.language, language)));
  const seen = new Set(existing.map((e) => e.text.toLowerCase().trim()));
  const result = await generateCandidates(category, language, count, [...seen]);
  const terms: LexiconTerm[] = [];
  for (const c of result.candidates) {
    const text = c.text.trim().toLowerCase();
    if (!text || text.length > 120 || seen.has(text)) continue;
    seen.add(text);
    const [row] = await db
      .insert(lexiconTerms)
      .values({
        text,
        language,
        category,
        severity: c.severity,
        status: "candidate",
        source: "gemini",
        addedBy,
        note: c.note ?? "AI suggestion, verify before approving",
      })
      .onConflictDoNothing()
      .returning();
    if (row) terms.push(row);
  }
  return { source: result.source, generated: result.candidates.length, added: terms.length, terms };
}

export type GridSummary = {
  cells: number;
  generated: number;
  added: number;
  errors: Record<string, string>;
};

/** The whole 8 x 5 grid in one pass; per-cell errors are collected, not thrown. */
export async function generateLexiconGrid(count: number, addedBy: string): Promise<GridSummary> {
  const summary: GridSummary = { cells: 0, generated: 0, added: 0, errors: {} };
  for (const category of CATEGORIES) {
    for (const language of LANGUAGES) {
      summary.cells += 1;
      try {
        const r = await generateLexiconCandidates(category, language, count, addedBy);
        summary.generated += r.generated;
        summary.added += r.added;
      } catch (e) {
        summary.errors[`${category}/${language}`] = e instanceof Error ? e.message : String(e);
      }
    }
  }
  return summary;
}
