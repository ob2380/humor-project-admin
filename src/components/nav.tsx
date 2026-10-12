"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview", hint: "What the room thinks" },
  { href: "/captions", label: "Captions", hint: "Create, edit, delete" },
  { href: "/media", label: "Images", hint: "AI-generated media" },
  { href: "/votes", label: "Votes", hint: "Every up and down" },
  { href: "/users", label: "Users", hint: "Profiles and voters" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`group rounded-xl px-3 py-2 shrink-0 ${
              active ? "bg-ink text-surface" : "text-ink hover:bg-surface-2"
            }`}
          >
            <span className="block font-semibold leading-tight">{l.label}</span>
            <span className={`hidden md:block text-[13px] ${active ? "opacity-70" : "text-muted"}`}>{l.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
