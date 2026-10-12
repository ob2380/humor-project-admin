import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/brand";

export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (profile?.is_superadmin) redirect("/");

  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-md">
        <Wordmark />
        <div className="panel mt-8 p-7">
          <h1 className="font-display text-2xl font-bold">This account isn&apos;t an admin</h1>
          <p className="mt-2 text-ink-2">
            You&apos;re signed in as <strong className="text-ink">{user.email}</strong>, but its profile doesn&apos;t
            have <code className="rounded bg-surface-2 px-1">is_superadmin</code> set. Ask an existing admin to grant
            access, or sign in with a different Google account.
          </p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button className="btn btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
