import "server-only";
import { cookies, headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dictionaries } from "./dictionaries";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "./config";

/**
 * Resolution order: signed-in affiliate's saved preference → language cookie
 * (set by the switcher) → browser Accept-Language.
 */
export async function getLocale(): Promise<Locale> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("affiliate_profiles")
      .select("preferred_locale")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) return data.preferred_locale;
  }

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
