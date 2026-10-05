"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({ t }: { t: Dictionary["login"] }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFailed(false);

    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (error) {
      // Same message for every failure so the form can't be used to probe
      // which emails have accounts.
      setFailed(true);
      setSubmitting(false);
      return;
    }

    // "/" routes to /admin or /affiliate based on the role in the database.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-sm text-muted">{t.subtitle}</p>

      <label className="block space-y-1">
        <span className="text-sm">{t.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-white/10 bg-background px-3 py-2"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">{t.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-white/10 bg-background px-3 py-2"
        />
      </label>

      {failed && <p role="alert" className="text-sm text-red-400">{t.error}</p>}

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
