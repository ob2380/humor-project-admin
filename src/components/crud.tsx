/** Collapsible "add" panel used at the top of every CRUD page. */
export function AddPanel({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="panel group mb-6 p-5" open={open}>
      <summary className="cursor-pointer list-none font-display text-lg font-bold">
        <span className="group-open:hidden">+ {title}</span>
        <span className="hidden group-open:inline">{title}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function SearchBar({
  q,
  placeholder,
  count,
  clearHref,
  children,
}: {
  q: string;
  placeholder: string;
  count: number;
  clearHref: string;
  children?: React.ReactNode;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
      <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="field max-w-xs" />
      {children}
      <button className="btn btn-ghost" type="submit">
        Apply
      </button>
      {q ? (
        <a href={clearHref} className="text-sm text-ink-2 underline underline-offset-4">
          Clear
        </a>
      ) : null}
      <span className="ml-auto text-sm text-muted">{count} shown</span>
    </form>
  );
}

export function Pill({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "ink" | "warn" | "ok" }) {
  const cls =
    tone === "ink"
      ? "bg-ink text-surface"
      : tone === "warn"
        ? "bg-down-soft text-danger"
        : tone === "ok"
          ? "bg-up-soft text-ink"
          : "bg-surface-2 text-ink-2";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${cls}`}>{children}</span>;
}
