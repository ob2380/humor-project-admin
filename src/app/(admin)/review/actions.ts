"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { communityImageUrl } from "@/lib/community";

export type ReviewResult = { ok: boolean; message: string };

/**
 * Publish a pending community post. Mirrors approvePost() in the public app, so a post
 * approved here or there lands in the same rows: images (for memes) + captions, then
 * community_posts.status = 'approved' with caption_id set. Only a still-pending post
 * can be approved, so approving twice from both apps can't publish a duplicate.
 */
export async function approvePost(postId: number): Promise<ReviewResult> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(postId) || postId <= 0) return { ok: false, message: "That post id isn't valid." };

  const { data: post } = await supabase
    .from("community_posts")
    .select("id, author_id, kind, caption_text, image_path, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "pending") return { ok: false, message: "That post was already reviewed." };

  let imageId: number | null = null;
  if (post.image_path) {
    const { data: img, error } = await supabase
      .from("images")
      .insert({
        url: communityImageUrl(post.image_path),
        storage_path: post.image_path,
        description: post.caption_text,
        is_seed: false,
        created_by: post.author_id,
      })
      .select("id")
      .single();
    if (error || !img) return { ok: false, message: `Couldn't save the image: ${error?.message ?? "no row returned"}` };
    imageId = img.id;
  }

  const { data: cap, error: capErr } = await supabase
    .from("captions")
    .insert({
      image_description: post.kind === "meme" ? "Community meme" : "Community caption",
      caption_text: post.caption_text,
      votes: 0,
      image_id: imageId,
      is_seed: false,
    })
    .select("id")
    .single();
  if (capErr || !cap) {
    if (imageId) await supabase.from("images").delete().eq("id", imageId);
    return { ok: false, message: `Couldn't publish the caption: ${capErr?.message ?? "no row returned"}` };
  }

  const { data: updated, error: updErr } = await supabase
    .from("community_posts")
    .update({ status: "approved", caption_id: cap.id })
    .eq("id", postId)
    .eq("status", "pending")
    .select("id");
  if (updErr || !updated?.length) {
    await supabase.from("captions").delete().eq("id", cap.id);
    if (imageId) await supabase.from("images").delete().eq("id", imageId);
    return { ok: false, message: updErr ? `Couldn't mark it approved: ${updErr.message}` : "That post was already reviewed." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Approved. It's live in the public feed." };
}

/** Reject a pending post. It stays in the table (status = 'rejected') for the record. */
export async function rejectPost(postId: number): Promise<ReviewResult> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(postId) || postId <= 0) return { ok: false, message: "That post id isn't valid." };

  const { data, error } = await supabase
    .from("community_posts")
    .update({ status: "rejected" })
    .eq("id", postId)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, message: `Couldn't reject it: ${error.message}` };
  if (!data?.length) return { ok: false, message: "That post was already reviewed." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Rejected. It won't be published." };
}
