import type { DeviceInfo } from "../db/schema";

export type ReinstallRow = {
  id: string;
  accountId: string;
  deviceInfo: DeviceInfo | null;
  lastSeenAt: Date | null;
  pairedAt: Date | null;
  createdAt: Date;
};

const modelKey = (info: DeviceInfo | null) => {
  const model = info?.model?.trim().toLowerCase();
  return model ? `${info?.manufacturer?.trim().toLowerCase() ?? ""}|${model}` : null;
};

const started = (r: ReinstallRow) => (r.pairedAt ?? r.createdAt).getTime();
const lastAlive = (r: ReinstallRow) =>
  Math.max(r.lastSeenAt?.getTime() ?? 0, r.pairedAt?.getTime() ?? 0, r.createdAt.getTime());

export function findReplaced(rows: ReinstallRow[]): Map<string, string> {
  const groups = new Map<string, ReinstallRow[]>();
  const add = (k: string, r: ReinstallRow) => groups.set(k, [...(groups.get(k) ?? []), r]);
  for (const r of rows) {
    const key = modelKey(r.deviceInfo);
    if (key) add(`${r.accountId}|${key}`, r);
    if (r.deviceInfo?.phoneId) add(`phone|${r.deviceInfo.phoneId}`, r);
  }

  const best = new Map<string, ReinstallRow>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const old of group) {
      for (const r of group) {
        if (r.id === old.id || started(r) <= lastAlive(old)) continue;
        if (old.deviceInfo?.phoneId && r.deviceInfo?.phoneId && old.deviceInfo.phoneId !== r.deviceInfo.phoneId) continue;
        const by = best.get(old.id);
        if (!by || started(r) > started(by)) best.set(old.id, r);
      }
    }
  }
  return new Map([...best].map(([id, r]) => [id, r.id]));
}
