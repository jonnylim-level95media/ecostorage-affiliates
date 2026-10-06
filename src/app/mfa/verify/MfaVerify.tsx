"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function MfaVerify({ factorId, destination }: { factorId: string; destination: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    setSubmitting(false);
    if (error) return setError("That code didn't work. Codes change every 30 seconds, so try the current one.");
    router.replace(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
      <h1 className="text-2xl font-bold">Enter your code</h1>
      <p className="text-sm text-muted">Open your authenticator app and enter the 6-digit code for EcoStorage.</p>
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        required
        autoFocus
        className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
      />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-60"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
