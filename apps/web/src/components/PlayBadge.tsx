export const PLAY_URL =
  "https://play.google.com/store/apps/details?id=fund.fastforward.lighthouse.child";

/** Google Play badge as a chunky dark button (per the Paper board). */
export function PlayBadge() {
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noreferrer"
      className="btn-chunky gap-3 bg-[#23272F] px-[26px] py-3.5 [--btn-edge:#0B0D11]"
    >
      <svg width="26" height="28" viewBox="0 0 24 26" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
        <path d="M2 1.5 14.5 13 2 24.5z" fill="#3BCCFF" />
        <path d="M2 1.5 18 9l-3.5 4z" fill="#5EE07A" />
        <path d="M2 24.5 18 17l-3.5-4z" fill="#FF5B5B" />
        <path d="M18 9l4.5 2.6a1.6 1.6 0 0 1 0 2.8L18 17l-3.5-4z" fill="#FFC834" />
      </svg>
      <span className="flex flex-col">
        <span className="font-mono text-[11px] leading-[14px] tracking-[0.06em] text-white/80">GET IT ON</span>
        <span className="text-xl font-bold leading-6 text-white">Google Play</span>
      </span>
    </a>
  );
}
