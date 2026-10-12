/** Up/down share of one caption or group as a single 100% bar with a 2px gap between the halves. */
export function SplitBar({ up, down, className = "" }: { up: number; down: number; className?: string }) {
  const total = up + down;
  if (!total) return <div className={`h-2 rounded-full bg-mid ${className}`} aria-label="No votes" />;
  const upPct = (up / total) * 100;
  return (
    <div
      className={`flex h-2 gap-[2px] ${className}`}
      role="img"
      aria-label={`${up} up, ${down} down`}
      title={`${up} up, ${down} down`}
    >
      {up > 0 ? <div className="h-full rounded-l-full bg-up" style={{ width: `${upPct}%`, borderRadius: down ? undefined : 999 }} /> : null}
      {down > 0 ? <div className="h-full rounded-r-full bg-down" style={{ width: `${100 - upPct}%`, borderRadius: up ? undefined : 999 }} /> : null}
    </div>
  );
}

/** Upvote share per group (model, length bucket), one row each, with a 50% reference line. */
export function ShareBars({
  rows,
}: {
  rows: { label: string; up: number; down: number; total: number; upShare: number; captions: number }[];
}) {
  if (!rows.length) return <p className="text-sm text-muted">No votes yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.up} up, ${r.down} down across ${r.captions} captions`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tnum text-ink-2">
              <strong className="text-ink">{Math.round(r.upShare * 100)}%</strong> up{" "}
              <span className="text-muted">of {r.total}</span>
            </span>
          </div>
          <div className="relative mt-1.5">
            <SplitBar up={r.up} down={r.down} />
            <span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-ink opacity-40" aria-hidden="true" />
          </div>
        </li>
      ))}
    </ul>
  );
}
