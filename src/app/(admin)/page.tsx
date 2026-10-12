import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadEverything, scopeDataset } from "@/lib/data";
import { buildDashboard, type CaptionScore, type VoterScore } from "@/lib/stats";
import { PageHeader, Section, ScopeToggle, Empty, Avatar, pct } from "@/components/ui";
import { QuadrantChart } from "@/components/charts/quadrant";
import { DailyVotesChart } from "@/components/charts/daily";
import { VoteHeatmap } from "@/components/charts/heatmap";
import { SplitBar, ShareBars } from "@/components/charts/split-bar";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { supabase } = await requireAdmin();
  const realOnly = (await searchParams).scope === "real";
  const data = scopeDataset(await loadEverything(supabase), realOnly);
  const s = buildDashboard(data);
  const t = s.totals;
  const delta = t.prior7 ? (t.last7 - t.prior7) / t.prior7 : null;

  return (
    <>
      <PageHeader
        title="What the room thinks"
        lede={
          t.votes ? (
            <>
              {t.activeVoters} people have cast {t.votes.toLocaleString()} votes on {t.captions} captions.{" "}
              {pct(t.upShare)} of all votes are upvotes.
            </>
          ) : (
            "No votes recorded yet. Charts fill in as soon as people start voting."
          )
        }
        actions={<ScopeToggle realOnly={realOnly} basePath="/" />}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Votes in the last 7 days" value={t.last7.toLocaleString()}>
          {delta === null ? (
            <span className="text-muted">No votes the week before</span>
          ) : (
            <span className={delta >= 0 ? "text-up" : "text-down"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))}% vs prior 7 days
            </span>
          )}
        </Tile>
        <Tile label="Upvote share" value={pct(t.upShare)}>
          <SplitBar up={Math.round(t.upShare * 1000)} down={1000 - Math.round(t.upShare * 1000)} className="mt-1.5" />
        </Tile>
        <Tile label="Captions" value={t.captions.toLocaleString()}>
          <span className="text-ink-2">
            {t.unvotedCaptions ? `${t.unvotedCaptions} still unseen` : "Every caption has votes"}
          </span>
        </Tile>
        <Tile label="Users" value={t.users.toLocaleString()}>
          <span className="text-ink-2">{t.activeVoters} have voted</span>
        </Tile>
      </dl>

      <Section
        title="Where every caption landed"
        note="Right means more people voted on it; up means the room liked it. Hover a dot to read the caption, click to open it."
        className="mb-6"
      >
        {s.captions.some((c) => c.total > 0) ? (
          <QuadrantChart
            medianVotes={s.medianVotes}
            points={s.captions.filter((c) => c.total > 0).map((c) => ({
              id: c.id,
              text: c.text,
              up: c.up,
              down: c.down,
              total: c.total,
              approval: c.approval,
            }))}
          />
        ) : (
          <Empty title="Nothing to plot yet">Captions appear here once they get their first vote.</Empty>
        )}
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Section
          title="Funniest"
          note="Ranked by Wilson score, so a caption with 40 of 45 upvotes beats one with 1 of 1."
        >
          <CaptionList rows={s.best} />
        </Section>
        <Section title="Least funny" note="Same ranking, from the bottom.">
          <CaptionList rows={s.worst} />
        </Section>
        <Section title="Most divisive" note="Closest to a 50/50 split, weighted by how many people voted.">
          <CaptionList rows={s.divisive} empty="Needs captions with 6+ votes." />
        </Section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Section title="Votes per day" note="Last 30 days, New York time.">
          <DailyVotesChart days={s.daily} />
        </Section>
        <Section title="When the room votes" note="Day of week by hour, New York time.">
          <VoteHeatmap weekdays={s.heatmap.weekdays} grid={s.heatmap.grid} />
        </Section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Does brevity win?" note="Upvote share by caption length. The tick marks 50%.">
          <ShareBars rows={s.byLength.filter((r) => r.total > 0)} />
        </Section>
        <Section title="Which model is funnier?" note="Upvote share by the model that wrote the caption.">
          <ShareBars rows={s.byModel} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Toughest crowd" note={`Voters with the lowest upvote share (${s.minVotesForPersona}+ votes).`}>
          <VoterList rows={s.harshest} />
        </Section>
        <Section title="Easiest laughs" note={`Voters who upvote almost everything (${s.minVotesForPersona}+ votes).`}>
          <VoterList rows={s.easiest} />
        </Section>
      </div>
    </>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="font-display mt-1 text-[32px] font-bold leading-none">{value}</dd>
      {children ? <dd className="mt-2 text-[13px]">{children}</dd> : null}
    </div>
  );
}

function CaptionList({ rows, empty = "No votes yet." }: { rows: CaptionScore[]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="space-y-4">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/captions?focus=${c.id}#c${c.id}`} className="block hover:underline decoration-line underline-offset-4">
            “{c.text}”
          </Link>
          <div className="mt-1.5 flex items-center gap-3">
            <SplitBar up={c.up} down={c.down} className="flex-1" />
            <span className="tnum shrink-0 text-[13px] text-ink-2">
              {c.up} / {c.down}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function VoterList({ rows }: { rows: VoterScore[] }) {
  if (!rows.length) return <p className="text-sm text-muted">Nobody has voted enough yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((v) => (
        <li key={v.id} className="flex items-center gap-3 py-2.5">
          <Avatar src={v.avatar} name={v.name} />
          <Link href={`/users/${v.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline underline-offset-4">
            {v.name}
          </Link>
          <SplitBar up={v.up} down={v.down} className="hidden w-28 sm:flex" />
          <span className="tnum w-24 shrink-0 text-right text-[13px] text-ink-2">
            <strong className="text-ink">{pct(v.upShare)}</strong> up of {v.total}
          </span>
        </li>
      ))}
    </ul>
  );
}
