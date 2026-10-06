"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Mirrors the Supabase project policy (config.toml): 12+ chars, upper, lower,
// digit. Supabase enforces it server-side; this just gives instant feedback.
function strongEnough(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function SetPasswordForm({ t }: { t: Dictionary["setPassword"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) return setError(t.mismatch);
    if (!strongEnough(password)) return setError(t.weak);

    setSubmitting(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      if (error.code === "weak_password") return setError(t.weak);
      if (error.code === "reauthentication_needed") return setError(t.reauth);
      return setError(t.error);
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-sm text-muted">{t.subtitle}</p>
      {(["password", "confirm"] as const).map((name) => (
        <label key={name} className="block space-y-1">
          <span className="text-sm">{t[name]}</span>
          <input
            name={name}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
            className="w-full rounded-md border border-white/10 bg-background px-3 py-2"
          />
        </label>
      ))}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-60"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
