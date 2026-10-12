import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PROFILE_COLS, VOTE_COLS, fetchAll, type Profile, type Vote } from "@/lib/data";
import { scoreVoters } from "@/lib/stats";
import { PageHeader, Empty, Avatar, SeedBadge, fmtDate, pct } from "@/components/ui";
import { SplitBar } from "@/components/charts/split-bar";

const SORTS = { recent: "Joined most recently", votes: "Most votes", harsh: "Toughest critics", kind: "Easiest laughs" } as const;
type Sort = keyof typeof SORTS;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "recent";

  const [profiles, votes] = await Promise.all([
    fetchAll<Profile>(supabase, "profiles", PROFILE_COLS, "created_at"),
    fetchAll<Vote>(supabase, "caption_votes", VOTE_COLS),
  ]);
  const meta = new Map(profiles.map((p) => [p.id, p]));
  let rows = scoreVoters(profiles, votes);
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q));
  rows.sort((a, b) => {
    if (sort === "votes") return b.total - a.total;
    if (sort === "harsh") return (b.total ? 1 : 0) - (a.total ? 1 : 0) || a.upShare - b.upShare;
    if (sort === "kind") return b.upShare - a.upShare || b.total - a.total;
    return (meta.get(b.id)?.created_at ?? "").localeCompare(meta.get(a.id)?.created_at ?? "");
  });
  const admins = profiles.filter((p) => p.is_superadmin).length;

  return (
    <>
      <PageHeader
        title="Users"
        lede={`${profiles.length} profiles, ${admins} with superadmin access. A profile is created automatically the first time someone signs in with Google.`}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search name or email" aria-label="Search users" className="field max-w-xs" />
        <select name="sort" defaultValue={sort} aria-label="Sort users" className="field w-auto">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost">
          Apply
        </button>
        <span className="ml-auto text-sm text-muted">{rows.length} shown</span>
      </form>

      {rows.length === 0 ? (
        <Empty title={q ? `Nobody matches “${sp.q}”` : "No users yet"} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Joined</th>
                <th scope="col" className="text-right">Votes</th>
                <th scope="col">Up vs down</th>
                <th scope="col">Last vote</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = meta.get(r.id)!;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/users/${r.id}`} className="flex items-center gap-3 hover:underline underline-offset-4">
                        <Avatar src={r.avatar} name={r.name} size={32} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-medium">
                            {r.name}
                            {p.is_superadmin ? (
                              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-surface">Admin</span>
                            ) : null}
                            {r.isSeed ? <SeedBadge /> : null}
                          </span>
                          <span className="block text-[13px] text-muted">{r.email ?? "No email on file"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{fmtDate(p.created_at)}</td>
                    <td className="text-right tnum">{r.total}</td>
                    <td className="min-w-[180px]">
                      {r.total ? (
                        <div className="flex items-center gap-2">
                          <SplitBar up={r.up} down={r.down} className="w-24" />
                          <span className="tnum text-[13px] text-ink-2">{pct(r.upShare)} up</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted">Hasn&apos;t voted</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{fmtDate(r.lastVote)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
