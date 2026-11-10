import { desc, eq, gte } from "drizzle-orm";

import { db } from "../db/client";
import { accounts, devices, popupReports, signals } from "../db/schema";
import { decryptSignalContent } from "./signal-crypto";

type Row = {
  engine: string;
  keeperVersion: string;
  popups: number;
  wrong: number;
  phoneDays: number;
  phones: number;
};

type PhoneRow = Row & { deviceId: string; name: string | null; email: string | null };

const day = (d: Date) => d.toISOString().slice(0, 10);
const str = (v: unknown) => (typeof v === "string" && v ? v : "unknown");

export async function popupStats(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [sigRows, wrongRows, devRows] = await Promise.all([
    db
      .select({ deviceId: signals.deviceId, payload: signals.payload, occurredAt: signals.occurredAt })
      .from(signals)
      .where(gte(signals.occurredAt, since))
      .orderBy(desc(signals.occurredAt))
      .limit(100000),
    db
      .select({ deviceId: popupReports.deviceId, engine: popupReports.engine, keeperVersion: popupReports.keeperVersion })
      .from(popupReports)
      .where(gte(popupReports.occurredAt, since)),
    db
      .select({ id: devices.id, name: devices.name, email: accounts.email })
      .from(devices)
      .leftJoin(accounts, eq(devices.accountId, accounts.id)),
  ]);

  const versions = new Map<string, Row & { phoneSet: Set<string>; daySet: Set<string> }>();
  const phones = new Map<string, PhoneRow & { daySet: Set<string> }>();
  const devInfo = new Map(devRows.map((d) => [d.id, d]));

  const vRow = (engine: string, keeperVersion: string) => {
    const k = `${engine}|${keeperVersion}`;
    let r = versions.get(k);
    if (!r) {
      r = { engine, keeperVersion, popups: 0, wrong: 0, phoneDays: 0, phones: 0, phoneSet: new Set(), daySet: new Set() };
      versions.set(k, r);
    }
    return r;
  };
  const pRow = (deviceId: string, engine: string, keeperVersion: string) => {
    const k = `${deviceId}|${engine}|${keeperVersion}`;
    let r = phones.get(k);
    if (!r) {
      const d = devInfo.get(deviceId);
      r = { deviceId, name: d?.name ?? null, email: d?.email ?? null, engine, keeperVersion, popups: 0, wrong: 0, phoneDays: 0, phones: 1, daySet: new Set() };
      phones.set(k, r);
    }
    return r;
  };

  for (const s of sigRows) {
    let meta: Record<string, unknown> | undefined;
    try {
      meta = decryptSignalContent(s.payload).meta;
    } catch {
      continue;
    }
    const engine = str(meta?.engine);
    const keeperVersion = str(meta?.modelVersion);
    const v = vRow(engine, keeperVersion);
    const p = pRow(s.deviceId, engine, keeperVersion);
    const d = `${s.deviceId}|${day(s.occurredAt)}`;
    v.phoneSet.add(s.deviceId);
    v.daySet.add(d);
    p.daySet.add(d);
    if (meta?.paused === true) {
      v.popups += 1;
      p.popups += 1;
    }
  }

  for (const w of wrongRows) {
    const engine = str(w.engine);
    const keeperVersion = str(w.keeperVersion);
    vRow(engine, keeperVersion).wrong += 1;
    pRow(w.deviceId, engine, keeperVersion).wrong += 1;
  }

  const byVersion = [...versions.values()]
    .map(({ phoneSet, daySet, ...r }) => ({ ...r, phones: phoneSet.size, phoneDays: daySet.size }))
    .sort((a, b) => b.engine.localeCompare(a.engine) || b.keeperVersion.localeCompare(a.keeperVersion));
  const byPhone = [...phones.values()]
    .map(({ daySet, ...r }) => ({ ...r, phoneDays: daySet.size }))
    .filter((r) => r.popups > 0 || r.wrong > 0)
    .sort((a, b) => b.popups - a.popups);

  return { since: since.toISOString(), days, byVersion, byPhone };
}
