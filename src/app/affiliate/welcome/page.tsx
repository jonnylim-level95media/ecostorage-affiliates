import { redirect } from "next/navigation";
import { requireAffiliate } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALES } from "@/lib/i18n/config";
import { referralLink } from "@/lib/referral";
import { WelcomeFlow } from "./WelcomeFlow";

export default async function WelcomePage() {
  const { supabase } = await requireAffiliate();
  const { locale } = await getDictionary();

  const { data: profile } = await supabase.from("affiliate_profiles").select("status").single();
  if (!profile) redirect("/login");
  if (profile.status !== "invited") redirect("/affiliate");

  // Load the code and the terms in every locale up front, so switching
  // language mid-flow is instant and the right agreement text is always shown.
  const [{ data: code }, ...terms] = await Promise.all([
    supabase.from("affiliate_codes").select("code").order("created_at").limit(1).maybeSingle(),
    ...LOCALES.map((l) => supabase.rpc("get_current_terms", { p_locale: l }).maybeSingle()),
  ]);

  const termsByLocale = Object.fromEntries(
    LOCALES.map((l, i) => [l, terms[i].data?.id ? terms[i].data : null])
  );

  return (
    <WelcomeFlow
      initialLocale={locale}
      dictionaries={dictionaries}
      terms={termsByLocale}
      code={code?.code ?? null}
      link={code ? referralLink(code.code) : null}
    />
  );
}
