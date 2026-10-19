import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";
import { Nav } from "@/components/nav";
import { LaughMeter } from "@/components/brand";
import Link from "next/link";

// Every route in this group renders per request, behind the superadmin check.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireAdmin();
  const { count: pendingCount } = await supabase
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-5">
          <Link href="/" className="flex items-center gap-2.5">
            <LaughMeter size={34} />
            <span className="font-display text-xl font-extrabold leading-none">Laugh Track</span>
          </Link>
          <Nav pendingCount={pendingCount ?? 0} />
          <div className="hidden md:block mt-auto border-t border-line pt-4">
            <div className="flex items-center gap-2.5">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-sm font-semibold">
                  {displayName(profile).slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{displayName(profile)}</div>
                <div className="text-[13px] text-muted">Superadmin</div>
              </div>
            </div>
            <form action="/auth/signout" method="post" className="mt-3">
              <button type="submit" className="btn btn-ghost w-full justify-center">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-[1180px]">{children}</div>
        <form action="/auth/signout" method="post" className="mt-10 md:hidden">
          <button type="submit" className="btn btn-ghost">
            Sign out of {profile.email}
          </button>
        </form>
      </main>
    </div>
  );
}
