"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "@/components/Turnstile";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ForgotForm({
  t,
  captchaError,
  locale,
}: {
  t: Dictionary["forgot"];
  captchaError: string;
  locale: string;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken) return setError(captchaError);
    setSubmitting(true);
    setError(null);

    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    // Supabase only honours redirect URLs on the project allowlist.
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      captchaToken,
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setSubmitting(false);
    if (error?.code === "captcha_failed") {
      setError(captchaError);
      setCaptchaKey((k) => k + 1);
      return;
    }
    // Same confirmation whether or not the account exists (no enumeration),
    // and for rate-limit errors too.
    setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      {sent ? (
        <p className="text-sm">{t.sent}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">{t.subtitle}</p>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={320}
            className="w-full rounded-md border border-white/10 bg-background px-3 py-2"
          />
          <Turnstile onToken={setCaptchaToken} resetKey={captchaKey} locale={locale} />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !captchaToken}
            className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-60"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </form>
      )}
      <Link href="/login" className="block text-center text-sm text-muted hover:text-foreground">
        {t.backToLogin}
      </Link>
    </div>
  );
}
