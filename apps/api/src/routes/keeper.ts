import { createHash } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import express, { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { keeperModels } from "../db/schema";
import { requireAdmin, requireDeviceOrAdmin } from "../lib/admin-auth";
import { ah } from "../lib/http";

export const keeperRouter = Router();

const Version = z.string().trim().regex(/^[0-9A-Za-z._-]{1,32}$/);
const FILES = { "keeper.onnx": "onnx", "keeper.spm": "spm" } as const;
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const summary = {
  version: keeperModels.version,
  onnxSha256: keeperModels.onnxSha256,
  spmSha256: keeperModels.spmSha256,
  onnxBytes: keeperModels.onnxBytes,
  spmBytes: keeperModels.spmBytes,
  notes: keeperModels.notes,
  minRisk: keeperModels.minRisk,
  live: keeperModels.live,
  uploadedBy: keeperModels.uploadedBy,
  createdAt: keeperModels.createdAt,
  publishedAt: keeperModels.publishedAt,
};

keeperRouter.get(
  "/current",
  requireDeviceOrAdmin,
  ah(async (_req, res) => {
    const [m] = await db
      .select({ version: keeperModels.version, onnxSha256: keeperModels.onnxSha256, spmSha256: keeperModels.spmSha256, onnxBytes: keeperModels.onnxBytes, spmBytes: keeperModels.spmBytes, minRisk: keeperModels.minRisk })
      .from(keeperModels)
      .where(eq(keeperModels.live, true))
      .limit(1);
    res.json(m ?? { version: null });
  }),
);

keeperRouter.get(
  "/files/:version/:file",
  requireDeviceOrAdmin,
  ah(async (req, res) => {
    const version = Version.parse(req.params.version);
    const col = FILES[req.params.file as keyof typeof FILES];
    if (!col) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const [m] = await db.select({ data: keeperModels[col] }).from(keeperModels).where(eq(keeperModels.version, version)).limit(1);
    if (!m?.data) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(m.data.length));
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.end(m.data);
  }),
);

keeperRouter.get(
  "/versions",
  requireAdmin,
  ah(async (_req, res) => {
    res.json({ versions: await db.select(summary).from(keeperModels).orderBy(desc(keeperModels.createdAt)) });
  }),
);

keeperRouter.put(
  "/versions/:version/:file",
  requireAdmin,
  express.raw({ type: "application/octet-stream", limit: "40mb" }),
  ah(async (req, res) => {
    const version = Version.parse(req.params.version);
    const col = FILES[req.params.file as keyof typeof FILES];
    const body = req.body as unknown;
    if (!col || !Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Send keeper.onnx or keeper.spm as application/octet-stream" });
      return;
    }
    const patch =
      col === "onnx"
        ? { onnx: body, onnxSha256: sha256(body), onnxBytes: body.length }
        : { spm: body, spmSha256: sha256(body), spmBytes: body.length };
    const [m] = await db
      .insert(keeperModels)
      .values({ version, uploadedBy: req.adminEmail ?? null, ...patch })
      .onConflictDoUpdate({ target: keeperModels.version, set: patch })
      .returning(summary);
    res.status(201).json({ model: m });
  }),
);

keeperRouter.patch(
  "/versions/:version",
  requireAdmin,
  express.json(),
  ah(async (req, res) => {
    const version = Version.parse(req.params.version);
    const patch = z.object({ notes: z.string().max(2000).optional(), minRisk: z.number().min(0).max(1).optional() }).parse(req.body);
    const [m] = await db.update(keeperModels).set(patch).where(eq(keeperModels.version, version)).returning(summary);
    if (!m) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json({ model: m });
  }),
);

keeperRouter.post(
  "/versions/:version/publish",
  requireAdmin,
  ah(async (req, res) => {
    const version = Version.parse(req.params.version);
    const [m] = await db.select(summary).from(keeperModels).where(eq(keeperModels.version, version)).limit(1);
    if (!m) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    if (!m.onnxSha256 || !m.spmSha256) {
      res.status(400).json({ error: "Upload both keeper.onnx and keeper.spm first" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(keeperModels).set({ live: false }).where(eq(keeperModels.live, true));
      await tx.update(keeperModels).set({ live: true, publishedAt: new Date() }).where(eq(keeperModels.version, version));
    });
    res.json({ ok: true, version });
  }),
);
