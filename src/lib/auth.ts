import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * The authorization gate for every admin page and server action.
 * 1. No session → /login (Google).
 * 2. Session but profiles.is_superadmin is not TRUE → /denied.
 * RLS policies enforce the same rule in the database, so this is defense in depth,
 * not the only line.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_superadmin) redirect("/denied");

  const { is_superadmin: _flag, ...rest } = profile;
  void _flag;
  return { supabase, user, profile: rest as AdminProfile };
});
