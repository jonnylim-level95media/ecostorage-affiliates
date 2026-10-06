import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendEmail } from "@/lib/email";

const COPY = {
  en: {
    subject: "You have a new referral",
    body: (name: string, portal: string) =>
      `Good news! Someone (${name}) just enquired using your EcoStorage referral.\n\n` +
      `Commission is confirmed once they become a customer and complete 60 days in good standing.\n\n` +
      `Track it in your dashboard: ${portal}`,
  },
  "zh-Hans": {
    subject: "您有一条新的推荐",
    body: (name: string, portal: string) =>
      `好消息！有客户（${name}）刚刚通过您的 EcoStorage 推荐进行了咨询。\n\n` +
      `客户成为正式客户并连续 60 天无逾期后，佣金即确认。\n\n` +
      `在您的主页查看进度：${portal}`,
  },
} as const;

/**
 * Tells the affiliate a referral came in. Only the masked name is included —
 * affiliates never receive customer contact details (decision #5).
 */
export async function notifyAffiliateOfLead(db: SupabaseClient<Database>, signupId: string) {
  const { data } = await db
    .from("affiliate_signups")
    .select("full_name, affiliate_profiles(email, preferred_locale)")
    .eq("id", signupId)
    .single();
  const affiliate = data?.affiliate_profiles;
  if (!data || !affiliate) return;

  const { data: masked } = await db.rpc("mask_name", { full_name: data.full_name });
  const copy = COPY[affiliate.preferred_locale];
  const portal = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/affiliate`;
  await sendEmail(affiliate.email, copy.subject, copy.body(masked ?? "—", portal));
}
