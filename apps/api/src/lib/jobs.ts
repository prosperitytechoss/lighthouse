import { and, eq } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db/client";
import { accounts, devices } from "../db/schema";
import { runWeeklyDigests } from "../services/digest";
import { emailService } from "../services/email";

import { isJobRunning, lastOkRun, runJob } from "./harvest";
import { logger } from "./logger";

/**
 * Safety net: a silently-dead monitor is the worst failure mode. If a child
 * device hasn't checked in (heartbeat / signal / /devices/me) for SILENCE_HOURS,
 * flag it and email the parent once per silence episode (cleared on next check-in).
 */
export async function checkSilentDevices(): Promise<{ flagged: number }> {
  const cutoff = Date.now() - env.SILENCE_HOURS * 60 * 60 * 1000;
  const rows = await db
    .select({
      deviceId: devices.id,
      name: devices.name,
      accountId: devices.accountId,
      lastSeenAt: devices.lastSeenAt,
      pairedAt: devices.pairedAt,
      createdAt: devices.createdAt,
      silenceAlertedAt: devices.silenceAlertedAt,
      email: accounts.email,
    })
    .from(devices)
    .innerJoin(accounts, eq(devices.accountId, accounts.id))
    .where(
      and(
        eq(devices.role, "child"),
        eq(accounts.emailVerified, true),
        eq(accounts.emailAlertsEnabled, true),
      ),
    );

  let flagged = 0;
  for (const d of rows) {
    if (d.silenceAlertedAt) continue; // already alerted this episode
    const last = (d.lastSeenAt ?? d.pairedAt ?? d.createdAt).getTime();
    if (last >= cutoff) continue; // checked in recently — alive

    const who = d.name ?? "your child's device";
    await emailService.sendSilenceAlert(d.email, who);
    await db.update(devices).set({ silenceAlertedAt: new Date() }).where(eq(devices.id, d.deviceId));
    flagged += 1;
  }
  logger.info(`[silence] checked ${rows.length} device(s), flagged ${flagged}`);
  return { flagged };
}

/**
 * True inside the weekly send window: the configured local weekday, from the
 * configured hour until end of day. The window is deliberately wide — sends are
 * deduped per account (weeklyDigestSentAt), so polling all morning just makes
 * the weekly resilient to restarts and late boots. (The old scheduler was a
 * 7-day setInterval from process start: any restart inside the week reset the
 * clock, so a regularly-redeployed server never sent a single weekly.)
 */
export function isWeeklySendWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: env.WEEKLY_DIGEST_TZ,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekday === DAYS[env.WEEKLY_DIGEST_DAY] && hour >= env.WEEKLY_DIGEST_HOUR;
}

let nextHarvestAt: Date | null = null;

/** What the admin Jobs tab shows: interval + when the next scheduled harvest fires. */
export function harvestSchedule(): { enabled: boolean; harvestIntervalMinutes: number; nextHarvestAt: Date | null } {
  return { enabled: env.HARVEST_ENABLED, harvestIntervalMinutes: env.HARVEST_INTERVAL_MINUTES, nextHarvestAt: env.HARVEST_ENABLED ? nextHarvestAt : null };
}

async function scheduledHarvest(): Promise<void> {
  const intervalMs = env.HARVEST_INTERVAL_MINUTES * 60_000;
  nextHarvestAt = new Date(Date.now() + intervalMs);
  try {
    if (isJobRunning("dataset_harvest")) return;
    const last = await lastOkRun("dataset_harvest");
    if (last && Date.now() - last.startedAt.getTime() < intervalMs) return;
    await runJob("dataset_harvest", "scheduler");
  } catch (e) {
    logger.error("[harvest] scheduled run failed", e);
  }
}

/** Start background schedulers. Interval-based; production can swap to real cron. */
export function startSchedulers(): void {
  const intervalMs = env.HARVEST_INTERVAL_MINUTES * 60_000;
  if (env.HARVEST_ENABLED) {
    nextHarvestAt = new Date(Date.now() + 60_000);
    setTimeout(() => {
      void scheduledHarvest();
      setInterval(() => {
        void scheduledHarvest();
      }, intervalMs).unref();
    }, 60_000).unref();
  }
  setInterval(() => {
    void checkSilentDevices().catch((e) => logger.error("[silence] error", e));
  }, 30 * 60 * 1000).unref();
  // Anchored to the calendar, not process uptime: poll every 15 minutes and let
  // the send-window check + per-account stamp decide.
  setInterval(() => {
    if (!isWeeklySendWindow()) return;
    void runWeeklyDigests().catch((e) => logger.error("[digest] error", e));
  }, 15 * 60 * 1000).unref();
  logger.info(
    `[jobs] schedulers started (silence check: 30m; weekly summary: day ${env.WEEKLY_DIGEST_DAY} from ${env.WEEKLY_DIGEST_HOUR}:00 ${env.WEEKLY_DIGEST_TZ}; harvest: ${env.HARVEST_ENABLED ? `every ${env.HARVEST_INTERVAL_MINUTES}m` : "off"})`,
  );
}
