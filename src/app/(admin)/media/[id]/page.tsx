import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CAPTION_COLS, IMAGE_COLS, VOTE_COLS, type Caption, type ImageRow, type Vote } from "@/lib/data";
import { scoreCaptions } from "@/lib/stats";
import { SeedBadge, fmtDate, Empty } from "@/components/ui";
import { SplitBar } from "@/components/charts/split-bar";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { updateImage, deleteImage, createCaption, updateCaption, deleteCaption } from "../../actions";

export default async function ImageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const id = Number((await params).id);
  const { created } = await searchParams;
  if (!id) notFound();

  const { data: img } = await supabase.from("images").select(IMAGE_COLS).eq("id", id).maybeSingle<ImageRow>();
  if (!img) notFound();

  const { data: caps } = await supabase.from("captions").select(CAPTION_COLS).eq("image_id", id).order("created_at");
  const captions = (caps ?? []) as Caption[];
  const ids = captions.map((c) => c.id);
  const { data: vs } = ids.length
    ? await supabase.from("caption_votes").select(VOTE_COLS).in("caption_id", ids)
    : { data: [] as Vote[] };
  const scores = new Map(scoreCaptions(captions, (vs ?? []) as Vote[]).map((s) => [s.id, s]));
  const totalVotes = [...scores.values()].reduce((n, s) => n + s.total, 0);

  return (
    <>
      <Link href="/media" className="text-sm text-ink-2 hover:text-ink">
        ← All images
      </Link>
      {created ? (
        <p role="status" className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          Image added. Write the first caption for it below.
        </p>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.description ?? ""} className="panel w-full bg-surface-2 object-contain" />
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            Added {fmtDate(img.created_at, true)}
            {img.storage_path ? <span>Stored in media/{img.storage_path}</span> : <span>External link</span>}
            {img.is_seed ? <SeedBadge /> : null}
          </p>
        </div>

        <section className="panel p-5">
          <h1 className="font-display text-2xl font-bold leading-tight">{img.description || `Image ${img.id}`}</h1>
          <ActionForm action={updateImage} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={img.id} />
            <Field label="Description">
              <input name="description" defaultValue={img.description ?? ""} className="field" />
            </Field>
            <Field label="Image URL">
              <input name="url" required defaultValue={img.url} className="field" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Model">
                <input name="model" defaultValue={img.model ?? ""} className="field" />
              </Field>
            </div>
            <Field label="Prompt used">
              <textarea name="prompt" rows={3} defaultValue={img.prompt ?? ""} className="field" />
            </Field>
            <div>
              <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
            </div>
          </ActionForm>
          <div className="mt-5 border-t border-line pt-4">
            <DeleteButton
              action={deleteImage}
              id={img.id}
              label="Delete image"
              confirmText={`Delete this image, its ${captions.length} captions and ${totalVotes} votes? This can't be undone.`}
            />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">Captions for this image</h2>
        <ActionForm action={createCaption} resetOnSuccess className="panel mt-4 flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="image_id" value={img.id} />
          <input type="hidden" name="image_description" value={img.description ?? ""} />
          <div className="min-w-[240px] flex-[3]">
            <Field label="New caption">
              <input name="caption_text" required maxLength={500} className="field" placeholder="Write a caption for this image" />
            </Field>
          </div>
          <div className="min-w-[140px] flex-1">
            <Field label="Model">
              <input name="model" className="field" placeholder="Optional" />
            </Field>
          </div>
          <SubmitButton pendingText="Adding…">Add caption</SubmitButton>
        </ActionForm>

        {captions.length === 0 ? (
          <div className="mt-4">
            <Empty title="No captions yet">Add one above.</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {captions.map((c) => {
              const s = scores.get(c.id)!;
              return (
                <li key={c.id} className="panel p-4">
                  <ActionForm action={updateCaption} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="image_id" value={img.id} />
                    <input type="hidden" name="prompt" value={c.prompt ?? ""} />
                    <Field label="Caption">
                      <input name="caption_text" required maxLength={500} defaultValue={c.caption_text} className="field" />
                    </Field>
                    <Field label="Model">
                      <input name="model" defaultValue={c.model ?? ""} className="field" />
                    </Field>
                    <SubmitButton pendingText="Saving…" variant="ghost">
                      Save
                    </SubmitButton>
                  </ActionForm>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <SplitBar up={s.up} down={s.down} className="w-40" />
                    <span className="tnum text-[13px] text-ink-2">
                      {s.up} up, {s.down} down
                    </span>
                    {c.is_seed ? <SeedBadge /> : null}
                    <div className="ml-auto">
                      <DeleteButton
                        action={deleteCaption}
                        id={c.id}
                        label="Delete"
                        back={`/media/${img.id}`}
                        confirmText={`Delete “${c.caption_text}”${s.total ? ` and its ${s.total} votes` : ""}?`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
