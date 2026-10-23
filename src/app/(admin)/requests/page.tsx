import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { displayName, fetchProfiles } from "@/lib/data";
import { PageHeader, Empty, SeedBadge, fmtDate } from "@/components/ui";
import { Pill } from "@/components/crud";

const PAGE = 100;

type Resp = {
  id: string;
  response: string | null;
  processing_time_seconds: number | null;
  llm_temperature: number | null;
  system_prompt: string | null;
  user_prompt: string | null;
  llm_models: { name: string } | null;
  prompt_chain_steps: { step_order: number; description: string | null } | null;
};

type Req = {
  id: number;
  status: string;
  is_seed: boolean;
  created_at: string;
  profile_id: string | null;
  prompt_chains: { id: number; slug: string } | null;
  images: { id: number; url: string; description: string | null } | null;
  llm_responses: Resp[];
};

const STATUSES = ["pending", "completed", "failed"] as const;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; chain?: string; user?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const chainId = Number(sp.chain) || null;
  const userId = sp.user && /^[0-9a-f-]{36}$/i.test(sp.user) ? sp.user : null;

  let query = supabase
    .from("generation_requests")
    .select(
      `id, status, is_seed, created_at, profile_id,
       prompt_chains(id, slug),
       images(id, url, description),
       llm_responses(id, response, processing_time_seconds, llm_temperature, system_prompt, user_prompt,
         llm_models(name), prompt_chain_steps(step_order, description))`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (status) query = query.eq("status", status);
  if (chainId) query = query.eq("prompt_chain_id", chainId);
  if (userId) query = query.eq("profile_id", userId);

  const [{ data, count, error }, profiles, chains] = await Promise.all([
    query,
    fetchProfiles(supabase),
    supabase.from("prompt_chains").select("id, slug").order("slug").then((r) => r.data ?? []),
  ]);
  if (error) throw new Error(`Couldn't read generation requests: ${error.message}`);
  const rows = (data ?? []) as unknown as Req[];
  const who = new Map(profiles.map((p) => [p.id, p]));
  const filtered = Boolean(status || chainId || userId);

  return (
    <>
      <PageHeader
        title="Generation requests"
        lede={`${count ?? rows.length} requests to generate captions for an image. Open one to see every LLM call the chain made for it. Read-only.`}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={status ?? ""} aria-label="Filter by status" className="field w-auto">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select name="chain" defaultValue={chainId ?? ""} aria-label="Filter by prompt chain" className="field w-auto">
          <option value="">Any chain</option>
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.slug}
            </option>
          ))}
        </select>
        {userId ? <input type="hidden" name="user" value={userId} /> : null}
        <button className="btn btn-ghost" type="submit">
          Apply
        </button>
        {filtered ? (
          <Link href="/requests" className="text-sm text-ink-2 underline underline-offset-4">
            Clear
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-muted">
          {rows.length} shown{(count ?? 0) > rows.length ? ` of ${count}` : ""}
        </span>
      </form>

      {rows.length === 0 ? (
        <Empty title={filtered ? "No requests match those filters" : "No generation requests yet"}>
          {filtered ? "Clear the filters to see everything." : "They appear here as soon as the public app asks a chain for captions."}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const resps = [...r.llm_responses].sort((a, b) => (a.prompt_chain_steps?.step_order ?? 0) - (b.prompt_chain_steps?.step_order ?? 0));
            const total = resps.reduce((n, x) => n + (x.processing_time_seconds ?? 0), 0);
            const p = r.profile_id ? who.get(r.profile_id) : undefined;
            return (
              <li key={r.id} className="panel p-4">
                <div className="flex gap-4">
                  {r.images ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.images.url} alt={r.images.description ?? ""} className="h-16 w-16 shrink-0 rounded-lg bg-surface-2 object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] text-muted">No image</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="tnum text-[13px] text-muted">#{r.id}</span>
                      <Pill tone={r.status === "failed" ? "warn" : r.status === "completed" ? "ok" : "plain"}>{r.status}</Pill>
                      {r.prompt_chains ? (
                        <Link href={`/chains/${r.prompt_chains.id}`} className="text-sm font-semibold underline underline-offset-4">
                          {r.prompt_chains.slug}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted">No chain</span>
                      )}
                      {r.is_seed ? <SeedBadge /> : null}
                      <span className="ml-auto text-[13px] text-muted">{fmtDate(r.created_at, true)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-2">
                      {r.images?.description ?? "Untitled image"} · requested by{" "}
                      {p ? (
                        <Link href={`/users/${p.id}`} className="underline underline-offset-4">
                          {displayName(p)}
                        </Link>
                      ) : (
                        "an unknown user"
                      )}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {resps.length} LLM call{resps.length === 1 ? "" : "s"} · {total.toFixed(1)}s total
                    </p>
                  </div>
                </div>

                {resps.length ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Show the LLM calls</summary>
                    <ol className="mt-3 space-y-3">
                      {resps.map((x) => (
                        <li key={x.id} className="rounded-xl border border-line p-3">
                          <p className="text-sm font-semibold">
                            Step {x.prompt_chain_steps?.step_order ?? "?"}: {x.prompt_chain_steps?.description ?? "Deleted step"}
                            <span className="ml-2 font-normal text-muted">
                              {x.llm_models?.name ?? "unknown model"}
                              {x.llm_temperature !== null ? ` · temp ${x.llm_temperature}` : ""}
                              {x.processing_time_seconds !== null ? ` · ${x.processing_time_seconds}s` : ""}
                            </span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-[15px]">{x.response ?? "No response stored."}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
