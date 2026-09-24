import { Mascot } from "../components/Mascot";
import { PLAY_URL } from "../components/PlayBadge";

export function Nav() {
  return (
    <header className="flex items-center gap-3 px-5 py-4 md:px-10 xl:px-20 xl:py-6">
      <Mascot className="h-11 w-11 shrink-0" />
      <a href="/" className="flex-1 text-[22px] font-bold leading-7 text-ink">
        Lighthouse
      </a>
      <nav className="hidden items-center sm:flex" aria-label="Main">
        <a href="/#how-it-works" className="px-5 text-[15px] font-bold leading-[18px] text-muted hover:text-ink">
          How it works
        </a>
        <a href="/#privacy" className="px-5 text-[15px] font-bold leading-[18px] text-muted hover:text-ink">
          Privacy
        </a>
      </nav>
      <a
        href={PLAY_URL}
        target="_blank"
        rel="noreferrer"
        className="btn-chunky bg-primary px-6 py-3 text-[15px] font-bold leading-[18px] text-white"
      >
        GET THE APP
      </a>
    </header>
  );
}
