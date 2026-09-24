import { CATEGORY_NAMES, MONITORED_APP_IDS, MONITORED_APPS, SEVERITY_NAMES } from "@lighthouse/types";
import { and, desc, eq, gte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { accounts, devices, signals } from "../db/schema";
import { thresholdSeverities } from "../lib/alerts";
import { requireDevice, requireParent } from "../lib/auth-middleware";
import { EPISODE_WINDOW_SECONDS, groupEpisodes, type RawSignal } from "../lib/episodes";
import { ah } from "../lib/http";
import { redis } from "../lib/redis";
import { decryptSignalContent, encryptSignalContent } from "../lib/signal-crypto";
import { emailService } from "../services/email";

type IngestItem = { category: string; severity: string; app: string };

/**
 * Fire-and-forget: alert the parent on signals at/above their threshold, if opted
 * in — with PER-EPISODE DEDUP. The first qualifying signal in an episode (same
 * device + app + category, within a sliding EPISODE_WINDOW) fires the push; later
 * signals in the same open episode refresh the window and SUPPRESS the push. Same
 * spirit as the silence/tamper `*_alerted_at` markers, but ephemeral in Redis.
 */
async function maybeNotify(accountId: string, deviceId: string, items: IngestItem[]): Promise<void> {
  const [acct] = await db
    .select({
      email: accounts.email,
      verified: accounts.emailVerified,
      alertsOn: accounts.emailAlertsEnabled,
      threshold: accounts.alertThreshold,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  // Alerts go by email now (parent app deprecated); require a confirmed address.
  if (!acct?.verified || !acct.alertsOn) return;

  // Respect the parent's severity threshold (Settings).
  const allowed = new Set(thresholdSeverities(acct.threshold));
  const high = items.filter((i) => allowed.has(i.severity));
  if (high.length === 0) return;

  // Collapse to distinct episodes (app+category) and dedup each against its window.
  const groups = new Map<string, { app: string; category: string }>();
  for (const h of high) groups.set(`${h.app}|${h.category}`, { app: h.app, category: h.category });

  const fresh: { app: string; category: string }[] = [];
  for (const g of groups.values()) {
    const key = `pushalert:${deviceId}:${g.app}:${g.category}`;
    // NX = only set if absent → tells us this is a NEW episode (fire). Otherwise
    // refresh the TTL so a continuing stream keeps the episode open (suppress).
    const isNew = await redis.set(key, "1", { EX: EPISODE_WINDOW_SECONDS, NX: true });
    if (isNew) fresh.push(g);
    else await redis.expire(key, EPISODE_WINDOW_SECONDS);
  }
  if (fresh.length === 0) return; // every episode already alerted — suppress

  const [dev] = await db
    .select({ name: devices.name, overlayEnabled: devices.overlayEnabled })
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1);
  const deviceName = dev?.name ?? "your child's device";
  // The block uses the SAME severity threshold as this alert (shouldBlock), so
  // among alerted signals, the ones that paused the screen are exactly those on
  // a device with the overlay enabled. That lets the email say "paused" honestly.
  const blocked = dev?.overlayEnabled ?? true;
  const apps = Array.from(new Set(fresh.map((g) => APP_LABEL.get(g.app) ?? g.app)));
  const cats = Array.from(new Set(fresh.map((g) => g.category)));
  await emailService.sendUrgentAlert(acct.email, { apps, categories: cats, deviceName, blocked });
}

// Monitored-app id → display name ("whatsapp" → "WhatsApp") for alert emails.
const APP_LABEL = new Map<string, string>(MONITORED_APPS.map((a) => [a.id, a.displayName]));

export const signalsRouter = Router();

// Validation taxonomy comes straight from the central registry in @lighthouse/types
// (no local mirror) — CATEGORY_NAMES, SEVERITY_NAMES, and the monitored-app ids.
const nonEmpty = <T>(arr: readonly T[]) => arr as unknown as [T, ...T[]];

// ── A2: POST /signals — child ingest (device-authed). Batch, encrypt-on-write ──
const SignalItem = z.object({
  category: z.enum(nonEmpty(CATEGORY_NAMES)),
  severity: z.enum(nonEmpty(SEVERITY_NAMES)),
  app: z.enum(nonEmpty(MONITORED_APP_IDS)),
  occurredAt: z.string().datetime({ offset: true }),
  channel: z.enum(["text", "notification", "ocr", "image"]).default("text"),
  meta: z.record(z.union([z.string().max(64), z.number(), z.boolean()])).optional(),
});
const IngestBody = z.object({
  signals: z.array(SignalItem).min(1).max(200),
  // Additive + backward-compatible: tags the batch's origin. Defaults to
  // 'synthetic' (the DEV producer); the Stage B real producer sends 'real'.
  source: z.enum(["synthetic", "real"]).default("synthetic"),
});

signalsRouter.post(
  "/",
  requireDevice,
  ah(async (req, res) => {
    const { signals: items, source } = IngestBody.parse(req.body);
    // deviceId/accountId come from the device token — the client can't widen scope.
    const rows = items.map((it) => ({
      deviceId: req.deviceId!,
      accountId: req.accountId!,
      payload: encryptSignalContent({ category: it.category, severity: it.severity, app: it.app, ...(it.meta ? { meta: it.meta } : {}) }),
      source,
      channel: it.channel,
      occurredAt: new Date(it.occurredAt),
    }));
    await db.insert(signals).values(rows);
    // Heartbeat: this device just reported, so it's alive now.
    await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, req.deviceId!));
    // High-severity push alert to the parent (opt-in), per-episode deduped, non-blocking.
    void maybeNotify(req.accountId!, req.deviceId!, items).catch(() => {});
    res.json({ ok: true, count: rows.length });
  }),
);

// ── A3: GET /signals — parent feed (decrypt-on-read), account-scoped ──────────
const ListQuery = z.object({
  deviceId: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  // Cap matches what the parent feed/deep-dive request (500). Was 200, which
  // 400'd those calls → the Activity feed silently showed "No activity yet" while
  // Home (summary endpoint, uncapped) correctly showed the real count.
  limit: z.coerce.number().int().positive().max(500).default(50),
});

signalsRouter.get(
  "/",
  requireParent,
  ah(async (req, res) => {
    const q = ListQuery.parse(req.query);
    const conds = [eq(signals.accountId, req.accountId!)];
    if (q.deviceId) conds.push(eq(signals.deviceId, q.deviceId));
    if (q.since) conds.push(gte(signals.occurredAt, new Date(q.since)));
    const rows = await db
      .select()
      .from(signals)
      .where(and(...conds))
      .orderBy(desc(signals.occurredAt))
      .limit(q.limit);
    const out = rows.map((r) => {
      const c = decryptSignalContent(r.payload);
      return {
        id: r.id,
        deviceId: r.deviceId,
        category: c.category,
        severity: c.severity,
        app: c.app,
        occurredAt: r.occurredAt,
        source: r.source,
      };
    });
    res.json({ ok: true, signals: out });
  }),
);

// ── A3: GET /signals/summary — weekly counts, decrypt + aggregate IN THE APP ──
// (No SQL GROUP BY: category/severity are encrypted. Volume is tiny.)
const SummaryQuery = z.object({ range: z.enum(["week"]).default("week") });

signalsRouter.get(
  "/summary",
  requireParent,
  ah(async (req, res) => {
    const { range } = SummaryQuery.parse(req.query);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(signals)
      .where(and(eq(signals.accountId, req.accountId!), gte(signals.occurredAt, since)));

    let total = 0;
    const byDevice: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byApp: Record<string, number> = {};
    for (const r of rows) {
      const c = decryptSignalContent(r.payload);
      total += 1;
      byDevice[r.deviceId] = (byDevice[r.deviceId] ?? 0) + 1;
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
      bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1;
      byApp[c.app] = (byApp[c.app] ?? 0) + 1;
    }
    res.json({ ok: true, range, since: since.toISOString(), total, byDevice, byCategory, bySeverity, byApp });
  }),
);

// ── GET /signals/episodes — grouped feed (decrypt + group ON READ) ────────────
// Raw signals stay stored; we group them into episodes at query time (volume is
// tiny for the pilot). High-severity episodes are returned individually as cards;
// everything below is collapsed into one lower-priority count (no N rows).
const EpisodesQuery = z.object({
  deviceId: z.string().uuid().optional(),
  // Drill-down filters (applied AFTER decrypt + group — category/app are encrypted).
  app: z.enum(nonEmpty(MONITORED_APP_IDS)).optional(),
  category: z.enum(nonEmpty(CATEGORY_NAMES)).optional(),
  since: z.string().datetime({ offset: true }).optional(),
  // Cap on raw rows scanned (not episodes); generous for the pilot.
  limit: z.coerce.number().int().positive().max(5000).default(2000),
});

signalsRouter.get(
  "/episodes",
  requireParent,
  ah(async (req, res) => {
    const q = EpisodesQuery.parse(req.query);
    const since = q.since ? new Date(q.since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const conds = [eq(signals.accountId, req.accountId!), gte(signals.occurredAt, since)];
    if (q.deviceId) conds.push(eq(signals.deviceId, q.deviceId));
    const rows = await db
      .select()
      .from(signals)
      .where(and(...conds))
      .orderBy(desc(signals.occurredAt))
      .limit(q.limit);

    const raw: RawSignal[] = rows.map((r) => {
      const c = decryptSignalContent(r.payload);
      return {
        id: r.id,
        deviceId: r.deviceId,
        category: c.category,
        severity: c.severity,
        app: c.app,
        occurredAt: r.occurredAt,
      };
    });

    let all = groupEpisodes(raw);
    // Drill-down: narrow to a single app and/or category (post-group, decrypted).
    if (q.app) all = all.filter((e) => e.app === q.app);
    if (q.category) all = all.filter((e) => e.category === q.category);
    // High-severity episodes shown individually; the rest collapse to one count.
    const episodes = all.filter((e) => e.topSeverity === "high");
    const lower = all.filter((e) => e.topSeverity !== "high");
    const lowerPriority = {
      episodeCount: lower.length,
      count: lower.reduce((n, e) => n + e.count, 0),
    };

    res.json({
      ok: true,
      since: since.toISOString(),
      totalSignals: raw.length,
      episodes,
      lowerPriority,
    });
  }),
);
