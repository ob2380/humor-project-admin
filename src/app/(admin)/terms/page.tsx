import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { Term, TermType } from "@/lib/domain";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { AddPanel, SearchBar, Pill } from "@/components/crud";
import { createTerm, updateTerm, deleteTerm } from "../domain-actions";

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const typeFilter = Number(sp.type) || null;

  const [terms, types] = await Promise.all([
    fetchAll<Term>(supabase, "terms", "id, term, definition, example, priority, term_type_id, updated_at"),
    fetchAll<TermType>(supabase, "term_types", "id, name", "name"),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));

  const rows = terms
    .filter((t) => (!q || `${t.term} ${t.definition}`.toLowerCase().includes(q)) && (!typeFilter || t.term_type_id === typeFilter))
    .sort((a, b) => b.priority - a.priority || a.term.localeCompare(b.term));

  return (
    <>
      <PageHeader
        title="Terms"
        lede={`${terms.length} terms the generation prompts can draw on: comedy techniques, slang, and Columbia lore. Higher priority terms are used first.`}
      />

      <AddPanel title="Add a term" open={terms.length === 0}>
        <ActionForm action={createTerm} resetOnSuccess className="grid gap-4 md:grid-cols-2">
          <Field label="Term">
            <input name="term" required maxLength={120} className="field" placeholder="Callback" />
          </Field>
          <Field label="Type">
            <TypeSelect types={types} defaultValue={null} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Definition">
              <textarea name="definition" required rows={2} className="field" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Example" hint="Optional.">
              <textarea name="example" rows={2} className="field" />
            </Field>
          </div>
          <Field label="Priority" hint="Whole number. Higher means more important.">
            <input name="priority" type="number" step={1} defaultValue={0} className="field" />
          </Field>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Adding…">Add term</SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>

      <SearchBar q={sp.q ?? ""} placeholder="Search terms" count={rows.length} clearHref="/terms">
        <select name="type" defaultValue={typeFilter ?? ""} aria-label="Filter by type" className="field w-auto">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </SearchBar>

      {rows.length === 0 ? (
        <Empty title={q ? `No terms match “${sp.q}”` : "No terms yet"}>{q ? "Try a different word." : "Add one above."}</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id} className="panel p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tnum text-[13px] text-muted">#{t.id}</span>
                <h2 className="font-display text-lg font-bold">{t.term}</h2>
                {t.term_type_id ? <Pill>{typeName.get(t.term_type_id) ?? "Unknown type"}</Pill> : null}
                <span className="text-[13px] text-ink-2">Priority {t.priority}</span>
                <span className="ml-auto text-[13px] text-muted">Updated {fmtDate(t.updated_at)}</span>
              </div>
              <p className="mt-1.5 text-ink-2">{t.definition}</p>
              {t.example ? <p className="mt-1 text-[14px] text-muted">e.g. {t.example}</p> : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                <ActionForm action={updateTerm} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={t.id} />
                  <Field label="Term">
                    <input name="term" required maxLength={120} defaultValue={t.term} className="field" />
                  </Field>
                  <Field label="Type">
                    <TypeSelect types={types} defaultValue={t.term_type_id} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Definition">
                      <textarea name="definition" required rows={2} defaultValue={t.definition} className="field" />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Example">
                      <textarea name="example" rows={2} defaultValue={t.example ?? ""} className="field" />
                    </Field>
                  </div>
                  <Field label="Priority">
                    <input name="priority" type="number" step={1} defaultValue={t.priority} className="field" />
                  </Field>
                  <div className="md:col-span-2">
                    <SubmitButton pendingText="Saving…">Save term</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-3 border-t border-line pt-3">
                  <DeleteButton action={deleteTerm} id={t.id} label="Delete term" confirmText={`Delete the term “${t.term}”? This can't be undone.`} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TypeSelect({ types, defaultValue }: { types: TermType[]; defaultValue: number | null }) {
  return (
    <select name="term_type_id" defaultValue={defaultValue ?? ""} className="field">
      <option value="">No type</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
