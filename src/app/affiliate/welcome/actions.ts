"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n/config";
import { clientIp } from "@/lib/rate-limit";

/**
 * Click-wrap acceptance. The database picks the terms text for the locale
 * (falling back to English if the translation is stale) and records the
 * shown version, the governing English version, IP and user agent.
 */
export async function acceptTerms(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };

  const h = await headers();
  const ip = clientIp(new Request("http://local", { headers: h }));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("accept_current_terms", {
    p_locale: locale,
    // Only pass a well-formed IP; a bad value would fail the inet cast.
    p_ip_address: isIP(ip) ? ip : undefined,
    p_user_agent: h.get("user-agent") ?? undefined,
  });

  return { ok: !error };
}
