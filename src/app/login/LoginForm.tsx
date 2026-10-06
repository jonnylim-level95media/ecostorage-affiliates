"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "@/components/Turnstile";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({ t, locale, linkError }: { t: Dictionary["login"]; locale: string; linkError: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(linkError ? t.linkError : null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken) {
      setMessage(t.captchaError);
      return;
    }
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      options: { captchaToken },
    });

    if (error) {
      // Same message for every credential failure so the form can't be used
      // to probe which emails have accounts. Tokens are single-use, so get a
      // fresh one for the next attempt.
      setMessage(error.code === "captcha_failed" ? t.captchaError : t.error);
      setCaptchaKey((k) => k + 1);
      setSubmitting(false);
      return;
    }

    // "/" routes to /admin (via 2FA) or /affiliate based on the role.
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
          maxLength={320}
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
          maxLength={200}
          className="w-full rounded-md border border-white/10 bg-background px-3 py-2"
        />
      </label>

      <Turnstile onToken={setCaptchaToken} resetKey={captchaKey} locale={locale} />

      {message && <p role="alert" className="text-sm text-red-400">{message}</p>}

      <button
        type="submit"
        disabled={submitting || !captchaToken}
        className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-60"
      >
        {submitting ? t.submitting : t.submit}
      </button>

      <Link href="/forgot-password" className="block text-center text-sm text-muted hover:text-foreground">
        {t.forgot}
      </Link>
    </form>
  );
}
