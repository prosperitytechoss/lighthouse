const FAQS: { q: string; a: string }[] = [
  {
    q: "Can my child see that it is on?",
    a: "Yes, always. Lighthouse never hides. The child sees the app on their phone, what it watches, what it can never see, and when something was flagged.",
  },
  {
    q: "Do you read their messages?",
    a: "The check happens on the phone itself. What is on screen is read there to look for risk, then forgotten. It is never saved, never sent, and you never see the actual words, photos, or searches. Only a safety category ever leaves the phone.",
  },
  {
    q: "What phones does it work on?",
    a: "Android only for now. The child needs an Android phone. You as the parent only need an email address, on any device.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Lighthouse is free for families.",
  },
  {
    q: "Is it open source?",
    a: "Yes. The code is public on GitHub, so you do not have to take our word for what runs on your child's phone. You can read exactly what it checks and what it sends.",
  },
  {
    q: "How do I stop it?",
    a: "Uninstall the app or disconnect it from the phone at any time. Nothing lingers, because nothing was stored anywhere else.",
  },
];

export function Faq() {
  return (
    <section className="px-5 py-14 md:px-10 lg:px-20 lg:py-16">
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        Honest answers
      </h2>
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 pt-10">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="faq-item group rounded-2xl border-2 border-hairline bg-white px-5 open:border-primary">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-lg font-bold leading-6 text-ink">{q}</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" fill="none" stroke="#1CABE2" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </summary>
            <p className="pb-5 pr-9 text-base leading-[25px] text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
