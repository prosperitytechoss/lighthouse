import { useCallback, useEffect, useState } from "react";

import * as api from "../api";
import { type AppConfig, type KeeperVersion, type PopupPhoneRow, type PopupRow } from "../api";
import { type OverviewDevice } from "../DeviceList";
import { Empty, ErrBanner, Page, Spinner, errMsg, fmtWhen } from "../ui";

const BUILT_IN = "0.1";
const mb = (b: number | null) => (b == null ? "missing" : `${(b / 1e6).toFixed(1)} MB`);
const perDay = (r: PopupRow) => (r.phoneDays ? (r.popups / r.phoneDays).toFixed(1) : "0");
const hasButton = (engine: string) => {
  const m = engine.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const [x, y, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return x > 0 || y > 6 || (y === 6 && z >= 3);
};
const wrongRate = (r: PopupRow) => (!hasButton(r.engine) ? "no button yet" : r.popups ? `${Math.round((r.wrong / r.popups) * 100)}%` : "none");
const label = (r: PopupRow) => `${r.engine.replace("child-", "App ")}, Keeper ${r.keeperVersion === "unknown" ? "none" : r.keeperVersion}`;

function PictureText({ toast }: { toast: (m: string) => void }) {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.getConfig().then(setCfg).catch((e) => setErr(errMsg(e, "Settings did not load")));
  }, []);
  const flip = async () => {
    if (!cfg) return;
    const next = !cfg.ocrPopups;
    if (!window.confirm(next ? "Turn on pop-ups for text inside pictures on every phone?" : "Turn off pop-ups for text inside pictures on every phone?")) return;
    setBusy(true);
    try {
      setCfg(await api.setConfig({ ocrPopups: next }));
      toast(next ? "Picture text pop-ups are on. Phones switch at their next check-in." : "Picture text pop-ups are off.");
    } catch (e) {
      setErr(errMsg(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      {err && <ErrBanner e={err} />}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <b>Pop-ups for text inside pictures</b>
          <div className="muted">{cfg ? (cfg.ocrPopups ? "On" : "Off. Picture text is logged only.") : "Loading"}{cfg?.updatedBy ? `, changed by ${cfg.updatedBy} ${fmtWhen(cfg.updatedAt)}` : ""}</div>
        </div>
        <button className="btn ghost sm" disabled={!cfg || busy} onClick={() => void flip()}>{cfg?.ocrPopups ? "Turn off" : "Turn on"}</button>
      </div>
    </div>
  );
}

function Popups() {
  const [data, setData] = useState<{ byVersion: PopupRow[]; byPhone: PopupPhoneRow[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.popupStats(30).then(setData).catch((e) => setErr(errMsg(e, "Pop-up numbers did not load")));
  }, []);
  if (err) return <ErrBanner e={err} />;
  if (!data) return <Spinner />;
  const versions = data.byVersion.filter((r) => r.popups > 0 || r.wrong > 0 || r.phoneDays > 0);
  return (
    <>
      <h2>Pop-ups by version, last 30 days</h2>
      {versions.length === 0 ? <Empty>No pop-ups in the last 30 days.</Empty> : (
        <div className="card tablewrap">
          <table className="runs">
            <thead><tr><th>Version</th><th>Phones</th><th>Pop-ups</th><th>Per phone per day</th><th>Marked wrong</th><th>Wrong rate</th></tr></thead>
            <tbody>
              {versions.map((r) => (
                <tr key={`${r.engine}|${r.keeperVersion}`}>
                  <td><b>{label(r)}</b></td>
                  <td>{r.phones}</td>
                  <td>{r.popups}</td>
                  <td>{perDay(r)}</td>
                  <td>{r.wrong}</td>
                  <td className="muted">{wrongRate(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>Pop-ups by phone</h2>
      {data.byPhone.length === 0 ? <Empty>No phone has shown a pop-up in the last 30 days.</Empty> : (
        <div className="card tablewrap">
          <table className="runs">
            <thead><tr><th>Phone</th><th>Version</th><th>Pop-ups</th><th>Per day</th><th>Marked wrong</th><th>Wrong rate</th></tr></thead>
            <tbody>
              {data.byPhone.map((r) => (
                <tr key={`${r.deviceId}|${r.engine}|${r.keeperVersion}`}>
                  <td><b>{r.name ?? "Phone"}</b><div className="muted">{r.email ?? ""}</div></td>
                  <td className="muted">{label(r)}</td>
                  <td>{r.popups}</td>
                  <td>{perDay(r)}</td>
                  <td>{r.wrong}</td>
                  <td className="muted">{wrongRate(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Upload({ onDone, toast }: { onDone: () => void; toast: (m: string) => void }) {
  const [version, setVersion] = useState("");
  const [onnx, setOnnx] = useState<File | null>(null);
  const [spm, setSpm] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [cutoff, setCutoff] = useState("0.8");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const minRisk = Number(cutoff);
  const ok = /^[0-9A-Za-z._-]{1,32}$/.test(version.trim()) && onnx && spm && minRisk >= 0 && minRisk <= 1;

  const send = async () => {
    if (!ok) return;
    const v = version.trim();
    setErr("");
    try {
      setBusy("Uploading the model");
      await api.uploadKeeperFile(v, "keeper.onnx", onnx);
      setBusy("Uploading the word pieces");
      await api.uploadKeeperFile(v, "keeper.spm", spm);
      await api.patchKeeper(v, { minRisk, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      toast(`Keeper ${v} uploaded. Publish it to send it to phones.`);
      setVersion("");
      setOnnx(null);
      setSpm(null);
      setNotes("");
      onDone();
    } catch (e) {
      setErr(errMsg(e, "Upload failed"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ margin: "0 0 10px" }}>Upload a version</h3>
      {err && <ErrBanner e={err} />}
      <div className="kv" style={{ alignItems: "center", rowGap: 10 }}>
        <span className="muted">Version</span>
        <input placeholder="0.2" value={version} onChange={(e) => setVersion(e.target.value)} />
        <span className="muted">keeper.onnx</span>
        <input type="file" accept=".onnx" onChange={(e) => setOnnx(e.target.files?.[0] ?? null)} />
        <span className="muted">keeper.spm</span>
        <input type="file" accept=".spm,.model" onChange={(e) => setSpm(e.target.files?.[0] ?? null)} />
        <span className="muted">Cutoff</span>
        <input placeholder="0.8" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        <span className="muted">Notes</span>
        <input placeholder="Exam 80%, caught 84%" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn" style={{ marginTop: 14 }} disabled={!ok || !!busy} onClick={send}>{busy || "Upload"}</button>
    </div>
  );
}

export function Keeper({ toast }: { toast: (m: string) => void }) {
  const [versions, setVersions] = useState<KeeperVersion[] | null>(null);
  const [devices, setDevices] = useState<OverviewDevice[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    api.keeperVersions().then((r) => { setVersions(r.versions); setErr(""); }).catch((e) => setErr(errMsg(e, "Keeper versions did not load")));
    api.getOverview().then((o) => setDevices(o.devices)).catch(() => setDevices([]));
  }, []);
  useEffect(load, [load]);

  const live = versions?.find((v) => v.live) ?? null;
  const onPhone = (v: string) => devices.filter((d) => String(d.engineStats?.keeperVersion ?? "") === v).length;
  const reporting = devices.filter((d) => d.engineStats?.keeperVersion != null).length;

  const publish = async (v: KeeperVersion) => {
    const rollback = live && v.createdAt < live.createdAt;
    if (!window.confirm(rollback ? `Roll phones back to Keeper ${v.version}?` : `Send Keeper ${v.version} to every phone?`)) return;
    setBusy(v.version);
    try {
      await api.publishKeeper(v.version);
      toast(`Keeper ${v.version} is live. Phones switch on their next check, on Wi-Fi.`);
      load();
    } catch (e) {
      setErr(errMsg(e, "Publish failed"));
    } finally {
      setBusy("");
    }
  };

  return (
    <Page title="Keeper" blurb="The safety model on phones. Publish a version and phones download it on Wi-Fi." errors={[err]}>
      {!versions ? <Spinner /> : (
        <>
          <div className="metrics" style={{ maxWidth: 560 }}>
            <div className="metric"><div className="val">{live ? live.version : BUILT_IN}</div><div className="lbl">{live ? "Published version" : "Version built into the app"}</div></div>
            <div className="metric"><div className="val">{onPhone(live ? live.version : BUILT_IN)}</div><div className="lbl">Phones running it</div></div>
            <div className="metric"><div className="val">{devices.length - reporting}</div><div className="lbl">Phones still on the old app</div></div>
          </div>

          <h2>Pop-up settings</h2>
          <PictureText toast={toast} />

          <Popups />

          <h2>Versions</h2>
          {versions.length === 0 ? <Empty>Nothing uploaded yet. Phones run Keeper {BUILT_IN}, which ships inside app 0.6.0. Upload a new version here when there is one.</Empty> : (
            <div className="card tablewrap">
              <table className="runs">
                <thead><tr><th>Version</th><th>Files</th><th>Cutoff</th><th>Notes</th><th>Uploaded</th><th>Phones</th><th /></tr></thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.version}>
                      <td><b>{v.version}</b>{v.live && <span className="badge tag low" style={{ marginLeft: 8 }}>Live</span>}</td>
                      <td className="muted">{mb(v.onnxBytes)} model, {mb(v.spmBytes)} pieces</td>
                      <td className="muted">{v.minRisk}</td>
                      <td className="muted">{v.notes ?? ""}</td>
                      <td className="muted">{fmtWhen(v.createdAt)}</td>
                      <td>{onPhone(v.version)}</td>
                      <td>
                        {!v.live && (
                          <button className="btn ghost sm" disabled={!!busy || !v.onnxSha256 || !v.spmSha256} onClick={() => void publish(v)}>
                            {busy === v.version ? "Publishing" : live && v.createdAt < live.createdAt ? "Roll back to this" : "Publish"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>New version</h2>
          <Upload onDone={load} toast={toast} />
        </>
      )}
    </Page>
  );
}
