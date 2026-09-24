import { Mascot } from "../components/Mascot";
import { PlayBadge } from "../components/PlayBadge";

export function Cta() {
  return (
    <section className="flex flex-col items-center gap-5 border-t border-hairline px-5 py-12 md:px-10 lg:px-20 lg:py-16">
      <Mascot animated className="h-[140px] w-[140px]" />
      <h2 className="text-center text-[32px] font-bold leading-10 tracking-[-0.015em] text-ink lg:text-[40px] lg:leading-[48px]">
        Set up in five minutes, on their phone.
      </h2>
      <PlayBadge />
    </section>
  );
}
