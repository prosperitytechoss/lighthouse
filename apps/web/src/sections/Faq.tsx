const FAQS: { q: string; a: string }[] = [
  {
    q: "Can my child see that Lighthouse is on?",
    a: "Yes. Lighthouse is not designed for secret monitoring. Your child can see that it is running.",
  },
  {
    q: "Do you read their messages?",
    a: "Lighthouse can check what is happening on the phone for potential safety concerns. That analysis happens on the device. Their actual messages, images and searches are not sent to Lighthouse or shown to parents.",
  },
  {
    q: "What does a parent see?",
    a: "An alert tells the parent what kind of concern Lighthouse detected. It does not include the underlying conversation, message, photo or search.",
  },
  {
    q: "What happens if my child turns it off?",
    a: "You’re notified if monitoring is disabled or the phone stops reporting. If Lighthouse is uninstalled, the alert comes after the phone has stopped reporting for a while. It cannot tell an uninstall apart from a phone that is off or offline.",
  },
  {
    q: "What phones does it work on?",
    a: "Android for now.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Lighthouse is free for families.",
  },
  {
    q: "Is it open source?",
    a: "Yes. Lighthouse is open source, so anyone can inspect the code and understand how it works.",
  },
];

export function Faq() {
  return (
    <section className="px-5 py-14 md:px-10 lg:px-20 lg:py-16">
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        Honest answers.
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
