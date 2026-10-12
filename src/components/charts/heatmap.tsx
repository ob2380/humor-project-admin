"use client";

import { useEffect, useState } from "react";
import { useTooltip, TooltipCard } from "./tooltip";

type Cell = { count: number; up: number };

const STEPS = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)"];

function hourLabel(h: number) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/** When do people vote? Day of week x hour, New York time. One hue, light to dark. */
export function VoteHeatmap({ weekdays, grid }: { weekdays: string[]; grid: Cell[][] }) {
  const { ref, tip, show, hide } = useTooltip();
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const max = Math.max(1, ...grid.flat().map((c) => c.count));
  const left = 38;
  const gap = 2;
  const cell = Math.max(8, Math.floor((width - left - 4) / 24) - gap);
  const height = 7 * (cell + gap) + 22;

  const peak = (() => {
    let best = { d: 0, h: 0, n: -1 };
    grid.forEach((row, d) => row.forEach((c, h) => c.count > best.n && (best = { d, h, n: c.count })));
    return best;
  })();

  const tipFor = (d: number, h: number, c: Cell) => (
    <>
      <div className="font-semibold text-ink">
        {weekdays[d]} {hourLabel(h)}–{hourLabel((h + 1) % 24)}
      </div>
      <div className="mt-1 tnum text-ink-2">
        {c.count} votes{c.count ? `, ${Math.round((c.up / c.count) * 100)}% up` : ""}
      </div>
    </>
  );

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={hide}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Heatmap of votes by weekday and hour">
          {grid.map((row, d) => (
            <g key={d}>
              <text x={0} y={d * (cell + gap) + cell / 2 + 4} fontSize={12} className="fill-[var(--muted)]">
                {weekdays[d]}
              </text>
              {row.map((c, h) => {
                const step = c.count === 0 ? 0 : Math.min(6, 1 + Math.floor((c.count / max) * 5.999));
                return (
                  <rect
                    key={h}
                    x={left + h * (cell + gap)}
                    y={d * (cell + gap)}
                    width={cell}
                    height={cell}
                    rx={2}
                    fill={STEPS[step]}
                    tabIndex={0}
                    aria-label={`${weekdays[d]} ${hourLabel(h)}: ${c.count} votes`}
                    onPointerEnter={(e) => show(e, tipFor(d, h, c))}
                    onPointerMove={(e) => show(e, tipFor(d, h, c))}
                    onFocus={(e) => show(e, tipFor(d, h, c))}
                    onBlur={hide}
                  />
                );
              })}
            </g>
          ))}
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={left + h * (cell + gap) + cell / 2} y={height - 4} textAnchor="middle" fontSize={12} className="fill-[var(--muted)]">
              {hourLabel(h)}
            </text>
          ))}
        </svg>
        <TooltipCard tip={tip} width={width} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
        <span>
          {peak.n > 0 ? (
            <>
              Busiest hour: <strong className="text-ink">{weekdays[peak.d]} {hourLabel(peak.h)}</strong>, {peak.n} votes
            </>
          ) : (
            "No votes yet"
          )}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          Fewer
          {STEPS.slice(1).map((s) => (
            <span key={s} className="h-2.5 w-3.5 rounded-[2px]" style={{ background: s }} aria-hidden="true" />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
