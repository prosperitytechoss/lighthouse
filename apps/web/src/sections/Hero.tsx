import { PhoneMock } from "../components/PhoneMock";
import { PlayBadge } from "../components/PlayBadge";

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-14 bg-primary px-5 py-14 md:px-10 lg:flex-row lg:gap-[60px] lg:px-20 lg:py-24">
      <div className="flex min-w-0 flex-col lg:flex-1">
        <h1 className="text-[44px] font-bold leading-[48px] tracking-[-0.02em] text-white sm:text-[56px] sm:leading-[60px] xl:text-[72px] xl:leading-[78px]">
          Keep your children safe while on mobile devices
        </h1>
        <p className="max-w-[560px] pt-5 text-xl leading-[30px] text-white/95 lg:text-2xl lg:leading-[34px]">
          Lighthouse Family Safety Mobile App quietly checks for signs of serious risk on mobile
          apps and games such as exploitation, bullying, violence, explicit content, and self-harm,
          helping you keep your children safe while using mobile devices. Our innovative method
          does this in a way that preserves the dignity and privacy of children. If something is
          flagged, you get an alert, but never their actual messages, photos or searches.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-8">
          <PlayBadge />
          <p className="text-[15px] font-bold leading-[18px] text-white/90">
            Free for families. Open source. Android only.
          </p>
        </div>
      </div>
      <div className="shrink-0 lg:mr-6">
        <PhoneMock />
      </div>
    </section>
  );
}
