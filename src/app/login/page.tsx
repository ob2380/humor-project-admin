import { GoogleButton } from "./google-button";
import { Wordmark } from "@/components/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-md">
        <Wordmark />
        <div className="panel mt-8 p-7">
          <h1 className="font-display text-2xl font-bold">Sign in to the admin area</h1>
          <p className="mt-2 text-ink-2">
            Use your Google account. Only accounts marked as superadmin in the database can get past this
            screen.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-down-soft px-3 py-2 text-sm text-ink">
              Sign-in didn&apos;t finish: {error}. Try again.
            </p>
          ) : null}
          <div className="mt-6">
            <GoogleButton />
          </div>
        </div>
      </div>
    </main>
  );
}
