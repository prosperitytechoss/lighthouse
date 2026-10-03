import type { Overview } from "./api";
import { DeviceDetail } from "./DeviceDetail";
import { Empty } from "./ui";

export type OverviewDevice = Overview["devices"][number];

export const HEALTH_LABEL: Record<string, string> = { active: "Online", monitoring_off: "Monitoring off", not_reporting: "Offline" };
export const HEALTH_CLASS: Record<string, string> = { active: "low", monitoring_off: "review", not_reporting: "high" };

export function fmtAgo(s: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const fmtSeen = (s: string | null) => (s ? `last online ${fmtAgo(s)}` : "never came online");

export function StatusHelp({ hours = 6 }: { hours?: number }) {
  return (
    <details className="info">
      <summary aria-label="How phone status works">i</summary>
      <div className="info-pop">
        <p className="info-chain">phone calls server → server saves the time → admin compares it to now</p>
        <p><strong>Online:</strong> last call was under {hours} hours ago.</p>
        <p><strong>Offline:</strong> last call was over {hours} hours ago. The "7 days ago" is how long ago.</p>
        <p><strong>Never online:</strong> the phone was linked, but has never called the server once.</p>
      </div>
    </details>
  );
}

export function enginePlain(d: OverviewDevice): string | null {
  const s = d.engineStats;
  if (!s) return null;
  const n = (k: string) => (s[k] == null ? 0 : Number(s[k]));
  if (!d.visionTier) return "Vision is off on this phone.";
  const ok = s.ocrReady === true && s.imageReady === true && s.textModelReady === true;
  const every = d.visionIntervalMs ? Math.round(d.visionIntervalMs / 1000) : 60;
  return `Looks at the screen every ${every} s in watched apps. ${n("framesChecked")} checks so far, ${n("textHits") + n("imageHits")} flagged. ${ok ? "All three models loaded." : "A model is missing."}`;
}

function EngineDetail({ d }: { d: OverviewDevice }) {
  const s = d.engineStats ?? {};
  const n = (k: string) => (s[k] == null ? 0 : Number(s[k]));
  const ready = (k: string) => (s[k] === true ? "ready" : s[k] === false ? "missing" : "");
  return (
    <details style={{ marginBottom: 10 }}>
      <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>Engine numbers</summary>
      <div className="kv mono" style={{ marginTop: 6 }}>
        <span className="muted">vision</span>
        <span>{d.visionTier ?? "off"}{d.visionIntervalMs ? `, every ${Math.round(d.visionIntervalMs / 1000)} s` : ""}, {n("framesChecked")} frames checked, {n("framesSkipped")} unchanged skipped{d.visionLastFrameAt ? `, last ${new Date(d.visionLastFrameAt).toLocaleTimeString()}` : ""}</span>
        <span className="muted">timing</span>
        <span>ocr {n("lastOcrMs")} ms, image {n("lastImageMs")} ms, frame {n("lastTotalMs")} ms</span>
        <span className="muted">hits</span>
        <span>{n("textHits")} from text in frames, {n("imageHits")} from the image model</span>
        <span className="muted">models</span>
        <span>{String(s.ocr ?? "ocr")} {ready("ocrReady")}, {String(s.imageModel ?? "image")} {ready("imageReady")}, {String(s.textModel ?? "text model")} {ready("textModelReady")}, word list v{String(s.lexiconVersion ?? "?")}, {String(s.engine ?? "")}</span>
      </div>
    </details>
  );
}

export function DeviceList({ devices, open, onOpen, emptyText }: { devices: OverviewDevice[]; open: string | null; onOpen: (id: string | null) => void; emptyText: string }) {
  if (devices.length === 0) return <Empty>{emptyText}</Empty>;
  return (
    <div className="list">
      {devices.map((d) => {
        const isOpen = open === d.id;
        const line = enginePlain(d);
        return (
          <div className={`term clickable ${isOpen ? "open" : ""}`} key={d.id} style={{ alignItems: "flex-start" }} onClick={() => onOpen(isOpen ? null : d.id)}>
            <div className="txt">
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {d.name}{d.assignee && <span className="muted" style={{ fontWeight: 400 }}>, {d.assignee}</span>}
              </div>
              <div className="muted small">{d.replacedBy ? "Old install. This phone was set up again" : `${d.signals} signals`}, {fmtSeen(d.lastSeenAt)}</div>
              {line && !d.replacedBy && <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-2)" }}>{line}</div>}
            </div>
            {d.replacedBy ? (
              <span className="badge lang">Reinstalled</span>
            ) : (
              <>
                {d.batteryLevel != null && <span className="badge lang">Battery {d.batteryLevel}%</span>}
                {d.visionTier ? (
                  <span className="badge lang">Vision {d.visionTier}, {d.visionFrames ?? 0} frames</span>
                ) : d.visionSupported === false ? (
                  <span className="badge lang">No vision</span>
                ) : null}
                <span className={`badge ${HEALTH_CLASS[d.health]}`}>{d.lastSeenAt ? HEALTH_LABEL[d.health] : "Never online"}</span>
              </>
            )}
            <span className="muted small" aria-hidden>{isOpen ? "Hide" : "Open"}</span>
            {isOpen && (
              <div className="detail" onClick={(e) => e.stopPropagation()}>
                {d.engineStats && <EngineDetail d={d} />}
                <DeviceDetail id={d.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ParentList({ devices, open, onOpen, emptyText }: { devices: OverviewDevice[]; open: string | null; onOpen: (id: string | null) => void; emptyText: string }) {
  if (devices.length === 0) return <Empty>{emptyText}</Empty>;
  const groups = new Map<string, OverviewDevice[]>();
  for (const d of devices) {
    const key = d.account ?? "No parent email";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <div className="parents">
      {[...groups].map(([email, ds]) => {
        const current = ds.filter((d) => !d.replacedBy);
        const old = ds.length - current.length;
        return (
          <section key={email}>
            <div className="parent-head">
              <strong>{email}</strong>
              <span className="muted small">{current.length} phone{current.length === 1 ? "" : "s"}{old ? `, ${old} old install${old === 1 ? "" : "s"}` : ""}</span>
            </div>
            <DeviceList devices={[...current, ...ds.filter((d) => d.replacedBy)]} open={open} onOpen={onOpen} emptyText={emptyText} />
          </section>
        );
      })}
    </div>
  );
}
