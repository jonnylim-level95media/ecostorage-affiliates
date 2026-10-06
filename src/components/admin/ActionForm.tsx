"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin/actions-common";

/**
 * Form bound to an admin server action, with inline success/error feedback.
 * `confirm` asks before submitting, for irreversible actions.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm: confirmMessage,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
      {state?.link && (
        <div className="space-y-1 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
          <p>
            One-time sign-in link. Send it to the affiliate privately (WhatsApp, email). Anyone with it can set the
            password, and it&apos;s only shown once.
          </p>
          <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded bg-background px-2 py-1 font-mono" />
        </div>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
