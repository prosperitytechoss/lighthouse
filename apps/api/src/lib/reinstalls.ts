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
  for (const r of rows) {
    const key = modelKey(r.deviceInfo);
    if (!key) continue;
    const k = `${r.accountId}|${key}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const replaced = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const old of group) {
      let by: ReinstallRow | undefined;
      for (const r of group) {
        if (r.id === old.id || started(r) <= lastAlive(old)) continue;
        if (!by || started(r) > started(by)) by = r;
      }
      if (by) replaced.set(old.id, by.id);
    }
  }
  return replaced;
}
