"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qr: string; secret: string };

/** One-time authenticator setup for admins (Google Authenticator, 1Password, etc.). */
export function MfaSetup() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // Clear half-finished enrollments from earlier attempts.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "EcoStorage admin",
      });
      if (cancelled) return;
      if (error || !data) setError("Couldn't start setup. Refresh the page to try again.");
      else setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setSubmitting(true);
    setError(null);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
    setSubmitting(false);
    if (error) return setError("That code didn't work. Check your authenticator app and try again.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-8">
      <h1 className="text-2xl font-bold">Set up two-factor sign-in</h1>
      <p className="text-sm text-muted">
        The admin console holds customer details, so it needs a code from an authenticator app (Google Authenticator,
        Microsoft Authenticator, 1Password…) every time you sign in.
      </p>
      {enrollment ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL SVG from Supabase */}
          <img src={enrollment.qr} alt="QR code to scan with your authenticator app" className="mx-auto h-48 w-48 rounded bg-white p-2" />
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
            <code className="mt-2 block break-all font-mono">{enrollment.secret}</code>
          </details>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            required
            placeholder="6-digit code"
            className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
          />
        </>
      ) : (
        !error && <p className="text-sm text-muted">Preparing…</p>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!enrollment || submitting}
        className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-60"
      >
        {submitting ? "Verifying…" : "Turn on two-factor sign-in"}
      </button>
    </form>
  );
}
