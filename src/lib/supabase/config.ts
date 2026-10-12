// Public, browser-safe values: the publishable key ships to every visitor anyway and
// RLS is what protects the data. Env vars override these when set.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hrjtlppvzchrxijnqbcq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_w-2vh4QIZ2KLsaMF6-BLcA_xWIbOsYv";
