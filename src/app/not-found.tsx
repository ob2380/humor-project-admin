import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="panel max-w-md p-7">
        <h1 className="font-display text-2xl font-bold">Nothing here</h1>
        <p className="mt-2 text-ink-2">That record doesn&apos;t exist, or it was deleted.</p>
        <Link href="/" className="btn btn-primary mt-4">
          Back to the overview
        </Link>
      </div>
    </main>
  );
}
