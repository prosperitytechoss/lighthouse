/**
 * Episode grouping — turns the raw signal firehose into digestible events.
 *
 * Aggregate-on-READ: raw signals stay stored untouched; we group them at query
 * time. Grouping key = same device + same app + same category, within a rolling
 * window. A signal within EPISODE_WINDOW of the previous one in its group EXTENDS
 * the episode; a larger gap starts a new one. (Brain-agnostic — no classify().)
 *
 * The same window powers push dedup (one alert per open episode), so both live
 * here as the single source of truth.
 */

export const EPISODE_WINDOW_MS = 30 * 60 * 1000;
export const EPISODE_WINDOW_SECONDS = EPISODE_WINDOW_MS / 1000;

/** Highest-severity-wins ranking for an episode's headline severity. */
const SEVERITY_RANK: Record<string, number> = { high: 3, review: 2, low: 1 };

export type RawSignal = {
  id: string;
  deviceId: string;
  category: string;
  severity: string;
  app: string;
  occurredAt: Date;
};

/** A single underlying signal, exposed for episode drill-down. */
export type EpisodeItem = { id: string; severity: string; occurredAt: string };

export type Episode = {
  /** Stable synthetic id: device|app|category|startISO. */
  id: string;
  deviceId: string;
  app: string;
  category: string;
  /** Highest severity present in the episode. */
  topSeverity: string;
  startAt: string;
  endAt: string;
  count: number;
  severityCounts: Record<string, number>;
  /** Underlying signals (for drill-down), oldest→newest. */
  items: EpisodeItem[];
};

/** Group raw signals into episodes, newest episode (by endAt) first. */
export function groupEpisodes(signals: RawSignal[]): Episode[] {
  const byKey = new Map<string, RawSignal[]>();
  for (const s of signals) {
    const k = `${s.deviceId}|${s.app}|${s.category}`;
    const arr = byKey.get(k);
    if (arr) arr.push(s);
    else byKey.set(k, [s]);
  }

  const episodes: Episode[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    let cur: RawSignal[] = [];
    const flush = () => {
      if (cur.length === 0) return;
      const first = cur[0]!;
      const last = cur[cur.length - 1]!;
      const severityCounts: Record<string, number> = {};
      let topSeverity = cur[0]!.severity;
      for (const s of cur) {
        severityCounts[s.severity] = (severityCounts[s.severity] ?? 0) + 1;
        if ((SEVERITY_RANK[s.severity] ?? 0) > (SEVERITY_RANK[topSeverity] ?? 0)) topSeverity = s.severity;
      }
      episodes.push({
        id: `${first.deviceId}|${first.app}|${first.category}|${first.occurredAt.toISOString()}`,
        deviceId: first.deviceId,
        app: first.app,
        category: first.category,
        topSeverity,
        startAt: first.occurredAt.toISOString(),
        endAt: last.occurredAt.toISOString(),
        count: cur.length,
        severityCounts,
        items: cur.map((s) => ({ id: s.id, severity: s.severity, occurredAt: s.occurredAt.toISOString() })),
      });
      cur = [];
    };
    for (const s of arr) {
      const prev = cur[cur.length - 1];
      if (prev && s.occurredAt.getTime() - prev.occurredAt.getTime() > EPISODE_WINDOW_MS) flush();
      cur.push(s);
    }
    flush();
  }

  episodes.sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());
  return episodes;
}
