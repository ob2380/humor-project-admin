import { SUPABASE_URL } from "@/lib/supabase/config";

export const COMMUNITY_BUCKET = "community-memes";

export type PostStatus = "pending" | "approved" | "rejected";

export type CommunityPost = {
  id: number;
  author_id: string;
  kind: "caption" | "meme";
  caption_text: string;
  image_path: string | null;
  status: PostStatus;
  caption_id: number | null;
  created_at: string;
  author: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
};

/** Public URL of a meme uploaded from the public app (bucket is public-read, not listable). */
export function communityImageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${COMMUNITY_BUCKET}/${path}`;
}
