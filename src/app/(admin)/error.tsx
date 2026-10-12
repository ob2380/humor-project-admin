"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel p-6">
      <h1 className="font-display text-2xl font-bold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-ink-2">{error.message || "The database returned an error."}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
