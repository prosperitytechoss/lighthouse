import type { ReactNode } from "react";

import type { Term } from "./api";

export function Sev({ s }: { s: Term["severity"] }) {
  return <span className={`badge ${s}`}>{s}</span>;
}
export function Spinner() {
  return (
    <div className="center">
      <div className="spinner" />
    </div>
  );
}
export function ErrBanner({ e }: { e: string }) {
  return <div className="banner err" role="alert">{e}</div>;
}
export const fmtWhen = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : "never");

export function Page({ title, blurb, errors, children }: { title: string; blurb: string; errors?: (string | undefined | null)[]; children: ReactNode }) {
  const errs = (errors ?? []).filter((e): e is string => !!e);
  return (
    <div className="fade">
      <div className="page-h">
        <h1>{title}</h1>
        <p>{blurb}</p>
      </div>
      {errs.length > 0 && (
        <div className="page-err">
          {errs.map((e, i) => <ErrBanner key={i} e={e} />)}
        </div>
      )}
      {children}
    </div>
  );
}

export type SegItem<T extends string> = { id: T; label: string; count?: number };
export function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: SegItem<T>[] }) {
  return (
    <div className="seg" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? "on" : ""} onClick={() => onChange(it.id)}>
          {it.label}
          {it.count ? <span className="count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
