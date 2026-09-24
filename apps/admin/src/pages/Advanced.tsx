import { useEffect, useState } from "react";

import * as api from "../api";
import { type EvalResult } from "../api";
import { Dataset } from "../Dataset";
import { Jobs } from "../Jobs";
import { type AdvTab } from "../routes";
import { ErrBanner, Page, Seg, Spinner, errMsg } from "../ui";

function Eval() {
  const [r, setR] = useState<EvalResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setErr("");
    try {
      setR(await api.runEval());
    } catch (e) {
      setErr(errMsg(e, "The accuracy check failed"));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => void load(), []);

  return (
    <div>
      {err && <ErrBanner e={err} />}
      {busy && !r ? <Spinner /> : r && (
        <>
          <div className="metrics">
            <div className="metric"><div className="val">{r.accuracy}%</div><div className="lbl">Overall accuracy</div></div>
            <div className="metric"><div className="val">{r.safeFalsePositiveRate}%</div><div className="lbl">Safe messages wrongly flagged (lower is better)</div></div>
            <div className="metric"><div className="val">{r.hardNegativePassRate}%</div><div className="lbl">Tricky safe messages passed</div></div>
            <div className="metric"><div className="val">{r.categoryAccuracy}%</div><div className="lbl">Right category</div></div>
            <div className="metric"><div className="val">{r.codeswitchDetection}%</div><div className="lbl">Mixed language caught</div></div>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>Live word list v{r.version}, {r.total} test messages.</p>
          {r.dataset && (
            <>
              <h2>Against approved examples</h2>
              <div className="metrics">
                <div className="metric"><div className="val">{r.dataset.accuracy}%</div><div className="lbl">Overall accuracy</div></div>
                <div className="metric"><div className="val">{r.dataset.safeFalsePositiveRate}%</div><div className="lbl">Safe messages wrongly flagged (lower is better)</div></div>
                <div className="metric"><div className="val">{r.dataset.categoryAccuracy}%</div><div className="lbl">Right category</div></div>
              </div>
              <p className="muted small" style={{ marginTop: 10 }}>{r.dataset.total} approved eval examples.</p>
            </>
          )}
          <button className="btn ghost sm" onClick={() => void load()} disabled={busy} style={{ marginTop: 8 }}>{busy ? "Running" : "Run again"}</button>
        </>
      )}
    </div>
  );
}

const TABS: { id: AdvTab; label: string; blurb: string }[] = [
  { id: "eval", label: "Accuracy check", blurb: "We keep 52 test messages with known answers. This runs the live word list against them and shows the score. A health check, nothing to do here." },
  { id: "dataset", label: "Training examples", blurb: "Example messages collected for the text model. Approve or reject them when you have time. Nothing here changes phones until the model is retrained and a new app is built." },
  { id: "jobs", label: "Background jobs", blurb: "The server job that collects examples and word suggestions every 6 hours. Run history and an off switch. You rarely need this." },
];

export function Advanced({ tab, setTab, datasetCandidates, toast, refresh }: { tab: AdvTab; setTab: (t: AdvTab) => void; datasetCandidates: number; toast: (m: string) => void; refresh: () => void }) {
  const cur = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  return (
    <Page title="Advanced" blurb="Health checks and model training tools. Mostly for engineers.">
      <Seg value={tab} onChange={setTab} items={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === "dataset" ? datasetCandidates : undefined }))} />
      <p className="muted" style={{ margin: "14px 0 18px", fontSize: 13, maxWidth: "64ch" }}>{cur.blurb}</p>
      {tab === "eval" && <Eval />}
      {tab === "dataset" && <Dataset toast={toast} onChange={refresh} />}
      {tab === "jobs" && <Jobs toast={toast} />}
    </Page>
  );
}
