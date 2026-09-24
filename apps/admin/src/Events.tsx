import { useCallback, useEffect, useState } from "react";

import * as api from "./api";
import { type AdminEvent } from "./api";
import { Empty, ErrBanner, Sev, Spinner, errMsg } from "./ui";

const CHANNEL: Record<string, string> = { text: "On screen text", notification: "Notification", ocr: "Text in picture", image: "Image model" };
const APP: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", chrome: "Chrome", snapchat: "Snapchat", roblox: "Roblox", whatsapp: "WhatsApp", x: "X", facebook: "Facebook", messages: "Messages" };
const SEV_WORD: Record<string, string> = { high: "serious", review: "worth a look", low: "mild" };
const HOW: Record<string, string> = {
  text: "Words on the screen",
  notification: "A notification",
  ocr: "Words inside a picture or video",
  image: "The picture itself",
};
const BY: Record<string, string> = { lexicon: "matched the word list", model: "looked like it to the text model", image: "was scored by the image model" };
const MODEL_NAME: Record<string, string> = {
  "lh-textmodel-v1": "Lighthouse text model v1",
  "mobilenetv4-small-nsfw": "MobileNetV4 small, nudity model",
  "mlkit-text-v2": "ML Kit text recognition v2",
};
const TIER_WORD: Record<string, string> = { fast: "fast phone", mid: "mid range phone", slow: "slow phone" };
const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;
const name = (v: unknown) => MODEL_NAME[String(v)] ?? String(v);

export function plain(e: AdminEvent): string {
  const how = HOW[e.channel] ?? "Something";
  const app = e.app ? APP[e.app] ?? e.app : "an app";
  const cat = e.category ?? "something risky";
  const sev = e.severity ? SEV_WORD[e.severity] ?? e.severity : "";
  const by = BY[String(e.meta.decidedBy ?? "")] ?? "";
  const paused = e.meta.paused === true ? " The screen was paused." : "";
  return `${how} in ${app} pointed to ${cat}${sev ? ` (${sev})` : ""}${by ? `, it ${by}` : ""}.${paused}`;
}

function rows(e: AdminEvent): [string, string][] {
  const m = e.meta;
  const out: [string, string][] = [];
  const by = String(m.decidedBy ?? "");
  if (by === "lexicon") out.push(["Decided by", `The word list, version ${String(m.lexiconVersion ?? "?")}. An exact phrase matched.`]);
  if (by === "model") out.push(["Decided by", `${name(m.model)}, ${m.confidence != null ? `${pct(m.confidence)} sure` : "confident"}. The word list found nothing first.`]);
  if (by === "image") {
    out.push(["Decided by", `${name(m.model)}, looking at the picture itself.`]);
    out.push(["Scores", `nudity ${pct(m.porn)}, drawn nudity ${pct(m.hentai)}, suggestive ${pct(m.sexy)}, neutral ${pct(m.neutral)}`]);
    if (m.crops != null) out.push(["Checked", `${String(m.crops)} square crop${Number(m.crops) === 1 ? "" : "s"} of the frame in ${String(m.imageMs ?? "?")} ms`]);
  }
  if (e.channel === "ocr") out.push(["Words read by", `${name(m.ocr)} in ${String(m.ocrMs ?? "?")} ms, ${String(m.chars ?? "?")} characters found`]);
  if (e.channel === "text" || e.channel === "notification") out.push(["Words read from", `Android's accessibility text, ${String(m.chars ?? "?")} characters`]);
  if (m.frameTier != null) out.push(["Screen checks", `every ${Math.round(Number(m.intervalMs ?? 0) / 1000)} s on this ${TIER_WORD[String(m.frameTier)] ?? String(m.frameTier)}`]);
  if (m.paused === true) out.push(["Action", "The screen was paused on the phone."]);
  else if (m.paused === false) out.push(["Action", "Flagged only. Below the parent's pause threshold."]);
  if (m.engine != null) out.push(["App", String(m.engine).replace("child-", "Lighthouse ")]);
  return out;
}

export function Meta({ e }: { e: AdminEvent }) {
  const r = rows(e);
  if (!r.length) return null;
  return (
    <details style={{ marginTop: 6 }}>
      <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>How we know</summary>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", fontSize: 13, lineHeight: "19px", marginTop: 6 }}>
        {r.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function Events() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [err, setErr] = useState("");
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.listEvents(150);
      setEvents(r.events);
      setErr("");
    } catch (e) {
      setErr(errMsg(e, "Alerts did not load"));
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, [live, load]);

  if (err && !events) return <ErrBanner e={err} />;
  if (!events) return <Spinner />;

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{events.length} most recent. Open "How we know" under any alert for the detail.</span>
        <label className="row" style={{ gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Refresh every 5 s
        </label>
      </div>
      {events.length === 0 ? (
        <Empty>No alerts yet. When a phone flags something it shows here.</Empty>
      ) : (
        <div className="list">
          {events.map((e) => (
            <div className="term" key={e.id} style={{ alignItems: "flex-start" }}>
              <div className="txt" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 15, lineHeight: "22px" }}>{plain(e)}</div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <b>{e.category ?? "Unknown"}</b>
                  {e.severity && <Sev s={e.severity} />}
                  <span className="badge lang">{CHANNEL[e.channel] ?? e.channel}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{e.app ? `${APP[e.app] ?? e.app}, ` : ""}{e.deviceName}</span>
                </div>
                <Meta e={e} />
              </div>
              <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(e.occurredAt).toLocaleTimeString()}<br />{new Date(e.occurredAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
