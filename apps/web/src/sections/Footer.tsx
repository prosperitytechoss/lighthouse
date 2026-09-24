export function Footer() {
  return (
    <footer className="flex flex-col gap-3 border-t border-hairline px-5 py-7 md:flex-row md:items-center md:gap-6 md:px-10 lg:px-20">
      <p className="text-sm font-bold leading-[18px] text-ink md:flex-1">
        Lighthouse, by Prosperity Tech Projects
      </p>
      <a href="/privacy" className="text-[13px] leading-4 text-muted hover:text-ink">
        Privacy policy
      </a>
      <a href="/terms" className="text-[13px] leading-4 text-muted hover:text-ink">
        Terms
      </a>
      <a
        href="https://github.com/prosperitytechoss/lighthouse"
        target="_blank"
        rel="noreferrer"
        className="text-[13px] leading-4 text-muted hover:text-ink"
      >
        Source on GitHub
      </a>
      <a href="mailto:hello@prosperitytech.org" className="text-[13px] leading-4 text-muted hover:text-ink">
        Contact
      </a>
    </footer>
  );
}
