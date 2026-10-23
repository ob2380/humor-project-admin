import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { Model, Provider, Step } from "@/lib/domain";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton, DeleteButton, Field } from "@/components/forms";
import { AddPanel, SearchBar, Pill } from "@/components/crud";
import { createModel, updateModel, deleteModel } from "../domain-actions";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ q?: string; provider?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const providerFilter = Number(sp.provider) || null;

  const [models, providers, steps] = await Promise.all([
    fetchAll<Model>(supabase, "llm_models", "id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_at, updated_at", "name"),
    fetchAll<Provider>(supabase, "llm_providers", "id, name, created_at, updated_at", "name"),
    fetchAll<Pick<Step, "id" | "llm_model_id">>(supabase, "prompt_chain_steps", "id, llm_model_id"),
  ]);
  const providerName = new Map(providers.map((p) => [p.id, p.name]));
  const stepCount = new Map<number, number>();
  for (const s of steps) stepCount.set(s.llm_model_id, (stepCount.get(s.llm_model_id) ?? 0) + 1);

  const rows = models.filter(
    (m) =>
      (!q || `${m.name} ${m.provider_model_id}`.toLowerCase().includes(q)) && (!providerFilter || m.llm_provider_id === providerFilter),
  );

  return (
    <>
      <PageHeader
        title="LLM models"
        lede={`${models.length} models across ${providers.length} providers. A model can't be deleted while a prompt chain step or a stored response still uses it.`}
      />

      <AddPanel title="Add a model" open={models.length === 0}>
        {providers.length === 0 ? (
          <Empty title="Add a provider first">Models belong to a provider. Use the LLM providers page.</Empty>
        ) : (
          <ActionForm action={createModel} resetOnSuccess className="grid gap-4 md:grid-cols-2">
            <Fields providers={providers} />
            <div className="md:col-span-2">
              <SubmitButton pendingText="Adding…">Add model</SubmitButton>
            </div>
          </ActionForm>
        )}
      </AddPanel>

      <SearchBar q={sp.q ?? ""} placeholder="Search models" count={rows.length} clearHref="/models">
        <select name="provider" defaultValue={providerFilter ?? ""} aria-label="Filter by provider" className="field w-auto">
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </SearchBar>

      {rows.length === 0 ? (
        <Empty title={q ? `No models match “${sp.q}”` : "No models yet"} />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => {
            const used = stepCount.get(m.id) ?? 0;
            return (
              <li key={m.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum text-[13px] text-muted">#{m.id}</span>
                  <h2 className="font-display text-lg font-bold">{m.name}</h2>
                  <Pill>{providerName.get(m.llm_provider_id) ?? "Unknown provider"}</Pill>
                  <code className="text-[13px] text-ink-2">{m.provider_model_id}</code>
                  <Pill tone={m.is_temperature_supported ? "ok" : "plain"}>
                    {m.is_temperature_supported ? "Temperature supported" : "No temperature"}
                  </Pill>
                  <span className="text-[13px] text-ink-2">
                    Used in {used} step{used === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto text-[13px] text-muted">Updated {fmtDate(m.updated_at)}</span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Edit or delete</summary>
                  <ActionForm action={updateModel} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={m.id} />
                    <Fields providers={providers} model={m} />
                    <div className="md:col-span-2">
                      <SubmitButton pendingText="Saving…">Save model</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-3 border-t border-line pt-3">
                    <DeleteButton action={deleteModel} id={m.id} label="Delete model" confirmText={`Delete ${m.name}? This can't be undone.`} />
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

function Fields({ providers, model }: { providers: Provider[]; model?: Model }) {
  return (
    <>
      <Field label="Name" hint="How it appears in this admin area.">
        <input name="name" required maxLength={80} defaultValue={model?.name ?? ""} className="field" placeholder="gemini-2.5-flash" />
      </Field>
      <Field label="Provider">
        <select name="llm_provider_id" required defaultValue={model?.llm_provider_id ?? ""} className="field">
          <option value="" disabled>
            Choose a provider
          </option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Provider model id" hint="The exact id the provider's API expects.">
        <input name="provider_model_id" required maxLength={120} defaultValue={model?.provider_model_id ?? ""} className="field" />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="is_temperature_supported" defaultChecked={model?.is_temperature_supported ?? true} className="h-4 w-4" />
        Supports a temperature setting
      </label>
    </>
  );
}
