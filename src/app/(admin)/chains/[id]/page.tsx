import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import { STEP_TYPE_LABEL, type Chain, type Mix, type Model, type Provider, type Step } from "@/lib/domain";
import { PageHeader, Section, Empty, fmtDate } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/crud";
import { updateMix } from "../../domain-actions";

export default async function ChainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const { data: chain } = await supabase
    .from("prompt_chains")
    .select("id, slug, description, is_pinned, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<Chain>();
  if (!chain) notFound();

  const [steps, mix, models, providers, requests] = await Promise.all([
    supabase
      .from("prompt_chain_steps")
      .select(
        "id, prompt_chain_id, step_order, description, step_type, input_type, output_type, llm_model_id, llm_temperature, system_prompt, user_prompt, is_hidden",
      )
      .eq("prompt_chain_id", id)
      .order("step_order")
      .then((r) => (r.data ?? []) as Step[]),
    supabase.from("prompt_chain_mix").select("id, prompt_chain_id, caption_count, updated_at").eq("prompt_chain_id", id).maybeSingle<Mix>().then((r) => r.data),
    fetchAll<Model>(supabase, "llm_models", "id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_at, updated_at"),
    fetchAll<Provider>(supabase, "llm_providers", "id, name, created_at, updated_at"),
    supabase.from("generation_requests").select("id", { count: "exact", head: true }).eq("prompt_chain_id", id).then((r) => r.count ?? 0),
  ]);
  const modelById = new Map(models.map((m) => [m.id, m]));
  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/chains" className="text-ink-2 underline underline-offset-4">
          ← All prompt chains
        </Link>
      </p>
      <PageHeader
        title={chain.slug}
        lede={chain.description ?? "No description."}
        actions={chain.is_pinned ? <Pill tone="ink">Pinned</Pill> : undefined}
      />
      <p className="-mt-3 mb-6 text-sm text-muted">
        Chain #{chain.id} · {requests} generation request{requests === 1 ? "" : "s"} · updated {fmtDate(chain.updated_at, true)}
      </p>

      <Section title="Mix" note="How many captions this chain contributes to each generation request." className="mb-6">
        {mix ? (
          <ActionForm action={updateMix} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={mix.id} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Captions per request</span>
              <input name="caption_count" type="number" min={0} max={50} step={1} defaultValue={mix.caption_count} className="field w-28" />
            </label>
            <SubmitButton pendingText="Saving…">Save mix</SubmitButton>
          </ActionForm>
        ) : (
          <Empty title="No mix row for this chain" />
        )}
      </Section>

      <Section title="Steps" note={`${steps.length} step${steps.length === 1 ? "" : "s"}, run in order. Each step's output feeds the next.`}>
        {steps.length === 0 ? (
          <Empty title="This chain has no steps yet" />
        ) : (
          <ol className="space-y-4">
            {steps.map((s) => {
              const m = modelById.get(s.llm_model_id);
              return (
                <li key={s.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm font-bold text-surface tnum">{s.step_order}</span>
                    <h3 className="font-display text-lg font-bold">{s.description ?? STEP_TYPE_LABEL[s.step_type] ?? s.step_type}</h3>
                    <Pill>{STEP_TYPE_LABEL[s.step_type] ?? s.step_type}</Pill>
                    {s.is_hidden ? <Pill tone="warn">Hidden</Pill> : null}
                    <span className="tnum ml-auto text-[13px] text-muted">Step #{s.id}</span>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Meta label="Model" value={m ? `${m.name} (${providerName.get(m.llm_provider_id) ?? "?"})` : "Unknown"} />
                    <Meta label="Temperature" value={s.llm_temperature === null ? "Not set" : String(s.llm_temperature)} />
                    <Meta label="Input" value={s.input_type === "image_and_text" ? "Image and text" : "Text only"} />
                    <Meta label="Output" value={s.output_type === "array" ? "List of strings" : "One string"} />
                  </dl>
                  <Prompt label="System prompt" text={s.system_prompt} />
                  <Prompt label="User prompt" text={s.user_prompt} />
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Prompt({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {text ? (
        <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-[13px] leading-relaxed">{text}</pre>
      ) : (
        <p className="mt-1 text-sm text-muted">None.</p>
      )}
    </div>
  );
}
