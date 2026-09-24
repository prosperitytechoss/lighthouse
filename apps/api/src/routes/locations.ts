import { and, desc, eq, gte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { devices, locations } from "../db/schema";
import { requireDevice, requireParent } from "../lib/auth-middleware";
import { ah } from "../lib/http";
import { decryptLocationContent, encryptLocationContent } from "../lib/location-crypto";

export const locationsRouter = Router();

// ── POST /locations — child ingest (device-authed). Batch, encrypt-on-write ────
// Coordinates are encrypted before insert; the DB never sees plaintext lat/lng.
const LocationItem = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  capturedAt: z.string().datetime({ offset: true }),
});
const IngestBody = z.object({
  locations: z.array(LocationItem).min(1).max(200),
});

locationsRouter.post(
  "/",
  requireDevice,
  ah(async (req, res) => {
    const { locations: items } = IngestBody.parse(req.body);
    // deviceId/accountId come from the device token — the client can't widen scope.
    const rows = items.map((it) => ({
      deviceId: req.deviceId!,
      accountId: req.accountId!,
      payload: encryptLocationContent({ lat: it.lat, lng: it.lng, accuracy: it.accuracy }),
      capturedAt: new Date(it.capturedAt),
    }));
    await db.insert(locations).values(rows);
    // Heartbeat: this device just reported, so it's alive now.
    await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, req.deviceId!));
    res.json({ ok: true, count: rows.length });
  }),
);

// ── GET /locations — parent read (decrypt-on-read), account-scoped ────────────
// No parent UI in part A; this is the data path the map (part B) will consume.
const ListQuery = z.object({
  deviceId: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

locationsRouter.get(
  "/",
  requireParent,
  ah(async (req, res) => {
    const q = ListQuery.parse(req.query);
    const conds = [eq(locations.accountId, req.accountId!)];
    if (q.deviceId) conds.push(eq(locations.deviceId, q.deviceId));
    if (q.since) conds.push(gte(locations.capturedAt, new Date(q.since)));
    const rows = await db
      .select()
      .from(locations)
      .where(and(...conds))
      .orderBy(desc(locations.capturedAt))
      .limit(q.limit);
    const out = rows.map((r) => {
      const c = decryptLocationContent(r.payload);
      return {
        id: r.id,
        deviceId: r.deviceId,
        lat: c.lat,
        lng: c.lng,
        accuracy: c.accuracy ?? null,
        capturedAt: r.capturedAt,
      };
    });
    res.json({ ok: true, locations: out });
  }),
);
