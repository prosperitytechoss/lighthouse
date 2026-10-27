import { useCallback, useEffect, useState } from "react";

import * as api from "../api";
import { type KeeperVersion } from "../api";
import { type OverviewDevice } from "../DeviceList";
import { Empty, ErrBanner, Page, Spinner, errMsg, fmtWhen } from "../ui";

const BUILT_IN = "0.1";
const mb = (b: number | null) => (b == null ? "missing" : `${(b / 1e6).toFixed(1)} MB`);

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
