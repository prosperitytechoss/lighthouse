import { eq } from "drizzle-orm";

import { env, isProd } from "../config/env";
import { db } from "../db/client";
import { accounts, devices } from "../db/schema";
import { runWeeklyDigests } from "../services/digest";
import { emailService } from "../services/email";

import { isJobRunning, lastOkRun, runJob } from "./harvest";
import { logger } from "./logger";
import { createQueue, createWorker, readyQueues } from "./queue";
import { findReplaced } from "./reinstalls";

/**
 * Safety net: a silently-dead monitor is the worst failure mode. If a child
 * device hasn't checked in (heartbeat / signal / /devices/me) for SILENCE_HOURS,
 * flag it and email the parent once per silence episode (cleared on next check-in).
 */
export async function checkSilentDevices(): Promise<{ flagged: number }> {
  const cutoff = Date.now() - env.SILENCE_HOURS * 60 * 60 * 1000;
  const rows = await db
    .select({
      id: devices.id,
      name: devices.name,
      accountId: devices.accountId,
      deviceInfo: devices.deviceInfo,
      lastSeenAt: devices.lastSeenAt,
      pairedAt: devices.pairedAt,
      createdAt: devices.createdAt,
      silenceAlertedAt: devices.silenceAlertedAt,
      email: accounts.email,
      emailVerified: accounts.emailVerified,
      emailAlertsEnabled: accounts.emailAlertsEnabled,
    })
    .from(devices)
    .innerJoin(accounts, eq(devices.accountId, accounts.id))
    .where(eq(devices.role, "child"));

  const replaced = findReplaced(rows);
  let flagged = 0;
  for (const d of rows) {
    if (!d.emailVerified || !d.emailAlertsEnabled) continue;
    if (d.silenceAlertedAt) continue; // already alerted this episode
    if (replaced.has(d.id)) continue;
    const last = (d.lastSeenAt ?? d.pairedAt ?? d.createdAt).getTime();
    if (last >= cutoff) continue; // checked in recently — alive

    const who = d.name ?? "your child's device";
    await emailService.sendSilenceAlert(d.email, who);
    await db.update(devices).set({ silenceAlertedAt: new Date() }).where(eq(devices.id, d.id));
    flagged += 1;
  }
  logger.info(`[silence] checked ${rows.length} device(s), flagged ${flagged}, skipped ${replaced.size} reinstalled`);
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

type ScheduledTask = "silence" | "weekly" | "harvest";
type ScheduledData = { task: ScheduledTask };
let scheduleQueue: ReturnType<typeof createQueue<ScheduledData>> | undefined;
const schedulersEnabled = isProd || env.RUN_SCHEDULERS === "true";

/** What the admin Jobs tab shows: interval + when the next scheduled harvest fires. */
export async function harvestSchedule(): Promise<{ enabled: boolean; harvestIntervalMinutes: number; nextHarvestAt: Date | null }> {
  const enabled = schedulersEnabled && env.HARVEST_ENABLED;
  const scheduler = enabled ? await scheduleQueue?.getJobScheduler("harvest") : null;
  return { enabled, harvestIntervalMinutes: env.HARVEST_INTERVAL_MINUTES, nextHarvestAt: scheduler?.next ? new Date(scheduler.next) : null };
}

async function scheduledHarvest(): Promise<void> {
  const intervalMs = env.HARVEST_INTERVAL_MINUTES * 60_000;
  if (isJobRunning("dataset_harvest")) return;
  const last = await lastOkRun("dataset_harvest");
  if (last && Date.now() - last.startedAt.getTime() < intervalMs) return;
  await runJob("dataset_harvest", "scheduler");
}

/** Redis owns schedules and locks, so restarts and overlapping deploys are safe. */
export async function startSchedulers(): Promise<void> {
  if (!schedulersEnabled || scheduleQueue) return;
  scheduleQueue = createQueue<ScheduledData>("scheduled");
  await readyQueues();
  await scheduleQueue.setGlobalConcurrency(1);
  await scheduleQueue.upsertJobScheduler("silence", { every: 30 * 60_000 }, {
    name: "silence", data: { task: "silence" },
  });
  await scheduleQueue.upsertJobScheduler("weekly", { every: 15 * 60_000 }, {
    name: "weekly", data: { task: "weekly" },
  });
  if (env.HARVEST_ENABLED) {
    await scheduleQueue.upsertJobScheduler("harvest", { every: env.HARVEST_INTERVAL_MINUTES * 60_000 }, {
      name: "harvest", data: { task: "harvest" },
    });
  } else {
    await scheduleQueue.removeJobScheduler("harvest");
  }
  createWorker<ScheduledData>("scheduled", async (job) => {
    switch (job.data.task) {
      case "silence": await checkSilentDevices(); break;
      case "weekly": if (isWeeklySendWindow()) await runWeeklyDigests(); break;
      case "harvest": if (env.HARVEST_ENABLED) await scheduledHarvest(); break;
    }
  }, { concurrency: 1 });
  logger.info("[jobs] BullMQ schedules active (silence: 30m, weekly window: 15m, harvest per configuration)");
}
