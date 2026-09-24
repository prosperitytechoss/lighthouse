import { desc, eq } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db/client";
import { accounts, devices, signals } from "../db/schema";

import { decryptSignalContent } from "./signal-crypto";

/** Fleet health, mirrors the parent devices logic (silence + tamper). */
function health(d: { lastSeenAt: Date | null; pairedAt: Date | null; createdAt: Date; accessibilityEnabled: boolean | null; notificationAccessEnabled: boolean | null }) {
  const last = (d.lastSeenAt ?? d.pairedAt ?? d.createdAt).getTime();
  if (Date.now() - last > env.SILENCE_HOURS * 3600_000) return "not_reporting";
  if (d.accessibilityEnabled === false || d.notificationAccessEnabled === false) return "monitoring_off";
  return "active";
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

/**
 * Admin fleet overview: every device across all accounts + signal stats. Signal
 * content is encrypted at rest, so we decrypt-on-read in the app layer (same as
 * the parent summary) — nothing plaintext is stored. Volume is small; fine to scan.
 */
export async function buildOverview() {
  const devs = await db
    .select({
      id: devices.id,
      name: devices.name,
      assignee: devices.assignee,
      role: devices.role,
      batteryLevel: devices.batteryLevel,
      batteryCharging: devices.batteryCharging,
      lastSeenAt: devices.lastSeenAt,
      pairedAt: devices.pairedAt,
      createdAt: devices.createdAt,
      accessibilityEnabled: devices.accessibilityEnabled,
      notificationAccessEnabled: devices.notificationAccessEnabled,
      visionSupported: devices.visionSupported,
      visionTier: devices.visionTier,
      visionFrames: devices.visionFrames,
      visionLastFrameAt: devices.visionLastFrameAt,
      engineStats: devices.engineStats,
      email: accounts.email,
    })
    .from(devices)
    .leftJoin(accounts, eq(devices.accountId, accounts.id))
    .orderBy(desc(devices.lastSeenAt));

  const sigs = await db
    .select({ deviceId: signals.deviceId, payload: signals.payload, occurredAt: signals.occurredAt, channel: signals.channel })
    .from(signals);

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const perDevice = new Map<string, number>();
  const byCategory: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const dayCounts = new Map<string, number>();
  let signals7d = 0;

  for (const s of sigs) {
    let category = "Unknown";
    try {
      category = decryptSignalContent(s.payload).category;
    } catch {
      /* undecryptable → bucket as Unknown */
    }
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    byChannel[s.channel] = (byChannel[s.channel] ?? 0) + 1;
    perDevice.set(s.deviceId, (perDevice.get(s.deviceId) ?? 0) + 1);
    if (s.occurredAt.getTime() >= weekAgo) signals7d++;
    const k = dayKey(s.occurredAt);
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }

  const byDay: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    byDay.push({ date: dayLabel(d), count: dayCounts.get(dayKey(d)) ?? 0 });
  }

  const deviceList = devs.map((d) => ({
    id: d.id,
    name: d.name ?? "(unnamed)",
    assignee: d.assignee,
    account: d.email,
    role: d.role,
    batteryLevel: d.batteryLevel,
    batteryCharging: d.batteryCharging,
    lastSeenAt: d.lastSeenAt,
    visionSupported: d.visionSupported,
    visionTier: d.visionTier,
    visionFrames: d.visionFrames,
    visionLastFrameAt: d.visionLastFrameAt,
    engineStats: (d.engineStats ?? null) as Record<string, string | number | boolean> | null,
    health: health(d),
    signals: perDevice.get(d.id) ?? 0,
  }));

  return {
    stats: {
      totalDevices: devs.length,
      reporting: deviceList.filter((d) => d.health === "active").length,
      totalSignals: sigs.length,
      signals7d,
    },
    byDay,
    byCategory,
    byChannel,
    devices: deviceList,
  };
}
