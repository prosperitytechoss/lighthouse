import type { ReactNode } from "react";

import { Mascot } from "./Mascot";

const check = (
  <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const chevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
    <path d="m9 18 6-6-6-6" fill="none" stroke="#C2C7D0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Weekday check row: filled check, warn "!", or dashed upcoming. */
const DAYS: { label: string; state: "check" | "warn" | "upcoming" }[] = [
  { label: "M", state: "check" },
  { label: "T", state: "check" },
  { label: "W", state: "check" },
  { label: "T", state: "warn" },
  { label: "F", state: "check" },
  { label: "S", state: "check" },
  { label: "S", state: "upcoming" },
];

function LinkRow({ icon, label, trailing }: { icon: ReactNode; label: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-white px-3 py-2.5">
      <span className="w-[18px] shrink-0">{icon}</span>
      <span className="flex-1 whitespace-nowrap text-[13px] font-bold leading-4 text-ink">{label}</span>
      <span className="flex shrink-0 justify-end">{trailing ?? chevron}</span>
    </div>
  );
}

/**
 * HTML/CSS recreation of the app Home screen (Paper board 21) inside a dark
 * rounded phone frame. Purely presentational; sizes are the 390 design scaled
 * to a 300px screen.
 */
export function PhoneMock() {
  return (
    <div className="w-[300px] rounded-[44px] bg-ink p-2.5 shadow-[0_24px_48px_rgba(10,42,58,0.35)]" role="img" aria-label="The Lighthouse app Home screen. All clear today. Five quiet days this week.">
      <div className="overflow-hidden rounded-[34px] bg-surface">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <span className="text-[12px] font-bold leading-4 text-ink">9:41</span>
          <svg width="60" height="16" viewBox="0 0 82 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3.7 13H2.5a1 1 0 0 0-1 1v2.5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1V14a1 1 0 0 0-1-1m5.2-2.5H7.7a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1M14.1 8h-1.2a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1m5.2-2.5h-1.2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1" fill="#1A1A1A" />
            <path fillRule="evenodd" d="M36.57 7.8c2.49 0 4.88.92 6.68 2.58.14.13.36.12.49 0l1.3-1.27a.34.34 0 0 0 0-.5 12.55 12.55 0 0 0-16.93 0 .34.34 0 0 0 0 .5l1.3 1.26c.13.13.34.14.48 0a10 10 0 0 1 6.68-2.57m0 4.22a5.4 5.4 0 0 1 3.67 1.44c.14.13.35.13.48 0l1.3-1.33a.37.37 0 0 0-.01-.52 7.9 7.9 0 0 0-10.88 0 .37.37 0 0 0 0 .52l1.29 1.32c.13.14.34.14.48 0 1-.92 2.31-1.43 3.67-1.43m2.52 2.8q0 .15-.1.28l-2.18 2.45a.3.3 0 0 1-.24.11.3.3 0 0 1-.24-.1l-2.18-2.46a.43.43 0 0 1 .01-.56 3.44 3.44 0 0 1 4.82 0 .4.4 0 0 1 .11.28" clipRule="evenodd" fill="#1A1A1A" />
            <path d="M54 11c0-1.4 0-2.1.27-2.63a2.5 2.5 0 0 1 1.1-1.1C55.9 7 56.6 7 58 7h13c1.4 0 2.1 0 2.64.27q.72.37 1.09 1.1C75 8.9 75 9.6 75 11v1c0 1.4 0 2.1-.27 2.64a2.5 2.5 0 0 1-1.1 1.09C73.1 16 72.4 16 71 16H58c-1.4 0-2.1 0-2.63-.27a2.5 2.5 0 0 1-1.1-1.1C54 14.1 54 13.4 54 12z" fill="#1A1A1A" />
            <path d="M78 9.5v4.08a2.2 2.2 0 0 0 1.33-2.04A2.2 2.2 0 0 0 78 9.5" fill="#1A1A1A" opacity="0.35" />
          </svg>
        </div>
        {/* app header */}
        <div className="flex items-center px-5 pt-1.5">
          <div className="flex flex-1 items-center gap-1.5">
            <Mascot className="h-5 w-5 shrink-0" />
            <span className="text-[14px] font-bold leading-[18px] tracking-[-0.01em] text-ink">Lighthouse</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {[
              ["21", "14", "4", "4"], ["10", "3", "4", "4"], ["21", "12", "12", "12"], ["8", "3", "12", "12"],
              ["21", "16", "20", "20"], ["12", "3", "20", "20"], ["14", "14", "2", "6"], ["8", "8", "10", "14"], ["16", "16", "18", "22"],
            ].map(([x1, x2, y1, y2], i) => (
              <line key={i} x1={x1} x2={x2} y1={y1} y2={y2} stroke="#5A6472" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
        {/* mascot + bubble */}
        <div className="flex flex-col items-center px-5 pt-3">
          <div className="bubble-in rounded-[13px] bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(16,42,67,0.06),0_4px_12px_rgba(16,42,67,0.08)]">
            <span className="text-[12px] font-bold leading-[15px] text-ink">All clear today. I’m keeping watch.</span>
          </div>
          <svg width="14" height="8" viewBox="0 0 18 10" xmlns="http://www.w3.org/2000/svg" className="bubble-in shrink-0" aria-hidden="true">
            <path d="M0 0 H18 L9 10 Z" fill="#FFFFFF" />
          </svg>
          <Mascot animated className="h-[112px] w-[112px]" />
        </div>
        {/* quiet days */}
        <div className="flex flex-col items-center px-5 pt-2">
          <span className="text-[42px] font-bold leading-[46px] tracking-[-0.02em] text-primary">5</span>
          <span className="pt-0.5 text-[13px] font-bold leading-4 text-ink">quiet days this week</span>
          <div className="flex gap-1.5 pt-3">
            {DAYS.map(({ label, state }, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold leading-3 text-[#8E8E93]">{label}</span>
                {state === "check" && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">{check}</span>
                )}
                {state === "warn" && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-[11px] font-bold leading-none text-white">
                    !
                  </span>
                )}
                {state === "upcoming" && (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-hairline bg-white" />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* link cards */}
        <div className="flex flex-col gap-2 px-4 pt-5">
          <LinkRow
            label="Your week"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M8 2v4M16 2v4M3 10h18" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <rect width="18" height="18" x="3" y="4" rx="2" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <LinkRow
            label="What I can and can’t see"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <LinkRow
            label="Linked to your parent"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="20" height="16" x="2" y="4" rx="2" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            trailing={
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold leading-[14px] text-primary-700">Active</span>
            }
          />
        </div>
        {/* privacy caption */}
        <p className="px-6 pb-6 pt-4 text-center text-[10px] leading-[14px] text-muted">
          Checked on this phone. Never saved, never sent. Your parent never sees the actual content.
        </p>
      </div>
    </div>
  );
}
