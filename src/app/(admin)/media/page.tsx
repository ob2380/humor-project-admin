import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CAPTION_COLS, IMAGE_COLS, VOTE_COLS, fetchAll, type Caption, type ImageRow, type Vote } from "@/lib/data";
import { scoreCaptions } from "@/lib/stats";
import { PageHeader, Empty, SeedBadge, pct } from "@/components/ui";
import { SplitBar } from "@/components/charts/split-bar";
import { ActionForm, SubmitButton, Field } from "@/components/forms";
import { createImage } from "../actions";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { supabase } = await requireAdmin();
  const { deleted } = await searchParams;
  const [images, captions, votes] = await Promise.all([
    fetchAll<ImageRow>(supabase, "images", IMAGE_COLS, "created_at"),
    fetchAll<Caption>(supabase, "captions", CAPTION_COLS),
    fetchAll<Vote>(supabase, "caption_votes", VOTE_COLS),
  ]);
  const scores = scoreCaptions(captions, votes);

  const cards = images
    .map((img) => {
      const mine = scores.filter((s) => s.imageId === img.id);
      const up = mine.reduce((n, s) => n + s.up, 0);
      const down = mine.reduce((n, s) => n + s.down, 0);
      const best = [...mine].sort((a, b) => b.wilson - a.wilson)[0];
      return { img, count: mine.length, up, down, best };
    })
    .reverse();

  return (
    <>
      <PageHeader
        title="Images"
        lede="The AI-generated images captions are written for. Files live in Supabase Storage; the database keeps a link to each one."
      />

      {deleted ? (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          Image deleted, along with its captions and their votes.
        </p>
      ) : null}

      <details className="panel group mb-6 p-5" open={images.length === 0}>
        <summary className="cursor-pointer list-none font-display text-lg font-bold">
          <span className="group-open:hidden">+ Add an image</span>
          <span className="hidden group-open:inline">Add an image</span>
        </summary>
        <ActionForm action={createImage} className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Upload a file" hint="PNG, JPEG, WebP, GIF or SVG, up to 6 MB. Saved to the media bucket.">
            <input type="file" name="file" accept="image/*" className="field file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1" />
          </Field>
          <Field label="Or paste an image URL" hint="Used only when no file is chosen.">
            <input name="url" type="url" className="field" placeholder="https://…" />
          </Field>
          <Field label="Description" hint="What's in the picture. Captions get written against this.">
            <input name="description" className="field" placeholder="A pigeon guarding the Butler Library steps" />
          </Field>
          <Field label="Model">
            <input name="model" className="field" placeholder="dall-e-3" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Prompt used">
              <textarea name="prompt" rows={2} className="field" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Uploading…">Add image</SubmitButton>
          </div>
        </ActionForm>
      </details>

      {cards.length === 0 ? (
        <Empty title="No images yet">Add the first one above.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ img, count, up, down, best }) => (
            <li key={img.id} className="panel overflow-hidden">
              <Link href={`/media/${img.id}`} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.description ?? `Image ${img.id}`} className="aspect-[4/3] w-full bg-surface-2 object-cover" />
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/media/${img.id}`} className="font-semibold leading-snug hover:underline underline-offset-4">
                    {img.description || `Image ${img.id}`}
                  </Link>
                  {img.is_seed ? <SeedBadge /> : null}
                </div>
                <p className="mt-1 text-[13px] text-ink-2">
                  {count} {count === 1 ? "caption" : "captions"}
                  {img.model ? `, made with ${img.model}` : ""}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <SplitBar up={up} down={down} className="flex-1" />
                  <span className="tnum shrink-0 text-[13px] text-ink-2">{up + down ? `${pct(up / (up + down))} up` : "No votes"}</span>
                </div>
                {best && best.total > 0 ? (
                  <p className="mt-3 text-[13px] text-ink-2">
                    Best caption: <span className="text-ink">“{best.text}”</span>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
