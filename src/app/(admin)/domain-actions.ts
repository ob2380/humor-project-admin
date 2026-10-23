"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "./actions";

/* Week 7 domain model: terms, generation examples, LLM providers and models,
   signup allow-lists, prompt chain mix. Every action re-checks superadmin;
   RLS enforces the same rule in the database. */

function str(form: FormData, key: string, max = 2000) {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function int(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

type DbError = { code?: string; message: string } | null;

function explain(error: NonNullable<DbError>, what: string) {
  if (error.code === "23505") return `That ${what} already exists.`;
  if (error.code === "23503") return `Can't do that: it's still referenced by other rows (${what}).`;
  if (error.code === "23514") return `That value isn't allowed for ${what}.`;
  return error.message;
}

/* ---------- Terms ---------- */

export async function createTerm(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const term = str(form, "term", 120);
  const definition = str(form, "definition", 2000);
  if (!term || !definition) return { ok: false, message: "A term needs a name and a definition." };
  const { error } = await supabase.from("terms").insert({
    term,
    definition,
    example: str(form, "example"),
    priority: int(form, "priority") ?? 0,
    term_type_id: int(form, "term_type_id"),
  });
  if (error) return { ok: false, message: explain(error, "term") };
  refresh();
  return { ok: true, message: "Term added." };
}

export async function updateTerm(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const term = str(form, "term", 120);
  const definition = str(form, "definition", 2000);
  if (!id) return { ok: false, message: "Missing term id." };
  if (!term || !definition) return { ok: false, message: "A term needs a name and a definition." };
  const { error } = await supabase
    .from("terms")
    .update({
      term,
      definition,
      example: str(form, "example"),
      priority: int(form, "priority") ?? 0,
      term_type_id: int(form, "term_type_id"),
    })
    .eq("id", id);
  if (error) return { ok: false, message: explain(error, "term") };
  refresh();
  return { ok: true, message: "Term saved." };
}

export async function deleteTerm(form: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("terms").delete().eq("id", int(form, "id") ?? -1);
  if (error) throw new Error(`Couldn't delete the term: ${error.message}`);
  refresh();
}

/* ---------- Generation examples ---------- */

export async function createExample(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const image_description = str(form, "image_description");
  const caption = str(form, "caption", 500);
  if (!image_description || !caption) return { ok: false, message: "Describe the image and write the example caption." };
  const { error } = await supabase.from("generation_examples").insert({
    image_description,
    caption,
    explanation: str(form, "explanation"),
    priority: int(form, "priority") ?? 0,
    image_id: int(form, "image_id"),
  });
  if (error) return { ok: false, message: explain(error, "example") };
  refresh();
  return { ok: true, message: "Example added." };
}

export async function updateExample(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const image_description = str(form, "image_description");
  const caption = str(form, "caption", 500);
  if (!id) return { ok: false, message: "Missing example id." };
  if (!image_description || !caption) return { ok: false, message: "Describe the image and write the example caption." };
  const { error } = await supabase
    .from("generation_examples")
    .update({
      image_description,
      caption,
      explanation: str(form, "explanation"),
      priority: int(form, "priority") ?? 0,
      image_id: int(form, "image_id"),
    })
    .eq("id", id);
  if (error) return { ok: false, message: explain(error, "example") };
  refresh();
  return { ok: true, message: "Example saved." };
}

export async function deleteExample(form: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("generation_examples").delete().eq("id", int(form, "id") ?? -1);
  if (error) throw new Error(`Couldn't delete the example: ${error.message}`);
  refresh();
}

/* ---------- LLM providers ---------- */

export async function createProvider(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const name = str(form, "name", 80);
  if (!name) return { ok: false, message: "A provider needs a name." };
  const { error } = await supabase.from("llm_providers").insert({ name });
  if (error) return { ok: false, message: explain(error, "provider") };
  refresh();
  return { ok: true, message: "Provider added." };
}

export async function updateProvider(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const name = str(form, "name", 80);
  if (!id) return { ok: false, message: "Missing provider id." };
  if (!name) return { ok: false, message: "A provider needs a name." };
  const { error } = await supabase.from("llm_providers").update({ name }).eq("id", id);
  if (error) return { ok: false, message: explain(error, "provider") };
  refresh();
  return { ok: true, message: "Provider saved." };
}

export async function deleteProvider(form: FormData) {
  const { supabase } = await requireAdmin();
  // Deleting a provider cascades to its models. The database refuses if any of those models
  // is still used by a prompt chain step or an LLM response.
  const { error } = await supabase.from("llm_providers").delete().eq("id", int(form, "id") ?? -1);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This provider has models that are still used by prompt chain steps or LLM responses. Move or delete those first."
        : `Couldn't delete the provider: ${error.message}`,
    );
  }
  refresh();
}

/* ---------- LLM models ---------- */

export async function createModel(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const name = str(form, "name", 80);
  const provider_model_id = str(form, "provider_model_id", 120);
  const llm_provider_id = int(form, "llm_provider_id");
  if (!name || !provider_model_id) return { ok: false, message: "A model needs a name and the provider's model id." };
  if (!llm_provider_id) return { ok: false, message: "Choose a provider. Add one on the Providers page first if the list is empty." };
  const { error } = await supabase.from("llm_models").insert({
    name,
    provider_model_id,
    llm_provider_id,
    is_temperature_supported: form.get("is_temperature_supported") === "on",
  });
  if (error) return { ok: false, message: explain(error, "model") };
  refresh();
  return { ok: true, message: "Model added." };
}

export async function updateModel(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const name = str(form, "name", 80);
  const provider_model_id = str(form, "provider_model_id", 120);
  const llm_provider_id = int(form, "llm_provider_id");
  if (!id) return { ok: false, message: "Missing model id." };
  if (!name || !provider_model_id || !llm_provider_id) return { ok: false, message: "Name, provider and provider model id are all required." };
  const { error } = await supabase
    .from("llm_models")
    .update({
      name,
      provider_model_id,
      llm_provider_id,
      is_temperature_supported: form.get("is_temperature_supported") === "on",
    })
    .eq("id", id);
  if (error) return { ok: false, message: explain(error, "model") };
  refresh();
  return { ok: true, message: "Model saved." };
}

export async function deleteModel(form: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("llm_models").delete().eq("id", int(form, "id") ?? -1);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This model is still used by prompt chain steps or LLM responses, so it can't be deleted."
        : `Couldn't delete the model: ${error.message}`,
    );
  }
  refresh();
}

/* ---------- Allowed signup domains ---------- */

function cleanDomain(raw: string | null) {
  if (!raw) return null;
  return raw.toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

export async function createDomain(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const apex_domain = cleanDomain(str(form, "apex_domain", 253));
  if (!apex_domain) return { ok: false, message: "Enter a domain like columbia.edu." };
  const { error } = await supabase.from("allowed_signup_domains").insert({ apex_domain });
  if (error) return { ok: false, message: error.code === "23514" ? "That doesn't look like a domain. Use the form columbia.edu." : explain(error, "domain") };
  refresh();
  return { ok: true, message: "Domain added." };
}

export async function updateDomain(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const apex_domain = cleanDomain(str(form, "apex_domain", 253));
  if (!id) return { ok: false, message: "Missing domain id." };
  if (!apex_domain) return { ok: false, message: "Enter a domain like columbia.edu." };
  const { error } = await supabase.from("allowed_signup_domains").update({ apex_domain }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23514" ? "That doesn't look like a domain. Use the form columbia.edu." : explain(error, "domain") };
  refresh();
  return { ok: true, message: "Domain saved." };
}

export async function deleteDomain(form: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("allowed_signup_domains").delete().eq("id", int(form, "id") ?? -1);
  if (error) throw new Error(`Couldn't delete the domain: ${error.message}`);
  refresh();
}

/* ---------- Whitelisted e-mail addresses ---------- */

export async function createEmail(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const email_address = str(form, "email_address", 254)?.toLowerCase() ?? null;
  if (!email_address) return { ok: false, message: "Enter an e-mail address." };
  const { error } = await supabase.from("whitelisted_emails").insert({ email_address });
  if (error) return { ok: false, message: error.code === "23514" ? "That doesn't look like an e-mail address." : explain(error, "e-mail address") };
  refresh();
  return { ok: true, message: "E-mail address added." };
}

export async function updateEmail(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const email_address = str(form, "email_address", 254)?.toLowerCase() ?? null;
  if (!id) return { ok: false, message: "Missing e-mail id." };
  if (!email_address) return { ok: false, message: "Enter an e-mail address." };
  const { error } = await supabase.from("whitelisted_emails").update({ email_address }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23514" ? "That doesn't look like an e-mail address." : explain(error, "e-mail address") };
  refresh();
  return { ok: true, message: "E-mail address saved." };
}

export async function deleteEmail(form: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("whitelisted_emails").delete().eq("id", int(form, "id") ?? -1);
  if (error) throw new Error(`Couldn't delete the e-mail address: ${error.message}`);
  refresh();
}

/* ---------- Prompt chain mix (read/update only) ---------- */

export async function updateMix(_p: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = int(form, "id");
  const caption_count = int(form, "caption_count");
  if (!id) return { ok: false, message: "Missing mix id." };
  if (caption_count === null || caption_count < 0 || caption_count > 50) {
    return { ok: false, message: "Caption count must be a whole number from 0 to 50." };
  }
  const { error } = await supabase.from("prompt_chain_mix").update({ caption_count }).eq("id", id);
  if (error) return { ok: false, message: explain(error, "mix") };
  refresh();
  return { ok: true, message: "Mix saved." };
}
