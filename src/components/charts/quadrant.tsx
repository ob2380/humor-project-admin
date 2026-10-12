"use client";

import { useEffect, useState } from "react";
import { useTooltip, TooltipCard, Legend } from "./tooltip";

export type QuadPoint = { id: number; text: string; up: number; down: number; total: number; approval: number };

const H = 380;
const PAD = { top: 18, right: 18, bottom: 42, left: 46 };

/**
 * Every caption placed by how many people saw it (x) and how the room split (y).
 * The hero of the dashboard: the four corners are four different editorial decisions.
 */
export function QuadrantChart({ points, medianVotes }: { points: QuadPoint[]; medianVotes: number }) {
  const { ref, tip, show, hide } = useTooltip();
  const [width, setWidth] = useState(760);
  const [focusId, setFocusId] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const maxVotes = Math.max(4, ...points.map((p) => p.total));
  const xMax = Math.ceil(maxVotes / 5) * 5;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const sx = (v: number) => PAD.left + (v / xMax) * innerW;
  const sy = (a: number) => PAD.top + ((1 - a) / 2) * innerH;
  const xTicks = Array.from({ length: 6 }, (_, i) => Math.round((xMax / 5) * i));
  const yTicks = [1, 0.5, 0, -0.5, -1];
  const medX = sx(medianVotes);
  const compact = width < 520;

  const quadLabel = (text: string, x: number, y: number, anchor: "start" | "end") => (
    <text x={x} y={y} textAnchor={anchor} className="fill-[var(--muted)]" fontSize={compact ? 11 : 13} fontWeight={600}>
      {text}
    </text>
  );

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={hide}>
        <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Scatter plot of captions by total votes and approval">
          {/* quadrant washes */}
          <rect x={medX} y={PAD.top} width={sx(xMax) - medX} height={innerH / 2} fill="var(--up)" opacity={0.05} />
          <rect x={medX} y={sy(0)} width={sx(xMax) - medX} height={innerH / 2} fill="var(--down)" opacity={0.05} />

          {/* grid */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "var(--axis)" : "var(--line)"} strokeWidth={1} />
              <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" fontSize={12} className="fill-[var(--muted)] tnum">
                {t > 0 ? `+${t * 100}%` : `${t * 100}%`}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={12} className="fill-[var(--muted)] tnum">
              {t}
            </text>
          ))}
          <line x1={medX} x2={medX} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--axis)" strokeDasharray="3 4" />
          <text x={(PAD.left + width - PAD.right) / 2} y={H - 6} textAnchor="middle" fontSize={12} className="fill-[var(--ink-2)]">
            Votes received (dashed line = median, {medianVotes})
          </text>

          {quadLabel("Crowd pleasers", width - PAD.right - 8, PAD.top + 18, "end")}
          {quadLabel("Public flops", width - PAD.right - 8, H - PAD.bottom - 10, "end")}
          {quadLabel("Hidden gems", PAD.left + 8, PAD.top + 18, "start")}
          {quadLabel("Quiet misses", PAD.left + 8, H - PAD.bottom - 10, "start")}

          {points.map((p) => {
            const positive = p.approval >= 0;
            const focused = focusId === p.id;
            return (
              <a key={p.id} href={`/captions?focus=${p.id}#c${p.id}`} aria-label={`${p.text}: ${p.up} up, ${p.down} down`}>
                <circle
                  cx={sx(p.total)}
                  cy={sy(p.approval)}
                  r={14}
                  fill="transparent"
                  onPointerEnter={(e) => {
                    setFocusId(p.id);
                    show(e, <PointTip p={p} />);
                  }}
                  onPointerMove={(e) => show(e, <PointTip p={p} />)}
                  onPointerLeave={() => setFocusId(null)}
                  onFocus={(e) => show(e, <PointTip p={p} />)}
                  onBlur={hide}
                />
                <circle
                  cx={sx(p.total)}
                  cy={sy(p.approval)}
                  r={focused ? 7 : 5}
                  fill={positive ? "var(--up)" : "var(--down)"}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              </a>
            );
          })}
        </svg>
        <TooltipCard tip={tip} width={width} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Legend
          items={[
            { label: "More upvotes than downvotes", color: "var(--up)" },
            { label: "More downvotes than upvotes", color: "var(--down)" },
          ]}
        />
        <span className="text-[13px] text-muted">Vertical axis: net approval, (up − down) ÷ votes</span>
      </div>
    </div>
  );
}

function PointTip({ p }: { p: QuadPoint }) {
  return (
    <>
      <div className="font-semibold text-ink">“{p.text}”</div>
      <div className="mt-1 tnum text-ink-2">
        {p.up} up, {p.down} down, net {p.approval >= 0 ? "+" : ""}
        {Math.round(p.approval * 100)}%
      </div>
    </>
  );
}
