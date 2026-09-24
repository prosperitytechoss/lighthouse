import { desc, eq } from "drizzle-orm";

import { db } from "../db/client";
import { devices, signals } from "../db/schema";

import { decryptSignalContent } from "./signal-crypto";

export async function recentEvents(limit: number, deviceId?: string) {
  const rows = await db
    .select({
      id: signals.id,
      deviceId: signals.deviceId,
      deviceName: devices.name,
      payload: signals.payload,
      channel: signals.channel,
      source: signals.source,
      occurredAt: signals.occurredAt,
      createdAt: signals.createdAt,
    })
    .from(signals)
    .leftJoin(devices, eq(signals.deviceId, devices.id))
    .where(deviceId ? eq(signals.deviceId, deviceId) : undefined)
    .orderBy(desc(signals.occurredAt))
    .limit(limit);
  return rows.map((r) => {
    let content: { category: string; severity: string; app: string; meta?: Record<string, unknown> } | null = null;
    try {
      content = decryptSignalContent(r.payload);
    } catch {
      content = null;
    }
    return {
      id: r.id,
      deviceId: r.deviceId,
      deviceName: r.deviceName ?? "(unnamed)",
      channel: r.channel,
      source: r.source,
      occurredAt: r.occurredAt,
      createdAt: r.createdAt,
      category: content?.category ?? null,
      severity: content?.severity ?? null,
      app: content?.app ?? null,
      meta: content?.meta ?? {},
    };
  });
}
