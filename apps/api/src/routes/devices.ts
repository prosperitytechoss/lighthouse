import { MONITORED_APP_IDS } from "@lighthouse/types";
import { and, eq, gte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db/client";
import { accounts, devices, signals } from "../db/schema";
import { requireDevice, requireParent } from "../lib/auth-middleware";
import { revokeDeviceToken } from "../lib/device-token";
import { ah } from "../lib/http";
import { generateOtp, storeOtp, takeResendSlot, verifyOtp } from "../lib/otp";
import { decryptSignalContent } from "../lib/signal-crypto";
import { emailService } from "../services/email";

export const devicesRouter = Router();

export type DeviceHealth = "active" | "monitoring_off" | "not_reporting";

/** Derived device health from real heartbeat state — no new tracking. */
function deviceHealth(d: {
  lastSeenAt: Date | null;
  pairedAt: Date | null;
  createdAt: Date;
  accessibilityEnabled: boolean | null;
  notificationAccessEnabled: boolean | null;
}): DeviceHealth {
  const last = (d.lastSeenAt ?? d.pairedAt ?? d.createdAt).getTime();
  if (Date.now() - last > env.SILENCE_HOURS * 60 * 60 * 1000) return "not_reporting"; // gone
  if (d.accessibilityEnabled === false || d.notificationAccessEnabled === false) {
    return "monitoring_off"; // alive but capture disabled (tamper)
  }
  return "active";
}

/**
 * Tamper alert: the device is alive (heartbeating) but reports a critical capture
 * permission OFF — monitoring was disabled without removing the app. Distinct from
 * silence (gone entirely). Deduped via tamper_alerted_at; cleared on re-enable.
 */
async function maybeTamperAlert(accountId: string, deviceId: string): Promise<void> {
  const [d] = await db
    .select({ name: devices.name, tamperAlertedAt: devices.tamperAlertedAt })
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1);
  if (!d || d.tamperAlertedAt) return; // already alerted this episode
  const [acct] = await db
    .select({ email: accounts.email, verified: accounts.emailVerified, alertsOn: accounts.emailAlertsEnabled })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!acct?.verified || !acct.alertsOn) return;

  const who = d.name ?? "your child's device";
  await emailService.sendTamperAlert(acct.email, who);
  await db.update(devices).set({ tamperAlertedAt: new Date() }).where(eq(devices.id, deviceId));
}

// GET /devices/me — child-authenticated (device token). Used by the child app's
// boot gate to confirm it's still linked. Defined BEFORE the parent gate below.
devicesRouter.get(
  "/me",
  requireDevice,
  ah(async (req, res) => {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, req.deviceId!), eq(devices.accountId, req.accountId!)))
      .limit(1);
    if (!device) {
      // Row gone (unpaired) but a stale token slipped through — revoke + 401.
      await revokeDeviceToken(req.deviceId!);
      return res.status(401).json({ ok: false, error: "Device not linked" });
    }
    // Heartbeat: the child checked in, so it's alive now.
    await db
      .update(devices)
      .set({ lastSeenAt: new Date(), silenceAlertedAt: null })
      .where(eq(devices.id, req.deviceId!));
    const [account] = await db
      .select({
        email: accounts.email,
        alertThreshold: accounts.alertThreshold,
        emailAlertsEnabled: accounts.emailAlertsEnabled,
        whatsappNumber: accounts.whatsappNumber,
      })
      .from(accounts)
      .where(eq(accounts.id, req.accountId!))
      .limit(1);
    return res.json({
      ok: true,
      device: { id: device.id, name: device.name, role: device.role },
      account: { email: account?.email ?? null },
      // Parent's phone (E.164), collected at setup — for display/edit in-app.
      parentPhone: account?.whatsappNumber ?? null,
      // Per-app capture filter the child pushes to native. null col = all enabled.
      monitoredApps: device.monitoredApps ?? [...MONITORED_APP_IDS],
      // Protective-overlay (blocking) on/off — child pushes to the native gate.
      overlayEnabled: device.overlayEnabled,
      // Account severity threshold — drives BOTH alerts and the overlay block.
      alertThreshold: account?.alertThreshold ?? "severe",
      // Email-alert master switch (parent-set in the child settings screen).
      emailAlertsEnabled: account?.emailAlertsEnabled ?? true,
    });
  }),
);

// GET /devices/weekly — child-authed: THIS device's last-7-days picture for the
// kid-facing Weekly screen. Same tagged metadata the parent sees (severity/app),
// boiled down to a per-day and per-app "worst" — never content, never other kids.
type Worst = "none" | "low" | "review" | "high";
const WORST_RANK: Record<Worst, number> = { none: 0, low: 1, review: 2, high: 3 };

devicesRouter.get(
  "/weekly",
  requireDevice,
  ah(async (req, res) => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // UTC calendar-day buckets: `since` is UTC midnight six days ago, so
    // days[0..5] are full UTC days and days[6] is today so far.
    const since = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS - 6 * DAY_MS);
    const rows = await db
      .select()
      .from(signals)
      .where(and(eq(signals.deviceId, req.deviceId!), gte(signals.occurredAt, since)));

    // days[0] = 6 UTC days ago … days[6] = today (UTC). Each day carries its worst severity.
    const days: Worst[] = Array.from({ length: 7 }, () => "none");
    const apps: Record<string, Worst> = {};
    let total = 0;
    let high = 0;
    for (const r of rows) {
      const c = decryptSignalContent(r.payload);
      total += 1;
      if (c.severity === "high") high += 1;
      const sev: Worst = c.severity === "high" || c.severity === "review" ? c.severity : "low";
      const idx = Math.min(6, Math.max(0, Math.floor((r.occurredAt.getTime() - since.getTime()) / DAY_MS)));
      if (WORST_RANK[sev] > WORST_RANK[days[idx]!]) days[idx] = sev;
      if (WORST_RANK[sev] > WORST_RANK[apps[c.app] ?? "none"]) apps[c.app] = sev;
    }
    res.json({ ok: true, since: since.toISOString(), days, apps, total, high });
  }),
);

// POST /devices/heartbeat — child-authed idle heartbeat. Bumps last_seen_at (so a
// silent-but-alive device isn't flagged dead) and carries self-reported capture
// permission state so we can detect "alive but monitoring disabled" (tamper).
const HeartbeatBody = z.object({
  accessibilityEnabled: z.boolean().optional(),
  notificationAccessEnabled: z.boolean().optional(),
  batteryOptimizationExempt: z.boolean().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  batteryCharging: z.boolean().optional(),
  visionSupported: z.boolean().optional(),
  visionTier: z.enum(["fast", "mid", "slow"]).nullable().optional(),
  visionIntervalMs: z.number().int().nonnegative().optional(),
  visionFrames: z.number().int().nonnegative().optional(),
  visionLastFrameAt: z.string().datetime({ offset: true }).nullable().optional(),
  engine: z.record(z.union([z.string().max(64), z.number(), z.boolean()])).optional(),
});
devicesRouter.post(
  "/heartbeat",
  requireDevice,
  ah(async (req, res) => {
    const perm = HeartbeatBody.parse(req.body ?? {});
    // A critical capture permission OFF while still heartbeating = tamper.
    const captureOff =
      perm.accessibilityEnabled === false || perm.notificationAccessEnabled === false;

    await db
      .update(devices)
      .set({
        lastSeenAt: new Date(),
        silenceAlertedAt: null,
        ...(perm.accessibilityEnabled !== undefined
          ? { accessibilityEnabled: perm.accessibilityEnabled }
          : {}),
        ...(perm.notificationAccessEnabled !== undefined
          ? { notificationAccessEnabled: perm.notificationAccessEnabled }
          : {}),
        ...(perm.batteryOptimizationExempt !== undefined
          ? { batteryOptimizationExempt: perm.batteryOptimizationExempt }
          : {}),
        ...(perm.batteryLevel !== undefined ? { batteryLevel: perm.batteryLevel } : {}),
        ...(perm.batteryCharging !== undefined ? { batteryCharging: perm.batteryCharging } : {}),
        ...(perm.visionSupported !== undefined ? { visionSupported: perm.visionSupported } : {}),
        ...(perm.visionTier !== undefined ? { visionTier: perm.visionTier } : {}),
        ...(perm.visionIntervalMs !== undefined ? { visionIntervalMs: perm.visionIntervalMs } : {}),
        ...(perm.visionFrames !== undefined ? { visionFrames: perm.visionFrames } : {}),
        ...(perm.engine ? { engineStats: { ...perm.engine, reportedAt: new Date().toISOString() } } : {}),
        ...(perm.visionLastFrameAt !== undefined
          ? { visionLastFrameAt: perm.visionLastFrameAt ? new Date(perm.visionLastFrameAt) : null }
          : {}),
        // Capture back on → clear the tamper flag (re-enabled). Leave it if still off.
        ...(captureOff ? {} : { tamperAlertedAt: null }),
      })
      .where(eq(devices.id, req.deviceId!));

    if (captureOff) void maybeTamperAlert(req.accountId!, req.deviceId!).catch(() => {});

    // Return the live settings so the native background service applies parent
    // changes (monitored apps / overlay / threshold) WITHOUT the child app being
    // foregrounded — the JS /devices/me poll is paused in the background.
    const [d] = await db
      .select({ monitoredApps: devices.monitoredApps, overlayEnabled: devices.overlayEnabled, visionEnabled: devices.visionEnabled })
      .from(devices)
      .where(eq(devices.id, req.deviceId!))
      .limit(1);
    const [acct] = await db
      .select({ threshold: accounts.alertThreshold })
      .from(accounts)
      .where(eq(accounts.id, req.accountId!))
      .limit(1);
    res.json({
      ok: true,
      monitoredApps: d?.monitoredApps ?? [...MONITORED_APP_IDS],
      overlayEnabled: d?.overlayEnabled ?? true,
      visionEnabled: d?.visionEnabled ?? true,
      alertThreshold: acct?.threshold ?? "severe",
    });
  }),
);

// POST /devices/settings — device-authed settings update. Powers the in-child
// settings screen (the parent app is deprecated, so the parent changes these on
// the child's phone): per-app monitoring, protective overlay, severity threshold,
// and the email-alert switch. Updates this device's row + its account, returns
// the effective settings so the app can re-sync native immediately.
const SettingsBody = z.object({
  monitoredApps: z.array(z.string()).max(50).optional(),
  overlayEnabled: z.boolean().optional(),
  visionEnabled: z.boolean().optional(),
  alertThreshold: z.enum(["severe", "moderate", "all"]).optional(),
  emailAlertsEnabled: z.boolean().optional(),
  // Required only when turning email alerts OFF (see the gate below).
  otp: z.string().trim().optional(),
});

// POST /devices/settings/otp — issue the confirmation code for turning email
// alerts off. Emailed to the parent, so only someone with inbox access (the
// parent) can complete the change — the child can't silence alerts alone.
devicesRouter.post(
  "/settings/otp",
  requireDevice,
  ah(async (req, res) => {
    if (!(await takeResendSlot(req.accountId!, "settings"))) {
      return res.status(429).json({ ok: false, error: "Please wait before requesting another code" });
    }
    const [acct] = await db
      .select({ email: accounts.email })
      .from(accounts)
      .where(eq(accounts.id, req.accountId!))
      .limit(1);
    if (!acct) return res.status(401).json({ ok: false, error: "Account not found" });
    const code = generateOtp();
    await storeOtp(req.accountId!, code, "settings");
    await emailService.sendSettingsOtp(acct.email, code);
    return res.json({ ok: true });
  }),
);

devicesRouter.post(
  "/settings",
  requireDevice,
  ah(async (req, res) => {
    const body = SettingsBody.parse(req.body ?? {});

    // OTP gate: turning email alerts OFF (true -> false) needs the code we
    // emailed the parent. Turning them back ON never does — re-enabling the
    // safety channel should be frictionless.
    if (body.emailAlertsEnabled === false) {
      const [cur] = await db
        .select({ on: accounts.emailAlertsEnabled })
        .from(accounts)
        .where(eq(accounts.id, req.accountId!))
        .limit(1);
      if (cur?.on) {
        if (!body.otp) return res.status(403).json({ ok: false, error: "otp_required" });
        const result = await verifyOtp(req.accountId!, body.otp, "settings");
        if (result !== "ok") return res.status(403).json({ ok: false, error: "otp_invalid" });
      }
    }

    const devPatch: { monitoredApps?: string[]; overlayEnabled?: boolean; visionEnabled?: boolean } = {};
    if (body.monitoredApps !== undefined) {
      // Keep only real app ids; empty array = watch nothing (valid, explicit).
      devPatch.monitoredApps = body.monitoredApps.filter((a) =>
        (MONITORED_APP_IDS as readonly string[]).includes(a),
      );
    }
    if (body.overlayEnabled !== undefined) devPatch.overlayEnabled = body.overlayEnabled;
    if (body.visionEnabled !== undefined) devPatch.visionEnabled = body.visionEnabled;
    if (Object.keys(devPatch).length) {
      await db
        .update(devices)
        .set({ ...devPatch, updatedAt: new Date() })
        .where(eq(devices.id, req.deviceId!));
    }

    const acctPatch: { alertThreshold?: string; emailAlertsEnabled?: boolean } = {};
    if (body.alertThreshold !== undefined) acctPatch.alertThreshold = body.alertThreshold;
    if (body.emailAlertsEnabled !== undefined) acctPatch.emailAlertsEnabled = body.emailAlertsEnabled;
    if (Object.keys(acctPatch).length) {
      await db
        .update(accounts)
        .set({ ...acctPatch, updatedAt: new Date() })
        .where(eq(accounts.id, req.accountId!));
    }

    const [d] = await db
      .select({ monitoredApps: devices.monitoredApps, overlayEnabled: devices.overlayEnabled, visionEnabled: devices.visionEnabled })
      .from(devices)
      .where(eq(devices.id, req.deviceId!))
      .limit(1);
    const [a] = await db
      .select({ threshold: accounts.alertThreshold, emailAlertsEnabled: accounts.emailAlertsEnabled })
      .from(accounts)
      .where(eq(accounts.id, req.accountId!))
      .limit(1);
    res.json({
      ok: true,
      monitoredApps: d?.monitoredApps ?? [...MONITORED_APP_IDS],
      overlayEnabled: d?.overlayEnabled ?? true,
      visionEnabled: d?.visionEnabled ?? true,
      alertThreshold: a?.threshold ?? "severe",
      emailAlertsEnabled: a?.emailAlertsEnabled ?? true,
    });
  }),
);

// Everything below is parent-scoped.
devicesRouter.use(requireParent);

// GET /devices — list this account's paired devices.
devicesRouter.get(
  "/",
  ah(async (req, res) => {
    const rows = await db.select().from(devices).where(eq(devices.accountId, req.accountId!));
    res.json({
      ok: true,
      devices: rows.map((r) => ({
        ...r,
        status: deviceHealth(r),
        // Resolve null → all enabled so the parent UI always gets a concrete set.
        monitoredApps: r.monitoredApps ?? [...MONITORED_APP_IDS],
      })),
    });
  }),
);

// PATCH /devices/:id — set name + assigned person.
const nonEmpty = <T>(arr: readonly T[]) => arr as unknown as [T, ...T[]];
const PatchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  assignee: z.string().trim().max(80).nullable().optional(),
  // Per-app monitoring set: subset of MONITORED_APP_IDS. [] = none; omitted = unchanged.
  monitoredApps: z.array(z.enum(nonEmpty(MONITORED_APP_IDS))).optional(),
  // Protective-overlay (blocking) on/off.
  overlayEnabled: z.boolean().optional(),
  visionEnabled: z.boolean().optional(),
});
devicesRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const { id } = req.params;
    const patch = PatchBody.parse(req.body);
    const [updated] = await db
      .update(devices)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(devices.id, id!), eq(devices.accountId, req.accountId!)))
      .returning();
    if (!updated) return res.status(404).json({ ok: false, error: "Device not found" });
    return res.json({ ok: true, device: updated });
  }),
);

// DELETE /devices/:id — unpair: revoke the child token + remove the row.
devicesRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const { id } = req.params;
    const [removed] = await db
      .delete(devices)
      .where(and(eq(devices.id, id!), eq(devices.accountId, req.accountId!)))
      .returning();
    if (!removed) return res.status(404).json({ ok: false, error: "Device not found" });
    await revokeDeviceToken(id!);
    return res.json({ ok: true });
  }),
);
