"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export type ActionState = { ok: boolean; message: string } | null;

const BUCKET = "media";
const MAX_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

function text(form: FormData, key: string, max = 2000) {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------- Images (AI-generated media) ---------- */

export async function createImage(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const file = form.get("file");
  let url = text(form, "url", 2048);
  let storagePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.includes(file.type)) return { ok: false, message: "Upload a PNG, JPEG, WebP, GIF or SVG." };
    if (file.size > MAX_BYTES) return { ok: false, message: "That file is over 6 MB. Upload a smaller one." };
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    storagePath = `images/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type });
    if (error) return { ok: false, message: `Upload failed: ${error.message}` };
    url = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
  }

  if (!url) return { ok: false, message: "Choose a file to upload or paste an image URL." };
  if (!/^https?:\/\//.test(url) && !url.startsWith("/")) return { ok: false, message: "The image URL must start with https://." };

  const { data, error } = await supabase
    .from("images")
    .insert({
      url,
      storage_path: storagePath,
      description: text(form, "description"),
      model: text(form, "model", 120),
      prompt: text(form, "prompt", 4000),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, message: `Couldn't save the image: ${error.message}` };
  }
  refresh();
  redirect(`/media/${data.id}?created=1`);
}

export async function updateImage(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const url = text(form, "url", 2048);
  if (!id) return { ok: false, message: "Missing image id." };
  if (!url) return { ok: false, message: "An image needs a URL." };

  const { error } = await supabase
    .from("images")
    .update({
      url,
      description: text(form, "description"),
      model: text(form, "model", 120),
      prompt: text(form, "prompt", 4000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: `Couldn't save changes: ${error.message}` };
  refresh();
  return { ok: true, message: "Changes saved." };
}

export async function deleteImage(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const { data: img } = await supabase.from("images").select("storage_path").eq("id", id).maybeSingle();
  // FKs cascade: deleting the image deletes its captions, and their votes with them.
  const { error } = await supabase.from("images").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete the image: ${error.message}`);
  if (img?.storage_path) await supabase.storage.from(BUCKET).remove([img.storage_path]);
  refresh();
  redirect("/media?deleted=1");
}

/* ---------- Captions ---------- */

export async function createCaption(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const caption_text = text(form, "caption_text", 500);
  if (!caption_text) return { ok: false, message: "Write the caption first." };
  const imageId = Number(form.get("image_id")) || null;

  const { error } = await supabase.from("captions").insert({
    caption_text,
    image_id: imageId,
    image_description: text(form, "image_description"),
    model: text(form, "model", 120),
    prompt: text(form, "prompt", 4000),
  });
  if (error) return { ok: false, message: `Couldn't add the caption: ${error.message}` };
  refresh();
  return { ok: true, message: "Caption added." };
}

export async function updateCaption(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const caption_text = text(form, "caption_text", 500);
  if (!id) return { ok: false, message: "Missing caption id." };
  if (!caption_text) return { ok: false, message: "A caption can't be empty." };

  const { error } = await supabase
    .from("captions")
    .update({
      caption_text,
      image_id: Number(form.get("image_id")) || null,
      model: text(form, "model", 120),
      prompt: text(form, "prompt", 4000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: `Couldn't save the caption: ${error.message}` };
  refresh();
  return { ok: true, message: "Caption saved." };
}

export async function deleteCaption(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const back = String(form.get("back") ?? "/captions");
  // caption_votes.caption_id cascades, so the caption's votes go with it.
  const { error } = await supabase.from("captions").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete the caption: ${error.message}`);
  refresh();
  redirect(back.startsWith("/") ? back : "/captions");
}
