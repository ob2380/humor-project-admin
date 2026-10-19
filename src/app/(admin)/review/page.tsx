import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { communityImageUrl, type CommunityPost } from "@/lib/community";
import { PageHeader, Section, Empty, Avatar, fmtDate } from "@/components/ui";
import { ReviewButtons } from "@/components/review-buttons";
import { approvePost, rejectPost } from "./actions";

const COLS =
  "id, author_id, kind, caption_text, image_path, status, caption_id, created_at, author:profiles(first_name, last_name, avatar_url)";

function authorName(p: CommunityPost) {
  return [p.author?.first_name, p.author?.last_name].filter(Boolean).join(" ") || "Player";
}

export default async function ReviewPage() {
  const { supabase } = await requireAdmin();

  const [pendingRes, reviewedRes] = await Promise.all([
    supabase.from("community_posts").select(COLS).eq("status", "pending").order("created_at", { ascending: true }),
    supabase
      .from("community_posts")
      .select(COLS)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (pendingRes.error) throw new Error(`Couldn't read the review queue: ${pendingRes.error.message}`);

  const pending = (pendingRes.data ?? []) as unknown as CommunityPost[];
  const reviewed = (reviewedRes.data ?? []) as unknown as CommunityPost[];

  return (
    <>
      <PageHeader
        title="Review queue"
        lede={
          pending.length
            ? `${pending.length} ${pending.length === 1 ? "post is" : "posts are"} waiting. Posts from the public app stay hidden until you approve them; approving adds them to the feed for voting.`
            : "Nothing waiting. New captions and memes from the public app show up here before anyone else sees them."
        }
      />

      {pending.length === 0 ? (
        <div className="mb-6">
          <Empty title="You're all caught up" />
        </div>
      ) : (
        <ul className="mb-8 space-y-4">
          {pending.map((p) => (
            <li key={p.id} className="panel overflow-hidden md:flex">
              {p.image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={communityImageUrl(p.image_path)}
                  alt={p.caption_text}
                  className="max-h-[420px] w-full bg-surface-2 object-contain md:w-[46%]"
                />
              ) : null}
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <Avatar src={p.author?.avatar_url ?? null} name={authorName(p)} size={28} />
                  <Link href={`/users/${p.author_id}`} className="font-semibold text-ink hover:underline underline-offset-4">
                    {authorName(p)}
                  </Link>
                  <span>{p.kind === "meme" ? "posted a meme" : "posted a caption"}</span>
                </div>
                <p className="font-display text-2xl font-bold leading-snug">“{p.caption_text}”</p>
                <p className="text-[13px] text-muted">Submitted {fmtDate(p.created_at, true)}</p>
                <div className="mt-auto">
                  <ReviewButtons postId={p.id} approve={approvePost} reject={rejectPost} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Section title="Recently reviewed" note="The last 12 decisions, newest first.">
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted">No posts reviewed yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {reviewed.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                {p.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={communityImageUrl(p.image_path)} alt="" className="h-10 w-10 shrink-0 rounded-md bg-surface-2 object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] text-muted">Text</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">“{p.caption_text}”</p>
                  <p className="text-[13px] text-muted">
                    {authorName(p)}, {fmtDate(p.created_at)}
                  </p>
                </div>
                {p.status === "approved" ? (
                  <Link
                    href={p.caption_id ? `/captions?focus=${p.caption_id}#c${p.caption_id}` : "/captions"}
                    className="shrink-0 rounded-full bg-up-soft px-2.5 py-0.5 text-[13px] font-semibold text-ink"
                  >
                    ▲ Approved
                  </Link>
                ) : (
                  <span className="shrink-0 rounded-full bg-down-soft px-2.5 py-0.5 text-[13px] font-semibold text-ink">
                    ✕ Rejected
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
