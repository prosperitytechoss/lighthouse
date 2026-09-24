export const CHANNEL_LABEL: Record<string, string> = { text: "On screen text", notification: "Notifications", ocr: "Text in pictures and video", image: "Image model" };

export function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0] ?? { date: "", count: 0 });
  const total = data.reduce((a, d) => a + d.count, 0);
  const w = 100 / Math.max(1, data.length);
  return (
    <div className="card">
      <div className="row between wrap">
        <h3 style={{ margin: 0 }}>Signals, last 14 days</h3>
        <span className="muted mono small">{total} total, busiest day {peak.date} with {peak.count}</span>
      </div>
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="chart" role="img" aria-label={`Signals per day for the last 14 days, ${total} in total`}>
        <line x1="0" y1="40" x2="100" y2="40" stroke="var(--border)" strokeWidth="0.3" />
        {data.map((d, i) => {
          const h = (d.count / max) * 38;
          return (
            <rect key={i} x={i * w + 0.8} y={40 - h} width={w - 1.6} height={Math.max(h, 0.4)} rx={0.6} fill={d.count ? "var(--cyan)" : "var(--border)"}>
              <title>{d.date}: {d.count}</title>
            </rect>
          );
        })}
      </svg>
      <div className="chart-x">
        {data.map((d, i) => <span key={i}>{d.date.slice(5)}</span>)}
      </div>
    </div>
  );
}

export function Bars({ title, data, label }: { title: string; data: Record<string, number>; label?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="card">
      <h3>{title}</h3>
      {entries.length === 0 && <span className="muted small">Nothing yet.</span>}
      {entries.map(([cat, n]) => (
        <div key={cat} className="catrow">
          <span className="catname" title={label?.[cat] ?? cat}>{label?.[cat] ?? cat}</span>
          <div className="catbar"><div style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="mono catn">{n}</span>
        </div>
      ))}
    </div>
  );
}
