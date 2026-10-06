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
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
