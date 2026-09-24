/**
 * Honest trust band: one quiet row of claims that are true today, plus a
 * small grey strip of the eight apps Lighthouse actually watches (real brand
 * marks, copied from .context). Deliberately no testimonials, ratings, or
 * user counts.
 */
const CLAIMS = [
  "Nothing is saved or sent off the phone",
  "Checks run on the phone, not our servers",
  "Free for families",
  "Open source, anyone can read the code",
];

const APPS: { name: string; file: string }[] = [
  { name: "WhatsApp", file: "whatsapp.svg" },
  { name: "Instagram", file: "instagram.svg" },
  { name: "TikTok", file: "tiktok.svg" },
  { name: "Snapchat", file: "snapchat.svg" },
  { name: "Facebook", file: "facebook.svg" },
  { name: "X", file: "x.svg" },
  { name: "Roblox", file: "roblox.svg" },
  { name: "Google Chrome", file: "googlechrome.svg" },
];

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" fill="none" stroke="#6B7080" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function TrustBand() {
  return (
    <section className="border-b border-hairline px-5 py-6 md:px-10 lg:px-20">
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
        <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
          {CLAIMS.map((claim) => (
            <li key={claim} className="flex items-center gap-2">
              {check}
              <span className="text-sm font-bold leading-5 text-ink">{claim}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted">
            Watches
          </p>
          <ul className="flex items-center gap-3.5">
            {APPS.map(({ name, file }) => (
              <li key={name} title={name}>
                <img src={`/brand-logos/${file}`} alt={name} className="brand-logo h-5 w-5" loading="lazy" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
