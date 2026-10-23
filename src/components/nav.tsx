"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    title: "Overview",
    links: [
      { href: "/", label: "Overview", hint: "What the room thinks" },
      { href: "/review", label: "Review", hint: "Approve community posts" },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/captions", label: "Captions", hint: "Create, edit, delete" },
      { href: "/media", label: "Images", hint: "AI-generated media" },
      { href: "/votes", label: "Votes", hint: "Every up and down" },
      { href: "/users", label: "Users", hint: "Profiles and voters" },
      { href: "/terms", label: "Terms", hint: "Humor vocabulary" },
      { href: "/examples", label: "Examples", hint: "Few-shot captions" },
    ],
  },
  {
    title: "Pipeline",
    links: [
      { href: "/chains", label: "Prompt chains", hint: "Steps and mix" },
      { href: "/requests", label: "Requests", hint: "Generation requests" },
      { href: "/responses", label: "LLM responses", hint: "What the models said" },
      { href: "/models", label: "LLM models", hint: "Create, edit, delete" },
      { href: "/providers", label: "LLM providers", hint: "Create, edit, delete" },
    ],
  },
  {
    title: "Access",
    links: [{ href: "/access", label: "Signup access", hint: "Domains and e-mails" }],
  },
];

export function Nav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex gap-4 overflow-x-auto md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:overflow-x-visible">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 md:flex-col">
          <p className="hidden px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted md:block">{g.title}</p>
          {g.links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const badge = l.href === "/review" && pendingCount > 0 ? pendingCount : null;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`group shrink-0 rounded-xl px-3 py-1.5 ${active ? "bg-ink text-surface" : "text-ink hover:bg-surface-2"}`}
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
                <span className={`hidden text-[13px] md:block ${active ? "opacity-70" : "text-muted"}`}>{l.hint}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
