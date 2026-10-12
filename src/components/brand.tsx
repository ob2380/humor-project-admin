export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <LaughMeter />
      <div>
        <div className="font-display text-[28px] font-extrabold leading-none">Laugh Track</div>
        <div className="mt-1 text-sm text-muted">The Humor Project admin</div>
      </div>
    </div>
  );
}

/** Logo: a tiny vote meter — blue up, red down. */
export function LaughMeter({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="var(--ink)" />
      <rect x="9" y="8" width="5" height="12" rx="2" fill="var(--up)" />
      <rect x="17.5" y="5" width="5" height="15" rx="2" fill="var(--up)" />
      <rect x="26" y="11" width="5" height="9" rx="2" fill="var(--up)" />
      <rect x="9" y="22" width="5" height="5" rx="2" fill="var(--down)" />
      <rect x="17.5" y="22" width="5" height="3" rx="1.5" fill="var(--down)" />
      <rect x="26" y="22" width="5" height="9" rx="2" fill="var(--down)" />
    </svg>
  );
}
