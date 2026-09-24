import { useEffect, useState } from "react";

import * as api from "../api";
import { type DatasetStats, type JobsInfo, type LexStatus, type Overview } from "../api";
import { BarChart, Bars, CHANNEL_LABEL } from "../Charts";
import { DeviceList, fmtSeen } from "../DeviceList";
import { JOB_LABEL, runFailures } from "../Jobs";
import { type Go } from "../routes";
import { Page, Spinner, errMsg } from "../ui";

type Item = { tone: "high" | "review" | "low"; tag: string; text: string; action: string; go: () => void };

function statusLine(ov: Overview | null, status: LexStatus | null, attention: number): string {
  const parts: string[] = [];
  if (ov) {
    const total = ov.stats.totalDevices;
    if (total === 0) parts.push("No phones set up yet.");
    else parts.push(`${ov.stats.reporting} of ${total} phone${total === 1 ? "" : "s"} reporting.`);
  }
  parts.push(attention === 0 ? "Nothing needs attention." : `${attention} thing${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention.`);
  if (status && ov) {
    const known = ov.devices.filter((d) => d.engineStats?.lexiconVersion != null);
    const behind = known.filter((d) => Number(d.engineStats!.lexiconVersion) < status.version).length;
    if (status.pendingChanges) parts.push(`Word list v${status.version} is out, with changes waiting to publish.`);
    else if (behind > 0) parts.push(`Word list v${status.version}. ${behind} phone${behind === 1 ? " is" : "s are"} still on an older list.`);
    else if (known.length > 0) parts.push(`Word list v${status.version} on every phone.`);
    else parts.push(`Word list v${status.version} published.`);
  }
  return parts.join(" ");
}

export function Home({ go, status, statusError }: { go: Go; status: LexStatus | null; statusError: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [ds, setDs] = useState<DatasetStats | null>(null);
  const [jobs, setJobs] = useState<JobsInfo | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, d, j] = await Promise.allSettled([api.getOverview(), api.datasetStats(), api.listJobs()]);
      if (!alive) return;
      const e: string[] = [];
      if (o.status === "fulfilled") setOv(o.value); else e.push(`Phones and signals did not load. ${errMsg(o.reason, "")}`.trim());
      if (d.status === "fulfilled") setDs(d.value); else e.push(`Training example counts did not load. ${errMsg(d.reason, "")}`.trim());
      if (j.status === "fulfilled") setJobs(j.value); else e.push(`Background job history did not load. ${errMsg(j.reason, "")}`.trim());
      setErrs(e);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const items: Item[] = [];
  for (const d of ov?.devices ?? []) {
    if (d.health === "not_reporting") items.push({ tone: "high", tag: "Not reporting", text: `${d.name} has not checked in since ${fmtSeen(d.lastSeenAt)}.`, action: "Open phone", go: () => go("phones", d.id) });
    if (d.health === "monitoring_off") items.push({ tone: "review", tag: "Switch off", text: `${d.name} has a monitoring switch turned off on the phone.`, action: "Open phone", go: () => go("phones", d.id) });
  }
  if (jobs) {
    const latest = new Map<string, api.JobRun>();
    for (const r of [...jobs.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) if (!latest.has(r.job)) latest.set(r.job, r);
    for (const r of latest.values()) for (const f of runFailures(r)) items.push({ tone: "review", tag: "Job failed", text: `Last "${JOB_LABEL[r.job] ?? r.job}" run: ${f}`, action: "Open jobs", go: () => go("advanced", "jobs") });
  }
  if (status?.pendingChanges) items.push({ tone: "review", tag: "Not published", text: "The word list has approved changes that are not on phones yet.", action: "Publish", go: () => go("words", "publish") });
  if (ds && (ds.approvedUntrained ?? 0) > 0) items.push({ tone: "low", tag: "Training", text: `${ds.approvedUntrained} approved example${ds.approvedUntrained === 1 ? " is" : "s are"} waiting for the next training run.`, action: "Open examples", go: () => go("advanced", "dataset") });

  return (
    <Page title="Home" blurb="How things are right now, and what to do next." errors={[statusError, ...errs]}>
      {loading ? <Spinner /> : (
        <>
          <p className="status-line">{statusLine(ov, status, items.length)}</p>

          <h2 style={{ marginTop: 0 }}>Needs attention</h2>
          <div className="attn">
            {items.length === 0 ? (
              <div className="attn-ok">Nothing right now.</div>
            ) : items.map((it, i) => (
              <div className="attn-row" key={i}>
                <span className={`badge tag ${it.tone}`}>{it.tag}</span>
                <span className="what">{it.text}</span>
                <button className="linkbtn" onClick={it.go}>{it.action}</button>
              </div>
            ))}
          </div>

          {ov && (
            <>
              <h2>Signals</h2>
              <div className="metrics">
                <div className="metric"><div className="val">{ov.stats.totalDevices}</div><div className="lbl">Phones</div></div>
                <div className="metric"><div className="val">{ov.stats.reporting}</div><div className="lbl">Reporting now</div></div>
                <div className="metric"><div className="val">{ov.stats.signals7d}</div><div className="lbl">Signals, last 7 days</div></div>
                <div className="metric"><div className="val">{ov.stats.totalSignals}</div><div className="lbl">Signals, all time</div></div>
              </div>
              <div className="section"><BarChart data={ov.byDay} /></div>
              <div className="cols section">
                <Bars title="By category" data={ov.byCategory} />
                {ov.byChannel && <Bars title="By channel" data={ov.byChannel} label={CHANNEL_LABEL} />}
              </div>

              <h2>Phones</h2>
              <DeviceList devices={ov.devices} open={open} onOpen={setOpen} emptyText="No phones set up yet." />
            </>
          )}
        </>
      )}
    </Page>
  );
}
