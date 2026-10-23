import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/data";
import type { Model } from "@/lib/domain";
import { PageHeader, Empty, SeedBadge, fmtDate } from "@/components/ui";
import { SearchBar } from "@/components/crud";

const PAGE = 150;

type Row = {
  id: string;
  generation_request_id: number;
  response: string | null;
  processing_time_seconds: number | null;
  llm_temperature: number | null;
  system_prompt: string | null;
  user_prompt: string | null;
  is_seed: boolean;
  created_at: string;
  llm_models: { id: number; name: string } | null;
  prompt_chain_steps: { step_order: number; description: string | null; prompt_chains: { slug: string } | null } | null;
};

export default async function ResponsesPage({ searchParams }: { searchParams: Promise<{ q?: string; model?: string; request?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const modelId = Number(sp.model) || null;
  const requestId = Number(sp.request) || null;

  let query = supabase
    .from("llm_responses")
    .select(
      `id, generation_request_id, response, processing_time_seconds, llm_temperature, system_prompt, user_prompt, is_seed, created_at,
       llm_models(id, name), prompt_chain_steps(step_order, description, prompt_chains(slug))`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (modelId) query = query.eq("llm_model_id", modelId);
  if (requestId) query = query.eq("generation_request_id", requestId);
  if (q) query = query.ilike("response", `%${q.replace(/[%_]/g, "\\$&")}%`);

  const [{ data, count, error }, models] = await Promise.all([
    query,
    fetchAll<Model>(supabase, "llm_models", "id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_at, updated_at", "name"),
  ]);
  if (error) throw new Error(`Couldn't read LLM responses: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];
  const filtered = Boolean(q || modelId || requestId);

  return (
    <>
      <PageHeader
        title="LLM responses"
        lede={`${count ?? rows.length} stored model outputs, newest first, with the prompts that produced them. Read-only.`}
      />

      <SearchBar q={q} placeholder="Search response text" count={rows.length} clearHref="/responses">
        <select name="model" defaultValue={modelId ?? ""} aria-label="Filter by model" className="field w-auto">
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {requestId ? <input type="hidden" name="request" value={requestId} /> : null}
      </SearchBar>
      {requestId ? (
        <p className="mb-4 text-sm text-ink-2">
          Showing responses for request #{requestId}.{" "}
          <Link href="/responses" className="underline underline-offset-4">
            Show all
          </Link>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Empty title={filtered ? "No responses match those filters" : "No LLM responses yet"} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="panel p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-2">
                <span className="font-semibold text-ink">{r.llm_models?.name ?? "Unknown model"}</span>
                <span>
                  {r.prompt_chain_steps?.prompt_chains?.slug ?? "no chain"} · step {r.prompt_chain_steps?.step_order ?? "?"}
                </span>
                <Link href={`/responses?request=${r.generation_request_id}`} className="underline underline-offset-4">
                  Request #{r.generation_request_id}
                </Link>
                {r.llm_temperature !== null ? <span>temp {r.llm_temperature}</span> : null}
                {r.processing_time_seconds !== null ? <span className="tnum">{r.processing_time_seconds}s</span> : null}
                {r.is_seed ? <SeedBadge /> : null}
                <span className="ml-auto text-muted">{fmtDate(r.created_at, true)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[16px]">{r.response ?? "No response stored."}</p>
              {r.system_prompt || r.user_prompt ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Show the prompts</summary>
                  {r.system_prompt ? <PromptBlock label="System prompt" text={r.system_prompt} /> : null}
                  {r.user_prompt ? <PromptBlock label="User prompt" text={r.user_prompt} /> : null}
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-[13px] leading-relaxed">{text}</pre>
    </div>
  );
}
