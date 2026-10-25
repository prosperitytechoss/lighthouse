import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

import * as api from "./api";
import { type KeeperVersion } from "./api";
import { Login } from "./Login";
import { Advanced } from "./pages/Advanced";
import { Alerts } from "./pages/Alerts";
import { Home } from "./pages/Home";
import { Keeper } from "./pages/Keeper";
import { Phones } from "./pages/Phones";
import { type AdvTab, type PageId, type Route } from "./routes";
import { Spinner, errMsg } from "./ui";

const ICONS: Record<PageId, ReactElement> = {
  home: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" /><path d="M6.5 13.5v-4h3v4" /></svg>,
  phones: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" /><path d="M7 12.5h2" /></svg>,
  alerts: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" /></svg>,
  keeper: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14.5h4M6.5 14.5 7 6h2l.5 8.5M5.5 6h5L8 2.5z" /></svg>,
  advanced: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.6" fill="var(--surface-2)" /><circle cx="10" cy="11" r="1.6" fill="var(--surface-2)" /></svg>,
};

export function App() {
  const [callbackToken] = useState(() => new URLSearchParams(window.location.search).get("token"));
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(!!api.getToken() || !!callbackToken);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [advTab, setAdvTab] = useState<AdvTab>("eval");
  const [menu, setMenu] = useState(false);
  const [keeper, setKeeper] = useState<KeeperVersion | null | undefined>(undefined);
  const [datasetCandidates, setDatasetCandidates] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [callbackError, setCallbackError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const magicExchange = useRef<ReturnType<typeof api.exchangeMagic> | null>(null);

  const resetSession = useCallback(() => {
    setAuthed(false);
    setChecking(false);
    setKeeper(undefined);
    setSessionError("");
    setDatasetCandidates(0);
    setToastMsg("");
    setMenu(false);
    setRoute({ page: "home" });
    setAdvTab("eval");
  }, []);

  useEffect(() => api.onSessionExpired(() => {
    resetSession();
    setCallbackError("Your session has expired. Sign in again to continue.");
  }), [resetSession]);

  const toast = (m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg(""), 2800);
  };
  const refreshStatus = useCallback(() => {
    const token = api.getToken();
    const current = () => token !== null && token === api.getToken();
    api.keeperVersions().then((r) => { if (current()) setKeeper(r.versions.find((v) => v.live) ?? null); }).catch(() => {
      if (current()) setKeeper(undefined);
    });
    api.datasetStats().then((s) => { if (current()) setDatasetCandidates(s.byStatus.candidate ?? 0); }).catch(() => {
      if (current()) setDatasetCandidates(0);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    if (callbackToken) {
      // A magic token is single-use; StrictMode must not exchange it twice.
      magicExchange.current ??= api.exchangeMagic(callbackToken);
      magicExchange.current
        .then(({ token }) => { if (alive) { api.setToken(token); setAuthed(true); } })
        .catch(() => { if (alive) setCallbackError("That sign in link is invalid or has expired. Request a new one."); })
        .finally(() => { if (alive) { setChecking(false); window.history.replaceState({}, "", "/"); } });
      return () => { alive = false; };
    }
    if (!api.getToken()) { setChecking(false); return; }
    const token = api.getToken();
    api.me()
      .then(() => { if (alive && api.getToken() === token) setAuthed(true); })
      .catch((e) => {
        if (alive && !(e instanceof api.ApiError && e.status === 401)) {
          setSessionError(errMsg(e, "Could not check your session. Please try again."));
        }
      })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [callbackToken, checkAttempt]);
  useEffect(() => {
    if (authed && !checking) refreshStatus();
  }, [authed, checking, refreshStatus]);

  if (checking) return <Spinner />;
  if (sessionError) return (
    <div className="login">
      <p role="alert">{sessionError}</p>
      <button className="btn" onClick={() => { setSessionError(""); setChecking(true); setCheckAttempt((n) => n + 1); }}>Try again</button>
    </div>
  );
  if (!authed) return <Login onAuthed={() => { setCallbackError(""); setAuthed(true); }} notice={callbackError} />;

  const signOut = () => { void api.logout().catch(() => {}); api.clearToken(); resetSession(); setCallbackError(""); };

  const go = (page: PageId, sub?: string) => {
    if (page === "advanced" && sub) setAdvTab(sub as AdvTab);
    setRoute({ page, sub });
    setMenu(false);
    window.scrollTo({ top: 0 });
  };

  const nav: { id: PageId; label: string; count?: number }[] = [
    { id: "home", label: "Home" },
    { id: "phones", label: "Phones" },
    { id: "alerts", label: "Alerts" },
    { id: "keeper", label: "Keeper" },
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
          <span className="vpill">{keeper ? `Keeper ${keeper.version} live` : keeper === null ? "Keeper built into the app" : "Loading"}</span>
          <button className="linkbtn" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        {route.page === "home" && <Home go={go} keeper={keeper} />}
        {route.page === "phones" && <Phones openId={route.sub} />}
        {route.page === "alerts" && <Alerts />}
        {route.page === "keeper" && <Keeper toast={(m) => { toast(m); refreshStatus(); }} />}
        {route.page === "advanced" && <Advanced tab={advTab} setTab={setAdvTab} datasetCandidates={datasetCandidates} toast={toast} refresh={refreshStatus} />}
      </main>

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
