import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { datasetExamples, lexiconPublications, lexiconTerms } from "../db/schema";
import { requireAdmin, requireDeviceOrAdmin } from "../lib/admin-auth";
import { ah } from "../lib/http";
import { assembleLiveCategories, getCurrentVersion, getLivePayload, publish } from "../lib/lexicon";
import { CATEGORIES, LANGUAGES, SEVERITIES } from "../lib/lexicon-defaults";
import { evalDataset, evalLexicon } from "../lib/lexicon-eval";
import { generateLexiconCandidates } from "../lib/lexicon-generate";

export const lexiconRouter = Router();

type Cats = Record<string, Record<string, Record<string, string[]>>>;

const Category = z.enum(CATEGORIES);
const Severity = z.enum(SEVERITIES);
const Language = z.enum(LANGUAGES);
const Status = z.enum(["live", "candidate", "rejected"]);

// ── Read side (what the child app syncs) ────────────────────────────────────

/** Full published lexicon + version — the app downloads this when it's stale. */
lexiconRouter.get(
  "/",
  requireDeviceOrAdmin,
  ah(async (_req, res) => {
    res.json(await getLivePayload());
  }),
);

/** Cheap "is there a newer version?" check. */
lexiconRouter.get(
  "/version",
  requireDeviceOrAdmin,
  ah(async (_req, res) => {
    res.json({ version: await getCurrentVersion() });
  }),
);

// ── Admin: working-set CRUD ─────────────────────────────────────────────────

/** List working-set terms, filterable — powers the browser + review queue. */
lexiconRouter.get(
  "/terms",
  requireAdmin,
  ah(async (req, res) => {
    const q = z
      .object({
        status: Status.optional(),
        language: Language.optional(),
        category: Category.optional(),
        source: z.enum(["human", "gemini", "curated", "dataset"]).optional(),
        search: z.string().trim().min(1).optional(),
      })
      .parse(req.query);
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(lexiconTerms.status, q.status));
    if (q.language) conds.push(eq(lexiconTerms.language, q.language));
    if (q.category) conds.push(eq(lexiconTerms.category, q.category));
    if (q.source) conds.push(eq(lexiconTerms.source, q.source));
    if (q.search) conds.push(ilike(lexiconTerms.text, `%${q.search}%`));
    const rows = await db
      .select()
      .from(lexiconTerms)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(lexiconTerms.updatedAt))
      .limit(1000);
    res.json({ terms: rows, count: rows.length });
  }),
);

/** Add a term. Human adds default to `live`; anything AI defaults to `candidate`. */
lexiconRouter.post(
  "/terms",
  requireAdmin,
  ah(async (req, res) => {
    const body = z
      .object({
        text: z.string().trim().min(1).max(120),
        language: Language,
        category: Category,
        severity: Severity,
        status: Status.default("live"),
        source: z.enum(["human", "gemini", "curated", "dataset"]).default("human"),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);
    // AI-sourced terms can NEVER be inserted as live — they must be reviewed.
    const status = body.source === "gemini" || body.source === "dataset" ? "candidate" : body.status;
    try {
      const [row] = await db
        .insert(lexiconTerms)
        .values({ ...body, status, addedBy: req.adminEmail })
        .returning();
      res.status(201).json({ ok: true, term: row });
    } catch (e) {
      if (String(e).includes("lexicon_term_uq")) {
        res.status(409).json({ ok: false, error: "That term already exists in this category/language." });
        return;
      }
      throw e;
    }
  }),
);

/** Edit / promote (status→live) / reject (status→rejected) a term. */
lexiconRouter.patch(
  "/terms/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const patch = z
      .object({
        text: z.string().trim().min(1).max(120).optional(),
        language: Language.optional(),
        category: Category.optional(),
        severity: Severity.optional(),
        status: Status.optional(),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);
    const [row] = await db
      .update(lexiconTerms)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(lexiconTerms.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ ok: false, error: "Term not found" });
      return;
    }
    res.json({ ok: true, term: row });
  }),
);

/** Hard-delete a term from the working set. */
lexiconRouter.delete(
  "/terms/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await db.delete(lexiconTerms).where(eq(lexiconTerms.id, id));
    res.json({ ok: true });
  }),
);

// ── Admin: status + publish ─────────────────────────────────────────────────

/** Counts + whether the working live-set differs from the published snapshot. */
lexiconRouter.get(
  "/status",
  requireAdmin,
  ah(async (_req, res) => {
    const counts = await db
      .select({ status: lexiconTerms.status, n: sql<number>`count(*)::int` })
      .from(lexiconTerms)
      .groupBy(lexiconTerms.status);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    const version = await getCurrentVersion();
    const [pub] = await db
      .select()
      .from(lexiconPublications)
      .orderBy(desc(lexiconPublications.version))
      .limit(1);
    const working = await assembleLiveCategories();
    const publishedCats = pub ? (pub.snapshot as { categories?: Cats }).categories : null;
    // Canonical, key/order-independent signature — JSONB round-trips reorder object
    // keys, so a raw JSON.stringify compare would always report a difference.
    const sig = (cats?: Cats | null): string => {
      const lines: string[] = [];
      for (const [c, byLang] of Object.entries(cats ?? {}))
        for (const [l, bySev] of Object.entries(byLang ?? {}))
          for (const [s, arr] of Object.entries(bySev ?? {})) for (const t of arr ?? []) lines.push(`${c}|${l}|${s}|${t}`);
      return lines.sort().join("\n");
    };
    const pendingChanges = sig(publishedCats) !== sig(working.categories);
    res.json({
      version,
      liveCount: working.liveCount,
      candidates: byStatus.candidate ?? 0,
      rejected: byStatus.rejected ?? 0,
      pendingChanges,
      lastPublishedAt: pub?.publishedAt ?? null,
    });
  }),
);

/** Snapshot all live terms → bump version. This is what the app will pick up. */
lexiconRouter.post(
  "/publish",
  requireAdmin,
  ah(async (req, res) => {
    const { version, liveCount } = await publish(req.adminEmail ?? "unknown");
    res.status(201).json({ ok: true, version, liveCount });
  }),
);

// ── Admin: AI candidate generation + eval ───────────────────────────────────

/**
 * Ask Gemini for candidate terms for a category × language. HARD RULE, enforced
 * here: everything inserted is status="candidate", source="gemini" — it can NEVER
 * be live. It lands in the review queue for a human. Deduped against existing
 * terms. (Gemini is weak at Nigerian slang — these are unverified suggestions.)
 */
lexiconRouter.post(
  "/generate",
  requireAdmin,
  ah(async (req, res) => {
    const { category, language, count } = z
      .object({ category: Category, language: Language, count: z.number().int().min(1).max(20).default(8) })
      .parse(req.body);
    try {
      const r = await generateLexiconCandidates(category, language, count, req.adminEmail ?? "admin");
      res.status(201).json({ ok: true, source: r.source, generated: r.generated, added: r.added, terms: r.terms });
    } catch (e) {
      res.status(502).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }),
);

/** Score the current LIVE lexicon against the canonical test set. */
lexiconRouter.get(
  "/eval",
  requireAdmin,
  ah(async (_req, res) => {
    const lex = await getLivePayload();
    const rows = await db
      .select({ text: datasetExamples.text, category: datasetExamples.category, kind: datasetExamples.kind })
      .from(datasetExamples)
      .where(and(eq(datasetExamples.status, "approved"), eq(datasetExamples.split, "eval")));
    res.json({ ...evalLexicon(lex), dataset: evalDataset(lex, rows) });
  }),
);
