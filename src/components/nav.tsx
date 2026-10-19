"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview", hint: "What the room thinks" },
  { href: "/review", label: "Review", hint: "Approve community posts" },
  { href: "/captions", label: "Captions", hint: "Create, edit, delete" },
  { href: "/media", label: "Images", hint: "AI-generated media" },
  { href: "/votes", label: "Votes", hint: "Every up and down" },
  { href: "/users", label: "Users", hint: "Profiles and voters" },
];

export function Nav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        const badge = l.href === "/review" && pendingCount > 0 ? pendingCount : null;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`group rounded-xl px-3 py-2 shrink-0 ${
              active ? "bg-ink text-surface" : "text-ink hover:bg-surface-2"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold leading-tight">
              {l.label}
              {badge ? (
                <span
                  className="rounded-full bg-down px-1.5 text-[12px] font-bold leading-[18px] text-white tnum"
                  aria-label={`${badge} waiting`}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span className={`hidden md:block text-[13px] ${active ? "opacity-70" : "text-muted"}`}>{l.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
