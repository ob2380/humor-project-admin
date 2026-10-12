"use client";

import { useEffect, useState } from "react";
import { useTooltip, TooltipCard, Legend } from "./tooltip";

type Day = { day: string; up: number; down: number };

const H = 230;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

function fmtDay(key: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

/** Upvotes stack above the baseline, downvotes hang below it. One axis, counts both ways. */
export function DailyVotesChart({ days }: { days: Day[] }) {
  const { ref, tip, show, hide } = useTooltip();
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const maxUp = Math.max(1, ...days.map((d) => d.up));
  const maxDown = Math.max(1, ...days.map((d) => d.down));
  const innerH = H - PAD.top - PAD.bottom;
  const upH = (innerH * maxUp) / (maxUp + maxDown);
  const base = PAD.top + upH;
  const scale = upH / maxUp;
  const innerW = width - PAD.left - PAD.right;
  const slot = innerW / days.length;
  const bar = Math.max(3, Math.min(14, slot - 2));
  const r = Math.min(3, bar / 2);

  const tipFor = (d: Day) => (
    <>
      <div className="font-semibold text-ink">{fmtDay(d.day, { weekday: "short", month: "short", day: "numeric" })}</div>
      <div className="mt-1 tnum text-ink-2">
        {d.up} up, {d.down} down
      </div>
    </>
  );

  // rounded data-end, square at the baseline
  const upPath = (x: number, h: number) =>
    h <= 0 ? "" : `M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${bar - 2 * r} q${r},0 ${r},${r} v${h - r} z`;
  const downPath = (x: number, h: number) =>
    h <= 0 ? "" : `M${x},${base + 1} v${h - r} q0,${r} ${r},${r} h${bar - 2 * r} q${r},0 ${r},${-r} v${-(h - r)} z`;

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={hide}>
        <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Daily upvotes and downvotes, last 30 days">
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top} y2={PAD.top} stroke="var(--line)" />
          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize={12} className="fill-[var(--muted)] tnum">
            {maxUp}
          </text>
          <text x={PAD.left - 6} y={H - PAD.bottom + 4} textAnchor="end" fontSize={12} className="fill-[var(--muted)] tnum">
            {maxDown}
          </text>
          <line x1={PAD.left} x2={width - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--line)" />
          {days.map((d, i) => {
            const x = PAD.left + i * slot + (slot - bar) / 2;
            return (
              <g key={d.day}>
                <path d={upPath(x, d.up * scale)} fill="var(--up)" />
                <path d={downPath(x, d.down * scale)} fill="var(--down)" />
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.day}: ${d.up} up, ${d.down} down`}
                  onPointerEnter={(e) => show(e, tipFor(d))}
                  onPointerMove={(e) => show(e, tipFor(d))}
                  onFocus={(e) => show(e, tipFor(d))}
                  onBlur={hide}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} stroke="var(--axis)" strokeWidth={1.5} />
          {days.map((d, i) =>
            i % 7 === 0 || i === days.length - 1 ? (
              <text
                key={d.day}
                x={PAD.left + i * slot + slot / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={12}
                className="fill-[var(--muted)]"
              >
                {fmtDay(d.day, { month: "short", day: "numeric" })}
              </text>
            ) : null,
          )}
        </svg>
        <TooltipCard tip={tip} width={width} />
      </div>
      <div className="mt-2">
        <Legend
          items={[
            { label: "Upvotes (above the line)", color: "var(--up)", shape: "bar" },
            { label: "Downvotes (below the line)", color: "var(--down)", shape: "bar" },
          ]}
        />
      </div>
    </div>
  );
}
