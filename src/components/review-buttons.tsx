"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReviewResult } from "@/app/(admin)/review/actions";

export function ReviewButtons({
  postId,
  approve,
  reject,
}: {
  postId: number;
  approve: (id: number) => Promise<ReviewResult>;
  reject: (id: number) => Promise<ReviewResult>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReviewResult | null>(null);

  function run(fn: (id: number) => Promise<ReviewResult>) {
    setResult(null);
    start(async () => {
      const res = await fn(postId);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(approve)} className="btn btn-primary">
        {pending ? "Saving…" : "Approve"}
      </button>
      <button type="button" disabled={pending} onClick={() => run(reject)} className="btn btn-danger">
        Reject
      </button>
      {result ? (
        <span role="status" className={`text-sm ${result.ok ? "text-ink-2" : "text-danger"}`}>
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
