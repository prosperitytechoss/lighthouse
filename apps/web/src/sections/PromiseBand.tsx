const CHIPS = ["On-device", "Transparent", "Open source"];

export function PromiseBand() {
  return (
    <section
      id="privacy"
      className="flex scroll-mt-6 flex-col items-center gap-4 bg-surface px-5 py-12 md:px-10 lg:px-20 lg:py-16"
    >
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        Safety without surveillance.
      </h2>
      <p className="max-w-[760px] text-center text-lg leading-7 text-muted lg:text-xl lg:leading-[30px]">
        Lighthouse is designed to tell you when something may be wrong, not give you a window
        into your child’s private life.
      </p>
      <p className="max-w-[760px] text-center text-lg leading-7 text-muted lg:text-xl lg:leading-[30px]">
        Content is checked on their phone. You receive safety alerts, never the underlying
        messages, photos or searches.
      </p>
      <ul className="flex flex-wrap justify-center gap-3.5 pt-2.5">
        {CHIPS.map((chip) => (
          <li key={chip} className="rounded-full border-2 border-hairline bg-white px-[22px] py-2.5">
            <span className="text-base font-bold leading-5 text-primary-700">{chip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
