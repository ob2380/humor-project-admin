import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PROFILE_COLS, displayName, fetchAll, type Profile } from "@/lib/data";
import { PageHeader, Empty, Avatar, fmtDate, pct } from "@/components/ui";

const PAGE = 50;

type Row = {
  id: number;
  vote_value: number;
  created_at: string;
  caption_id: number;
  profile_id: string;
  captions: { caption_text: string } | null;
  profiles: { first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null } | null;
};

export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; user?: string; caption?: string; page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const dir = sp.dir === "up" ? 1 : sp.dir === "down" ? -1 : null;
  const user = sp.user || null;
  const captionId = Number(sp.caption) || null;
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("caption_votes")
    .select(
      "id, vote_value, created_at, caption_id, profile_id, captions(caption_text), profiles(first_name, last_name, email, avatar_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (dir) query = query.eq("vote_value", dir);
  if (user) query = query.eq("profile_id", user);
  if (captionId) query = query.eq("caption_id", captionId);

  // Totals for the summary strip, under the same filters minus direction.
  const countFor = (value: 1 | -1) => {
    let q = supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote_value", value);
    if (user) q = q.eq("profile_id", user);
    if (captionId) q = q.eq("caption_id", captionId);
    return q;
  };

  const [{ data, count, error }, upRes, downRes, profiles] = await Promise.all([
    query,
    countFor(1),
    countFor(-1),
    fetchAll<Profile>(supabase, "profiles", PROFILE_COLS, "created_at"),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const up = upRes.count ?? 0;
  const down = downRes.count ?? 0;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const filtered = !!(dir || user || captionId);
  const captionText = captionId ? rows[0]?.captions?.caption_text : null;

  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { dir: sp.dir ?? null, user, caption: captionId ? String(captionId) : null, page: null as string | null, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/votes?${s}` : "/votes";
  };

  return (
    <>
      <PageHeader
        title="Votes"
        lede="Every upvote and downvote, newest first. Read-only: votes belong to the people who cast them."
      />

      <div className="panel mb-4 grid gap-4 p-4 sm:grid-cols-3">
        <Stat label="Upvotes" value={up} color="var(--up)" />
        <Stat label="Downvotes" value={down} color="var(--down)" />
        <div>
          <div className="text-sm text-ink-2">Upvote share</div>
          <div className="font-display text-[28px] font-bold leading-tight">{up + down ? pct(up / (up + down)) : "—"}</div>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter votes">
        <select name="dir" defaultValue={sp.dir ?? ""} className="field w-auto" aria-label="Vote direction">
          <option value="">Up and down</option>
          <option value="up">Upvotes only</option>
          <option value="down">Downvotes only</option>
        </select>
        <select name="user" defaultValue={user ?? ""} className="field w-auto max-w-[240px]" aria-label="Voter">
          <option value="">Every voter</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)}
            </option>
          ))}
        </select>
        {captionId ? <input type="hidden" name="caption" value={captionId} /> : null}
        <button type="submit" className="btn btn-ghost">
          Apply
        </button>
        {filtered ? (
          <Link href="/votes" className="text-sm text-ink-2 underline underline-offset-4">
            Clear filters
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-muted tnum">{(count ?? 0).toLocaleString()} votes</span>
      </form>
      {captionId ? (
        <p className="mb-4 text-sm text-ink-2">
          Showing votes on {captionText ? <strong className="text-ink">“{captionText}”</strong> : `caption ${captionId}`}.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Empty title={filtered ? "No votes match these filters" : "No votes yet"}>
          {filtered ? "Loosen a filter to see more." : "Votes show up here as soon as people use the public app."}
        </Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Vote</th>
                <th scope="col">Caption</th>
                <th scope="col">Voter</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = displayName(r.profiles);
                return (
                  <tr key={r.id}>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold ${
                          r.vote_value === 1 ? "bg-up-soft text-ink" : "bg-down-soft text-ink"
                        }`}
                      >
                        <span aria-hidden="true" style={{ color: r.vote_value === 1 ? "var(--up)" : "var(--down)" }}>
                          {r.vote_value === 1 ? "▲" : "▼"}
                        </span>
                        {r.vote_value === 1 ? "Up" : "Down"}
                      </span>
                    </td>
                    <td className="max-w-[420px]">
                      <Link href={link({ caption: String(r.caption_id) })} className="line-clamp-2 hover:underline underline-offset-4">
                        “{r.captions?.caption_text ?? `Caption ${r.caption_id}`}”
                      </Link>
                    </td>
                    <td>
                      <Link href={`/users/${r.profile_id}`} className="flex items-center gap-2 whitespace-nowrap hover:underline underline-offset-4">
                        <Avatar src={r.profiles?.avatar_url ?? null} name={name} size={24} />
                        {name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap tnum text-ink-2">{fmtDate(r.created_at, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="btn btn-ghost" href={link({ page: String(page - 1) })}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-2 tnum">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link className="btn btn-ghost" href={link({ page: String(page + 1) })}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-ink-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {label}
      </div>
      <div className="font-display text-[28px] font-bold leading-tight tnum">{value.toLocaleString()}</div>
    </div>
  );
}
