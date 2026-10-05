import type { Database } from "@/types/database";

export type Locale = Database["public"]["Enums"]["app_locale"];

export const LOCALES: readonly Locale[] = ["en", "zh-Hans"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "eco_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl date/number formatting (Singapore region). */
export function intlTag(locale: Locale) {
  return locale === "zh-Hans" ? "zh-Hans-SG" : "en-SG";
}

/** First-visit guess from Accept-Language: any Chinese preference → zh-Hans. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  return header && /(^|,)\s*zh\b/i.test(header) ? "zh-Hans" : DEFAULT_LOCALE;
}
