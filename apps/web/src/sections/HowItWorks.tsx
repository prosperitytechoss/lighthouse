import type { ReactNode } from "react";

import { Mascot } from "../components/Mascot";

/** Chunky numbered circle in the brand button style. */
function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-[0_4px_0_0_#0E7FA8]">
      {n}
    </span>
  );
}

/** Small flat visuals built from the app's own UI language. */
function SetupVisual() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5 rounded-2xl border border-hairline bg-surface p-4">
      <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted">On the child’s phone</p>
      <div className="rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-[14px] leading-5 text-muted">
        parent@email.com
      </div>
      <div className="btn-chunky justify-center bg-primary px-4 py-2.5 text-[14px] font-bold text-white">
        Link my parent
      </div>
    </div>
  );
}

function ChecksVisual() {
  return (
    <div className="flex w-full max-w-[300px] items-center gap-3.5 rounded-2xl border border-hairline bg-surface p-4">
      <Mascot className="h-16 w-16 shrink-0" />
      <div className="flex flex-col gap-1.5">
        <span className="rounded-[10px] bg-white px-2.5 py-1 text-[13px] font-bold leading-4 text-ink shadow-[0_1px_2px_rgba(16,42,67,0.08)]">
          All clear today.
        </span>
        <span className="text-[12px] leading-4 text-muted">Nothing saved. Nothing sent.</span>
      </div>
    </div>
  );
}

function EmailVisual() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-white px-3 py-2.5">
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
          <rect width="20" height="16" x="2" y="4" rx="2" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="#1CABE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold leading-4 text-ink">A quiet week for Amara</span>
          <span className="text-[11px] leading-4 text-muted">Lighthouse, Sunday 6 pm</span>
        </div>
      </div>
      <span className="text-[12px] leading-4 text-muted">And an instant alert if something serious happens.</span>
    </div>
  );
}

const STEPS: { title: string; body: string; visual: ReactNode }[] = [
  {
    title: "Set up on their phone with your email",
    body: "Install Lighthouse on the child’s phone, type your email, done. There is no parent app and no dashboard to learn.",
    visual: <SetupVisual />,
  },
  {
    title: "The phone checks itself",
    body: "Lighthouse reads the screen right on the device and sorts what it sees into safety categories. The content itself never leaves the phone.",
    visual: <ChecksVisual />,
  },
  {
    title: "You get one calm email a week",
    body: "A short Sunday summary of how the week went, and an alert the moment something serious shows up.",
    visual: <EmailVisual />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-6 px-5 py-14 md:px-10 lg:px-20 lg:py-16">
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        How it works
      </h2>
      <div className="mx-auto flex max-w-[880px] flex-col gap-10 pt-10 lg:gap-12">
        {STEPS.map(({ title, body, visual }, i) => (
          <div
            key={title}
            className={`flex flex-col items-start gap-5 md:items-center md:gap-12 ${
              i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
            }`}
          >
            <div className="flex flex-1 gap-4">
              <StepNumber n={i + 1} />
              <div className="flex flex-col gap-2 pt-2">
                <h3 className="text-xl font-bold leading-7 text-ink lg:text-2xl lg:leading-[30px]">{title}</h3>
                <p className="text-base leading-[25px] text-muted">{body}</p>
              </div>
            </div>
            <div className="flex w-full flex-1 justify-center pl-16 md:pl-0">{visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
