import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { env, isProd } from "../config/env";
import {
  consumeMagicToken,
  createAdminSession,
  createMagicToken,
  destroyAdminSession,
  isAdmin,
  requireAdmin,
} from "../lib/admin-auth";
import { db } from "../db/client";
import { accounts, devices } from "../db/schema";
import { recentEvents } from "../lib/admin-events";
import { buildOverview } from "../lib/admin-overview";
import { JOB_NAMES, recentRuns, runJob, type JobName } from "../lib/harvest";
import { ah, allowRequest, clientIp } from "../lib/http";
import { harvestSchedule } from "../lib/jobs";
import { logger } from "../lib/logger";
import { runWeeklyDigests } from "../services/digest";
import { emailService } from "../services/email";

export const adminRouter = Router();

/**
 * Request a magic link. Always responds ok (never reveals who's allow-listed).
 * In DEV the magic URL is returned in the body so the flow is testable without
 * email delivery — see the Resend blocker note in the report.
 */
adminRouter.post(
  "/login",
  ah(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    if (!(await allowRequest(`adminlogin:${clientIp(req)}`, 5, 60))) {
      res.status(429).json({ ok: false, error: "Too many attempts, try again shortly." });
      return;
    }
    let devMagicUrl: string | undefined;
    if (isAdmin(email)) {
      const token = await createMagicToken(email);
      const url = `${env.ADMIN_APP_URL}/auth/callback?token=${token}`;
      try {
        await emailService.sendMagicLink(email, url);
      } catch (e) {
        // Resend domain not verified yet → delivery fails. Don't 500 the flow;
        // the dev URL below still unblocks testing.
        logger.warn(`magic-link email failed (expected until Resend domain is set): ${String(e)}`);
      }
      if (!isProd) devMagicUrl = url;
    }
    res.json({ ok: true, ...(devMagicUrl ? { devMagicUrl } : {}) });
  }),
);

/** Exchange a magic-link token for an admin session. */
adminRouter.post(
  "/callback",
  ah(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const email = await consumeMagicToken(token);
    if (!email || !isAdmin(email)) {
      res.status(401).json({ ok: false, error: "Invalid or expired link" });
      return;
    }
    const session = await createAdminSession(email);
    res.json({ ok: true, token: session, email });
  }),
);

/**
 * DEV-ONLY login bypass (__DEV__). Issues a real admin session without email so
 * the dashboard is usable before the Resend sending domain is set up. Hard-off in
 * production. CLEARLY marked; remove/disable once magic-link email delivers.
 */
adminRouter.post(
  "/dev-login",
  ah(async (req, res) => {
    if (isProd) {
      res.status(403).json({ ok: false, error: "dev-login is disabled in production" });
      return;
    }
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    if (!isAdmin(email)) {
      res.status(403).json({ ok: false, error: `${email} is not in ADMIN_EMAILS` });
      return;
    }
    const session = await createAdminSession(email);
    logger.warn(`[admin] DEV-LOGIN bypass used for ${email}`);
    res.json({ ok: true, token: session, email, dev: true });
  }),
);

adminRouter.get(
  "/me",
  requireAdmin,
  ah(async (req, res) => {
    res.json({ ok: true, email: req.adminEmail });
  }),
);

/** Fleet overview: all devices + signal stats/graph data (admin-scoped, global). */
adminRouter.get(
  "/overview",
  requireAdmin,
  ah(async (_req, res) => {
    res.json(await buildOverview());
  }),
);

/**
 * Force a weekly-summary run NOW, ignoring the Sunday window and the
 * once-per-week stamp. Pilot/testing lever: lets us see the real email a
 * parent would get without waiting for Sunday.
 */
adminRouter.post(
  "/weekly-digest/run",
  requireAdmin,
  ah(async (req, res) => {
    const result = await runWeeklyDigests({ force: true });
    logger.info(`[admin] weekly digest force-run by ${req.adminEmail}: ${result.sent} sent`);
    res.json({ ok: true, ...result });
  }),
);

adminRouter.get(
  "/jobs",
  requireAdmin,
  ah(async (_req, res) => {
    res.json({ runs: await recentRuns(30), schedule: harvestSchedule() });
  }),
);

adminRouter.post(
  "/jobs/:job/run",
  requireAdmin,
  ah(async (req, res) => {
    const job = z.enum(JOB_NAMES as [JobName, ...JobName[]]).parse(req.params.job);
    try {
      const run = await runJob(job, req.adminEmail ?? "admin");
      res.json({ ok: true, run });
    } catch (e) {
      const err = e as Error & { run?: unknown };
      res.status(502).json({ ok: false, error: err.message, ...(err.run ? { run: err.run } : {}) });
    }
  }),
);

adminRouter.get(
  "/events",
  requireAdmin,
  ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    res.json({ events: await recentEvents(limit) });
  }),
);

adminRouter.get(
  "/devices/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const [d] = await db
      .select({
        id: devices.id,
        name: devices.name,
        assignee: devices.assignee,
        deviceInfo: devices.deviceInfo,
        pairedAt: devices.pairedAt,
        lastSeenAt: devices.lastSeenAt,
        createdAt: devices.createdAt,
        accessibilityEnabled: devices.accessibilityEnabled,
        notificationAccessEnabled: devices.notificationAccessEnabled,
        batteryOptimizationExempt: devices.batteryOptimizationExempt,
        batteryLevel: devices.batteryLevel,
        batteryCharging: devices.batteryCharging,
        monitoredApps: devices.monitoredApps,
        overlayEnabled: devices.overlayEnabled,
        visionEnabled: devices.visionEnabled,
        visionSupported: devices.visionSupported,
        visionTier: devices.visionTier,
        visionIntervalMs: devices.visionIntervalMs,
        visionFrames: devices.visionFrames,
        visionLastFrameAt: devices.visionLastFrameAt,
        engineStats: devices.engineStats,
        email: accounts.email,
        emailVerified: accounts.emailVerified,
        alertThreshold: accounts.alertThreshold,
        emailAlertsEnabled: accounts.emailAlertsEnabled,
      })
      .from(devices)
      .leftJoin(accounts, eq(devices.accountId, accounts.id))
      .where(eq(devices.id, id))
      .limit(1);
    if (!d) {
      res.status(404).json({ ok: false, error: "Device not found" });
      return;
    }
    res.json({ device: d, events: await recentEvents(50, id) });
  }),
);

adminRouter.post(
  "/logout",
  requireAdmin,
  ah(async (req, res) => {
    const token = (req.header("authorization") ?? "").slice(7);
    await destroyAdminSession(token);
    res.json({ ok: true });
  }),
);
