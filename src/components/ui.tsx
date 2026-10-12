import Link from "next/link";

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-[34px] font-extrabold leading-[1.05] md:text-[42px]">{title}</h1>
        {lede ? <p className="mt-2 text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  note,
  children,
  className = "",
  aside,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={`panel p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
          {note ? <p className="mt-1 text-sm text-ink-2">{note}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SeedBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-seed-bg px-2 py-0.5 text-[12px] font-semibold text-seed"
      title="Demo row created by the seed script (is_seed = true)"
    >
      Demo
    </span>
  );
}

export function ScopeToggle({ realOnly, basePath, extra = {} }: { realOnly: boolean; basePath: string; extra?: Record<string, string> }) {
  const qs = (scope?: string) => {
    const p = new URLSearchParams(extra);
    if (scope) p.set("scope", scope);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div role="group" aria-label="Which rows to include" className="inline-flex rounded-full border border-line bg-surface p-0.5 text-sm">
      <Link
        href={qs()}
        aria-current={!realOnly ? "true" : undefined}
        className={`rounded-full px-3 py-1 font-medium ${!realOnly ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
      >
        All data
      </Link>
      <Link
        href={qs("real")}
        aria-current={realOnly ? "true" : undefined}
        className={`rounded-full px-3 py-1 font-medium ${realOnly ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
      >
        Real activity only
      </Link>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function Avatar({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} className="rounded-full" referrerPolicy="no-referrer" style={{ width: size, height: size }} />
    );
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function fmtDate(iso: string | null, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}
