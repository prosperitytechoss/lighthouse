const CHIPS = ["On device", "Private", "Honest with kids"];

export function PromiseBand() {
  return (
    <section
      id="privacy"
      className="flex scroll-mt-6 flex-col items-center gap-4 bg-surface px-5 py-12 md:px-10 lg:px-20 lg:py-16"
    >
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        The whole product is one promise
      </h2>
      <p className="max-w-[760px] text-center text-lg leading-7 text-muted lg:text-xl lg:leading-[30px]">
        Content is read on the child’s phone to check for risk. It is never saved, never sent, and
        the parent never sees the actual words, images, or searches. Only a safety category ever
        leaves the phone.
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
