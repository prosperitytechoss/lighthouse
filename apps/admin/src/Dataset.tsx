import { useCallback, useEffect, useState } from "react";

import * as api from "./api";
import { type DatasetExample, type DatasetStats, type ExampleKind, type Term } from "./api";
import { Empty, ErrBanner, Sev, Spinner, errMsg, fmtWhen } from "./ui";

const KIND_LABEL: Record<ExampleKind, string> = { positive: "positive", hard_negative: "hard negative", safe: "safe" };
const KINDS: ExampleKind[] = ["positive", "hard_negative", "safe"];
const SAFE = "SAFE";

type Filters = { status: string; category: string; language: string; source: string; trained: string; search: string };
const DEFAULT_FILTERS: Filters = { status: "candidate", category: "", language: "", source: "", trained: "", search: "" };

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ flex: "1 1 140px" }}>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 4 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function AddExample({ onAdded, onError }: { onAdded: (e: DatasetExample) => void; onError: (m: string) => void }) {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState(SAFE);
  const [severity, setSeverity] = useState<Term["severity"]>("review");
  const [kind, setKind] = useState<ExampleKind>("safe");
  const [busy, setBusy] = useState(false);

  const pickCategory = (c: string) => {
    setCategory(c);
    if (c === SAFE) setKind("safe");
    else if (kind === "safe") setKind("positive");
  };

  const submit = async () => {
    setBusy(true);
    try {
      const safe = category === SAFE;
      const { example } = await api.createExample({ text: text.trim(), language, category: safe ? null : category, severity: safe ? null : severity, kind });
      setText("");
      onAdded(example);
    } catch (e) {
      onError(errMsg(e, "Add failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card section">
      <h3 style={{ margin: "0 0 10px" }}>Add example</h3>
      <input placeholder="Message text" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row wrap" style={{ marginTop: 10, alignItems: "flex-end" }}>
        <Filter label="Language" value={language} onChange={setLanguage} options={api.LANGUAGES.map((l) => ({ v: l, l: api.LANG_LABEL[l] ?? l }))} />
        <Filter label="Category" value={category} onChange={pickCategory} options={[{ v: SAFE, l: SAFE }, ...api.CATEGORIES.map((c) => ({ v: c, l: c }))]} />
        {category !== SAFE && (
          <Filter label="Severity" value={severity} onChange={(v) => setSeverity(v as Term["severity"])} options={api.SEVERITIES.map((s) => ({ v: s, l: s }))} />
        )}
        <Filter label="Kind" value={kind} onChange={(v) => setKind(v as ExampleKind)} options={KINDS.map((k) => ({ v: k, l: KIND_LABEL[k] }))} />
        <button className="btn" disabled={busy || text.trim().length < 2} onClick={() => void submit()}>{busy ? "Adding" : "Add"}</button>
      </div>
    </div>
  );
}

function ExampleRow({ ex, onPatch }: { ex: DatasetExample; onPatch: (ex: DatasetExample, patch: api.ExamplePatch, msg: string) => void }) {
  const cat = ex.category ?? SAFE;
  const setCategory = (c: string) => {
    if (c === SAFE) onPatch(ex, { category: null, severity: null, kind: "safe" }, "Marked SAFE");
    else onPatch(ex, { category: c, severity: ex.severity ?? "review", kind: ex.kind === "safe" ? "positive" : ex.kind }, `Moved to ${c}`);
  };
  return (
    <div className="cand">
      <div className="row wrap">
        <span className="txt" style={{ fontWeight: 600, fontSize: 15, flex: "1 1 240px", overflowWrap: "anywhere" }}>{ex.text}</span>
        <span className="badge lang">{api.LANG_LABEL[ex.language] ?? ex.language}</span>
        <span className={`badge ${ex.category ? "lang" : "low"}`}>{cat}</span>
        {ex.severity && <Sev s={ex.severity} />}
        <span className="badge lang">{KIND_LABEL[ex.kind]}</span>
        <span className="badge lang mono">{ex.source}</span>
                {ex.modelTag && <span className="badge low">in model {ex.modelTag}</span>}
        {ex.status !== "candidate" && <span className={`badge ${ex.status === "approved" ? "low" : "high"}`}>{ex.status}</span>}
      </div>
      <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
        <select value={cat} onChange={(e) => setCategory(e.target.value)} style={{ width: 170 }}>
          <option value={SAFE}>{SAFE}</option>
          {api.CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {ex.category && (
          <select value={ex.severity ?? "review"} onChange={(e) => onPatch(ex, { severity: e.target.value as Term["severity"] }, "Severity updated")} style={{ width: 110 }}>
            {api.SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn sm" disabled={ex.status === "approved"} onClick={() => onPatch(ex, { status: "approved" }, "Approved")}>Approve</button>
        <button className="btn danger sm" disabled={ex.status === "rejected"} onClick={() => onPatch(ex, { status: "rejected" }, "Rejected")}>Reject</button>
      </div>
    </div>
  );
}

export function Dataset({ toast, onChange }: { toast: (m: string) => void; onChange: () => void }) {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [examples, setExamples] = useState<DatasetExample[] | null>(null);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.datasetStats());
    } catch (e) {
      setErr(errMsg(e, "Training examples did not load"));
    }
  }, []);
  const loadExamples = useCallback(async () => {
    setErr("");
    try {
      const r = await api.listExamples({ ...filters, search: filters.search || undefined, status: filters.status || undefined, category: filters.category || undefined, language: filters.language || undefined, source: filters.source || undefined, trained: filters.trained || undefined, limit: "100" });
      setExamples(r.examples);
      setCount(r.count);
    } catch (e) {
      setErr(errMsg(e, "Training examples did not load"));
    }
  }, [filters]);

  useEffect(() => void loadStats(), [loadStats]);
  useEffect(() => void loadExamples(), [loadExamples]);
  useEffect(() => {
    const t = window.setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const patch = async (ex: DatasetExample, p: api.ExamplePatch, msg: string) => {
    try {
      const { example } = await api.patchExample(ex.id, p);
      setExamples((list) => list?.map((x) => (x.id === ex.id ? { ...x, ...example } : x)) ?? null);
      toast(msg);
      void loadStats();
      onChange();
    } catch (e) {
      setErr(errMsg(e, "Update failed"));
    }
  };

  const exportTrain = async () => {
    const tag = window.prompt("Name for this training run. Every approved example without a stamp gets it.", `model-${new Date().toISOString().slice(0, 10)}`);
    if (!tag) return;
    setExporting(true);
    try {
      await api.downloadExport("train", tag.trim());
      toast(`Exported and stamped as ${tag.trim()}`);
      void loadStats();
      void loadExamples();
    } catch (e) {
      setErr(errMsg(e, "Export failed"));
    } finally {
      setExporting(false);
    }
  };

  if (!stats && err) return <ErrBanner e={err} />;
  if (!stats) return <Spinner />;

  const sources = Object.keys(stats.bySource).sort();
  const all = { v: "", l: "All" };

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <div className="metrics">
        <div className="metric"><div className="val">{stats.byStatus.candidate ?? 0}</div><div className="lbl">Waiting for a human</div></div>
        <div className="metric"><div className="val">{stats.approvedUntrained ?? 0}</div><div className="lbl">Approved, not in a model yet</div></div>
        <div className="metric"><div className="val">{stats.inModel ?? 0}</div><div className="lbl">Inside a trained model</div></div>
        <div className="metric"><div className="val">{stats.byStatus.rejected ?? 0}</div><div className="lbl">Rejected</div></div>
        <div className="metric"><div className="val" style={{ fontSize: 14, lineHeight: "30px", fontFamily: "inherit" }}>{fmtWhen(stats.lastHarvestAt)}</div><div className="lbl">Last collection</div></div>
      </div>

      <div className="banner info section">
        Collected -&gt; approved by a person -&gt; exported for training -&gt; stamped with the model name. Export only takes approved examples and stamps them, so "Approved, not in a model yet" is your to do count. Phones are untouched until a new model ships in an app build.
        {stats.byModelTag && Object.keys(stats.byModelTag).length > 0 && (
          <div style={{ marginTop: 6 }}>Models so far: {Object.entries(stats.byModelTag).map(([t, n]) => `${t} (${n})`).join(", ")}</div>
        )}
      </div>

      <div className="row wrap section" style={{ justifyContent: "space-between" }}>
        <span className="muted" style={{ fontSize: 13 }}>{(stats.approvedUntrained ?? 0) > 0 ? `${stats.approvedUntrained} approved examples are ready for the next training run.` : "Nothing new to train on. Approve some examples first."}</span>
        <button className="btn ghost sm" disabled={exporting || !(stats.approvedUntrained ?? 0)} onClick={() => void exportTrain()}>{exporting ? "Exporting" : "Export for training and stamp"}</button>
      </div>

      <AddExample onAdded={() => { toast("Example added"); void loadStats(); void loadExamples(); onChange(); }} onError={setErr} />

      <div className="card section">
        <div className="row wrap" style={{ alignItems: "flex-end" }}>
          <Filter label="Status" value={filters.status} onChange={set("status")} options={[all, { v: "candidate", l: "Candidate" }, { v: "approved", l: "Approved" }, { v: "rejected", l: "Rejected" }]} />
          <Filter label="Category" value={filters.category} onChange={set("category")} options={[all, { v: SAFE, l: SAFE }, ...api.CATEGORIES.map((c) => ({ v: c, l: c }))]} />
          <Filter label="Language" value={filters.language} onChange={set("language")} options={[all, ...api.LANGUAGES.map((l) => ({ v: l, l: api.LANG_LABEL[l] ?? l }))]} />
          <Filter label="Source" value={filters.source} onChange={set("source")} options={[all, ...sources.map((s) => ({ v: s, l: s }))]} />
          <Filter label="In a model" value={filters.trained} onChange={set("trained")} options={[all, { v: "yes", l: "Yes" }, { v: "no", l: "Not yet" }]} />
        </div>
        <input placeholder="Search text" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginTop: 10 }} />
      </div>

      {!examples ? <Spinner /> : examples.length === 0 ? (
        <div className="section"><Empty>No examples match these filters.</Empty></div>
      ) : (
        <div className="section">
          <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Showing {examples.length} of {count}</p>
          {examples.map((ex) => <ExampleRow key={ex.id} ex={ex} onPatch={(e, p, m) => void patch(e, p, m)} />)}
        </div>
      )}
    </div>
  );
}
