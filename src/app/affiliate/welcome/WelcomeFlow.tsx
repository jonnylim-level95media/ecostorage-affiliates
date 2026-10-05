"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import { acceptTerms } from "./actions";

type Terms = { version: string; locale: Locale; body_md: string } | null;

interface Props {
  initialLocale: Locale;
  dictionaries: Record<Locale, Dictionary>;
  terms: Record<string, Terms>;
  code: string | null;
  link: string | null;
}

/** First-login flow: language → affiliate agreement → code reveal. */
export function WelcomeFlow({ initialLocale, dictionaries, terms, code, link }: Props) {
  const router = useRouter();
  const [locale, setLocalLocale] = useState<Locale>(initialLocale);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agreed, setAgreed] = useState(false);
  const [agreedGoverning, setAgreedGoverning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const t = dictionaries[locale].welcome;
  const doc = terms[locale];
  // The governing-language checkbox only applies when a translation is shown.
  const isTranslation = doc != null && doc.locale !== "en";
  const canAccept = doc != null && agreed && (!isTranslation || agreedGoverning);

  function chooseLocale(next: Locale) {
    setLocalLocale(next);
    // Persist in the background; the flow itself re-renders instantly.
    void setLocale(next);
  }

  function accept() {
    setFailed(false);
    startTransition(async () => {
      const { ok } = await acceptTerms(locale);
      if (ok) setStep(3);
      else setFailed(true);
    });
  }

  return (
    <main lang={locale} className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6">
      <p className="text-sm text-muted">{fill(t.step, { n: step })}</p>

      {step === 1 && (
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{t.languageTitle}</h1>
            <p className="text-muted">{t.languagePrompt}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                onClick={() => chooseLocale(l)}
                aria-pressed={l === locale}
                className={`rounded-xl border-2 p-6 text-left text-xl font-semibold transition ${
                  l === locale ? "border-accent bg-accent/10" : "border-white/10 bg-surface hover:border-white/30"
                }`}
              >
                {dictionaries[l].localeName}
              </button>
            ))}
          </div>

          <PrimaryButton onClick={() => setStep(2)}>{t.continue}</PrimaryButton>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t.termsTitle}</h1>
            {doc && <p className="text-sm text-muted">{fill(t.termsVersion, { version: doc.version })}</p>}
          </div>

          {!doc ? (
            <p className="rounded-lg bg-surface p-4 text-sm">{t.termsUnavailable}</p>
          ) : (
            <>
              {isTranslation && (
                <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                  {t.translationNotice}
                  <span lang="en" className="mt-1 block text-muted">
                    This translation is for reference only. If there is any inconsistency, the English
                    version prevails.
                  </span>
                </p>
              )}

              <div
                tabIndex={0}
                className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface p-4 text-sm leading-relaxed"
              >
                {doc.body_md}
              </div>

              <Checkbox checked={agreed} onChange={setAgreed}>
                {fill(t.agree, { version: doc.version })}
              </Checkbox>
              {isTranslation && (
                <Checkbox checked={agreedGoverning} onChange={setAgreedGoverning}>
                  {t.agreeGoverning}
                </Checkbox>
              )}

              {failed && <p role="alert" className="text-sm text-red-400">{t.acceptError}</p>}
            </>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-white/10 px-4 py-2"
            >
              {t.back}
            </button>
            <PrimaryButton onClick={accept} disabled={!canAccept || pending}>
              {pending ? t.accepting : t.accept}
            </PrimaryButton>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{t.codeTitle}</h1>
            <p className="text-muted">{t.codeSubtitle}</p>
          </div>

          {code && link && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-6">
                <span className="font-mono text-3xl tracking-widest text-accent">{code}</span>
                <CopyButton text={code} t={t} />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted">{t.linkLabel}</p>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-surface p-3">
                  <span className="break-all font-mono text-sm">{link}</span>
                  <CopyButton text={link} t={t} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold">{t.shareHeading}</h2>
                {[t.shareWhatsapp, t.shareSocial].map((template) => {
                  const text = fill(template, { code, link });
                  return (
                    <div key={template} className="space-y-2 rounded-lg bg-surface p-4">
                      <p className="whitespace-pre-wrap text-sm">{text}</p>
                      <CopyButton text={text} t={t} />
                    </div>
                  );
                })}
                <p className="text-xs text-muted">{t.disclosureReminder}</p>
              </div>
            </>
          )}

          <PrimaryButton
            onClick={() => {
              router.replace("/affiliate");
              router.refresh();
            }}
          >
            {t.toDashboard}
          </PrimaryButton>
        </section>
      )}
    </main>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-md bg-accent px-4 py-3 font-semibold text-background disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-accent"
      />
      <span>{children}</span>
    </label>
  );
}

function CopyButton({ text, t }: { text: string; t: Dictionary["welcome"] }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:border-accent"
    >
      {copied ? t.copied : t.copy}
    </button>
  );
}
