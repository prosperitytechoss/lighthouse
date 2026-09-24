import { PlayBadge } from "./PlayBadge";

/** Mobile-only sticky bottom bar keeping the store CTA one thumb away. */
export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-hairline bg-white px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
      <PlayBadge />
    </div>
  );
}
