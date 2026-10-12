"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/(admin)/actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** A form bound to a server action, with an inline result message. */
export function ActionForm({
  action,
  children,
  resetOnSuccess = false,
  className = "",
}: {
  action: Action;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state ? (
        <p role="status" className={`mt-3 text-sm ${state.ok ? "text-ink-2" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({ children, pendingText, variant = "primary" }: { children: React.ReactNode; pendingText: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn ${variant === "primary" ? "btn-primary" : "btn-ghost"}`}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Delete with a native confirm. The server action still re-checks superadmin. */
export function DeleteButton({
  action,
  id,
  label,
  confirmText,
  back,
}: {
  action: (form: FormData) => Promise<void>;
  id: number | string;
  label: string;
  confirmText: string;
  back?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {back ? <input type="hidden" name="back" value={back} /> : null}
      <DeleteSubmit label={label} />
    </form>
  );
}

function DeleteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-danger">
      {pending ? "Deleting…" : label}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}
