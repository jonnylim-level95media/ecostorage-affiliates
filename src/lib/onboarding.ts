import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendEmail, type SendResult } from "@/lib/email";
import { referralLink } from "@/lib/referral";

/**
 * Sends the current onboarding pack (in the affiliate's language, falling
 * back to English) and records it in onboarding_sends.
 */
export async function sendOnboarding(
  db: SupabaseClient<Database>,
  affiliateId: string,
  actorId: string
): Promise<SendResult> {
  const { data: affiliate } = await db
    .from("affiliate_profiles")
    .select("full_name, email, preferred_locale, affiliate_codes(code, deactivated_at, created_at)")
    .eq("id", affiliateId)
    .single();
  if (!affiliate) return { sent: false, reason: "affiliate not found" };

  const code = affiliate.affiliate_codes
    .filter((c) => c.deactivated_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.code;
  if (!code) return { sent: false, reason: "affiliate has no current code" };

  const { data: templates } = await db
    .from("onboarding_templates")
    .select("id, locale, subject, body_md")
    .eq("is_current", true)
    .in("locale", [affiliate.preferred_locale, "en"]);
  const template =
    templates?.find((t) => t.locale === affiliate.preferred_locale) ?? templates?.find((t) => t.locale === "en");
  if (!template) return { sent: false, reason: "no onboarding template is published" };

  // Plain-text email. Names come from the public application form, so strip
  // line breaks before they reach the subject header.
  const values: Record<string, string> = {
    name: affiliate.full_name.replace(/[\r\n]+/g, " "),
    code,
    link: referralLink(code),
  };
  const fill = (s: string) => s.replace(/\{\{(name|code|link)\}\}/g, (_, k: string) => values[k]);

  const subject = fill(template.subject).replace(/[\r\n]+/g, " ");
  const result = await sendEmail(affiliate.email, subject, fill(template.body_md));
  if (result.sent) {
    await db.from("onboarding_sends").insert({
      affiliate_id: affiliateId,
      template_id: template.id,
      sent_by: actorId,
      provider_message_id: result.id,
    });
  }
  return result;
}
