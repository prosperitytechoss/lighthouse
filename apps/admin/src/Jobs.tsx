import { useCallback, useEffect, useState } from "react";

import * as api from "./api";
import { type DatasetSource, type JobName, type JobRun, type JobsInfo } from "./api";
import { ErrBanner, Spinner, errMsg, fmtWhen } from "./ui";

export const JOB_LABEL: Record<JobName, string> = { dataset_harvest: "Collect examples", lexicon_generate: "Ask Gemini for words" };
const STATUS_CLASS: Record<string, string> = { ok: "low", error: "high", running: "review", partial: "review" };
const SOURCE_INFO: Record<string, { name: string; what: string; becomes: string }> = {
  "hf:Ram07/Detection-for-Suicide": { name: "Reddit suicide posts", what: "Reddit posts labelled suicidal or not, from a public research set on Hugging Face.", becomes: "Self Harm examples, plus safe examples." },
  "hf:adi515/drug_slangs": { name: "Drug slang list", what: "A public list of drug slang words with the country they are used in.", becomes: "Nigerian ones become Substance Use examples and word suggestions." },
  "gemini:synthetic": { name: "Gemini written messages", what: "Not a dataset. Gemini is asked to write example kid messages in the 5 languages. The only Gemini step in this job.", becomes: "Examples in every category, plus word suggestions." },
  "hf:poorvanshi04/cyberbullying_tweets.csv": { name: "Cyberbullying tweets", what: "Tweets labelled by bullying type: ethnicity, religion, gender, or none.", becomes: "Hate Speech examples, plus safe examples." },
  "hf:franciellevargas/HausaHate": { name: "Hausa hate speech", what: "Hausa tweets labelled hate, offensive, or neither.", becomes: "Hate Speech examples in Hausa." },
  "hf:SSEF-HG-AC/cyberbullying-instagram-tiktok": { name: "Instagram and TikTok comments", what: "Comments labelled bullying or not. Capped at 300 because the labels are noisy.", becomes: "Hate Speech examples." },
  "hf:Maxx0/sexting-nsfw-adultconten": { name: "Sexting lines", what: "Adult sexting lines from a public set. Capped at 400.", becomes: "Sexual Content examples." },
};
type SourceRun = { pulled?: number | string; inserted?: number | string; skipped?: number | string; error?: string };
export const plainError = (e: string) => {
  if (/credits are depleted|429/.test(e)) return "Gemini has run out of credits. Top up the Google AI billing account.";
  if (/API key/i.test(e)) return "Gemini API key is wrong or missing.";
  return e;
};
export function runFailures(r: JobRun): string[] {
  const out: string[] = [];
  const src = (r.summary?.sources ?? {}) as Record<string, SourceRun>;
  for (const [k, v] of Object.entries(src)) if (v.error) out.push(`${SOURCE_INFO[k]?.name ?? k}: ${plainError(v.error)}`);
  if (r.error) out.push(plainError(r.error));
  return out;
}
const runStatus = (r: JobRun) => {
  if (r.status !== "ok") return r.status;
  const src = (r.summary?.sources ?? {}) as Record<string, SourceRun>;
  return Object.values(src).some((s) => s.error) ? "partial" : "ok";
};
const STATUS_WORD: Record<string, string> = { ok: "ok", error: "failed", running: "running", partial: "partly failed" };

const fmtInterval = (m: number) => (m % 60 === 0 ? `${m / 60} h` : `${m} min`);
const fmtDuration = (r: JobRun) => {
  if (!r.finishedAt) return "running";
  const s = Math.max(0, Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const fmtVal = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const compact = (s: Record<string, unknown> | null) => {
  if (!s) return "";
  return Object.entries(s).map(([k, v]) => `${k} ${fmtVal(v)}`).join(", ");
};

export function Jobs({ toast }: { toast: (m: string) => void }) {
  const [info, setInfo] = useState<JobsInfo | null>(null);
  const [sources, setSources] = useState<DatasetSource[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<JobName | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([api.listJobs(), api.listSources()]);
      setInfo(i);
      setSources(s.sources);
    } catch (e) {
      setErr(errMsg(e, "Background jobs did not load"));
    }
  }, []);
  useEffect(() => void load(), [load]);

  const run = async (job: JobName) => {
    setBusy(job);
    setErr("");
    try {
      const { run } = await api.runJob(job);
      const s = compact(run.summary);
      toast(`${JOB_LABEL[job]} done${s ? `: ${s}` : ""}`.slice(0, 160));
    } catch (e) {
      setErr(errMsg(e, "Job failed"));
    } finally {
      setBusy(null);
      void load();
    }
  };

  const toggle = async (s: DatasetSource, enabled: boolean) => {
    try {
      await api.patchSource(s.id, enabled);
      setSources((list) => list?.map((x) => (x.id === s.id ? { ...x, enabled } : x)) ?? null);
      toast(`${s.key} ${enabled ? "on" : "off"}`);
    } catch (e) {
      setErr(errMsg(e, "Update failed"));
    }
  };

  if (!info && err) return <ErrBanner e={err} />;
  if (!info || !sources) return <Spinner />;

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <div className="banner info" style={{ marginTop: 0 }}>
        One job runs here, every 6 hours. It collects example messages from the sources below into Training examples, and asks Gemini for new word suggestions. Nothing it collects reaches a phone. A person approves examples, a person approves words, and only Publish sends words to phones.
      </div>
      <div className="card">
        <h3>Schedule</h3>
        <div className="row wrap" style={{ gap: 24 }}>
          <div><div className="muted" style={{ fontSize: 12 }}>Harvest every</div><div className="mono" style={{ fontWeight: 600 }}>{info.schedule.enabled === false ? "off on this server" : fmtInterval(info.schedule.harvestIntervalMinutes)}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>Next run</div><div className="mono" style={{ fontWeight: 600 }}>{info.schedule.enabled === false ? "manual only" : fmtWhen(info.schedule.nextHarvestAt)}</div></div>
        </div>
        <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
          <button className="btn sm" disabled={!!busy} onClick={() => void run("dataset_harvest")}>{busy === "dataset_harvest" ? "Collecting" : "Collect examples now"}</button>
          <button className="btn ghost sm" disabled={!!busy} onClick={() => void run("lexicon_generate")}>{busy === "lexicon_generate" ? "Asking Gemini" : "Ask Gemini for words now"}</button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Collect examples: pulls the next batch from every source below. Ask Gemini for words: 15 word suggestions for each language and category, straight into Suggestions.</p>
        {busy && <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>This can take a few minutes. Keep the tab open.</p>}
      </div>

      <div className="card section">
        <h3 style={{ margin: "0 0 4px" }}>Where examples come from</h3>
        <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Switch a source off and the job skips it. "hf" means Hugging Face, the public site these datasets live on.</p>
        {sources.map((s) => {
          const info = SOURCE_INFO[s.key];
          return (
            <div className="term" key={s.id} style={{ alignItems: "flex-start" }}>
              <input type="checkbox" className="switch" checked={s.enabled} onChange={(e) => void toggle(s, e.target.checked)} aria-label={s.key} />
              <div className="txt">
                <b>{info?.name ?? s.key}</b> <span className="mono muted" style={{ fontSize: 11 }}>{s.key}</span>
                {info && <div style={{ fontSize: 13, lineHeight: "19px", marginTop: 2 }}>{info.what} <span className="muted">Becomes:</span> {info.becomes}</div>}
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.totalPulled} examples taken so far, last run {fmtWhen(s.lastRunAt)}</div>
              </div>
              <span className={`badge ${s.kind === "gemini" ? "ai" : "lang"}`}>{s.kind === "gemini" ? "Gemini" : "public dataset"}</span>
            </div>
          );
        })}
        {sources.length === 0 && <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>No sources yet. The first harvest seeds them.</p>}
      </div>

      <div className="card section">
        <h3 style={{ margin: "0 0 4px" }}>Recent runs</h3>
        {info.runs.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>No runs yet.</p>
        ) : (
          <div className="tablewrap">
          <table className="runs">
            <thead>
              <tr><th>Job</th><th>Status</th><th>Started</th><th>Took</th><th>Summary</th></tr>
            </thead>
            <tbody>
              {info.runs.map((r) => {
                const st = runStatus(r);
                const src = (r.summary?.sources ?? {}) as Record<string, SourceRun>;
                const lines = Object.entries(src).map(([k, v]) => ({ name: SOURCE_INFO[k]?.name ?? k, added: Number(v.inserted ?? 0), pulled: Number(v.pulled ?? 0), error: v.error }));
                const added = lines.reduce((a, l) => a + l.added, 0);
                const failed = lines.filter((l) => l.error);
                return (
                  <tr key={r.id}>
                    <td>{JOB_LABEL[r.job] ?? r.job}<div className="muted" style={{ fontSize: 11 }}>{r.triggeredBy === "scheduler" ? "automatic" : r.triggeredBy ?? ""}</div></td>
                    <td><span className={`badge ${STATUS_CLASS[st] ?? "lang"}`}>{STATUS_WORD[st] ?? st}</span></td>
                    <td className="mono">{fmtWhen(r.startedAt)}</td>
                    <td className="mono">{fmtDuration(r)}</td>
                    <td>
                      {lines.length ? <div>{added} new examples added</div> : <span className="summary">{compact(r.summary)}</span>}
                      {failed.map((l) => <div key={l.name} style={{ color: "var(--high)", fontWeight: 600 }}>{l.name}: {plainError(l.error!)}</div>)}
                      {lines.length > 0 && (
                        <details><summary className="muted" style={{ fontSize: 12, cursor: "pointer" }}>per source</summary>
                          {lines.map((l) => <div key={l.name} className="muted" style={{ fontSize: 12 }}>{l.name}: {l.pulled} taken, {l.added} new{l.error ? ", failed" : ""}</div>)}
                        </details>
                      )}
                      {r.error && <div style={{ color: "var(--high)", fontWeight: 600 }}>{plainError(r.error)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
