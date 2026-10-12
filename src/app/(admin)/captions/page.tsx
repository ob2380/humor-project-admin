import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CAPTION_COLS, IMAGE_COLS, VOTE_COLS, fetchAll, type Caption, type ImageRow, type Vote } from "@/lib/data";
import { scoreCaptions } from "@/lib/stats";
import { PageHeader, Empty, SeedBadge, fmtDate } from "@/components/ui";
import { SplitBar } from "@/components/charts/split-bar";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { createCaption, updateCaption, deleteCaption } from "../actions";

const SORTS = {
  new: "Newest",
  best: "Most liked",
  worst: "Least liked",
  votes: "Most votes",
} as const;
type Sort = keyof typeof SORTS;

export default async function CaptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; focus?: string; image?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "new";
  const focus = Number(sp.focus) || null;
  const imageFilter = Number(sp.image) || null;

  const [captions, images, votes] = await Promise.all([
    fetchAll<Caption>(supabase, "captions", CAPTION_COLS),
    fetchAll<ImageRow>(supabase, "images", IMAGE_COLS),
    fetchAll<Vote>(supabase, "caption_votes", VOTE_COLS),
  ]);
  const byId = new Map(captions.map((c) => [c.id, c]));
  const imgById = new Map(images.map((i) => [i.id, i]));

  let rows = scoreCaptions(captions, votes);
  if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q) || (r.model ?? "").toLowerCase().includes(q));
  if (imageFilter) rows = rows.filter((r) => r.imageId === imageFilter);
  rows.sort((a, b) => {
    if (sort === "best") return b.wilson - a.wilson;
    if (sort === "worst") return a.wilson - b.wilson || b.total - a.total;
    if (sort === "votes") return b.total - a.total;
    return (byId.get(b.id)?.created_at ?? "").localeCompare(byId.get(a.id)?.created_at ?? "");
  });

  const models = [...new Set(captions.map((c) => c.model).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader
        title="Captions"
        lede={`${captions.length} AI-generated captions. Edit the wording, re-attach them to an image, or delete the ones that shouldn't be shown.`}
      />

      <details className="panel mb-6 p-5 group" open={captions.length === 0}>
        <summary className="cursor-pointer list-none font-display text-lg font-bold">
          <span className="group-open:hidden">+ Add a caption</span>
          <span className="hidden group-open:inline">Add a caption</span>
        </summary>
        <ActionForm action={createCaption} resetOnSuccess className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Caption">
              <textarea name="caption_text" required maxLength={500} rows={2} className="field" placeholder="Butler at 2am: a love story" />
            </Field>
          </div>
          <Field label="Image" hint="Optional. Leave empty for a text-only caption.">
            <ImageSelect images={images} defaultValue={imageFilter} />
          </Field>
          <Field label="Model">
            <input name="model" list="models" className="field" placeholder="gpt-4.1-mini" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Prompt used" hint="Optional. Helps trace which prompt produced which caption.">
              <textarea name="prompt" rows={2} className="field" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Adding…">Add caption</SubmitButton>
          </div>
        </ActionForm>
      </details>
      <datalist id="models">
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search caption text or model"
          aria-label="Search captions"
          className="field max-w-xs"
        />
        <select name="sort" defaultValue={sort} aria-label="Sort captions" className="field w-auto">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {imageFilter ? <input type="hidden" name="image" value={imageFilter} /> : null}
        <button className="btn btn-ghost" type="submit">
          Apply
        </button>
        {q || imageFilter || sort !== "new" ? (
          <Link href="/captions" className="text-sm text-ink-2 underline underline-offset-4">
            Clear
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-muted">{rows.length} shown</span>
      </form>

      {rows.length === 0 ? (
        <Empty title={q ? `No captions match “${sp.q}”` : "No captions yet"}>
          {q ? "Try a different word." : "Add one above, or generate some from the public app."}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const c = byId.get(r.id)!;
            const img = c.image_id ? imgById.get(c.image_id) : undefined;
            const open = focus === r.id;
            return (
              <li key={r.id} id={`c${r.id}`} className={`panel p-4 scroll-mt-6 ${open ? "ring-2 ring-[var(--focus)]" : ""}`}>
                <div className="flex gap-4">
                  {img ? (
                    <Link href={`/media/${img.id}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.description ?? ""} className="h-16 w-16 rounded-lg object-cover bg-surface-2" />
                    </Link>
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 px-1 text-center text-[11px] leading-tight text-muted">
                      Text only
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-medium leading-snug">“{r.text}”</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                      {c.model ? <span>{c.model}</span> : <span className="text-muted">No model recorded</span>}
                      <span>{fmtDate(c.created_at)}</span>
                      {c.is_seed ? <SeedBadge /> : null}
                    </div>
                    <div className="mt-2 flex max-w-md items-center gap-3">
                      <SplitBar up={r.up} down={r.down} className="flex-1" />
                      <span className="tnum shrink-0 text-[13px] text-ink-2">
                        {r.up} up, {r.down} down
                      </span>
                    </div>
                  </div>
                </div>
                <details className="mt-3" open={open}>
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                  <ActionForm action={updateCaption} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={c.id} />
                    <div className="md:col-span-2">
                      <Field label="Caption">
                        <textarea name="caption_text" required maxLength={500} rows={2} defaultValue={c.caption_text} className="field" />
                      </Field>
                    </div>
                    <Field label="Image">
                      <ImageSelect images={images} defaultValue={c.image_id} />
                    </Field>
                    <Field label="Model">
                      <input name="model" list="models" defaultValue={c.model ?? ""} className="field" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Prompt used">
                        <textarea name="prompt" rows={2} defaultValue={c.prompt ?? ""} className="field" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <SubmitButton pendingText="Saving…">Save caption</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-3 border-t border-line pt-3">
                    <DeleteButton
                      action={deleteCaption}
                      id={c.id}
                      label="Delete caption"
                      back="/captions"
                      confirmText={`Delete this caption${r.total ? ` and its ${r.total} votes` : ""}? This can't be undone.`}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ImageSelect({ images, defaultValue }: { images: ImageRow[]; defaultValue: number | null }) {
  return (
    <select name="image_id" defaultValue={defaultValue ?? ""} className="field">
      <option value="">No image</option>
      {images.map((i) => (
        <option key={i.id} value={i.id}>
          {i.description ? i.description.slice(0, 60) : `Image ${i.id}`}
        </option>
      ))}
    </select>
  );
}
