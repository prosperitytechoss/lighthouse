import { PhoneMock } from "../components/PhoneMock";
import { PlayBadge } from "../components/PlayBadge";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-14 bg-primary px-5 py-14 md:px-10 lg:flex-row lg:gap-[60px] lg:px-20 lg:py-24">
      <div className="flex min-w-0 flex-col lg:flex-1">
        <h1 className="text-[44px] font-bold leading-[48px] tracking-[-0.02em] text-white sm:text-[56px] sm:leading-[60px] xl:text-[72px] xl:leading-[78px]">
          A friend on your child’s phone.
        </h1>
        <p className="max-w-[560px] pt-5 text-xl leading-[30px] text-white/95 lg:text-2xl lg:leading-[34px]">
          Lighthouse checks what’s on screen right on the phone and tells you only what matters.
          Never the words. Never the photos. One calm email a week, and an alert the moment
          something serious happens.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-8">
          <PlayBadge />
          <p className="text-[15px] font-bold leading-[18px] text-white/90">
            Free for families. Android only.
          </p>
        </div>
      </div>
      <div className="shrink-0 lg:mr-6">
        <PhoneMock />
      </div>
    </section>
  );
}
