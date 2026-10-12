"use client";

import { useCallback, useRef, useState } from "react";

export type Tip = { x: number; y: number; content: React.ReactNode } | null;

/** Shared hover layer: a relative wrapper + a floating card that follows the hovered mark. */
export function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);

  const show = useCallback((e: React.PointerEvent | React.FocusEvent, content: React.ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    let x: number;
    let y: number;
    if ("clientX" in e) {
      x = e.clientX - box.left;
      y = e.clientY - box.top;
    } else {
      const r = (e.target as Element).getBoundingClientRect();
      x = r.left + r.width / 2 - box.left;
      y = r.top - box.top;
    }
    setTip({ x, y, content });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return { ref, tip, show, hide };
}

export function TooltipCard({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width - 240;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 max-w-[260px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-snug shadow-lg"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 12),
      }}
    >
      {tip.content}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; shape?: "dot" | "bar" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={i.shape === "bar" ? "h-2.5 w-3.5 rounded-[3px]" : "h-2.5 w-2.5 rounded-full"}
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
