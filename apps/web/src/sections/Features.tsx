import type { ReactNode } from "react";

const STROKE = { fill: "none", stroke: "#1CABE2", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Checked on the phone",
    body: "The reading happens on the child’s phone. Messages, searches and photos never leave it. Only a safety category does.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" {...STROKE} />
        <path d="M12 18h.01" {...STROKE} />
      </svg>
    ),
  },
  {
    title: "No parent app to learn",
    body: "Set up once on the child’s phone with your email. You get a calm Sunday summary and an instant email when something serious comes up.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2" {...STROKE} />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...STROKE} />
      </svg>
    ),
  },
  {
    title: "Kids see everything",
    body: "Nothing is hidden. The child sees what Lighthouse watches, what it can never see, and when something was flagged.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" {...STROKE} />
        <circle cx="12" cy="12" r="3" {...STROKE} />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="grid gap-10 px-5 py-12 md:grid-cols-3 md:px-10 lg:px-20 lg:py-14">
      {FEATURES.map(({ title, body, icon }) => (
        <div key={title} className="flex flex-col gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-primary-50">
            {icon}
          </div>
          <h2 className="text-2xl font-bold leading-[30px] text-ink">{title}</h2>
          <p className="text-base leading-[25px] text-muted">{body}</p>
        </div>
      ))}
    </section>
  );
}
