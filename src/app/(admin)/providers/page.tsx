import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { Model, Provider } from "@/lib/domain";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { AddPanel } from "@/components/crud";
import { createProvider, updateProvider, deleteProvider } from "../domain-actions";

export default async function ProvidersPage() {
  const { supabase } = await requireAdmin();
  const [providers, models] = await Promise.all([
    fetchAll<Provider>(supabase, "llm_providers", "id, name, created_at, updated_at", "name"),
    fetchAll<Model>(supabase, "llm_models", "id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_at, updated_at"),
  ]);
  const byProvider = new Map<number, Model[]>();
  for (const m of models) byProvider.set(m.llm_provider_id, [...(byProvider.get(m.llm_provider_id) ?? []), m]);

  return (
    <>
      <PageHeader title="LLM providers" lede={`${providers.length} companies whose models power the pipeline. Models belong to a provider.`} />

      <AddPanel title="Add a provider" open={providers.length === 0}>
        <ActionForm action={createProvider} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="Name">
              <input name="name" required maxLength={80} className="field" placeholder="Google" />
            </Field>
          </div>
          <SubmitButton pendingText="Adding…">Add provider</SubmitButton>
        </ActionForm>
      </AddPanel>

      {providers.length === 0 ? (
        <Empty title="No providers yet">Add one above, then add its models on the Models page.</Empty>
      ) : (
        <ul className="space-y-3">
          {providers.map((p) => {
            const ms = byProvider.get(p.id) ?? [];
            return (
              <li key={p.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum text-[13px] text-muted">#{p.id}</span>
                  <h2 className="font-display text-lg font-bold">{p.name}</h2>
                  <span className="text-[13px] text-ink-2">
                    {ms.length} model{ms.length === 1 ? "" : "s"}
                    {ms.length ? `: ${ms.map((m) => m.name).join(", ")}` : ""}
                  </span>
                  <span className="ml-auto text-[13px] text-muted">Updated {fmtDate(p.updated_at)}</span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                  <ActionForm action={updateProvider} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="min-w-[240px] flex-1">
                      <Field label="Name">
                        <input name="name" required maxLength={80} defaultValue={p.name} className="field" />
                      </Field>
                    </div>
                    <SubmitButton pendingText="Saving…">Save provider</SubmitButton>
                  </ActionForm>
                  <div className="mt-3 border-t border-line pt-3">
                    <DeleteButton
                      action={deleteProvider}
                      id={p.id}
                      label="Delete provider"
                      confirmText={`Delete ${p.name}${ms.length ? ` and its ${ms.length} model${ms.length === 1 ? "" : "s"}` : ""}? This can't be undone.`}
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
