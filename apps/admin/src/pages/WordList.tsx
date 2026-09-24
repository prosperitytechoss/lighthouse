import { useCallback, useEffect, useState } from "react";

import * as api from "../api";
import { type LexStatus, type Term } from "../api";
import { type WordTab } from "../routes";
import { Empty, ErrBanner, Page, Seg, Sev, Spinner, errMsg, fmtWhen } from "../ui";

type Common = { toast: (m: string) => void; onChange: () => void };

function Live({ toast, onChange }: Common) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [{ terms }, st] = await Promise.all([api.listTerms({ status: "live", ...(query.length >= 2 ? { search: query } : {}) }), api.lexStatus()]);
      setTerms(terms);
      setTotal(st.liveCount);
    } catch (e) {
      setErr(errMsg(e, "Live words did not load"));
    }
  }, [query]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const act = async (t: Term, patch: Partial<Term>, msg: string) => {
    try {
      await api.patchTerm(t.id, patch);
      toast(msg);
      void load();
      onChange();
    } catch (e) {
      setErr(errMsg(e, "Change failed"));
    }
  };

  if (err && !terms) return <ErrBanner e={err} />;
  if (!terms) return <Spinner />;

  const filtered = terms;
  const capped = total != null && terms.length < total && query.length < 2;
  const byCat = api.CATEGORIES.map((cat) => ({ cat, items: filtered.filter((t) => t.category === cat) })).filter((g) => g.items.length);

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <div className="row wrap between">
        <input placeholder="Search live words" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        <span className="muted small">{total != null ? `${total.toLocaleString()} live words` : ""}{capped ? ` · showing the newest ${terms.length.toLocaleString()}, search to find any word` : query.length >= 2 ? ` · ${terms.length.toLocaleString()} match` : ""}</span>
      </div>
      {filtered.length === 0 && <div className="section"><Empty>No live word matches "{search}".</Empty></div>}
      {byCat.map(({ cat, items }) => (
        <div key={cat}>
          <h2>{cat} <span className="muted mono" style={{ fontSize: 13, fontWeight: 500 }}>{items.length}</span></h2>
          {api.LANGUAGES.map((lang) => {
            const li = items.filter((t) => t.language === lang);
            if (!li.length) return null;
            return (
              <div className="card section" key={lang}>
                <h3>{api.LANG_LABEL[lang]}</h3>
                {li.map((t) => (
                  <div className="term" key={t.id}>
                    <span className="txt">{t.text}</span>
                    <select value={t.severity} onChange={(e) => void act(t, { severity: e.target.value as Term["severity"] }, "Severity changed. Publish to send it to phones.")} style={{ width: 110 }}>
                      {api.SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="acts">
                      <button className="btn danger sm" onClick={() => void act(t, { status: "rejected" }, `Removed "${t.text}". Publish to apply.`)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Suggestions({ toast, onChange }: Common) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState("");
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const { terms } = await api.listTerms({ status: "candidate" });
      setTerms(terms);
    } catch (e) {
      setErr(errMsg(e, "Suggestions did not load"));
    }
  }, []);
  useEffect(() => void load(), [load]);

  const act = async (t: Term, patch: Partial<Term>, msg: string) => {
    try {
      await api.patchTerm(t.id, patch);
      toast(msg);
      void load();
      onChange();
    } catch (e) {
      setErr(errMsg(e, "Change failed"));
    }
  };

  const shown = (terms ?? []).filter((t) => (!lang || t.language === lang) && (!cat || t.category === cat));

  const bulk = async (status: "live" | "rejected") => {
    if (!shown.length) return;
    const word = status === "live" ? "Approve" : "Reject";
    if (!window.confirm(`${word} all ${shown.length} shown?`)) return;
    setBusy(true);
    setErr("");
    try {
      for (const t of shown) await api.patchTerm(t.id, { status });
      toast(`${shown.length} ${status === "live" ? "approved. Publish to send them to phones." : "rejected."}`);
    } catch (e) {
      setErr(errMsg(e, "Bulk change failed part way. Reload to see what went through."));
    } finally {
      setBusy(false);
      void load();
      onChange();
    }
  };

  if (err && !terms) return <ErrBanner e={err} />;
  if (!terms) return <Spinner />;
  if (terms.length === 0) return <Empty>No suggestions waiting. Use Ask Gemini to get more.</Empty>;

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>Approve puts a word on the live list. Phones get it on the next Publish. Reject throws it away.</p>
      <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: 150 }}>
          <option value="">All languages</option>
          {api.LANGUAGES.map((l) => <option key={l} value={l}>{api.LANG_LABEL[l]}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 180 }}>
          <option value="">All categories</option>
          {api.CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="muted small" style={{ flex: 1 }}>{shown.length} shown</span>
        <button className="btn sm" disabled={busy || !shown.length} onClick={() => void bulk("live")}>{busy ? "Working" : `Approve all ${shown.length}`}</button>
        <button className="btn danger sm" disabled={busy || !shown.length} onClick={() => void bulk("rejected")}>Reject all {shown.length}</button>
      </div>
      {shown.map((t) => (
        <div className="cand" key={t.id}>
          <div className="row wrap">
            <span className="txt" style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>{t.text}</span>
            <span className="badge lang">{api.LANG_LABEL[t.language]}</span>
            <span className="badge lang">{t.category}</span>
            <Sev s={t.severity} />
            {t.source === "gemini" && <span className="badge ai">Gemini</span>}
          </div>
          {t.source === "gemini" && (
            <p className="ai-note">Gemini suggested this. Check it before approving. Gemini is unreliable on Nigerian slang.</p>
          )}
          <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
            <select value={t.severity} onChange={(e) => void act(t, { severity: e.target.value as Term["severity"] }, "Severity changed")} style={{ width: 120 }}>
              {api.SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn sm" onClick={() => void act(t, { status: "live" }, `Approved "${t.text}"`)}>Approve</button>
            <button className="btn danger sm" onClick={() => void act(t, { status: "rejected" }, "Rejected")}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AskGemini({ toast, goSuggestions }: { toast: (m: string) => void; goSuggestions: () => void }) {
  const [category, setCategory] = useState(api.CATEGORIES[0]!);
  const [language, setLanguage] = useState("pidgin");
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.generate(category, language, count);
      toast(`${r.added} suggestion${r.added === 1 ? "" : "s"} added${r.source === "dev-stub" ? " (dev stub)" : ""}`);
      goSuggestions();
    } catch (e) {
      setErr(errMsg(e, "Gemini did not answer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, maxWidth: "64ch" }}>
        Gemini writes words. They land in Suggestions, not on phones. A person approves each one, then Publish sends the list out. Gemini is weak on Nigerian slang, so check every word.
      </p>
      <div className="card" style={{ maxWidth: 420 }}>
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: 6 }}>
          {api.CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label style={{ display: "block", marginTop: 12 }}>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ marginTop: 6 }}>
          {api.LANGUAGES.map((l) => <option key={l} value={l}>{api.LANG_LABEL[l]}</option>)}
        </select>
        <label style={{ display: "block", marginTop: 12 }}>How many</label>
        <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ marginTop: 6 }} />
        <button className="btn block" disabled={busy} onClick={run} style={{ marginTop: 16 }}>
          {busy ? "Asking Gemini" : "Ask Gemini"}
        </button>
      </div>
    </div>
  );
}

function Publish({ status, toast, refresh }: { status: LexStatus | null; toast: (m: string) => void; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!status) return <Spinner />;

  const doPublish = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.publish();
      toast(`Published version ${r.version} with ${r.liveCount} live words. Phones update on their next refresh.`);
      refresh();
    } catch (e) {
      setErr(errMsg(e, "Publish failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {err && <ErrBanner e={err} />}
      <div className="card" style={{ maxWidth: 560 }}>
        {status.pendingChanges ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>Approved changes are not on phones yet.</div>
            <p className="muted" style={{ margin: "6px 0 14px", fontSize: 13 }}>
              Publish takes the live words as they are now and makes them version {status.version + 1}. Phones download that on their next refresh.
            </p>
            <button className="btn" disabled={busy} onClick={doPublish}>{busy ? "Publishing" : `Publish version ${status.version + 1}`}</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>Phones have the latest list.</div>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Version {status.version}, published {fmtWhen(status.lastPublishedAt)}. Nothing to send.</p>
          </>
        )}
      </div>
      <div className="metrics section" style={{ maxWidth: 560 }}>
        <div className="metric"><div className="val">v{status.version}</div><div className="lbl">On phones</div></div>
        <div className="metric"><div className="val">{status.liveCount}</div><div className="lbl">Live words</div></div>
        <div className="metric"><div className="val">{status.candidates}</div><div className="lbl">Suggestions waiting</div></div>
      </div>
    </div>
  );
}

const TABS: { id: WordTab; label: string }[] = [
  { id: "live", label: "Live words" },
  { id: "suggest", label: "Suggestions" },
  { id: "gemini", label: "Ask Gemini" },
  { id: "publish", label: "Publish" },
];

export function WordList({ tab, setTab, status, statusError, toast, refresh }: { tab: WordTab; setTab: (t: WordTab) => void; status: LexStatus | null; statusError: string; toast: (m: string) => void; refresh: () => void }) {
  return (
    <Page title="Word list" blurb="The words phones look for. Approve suggestions, then Publish to send the list to phones." errors={[statusError]}>
      <div style={{ marginBottom: 18 }}>
        <Seg value={tab} onChange={setTab} items={TABS.map((t) => ({ ...t, count: t.id === "suggest" ? status?.candidates : t.id === "publish" && status?.pendingChanges ? 1 : undefined }))} />
      </div>
      {tab === "live" && <Live toast={toast} onChange={refresh} />}
      {tab === "suggest" && <Suggestions toast={toast} onChange={refresh} />}
      {tab === "gemini" && <AskGemini toast={toast} goSuggestions={() => { setTab("suggest"); refresh(); }} />}
      {tab === "publish" && <Publish status={status} toast={toast} refresh={refresh} />}
    </Page>
  );
}
