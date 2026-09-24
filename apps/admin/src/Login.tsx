import { useState } from "react";

import * as api from "./api";
import { ErrBanner, errMsg } from "./ui";

export function Login({ onAuthed, notice }: { onAuthed: () => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [magic, setMagic] = useState("");

  const dev = async () => {
    setBusy(true);
    setErr("");
    try {
      const { token } = await api.devLogin(email.trim());
      api.setToken(token);
      onAuthed();
    } catch (e) {
      setErr(errMsg(e, "Login failed"));
    } finally {
      setBusy(false);
    }
  };
  const link = async () => {
    setBusy(true);
    setErr("");
    setMagic("");
    try {
      const r = await api.requestMagicLink(email.trim());
      setMagic(r.devMagicUrl ?? "sent");
    } catch (e) {
      setErr(errMsg(e, "Could not send the link"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login fade">
      <div className="brand">
        <img className="mark" src="/lighthouse.png" alt="Lighthouse" style={{ width: 40, height: 40 }} />
        <div>
          <h1>Lighthouse</h1>
          <div className="sub">Admin</div>
        </div>
      </div>
      <div className="card">
        <label htmlFor="email">Admin email</label>
        <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 6 }} />
        {notice && <div style={{ marginTop: 12 }}><ErrBanner e={notice} /></div>}
        {err && <div style={{ marginTop: 12 }}><ErrBanner e={err} /></div>}
        <button className="btn block" disabled={busy || !email} onClick={link} style={{ marginTop: 12 }}>
          {busy ? "Sending" : "Email me a sign in link"}
        </button>
        {magic === "sent" && <div className="banner info" style={{ marginBottom: 0 }}>If that email is an admin, a sign in link is on its way. Check your inbox.</div>}
        {import.meta.env.DEV && (
          <button className="btn ghost block" disabled={busy || !email} onClick={dev} style={{ marginTop: 8 }}>
            Dev login (local only)
          </button>
        )}
        {import.meta.env.DEV && magic && magic !== "sent" && (
          <div className="banner info" style={{ marginBottom: 0, wordBreak: "break-all" }}>
            Dev magic link: <a href={magic}>{magic}</a>
          </div>
        )}
      </div>
    </div>
  );
}
