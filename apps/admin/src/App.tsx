import { type ReactElement, useCallback, useEffect, useState } from "react";

import * as api from "./api";
import { type LexStatus } from "./api";
import { Login } from "./Login";
import { Advanced } from "./pages/Advanced";
import { Alerts } from "./pages/Alerts";
import { Home } from "./pages/Home";
import { Phones } from "./pages/Phones";
import { WordList } from "./pages/WordList";
import { type AdvTab, type PageId, type Route, type WordTab } from "./routes";
import { Spinner, errMsg } from "./ui";

const ICONS: Record<PageId, ReactElement> = {
  home: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" /><path d="M6.5 13.5v-4h3v4" /></svg>,
  phones: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" /><path d="M7 12.5h2" /></svg>,
  alerts: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" /></svg>,
  words: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h10M3 8h10M3 12h6" /></svg>,
  advanced: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.6" fill="var(--surface-2)" /><circle cx="10" cy="11" r="1.6" fill="var(--surface-2)" /></svg>,
};

export function App() {
  const callbackToken = new URLSearchParams(window.location.search).get("token");
  const [authed, setAuthed] = useState(!!api.getToken());
  const [checking, setChecking] = useState(!!api.getToken() || !!callbackToken);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [wordTab, setWordTab] = useState<WordTab>("live");
  const [advTab, setAdvTab] = useState<AdvTab>("eval");
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState<LexStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [datasetCandidates, setDatasetCandidates] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [callbackError, setCallbackError] = useState("");

  const toast = (m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg(""), 2800);
  };
  const refreshStatus = useCallback(() => {
    api.lexStatus().then((s) => { setStatus(s); setStatusError(""); }).catch((e) => { setStatus(null); setStatusError(`Word list status did not load. ${errMsg(e, "")}`.trim()); });
    api.datasetStats().then((s) => setDatasetCandidates(s.byStatus.candidate ?? 0)).catch(() => setDatasetCandidates(0));
  }, []);

  useEffect(() => {
    if (callbackToken) {
      api.exchangeMagic(callbackToken)
        .then(({ token }) => { api.setToken(token); setAuthed(true); })
        .catch(() => setCallbackError("That sign in link is invalid or has expired. Request a new one."))
        .finally(() => { setChecking(false); window.history.replaceState({}, "", "/"); });
      return;
    }
    if (!api.getToken()) return;
    api.me().then(() => setAuthed(true)).catch(() => api.clearToken()).finally(() => setChecking(false));
  }, [callbackToken]);
  useEffect(() => {
    if (authed) refreshStatus();
  }, [authed, refreshStatus]);

  if (checking) return <Spinner />;
  if (!authed) return <Login onAuthed={() => { setAuthed(true); }} notice={callbackError} />;

  const signOut = () => { void api.logout().catch(() => {}); api.clearToken(); setAuthed(false); };

  const go = (page: PageId, sub?: string) => {
    if (page === "words" && sub) setWordTab(sub as WordTab);
    if (page === "advanced" && sub) setAdvTab(sub as AdvTab);
    setRoute({ page, sub });
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const nav: { id: PageId; label: string; count?: number }[] = [
    { id: "home", label: "Home" },
    { id: "phones", label: "Phones" },
    { id: "alerts", label: "Alerts" },
    { id: "words", label: "Word list", count: status?.liveCount || undefined },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="shell">
      <aside className={`side ${menu ? "open" : ""}`}>
        <div className="brand">
          <img className="mark" src="/lighthouse.png" alt="" />
          <div>
            <h1>Lighthouse</h1>
            <div className="sub">Admin</div>
          </div>
        </div>
        <button className="btn ghost sm menu-btn" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h10" /></svg>
          Menu
        </button>
        <nav className="nav" aria-label="Pages">
          {nav.map((n) => (
            <button key={n.id} className={route.page === n.id ? "active" : ""} aria-current={route.page === n.id ? "page" : undefined} onClick={() => go(n.id)}>
              {ICONS[n.id]}
              {n.label}
              {n.count ? <span className="count">{n.count.toLocaleString()}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className="vpill">{status ? `Word list v${status.version}${status.pendingChanges ? ", changes waiting" : ""}` : statusError ? "Word list status unknown" : "Loading"}</span>
          <button className="linkbtn" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        {route.page === "home" && <Home go={go} status={status} statusError={statusError} />}
        {route.page === "phones" && <Phones openId={route.sub} />}
        {route.page === "alerts" && <Alerts />}
        {route.page === "words" && <WordList tab={wordTab} setTab={setWordTab} status={status} statusError={statusError} toast={toast} refresh={refreshStatus} />}
        {route.page === "advanced" && <Advanced tab={advTab} setTab={setAdvTab} datasetCandidates={datasetCandidates} toast={toast} refresh={refreshStatus} />}
      </main>

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
