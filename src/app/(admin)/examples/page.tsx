import { requireAdmin } from "@/lib/auth";
import { IMAGE_COLS, fetchAll, type ImageRow } from "@/lib/data";
import type { Example } from "@/lib/domain";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { AddPanel, SearchBar } from "@/components/crud";
import { createExample, updateExample, deleteExample } from "../domain-actions";

export default async function ExamplesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const [examples, images] = await Promise.all([
    fetchAll<Example>(supabase, "generation_examples", "id, image_description, caption, explanation, priority, image_id, updated_at"),
    fetchAll<ImageRow>(supabase, "images", IMAGE_COLS),
  ]);
  const imgById = new Map(images.map((i) => [i.id, i]));
  const rows = examples
    .filter((e) => !q || `${e.image_description} ${e.caption} ${e.explanation ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.priority - a.priority || b.id - a.id);

  return (
    <>
      <PageHeader
        title="Generation examples"
        lede={`${examples.length} example captions shown to the model as few-shot guidance. Pair an image description with the caption you'd want back, and say why it works.`}
      />

      <AddPanel title="Add an example" open={examples.length === 0}>
        <ActionForm action={createExample} resetOnSuccess className="grid gap-4 md:grid-cols-2">
          <Fields images={images} />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Adding…">Add example</SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>

      <SearchBar q={sp.q ?? ""} placeholder="Search examples" count={rows.length} clearHref="/examples" />

      {rows.length === 0 ? (
        <Empty title={q ? `No examples match “${sp.q}”` : "No examples yet"}>{q ? "Try a different word." : "Add one above."}</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => {
            const img = e.image_id ? imgById.get(e.image_id) : undefined;
            return (
              <li key={e.id} className="panel p-4">
                <div className="flex gap-4">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt={img.description ?? ""} className="h-16 w-16 shrink-0 rounded-lg bg-surface-2 object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 px-1 text-center text-[11px] leading-tight text-muted">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted">
                      <span className="tnum">#{e.id}</span> · Priority {e.priority} · Updated {fmtDate(e.updated_at)}
                    </p>
                    <p className="mt-0.5 text-[14px] text-ink-2">{e.image_description}</p>
                    <p className="mt-1 text-[17px] font-medium leading-snug">“{e.caption}”</p>
                    {e.explanation ? <p className="mt-1 text-[14px] text-muted">{e.explanation}</p> : null}
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                  <ActionForm action={updateExample} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={e.id} />
                    <Fields images={images} example={e} />
                    <div className="md:col-span-2">
                      <SubmitButton pendingText="Saving…">Save example</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-3 border-t border-line pt-3">
                    <DeleteButton action={deleteExample} id={e.id} label="Delete example" confirmText="Delete this example? This can't be undone." />
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

function Fields({ images, example }: { images: ImageRow[]; example?: Example }) {
  return (
    <>
      <div className="md:col-span-2">
        <Field label="Image description">
          <textarea name="image_description" required rows={2} defaultValue={example?.image_description ?? ""} className="field" placeholder="A cat staring at a laptop" />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Example caption">
          <textarea name="caption" required maxLength={500} rows={2} defaultValue={example?.caption ?? ""} className="field" />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Why it works" hint="Optional. The model sees this as the explanation.">
          <textarea name="explanation" rows={2} defaultValue={example?.explanation ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Image" hint="Optional.">
        <select name="image_id" defaultValue={example?.image_id ?? ""} className="field">
          <option value="">No image</option>
          {images.map((i) => (
            <option key={i.id} value={i.id}>
              {i.description ? i.description.slice(0, 60) : `Image ${i.id}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority" hint="Whole number. Higher is used first.">
        <input name="priority" type="number" step={1} defaultValue={example?.priority ?? 0} className="field" />
      </Field>
    </>
  );
}
