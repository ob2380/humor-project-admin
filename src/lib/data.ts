import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  is_seed: boolean;
  created_at: string;
};

export type ImageRow = {
  id: number;
  url: string;
  storage_path: string | null;
  description: string | null;
  model: string | null;
  prompt: string | null;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
};

export type Caption = {
  id: number;
  caption_text: string;
  image_description: string | null;
  image_id: number | null;
  model: string | null;
  prompt: string | null;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
};

export type Vote = {
  id: number;
  caption_id: number;
  profile_id: string;
  vote_value: 1 | -1;
  created_at: string;
};

/** PostgREST caps responses at 1000 rows; page through so stats see every row. */
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  order: string = "id",
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Couldn't read ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export const PROFILE_COLS =
  "id, email, first_name, last_name, avatar_url, is_superadmin, is_seed, created_at";
export const IMAGE_COLS =
  "id, url, storage_path, description, model, prompt, is_seed, created_at, updated_at";
export const CAPTION_COLS =
  "id, caption_text, image_description, image_id, model, prompt, is_seed, created_at, updated_at";
export const VOTE_COLS = "id, caption_id, profile_id, vote_value, created_at";

export async function loadEverything(supabase: SupabaseClient) {
  const [profiles, images, captions, votes] = await Promise.all([
    fetchAll<Profile>(supabase, "profiles", PROFILE_COLS, "created_at"),
    fetchAll<ImageRow>(supabase, "images", IMAGE_COLS),
    fetchAll<Caption>(supabase, "captions", CAPTION_COLS),
    fetchAll<Vote>(supabase, "caption_votes", VOTE_COLS),
  ]);
  return { profiles, images, captions, votes };
}

export type Dataset = Awaited<ReturnType<typeof loadEverything>>;

/** Optionally strip demo rows (is_seed) so the numbers reflect real activity only. */
export function scopeDataset(d: Dataset, realOnly: boolean): Dataset {
  if (!realOnly) return d;
  const profiles = d.profiles.filter((p) => !p.is_seed);
  const images = d.images.filter((i) => !i.is_seed);
  const captions = d.captions.filter((c) => !c.is_seed);
  const keepP = new Set(profiles.map((p) => p.id));
  const keepC = new Set(captions.map((c) => c.id));
  const votes = d.votes.filter((v) => keepP.has(v.profile_id) && keepC.has(v.caption_id));
  return { profiles, images, captions, votes };
}

export function displayName(p: Pick<Profile, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!p) return "Unknown voter";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || "Unnamed user";
}
