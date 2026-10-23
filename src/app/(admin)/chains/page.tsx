import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { Chain, Mix, Model, Step } from "@/lib/domain";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SearchBar, Pill } from "@/components/crud";
import { updateMix } from "../domain-actions";

export default async function ChainsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const [chains, steps, mixes, models, reqs] = await Promise.all([
    fetchAll<Chain>(supabase, "prompt_chains", "id, slug, description, is_pinned, created_at, updated_at"),
    fetchAll<Step>(
      supabase,
      "prompt_chain_steps",
      "id, prompt_chain_id, step_order, description, step_type, input_type, output_type, llm_model_id, llm_temperature, system_prompt, user_prompt, is_hidden",
    ),
    fetchAll<Mix>(supabase, "prompt_chain_mix", "id, prompt_chain_id, caption_count, updated_at"),
    fetchAll<Model>(supabase, "llm_models", "id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_at, updated_at"),
    fetchAll<{ id: number; prompt_chain_id: number | null }>(supabase, "generation_requests", "id, prompt_chain_id"),
  ]);
  const modelName = new Map(models.map((m) => [m.id, m.name]));
  const mixByChain = new Map(mixes.map((m) => [m.prompt_chain_id, m]));
  const reqCount = new Map<number, number>();
  for (const r of reqs) if (r.prompt_chain_id) reqCount.set(r.prompt_chain_id, (reqCount.get(r.prompt_chain_id) ?? 0) + 1);

  const rows = chains
    .filter((c) => !q || `${c.slug} ${c.description ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.slug.localeCompare(b.slug));
  const totalMix = mixes.reduce((n, m) => n + m.caption_count, 0);

  return (
    <>
      <PageHeader
        title="Prompt chains"
        lede={`${chains.length} chains. Each is an ordered series of LLM steps that turns an image into captions. The mix sets how many captions each chain contributes to a request (${totalMix} in total).`}
      />

      <SearchBar q={sp.q ?? ""} placeholder="Search chains" count={rows.length} clearHref="/chains" />

      {rows.length === 0 ? (
        <Empty title={q ? `No chains match “${sp.q}”` : "No prompt chains yet"} />
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const cs = steps.filter((s) => s.prompt_chain_id === c.id).sort((a, b) => a.step_order - b.step_order);
            const mix = mixByChain.get(c.id);
            return (
              <li key={c.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum text-[13px] text-muted">#{c.id}</span>
                  <h2 className="font-display text-lg font-bold">
                    <Link href={`/chains/${c.id}`} className="hover:underline underline-offset-4">
                      {c.slug}
                    </Link>
                  </h2>
                  {c.is_pinned ? <Pill tone="ink">Pinned</Pill> : null}
                  <span className="text-[13px] text-ink-2">
                    {cs.length} step{cs.length === 1 ? "" : "s"} · {reqCount.get(c.id) ?? 0} request{(reqCount.get(c.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto text-[13px] text-muted">Updated {fmtDate(c.updated_at)}</span>
                </div>
                {c.description ? <p className="mt-1.5 text-ink-2">{c.description}</p> : null}

                {cs.length ? (
                  <ol className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                    {cs.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2">
                        {i > 0 ? <span aria-hidden="true" className="text-muted">→</span> : null}
                        <span className="rounded-lg bg-surface-2 px-2 py-1">
                          <span className="tnum font-semibold">{s.step_order}.</span> {s.description ?? s.step_type}{" "}
                          <span className="text-muted">({modelName.get(s.llm_model_id) ?? "unknown model"})</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}

                <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-3">
                  {mix ? (
                    <ActionForm action={updateMix} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={mix.id} />
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium">Captions per request (mix)</span>
                        <input name="caption_count" type="number" min={0} max={50} step={1} defaultValue={mix.caption_count} className="field w-28" />
                      </label>
                      <SubmitButton pendingText="Saving…" variant="ghost">
                        Save mix
                      </SubmitButton>
                    </ActionForm>
                  ) : (
                    <p className="text-sm text-muted">No mix row for this chain.</p>
                  )}
                  <Link href={`/chains/${c.id}`} className="btn btn-ghost">
                    View steps
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
