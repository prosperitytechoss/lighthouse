import { and, desc, eq, ilike, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { datasetExamples, datasetSources } from "../db/schema";
import { requireAdmin } from "../lib/admin-auth";
import { lastOkRun } from "../lib/harvest";
import { ah } from "../lib/http";
import { CATEGORIES, LANGUAGES, SEVERITIES } from "../lib/lexicon-defaults";

export const datasetRouter = Router();
datasetRouter.use(requireAdmin);

const Category = z.enum(CATEGORIES);
const Severity = z.enum(SEVERITIES);
const Language = z.enum(LANGUAGES);
const Kind = z.enum(["positive", "hard_negative", "safe"]);
const Status = z.enum(["candidate", "approved", "rejected"]);
const Split = z.enum(["train", "eval"]);

const countBy = (rows: { key: unknown; n: number }[]): Record<string, number> =>
  Object.fromEntries(rows.map((r) => [String(r.key ?? "SAFE"), r.n]));

datasetRouter.get(
  "/stats",
  ah(async (_req, res) => {
    const n = sql<number>`count(*)::int`;
    const [byStatus, byCategory, byLanguage, bySource, last] = await Promise.all([
      db.select({ key: datasetExamples.status, n }).from(datasetExamples).groupBy(datasetExamples.status),
      db.select({ key: datasetExamples.category, n }).from(datasetExamples).groupBy(datasetExamples.category),
      db.select({ key: datasetExamples.language, n }).from(datasetExamples).groupBy(datasetExamples.language),
      db.select({ key: datasetExamples.source, n }).from(datasetExamples).groupBy(datasetExamples.source),
      lastOkRun("dataset_harvest"),
    ]);
    const status = countBy(byStatus);
    const trainedRows = await db
      .select({ trained: sql<boolean>`(${datasetExamples.modelTag} is not null)`, n: sql<number>`count(*)::int` })
      .from(datasetExamples)
      .where(eq(datasetExamples.status, "approved"))
      .groupBy(sql`(${datasetExamples.modelTag} is not null)`);
    const tagRows = await db
      .select({ tag: datasetExamples.modelTag, n: sql<number>`count(*)::int` })
      .from(datasetExamples)
      .where(isNotNull(datasetExamples.modelTag))
      .groupBy(datasetExamples.modelTag);
    res.json({
      total: byStatus.reduce((a, r) => a + r.n, 0),
      byStatus: { candidate: status.candidate ?? 0, approved: status.approved ?? 0, rejected: status.rejected ?? 0 },
      approvedUntrained: trainedRows.find((r) => r.trained === false)?.n ?? 0,
      inModel: trainedRows.find((r) => r.trained === true)?.n ?? 0,
      byModelTag: Object.fromEntries(tagRows.map((r) => [r.tag ?? "", r.n])),
      byCategory: countBy(byCategory),
      byLanguage: countBy(byLanguage),
      bySource: countBy(bySource),
      lastHarvestAt: last?.finishedAt ?? null,
    });
  }),
);

datasetRouter.get(
  "/examples",
  ah(async (req, res) => {
    const q = z
      .object({
        status: Status.optional(),
        category: z.union([Category, z.literal("SAFE")]).optional(),
        language: Language.optional(),
        source: z.string().min(1).optional(),
        kind: Kind.optional(),
        split: Split.optional(),
        trained: z.enum(["yes", "no"]).optional(),
        search: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().positive().max(1000).default(100),
      })
      .parse(req.query);
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(datasetExamples.status, q.status));
    if (q.category === "SAFE") conds.push(isNull(datasetExamples.category));
    else if (q.category) conds.push(eq(datasetExamples.category, q.category));
    if (q.language) conds.push(eq(datasetExamples.language, q.language));
    if (q.trained === "yes") conds.push(isNotNull(datasetExamples.modelTag));
    if (q.trained === "no") conds.push(isNull(datasetExamples.modelTag));
    if (q.source) conds.push(eq(datasetExamples.source, q.source));
    if (q.kind) conds.push(eq(datasetExamples.kind, q.kind));
    if (q.split) conds.push(eq(datasetExamples.split, q.split));
    if (q.search) conds.push(ilike(datasetExamples.text, `%${q.search}%`));
    const rows = await db
      .select()
      .from(datasetExamples)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(datasetExamples.createdAt))
      .limit(q.limit);
    res.json({ examples: rows, count: rows.length });
  }),
);

datasetRouter.patch(
  "/examples/:id",
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const patch = z
      .object({
        status: Status.optional(),
        category: Category.nullable().optional(),
        severity: Severity.nullable().optional(),
        kind: Kind.optional(),
        split: Split.optional(),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(req.body);
    const review = patch.status ? { reviewedBy: req.adminEmail, reviewedAt: new Date() } : {};
    const [row] = await db
      .update(datasetExamples)
      .set({ ...patch, ...review })
      .where(eq(datasetExamples.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ ok: false, error: "Example not found" });
      return;
    }
    res.json({ ok: true, example: row });
  }),
);

datasetRouter.post(
  "/examples",
  ah(async (req, res) => {
    const body = z
      .object({
        text: z.string().trim().min(1).max(300),
        language: Language,
        category: Category.nullable(),
        severity: Severity.nullable(),
        kind: Kind,
        split: Split.default("train"),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);
    const [row] = await db
      .insert(datasetExamples)
      .values({
        ...body,
        category: body.kind === "positive" ? body.category : null,
        severity: body.kind === "positive" ? body.severity : null,
        source: "human",
        status: "approved",
        reviewedBy: req.adminEmail,
        reviewedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      res.status(409).json({ ok: false, error: "That text already exists for this language." });
      return;
    }
    res.status(201).json({ ok: true, example: row });
  }),
);

datasetRouter.get(
  "/export",
  ah(async (req, res) => {
    const q = z.object({ split: Split.optional(), status: Status.default("approved"), tag: z.string().trim().min(1).max(60).optional() }).parse(req.query);
    const conds: SQL[] = [eq(datasetExamples.status, q.status)];
    if (q.split) conds.push(eq(datasetExamples.split, q.split));
    if (q.tag) await db.update(datasetExamples).set({ modelTag: q.tag }).where(and(...conds, isNull(datasetExamples.modelTag)));
    res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="lighthouse-dataset-${q.split ?? "all"}.jsonl"`);
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      const rows = await db
        .select({
          text: datasetExamples.text,
          language: datasetExamples.language,
          category: datasetExamples.category,
          severity: datasetExamples.severity,
          kind: datasetExamples.kind,
          source: datasetExamples.source,
        })
        .from(datasetExamples)
        .where(and(...conds))
        .orderBy(datasetExamples.createdAt, datasetExamples.id)
        .limit(page)
        .offset(offset);
      for (const r of rows) res.write(`${JSON.stringify(r)}\n`);
      if (rows.length < page) break;
    }
    res.end();
  }),
);

datasetRouter.get(
  "/sources",
  ah(async (_req, res) => {
    const rows = await db.select().from(datasetSources).orderBy(datasetSources.createdAt);
    res.json({
      sources: rows.map((s) => ({
        id: s.id,
        key: s.key,
        kind: s.kind,
        enabled: s.enabled,
        cursor: s.cursor,
        totalPulled: s.totalPulled,
        lastRunAt: s.lastRunAt,
      })),
    });
  }),
);

datasetRouter.patch(
  "/sources/:id",
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const [row] = await db.update(datasetSources).set({ enabled }).where(eq(datasetSources.id, id)).returning({ id: datasetSources.id });
    if (!row) {
      res.status(404).json({ ok: false, error: "Source not found" });
      return;
    }
    res.json({ ok: true });
  }),
);
