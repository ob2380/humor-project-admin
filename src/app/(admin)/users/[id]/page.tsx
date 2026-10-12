import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CAPTION_COLS, PROFILE_COLS, VOTE_COLS, displayName, fetchAll, type Caption, type Profile, type Vote } from "@/lib/data";
import { scoreCaptions } from "@/lib/stats";
import { Avatar, SeedBadge, fmtDate, pct, Section, Empty } from "@/components/ui";
import { SplitBar } from "@/components/charts/split-bar";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle<Profile>();
  if (!profile) notFound();

  const [mine, captions, allVotes] = await Promise.all([
    supabase.from("caption_votes").select(VOTE_COLS).eq("profile_id", id).order("created_at", { ascending: false }),
    fetchAll<Caption>(supabase, "captions", CAPTION_COLS),
    fetchAll<Vote>(supabase, "caption_votes", VOTE_COLS),
  ]);
  const votes = (mine.data ?? []) as Vote[];
  const captionById = new Map(captions.map((c) => [c.id, c]));
  const crowd = new Map(scoreCaptions(captions, allVotes).map((s) => [s.id, s]));

  const up = votes.filter((v) => v.vote_value === 1).length;
  const down = votes.length - up;

  // How often does this person agree with the room? Compare each vote to the caption's majority.
  let agree = 0;
  let comparable = 0;
  for (const v of votes) {
    const s = crowd.get(v.caption_id);
    if (!s) continue;
    // remove this voter's own vote before judging the crowd
    const othersUp = s.up - (v.vote_value === 1 ? 1 : 0);
    const othersDown = s.down - (v.vote_value === -1 ? 1 : 0);
    if (othersUp === othersDown) continue;
    comparable++;
    if ((othersUp > othersDown) === (v.vote_value === 1)) agree++;
  }

  const name = displayName(profile);

  return (
    <>
      <Link href="/users" className="text-sm text-ink-2 hover:text-ink">
        ← All users
      </Link>
      <header className="mt-4 mb-7 flex flex-wrap items-center gap-4">
        <Avatar src={profile.avatar_url} name={name} size={64} />
        <div>
          <h1 className="font-display text-[34px] font-extrabold leading-tight">{name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-ink-2">
            {profile.email ?? "No email on file"}
            {profile.is_superadmin ? <span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-semibold text-surface">Admin</span> : null}
            {profile.is_seed ? <SeedBadge /> : null}
          </p>
          <p className="text-[13px] text-muted">Joined {fmtDate(profile.created_at, true)}</p>
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Votes cast" value={String(votes.length)} />
        <Tile label="Upvote share" value={votes.length ? pct(up / votes.length) : "—"}>
          <SplitBar up={up} down={down} className="mt-2" />
        </Tile>
        <Tile
          label="Agrees with the room"
          value={comparable ? pct(agree / comparable) : "—"}
          note={comparable ? `on ${comparable} captions others also judged` : "Not enough overlap yet"}
        />
        <Tile label="Last vote" value={votes[0] ? fmtDate(votes[0].created_at) : "—"} />
      </dl>

      <Section title="Voting history" note="Their vote next to how everyone else voted on the same caption.">
        {votes.length === 0 ? (
          <Empty title="No votes yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Their vote</th>
                  <th scope="col">Caption</th>
                  <th scope="col">Everyone</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => {
                  const c = captionById.get(v.caption_id);
                  const s = crowd.get(v.caption_id);
                  return (
                    <tr key={v.id}>
                      <td>
                        <span className="font-semibold" style={{ color: v.vote_value === 1 ? "var(--up)" : "var(--down)" }}>
                          {v.vote_value === 1 ? "▲ Up" : "▼ Down"}
                        </span>
                      </td>
                      <td className="max-w-[420px]">
                        <Link href={`/captions?focus=${v.caption_id}#c${v.caption_id}`} className="hover:underline underline-offset-4">
                          “{c?.caption_text ?? `Caption ${v.caption_id}`}”
                        </Link>
                      </td>
                      <td className="min-w-[160px]">
                        {s ? (
                          <div className="flex items-center gap-2">
                            <SplitBar up={s.up} down={s.down} className="w-24" />
                            <span className="tnum text-[13px] text-ink-2">
                              {s.up}/{s.down}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap tnum text-ink-2">{fmtDate(v.created_at, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function Tile({ label, value, note, children }: { label: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="font-display mt-1 text-[28px] font-bold leading-none">{value}</dd>
      {note ? <dd className="mt-1.5 text-[13px] text-muted">{note}</dd> : null}
      {children ? <dd>{children}</dd> : null}
    </div>
  );
}
