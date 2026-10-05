"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * `English | 中文` — each option in its own script, no flags. Switching
 * re-renders server content without a full reload, so form input survives.
 */
export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 text-sm">
      {LOCALES.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-muted">|</span>}
          <button
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            disabled={pending}
            aria-pressed={locale === current}
            className={
              locale === current
                ? "rounded px-1.5 py-0.5 font-semibold text-accent"
                : "rounded px-1.5 py-0.5 text-muted hover:text-foreground"
            }
          >
            {dictionaries[locale].localeName}
          </button>
        </span>
      ))}
    </div>
  );
}
