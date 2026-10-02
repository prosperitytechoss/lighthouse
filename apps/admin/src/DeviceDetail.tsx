import { useEffect, useState } from "react";

import * as api from "./api";
import { type DeviceDetail as Detail } from "./api";
import { Meta, plain } from "./Events";
import { ErrBanner, Sev, Spinner, errMsg } from "./ui";

const APP: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", chrome: "Chrome", snapchat: "Snapchat", roblox: "Roblox", whatsapp: "WhatsApp", x: "X", facebook: "Facebook", messages: "Messages" };
const THRESHOLD: Record<string, string> = { severe: "serious only", moderate: "serious and worth a look", all: "everything" };
const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : "never");
const onoff = (v: boolean | null | undefined) => (v === true ? "on" : v === false ? "off" : "unknown");

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "contents" }}>
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      <div className="kv">
        {rows.map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </div>
    </div>
  );
}

export function DeviceDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ device: Detail; events: api.AdminEvent[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.getDevice(id).then(setData).catch((e) => setErr(errMsg(e, "This phone did not load")));
  }, [id]);
  if (err) return <ErrBanner e={err} />;
  if (!data) return <Spinner />;
  const d = data.device;
  const s = d.engineStats ?? {};
  const n = (k: string) => (s[k] == null ? "?" : String(s[k]));
  const apps = d.monitoredApps ? d.monitoredApps.map((a) => APP[a] ?? a).join(", ") : "all";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div className="cols">
        <Block title="Phone" rows={[
          ["Model", [d.deviceInfo?.manufacturer, d.deviceInfo?.model].filter(Boolean).join(" ") || "unknown"],
          ["Android", d.deviceInfo?.os ?? "unknown"],
          ["Battery", d.batteryLevel == null ? "not reported yet" : `${d.batteryLevel}%${d.batteryCharging ? ", charging" : ""}`],
          ["Last check in", when(d.lastSeenAt)],
          ["Set up", when(d.pairedAt ?? d.createdAt)],
        ]} />
        <Block title="Parent" rows={[
          ["Email", d.email ?? "?"],
          ["Email confirmed", onoff(d.emailVerified)],
          ["Alerts", onoff(d.emailAlertsEnabled)],
          ["Alert level", THRESHOLD[d.alertThreshold ?? ""] ?? d.alertThreshold ?? "?"],
          ["Pause screen on risk", onoff(d.overlayEnabled)],
          ["Watched apps", apps],
        ]} />
      </div>
      <div className="cols">
        <Block title="Monitoring switches on the phone" rows={[
          ["Read screen (accessibility)", onoff(d.accessibilityEnabled)],
          ["Read notifications", onoff(d.notificationAccessEnabled)],
          ["Battery saver exemption", onoff(d.batteryOptimizationExempt)],
        ]} />
        <Block title="Vision" rows={[
          ["Supported", d.visionSupported == null ? "unknown" : d.visionSupported ? "yes" : "no, needs Android 11"],
          ["Switched on", onoff(d.visionEnabled)],
          ["Tier", d.visionTier ? `${d.visionTier}, every ${Math.round((d.visionIntervalMs ?? 0) / 1000)} s` : "not running"],
          ["Frames checked", String(d.visionFrames ?? 0)],
          ["Last frame", when(d.visionLastFrameAt)],
          ["Last timings", `ocr ${n("lastOcrMs")} ms, image ${n("lastImageMs")} ms`],
          ["Models", `${n("ocr")} ${s.ocrReady === true ? "ready" : ""}, ${n("imageModel")} ${s.imageReady === true ? "ready" : ""}, ${n("textModel")} ${s.textModelReady === true ? "ready" : ""}`],
          ["Word list on phone", `v${n("lexiconVersion")}`],
          ["App", n("engine")],
        ]} />
      </div>
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 8px" }}>Recent alerts on this phone</h3>
        {data.events.length === 0 ? <span className="muted" style={{ fontSize: 13 }}>Nothing flagged yet.</span> : data.events.map((e) => (
          <div key={e.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, lineHeight: "20px" }}>{plain(e)}</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 13 }}>{e.category ?? "Unknown"}</b>
              {e.severity && <Sev s={e.severity} />}
              <span className="muted" style={{ fontSize: 12 }}>{new Date(e.occurredAt).toLocaleString()}</span>
            </div>
            <Meta e={e} />
          </div>
        ))}
      </div>
    </div>
  );
}
