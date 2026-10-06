import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Field, inputClass } from "@/components/admin/ui";
import { fmtDate } from "@/lib/admin/format";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { publishOnboardingTemplate } from "./actions";

// Starting points shown when nothing is published yet. Rates are included
// because this pack only goes to approved affiliates (decision 6e).
const STARTERS: Record<Locale, { subject: string; body: string }> = {
  en: {
    subject: "Welcome to EcoStorage Affiliates, {{name}}",
    body: `Hi {{name}},

Welcome aboard! Your application has been approved.

**Your referral code:** {{code}}
**Your referral link:** {{link}}

You'll get a separate email to set your password. When you first sign in, accept the affiliate agreement and your code goes live.

**How you earn**
- Your referrals get 1 month free on a 4-month storage plan.
- A referral counts if they enquire within 14 days of clicking your link, or enter your code.
- You earn a % of the customer's first full month's net rent:
  - 1–10 qualified referrals (rolling 12 months): 10%
  - 11–30: 20%
  - 31+: 35%
- Commission qualifies after the customer completes 60 days with no late payment, default or cancellation (or completes a move-out, for shorter storage), and is paid 30 days after that.

**Do**
- Share with friends, family, WhatsApp/WeChat groups and your own social posts.
- Always say you may earn a reward (e.g. "I earn a referral reward" or #affiliate).

**Don't**
- Post your code on coupon or deal sites, run paid ads on the EcoStorage name, spam, or refer yourself.

Rates and these details are confidential. Please don't publish them.

Thanks,
The EcoStorage team`,
  },
  "zh-Hans": {
    subject: "欢迎加入 EcoStorage 推广伙伴计划，{{name}}",
    body: `{{name}}，您好：

欢迎加入！您的申请已获批准。

**您的推荐码：** {{code}}
**您的推荐链接：** {{link}}

您将另外收到一封设置密码的邮件。首次登录时，请接受推广伙伴协议，您的推荐码即会启用。

**如何获得佣金**
- 您推荐的客户可在 4 个月存储方案中享 1 个月免费。
- 客户在点击您的链接后 14 天内咨询，或填写您的推荐码，即计为您的推荐。
- 佣金按客户首个完整月净租金的百分比计算：
  - 1–10 个达标推荐（滚动 12 个月）：10%
  - 11–30 个：20%
  - 31 个以上：35%
- 客户连续 60 天无逾期付款、违约或取消（或短期存储客户完成搬出）后，佣金即达标，并于达标后 30 天支付。

**请这样做**
- 分享给亲友、微信/WhatsApp 群组及您自己的社交平台。
- 务必注明您可能获得推荐奖励（例如"本人可获推荐奖励"或 #推广）。

**请勿**
- 在优惠券或折扣网站发布推荐码、以 EcoStorage 品牌名投放付费广告、发送垃圾信息或自我推荐。

佣金比例及上述内容属保密信息，请勿公开。

EcoStorage 团队敬上`,
  },
};

export default async function OnboardingPage() {
  const { supabase } = await requireAdmin();

  const [{ data: templates }, { count: sentCount }] = await Promise.all([
    supabase.from("onboarding_templates").select("*").order("created_at", { ascending: false }),
    supabase.from("onboarding_sends").select("id", { count: "exact", head: true }),
  ]);

  const emailReady = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

  return (
    <>
      <h1 className="text-2xl font-bold">Onboarding pack</h1>
      <p className="text-sm text-muted">
        Emailed to each affiliate on approval, in their chosen language. Placeholders: <code>{"{{name}}"}</code>,{" "}
        <code>{"{{code}}"}</code>, <code>{"{{link}}"}</code>. Sent so far: {sentCount ?? 0}.
      </p>
      {!emailReady && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          Email isn&apos;t configured yet (RESEND_API_KEY / EMAIL_FROM), so onboarding emails won&apos;t send. You can
          still prepare the templates.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {LOCALES.map((locale) => {
          const history = templates?.filter((t) => t.locale === locale) ?? [];
          const current = history.find((t) => t.is_current);
          const starter = STARTERS[locale];

          return (
            <Card
              key={locale}
              title={locale === "en" ? "English" : "中文"}
              actions={current ? <Badge tone="accent">current v{current.version}</Badge> : <Badge tone="warn">not published</Badge>}
            >
              <ActionForm action={publishOnboardingTemplate} confirm="Publish this as the current template?" className="space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <Field label="New version">
                  <input name="version" required placeholder={current ? `after ${current.version}` : "1.0"} className={inputClass} />
                </Field>
                <Field label="Subject">
                  <input name="subject" required defaultValue={current?.subject ?? starter.subject} className={inputClass} />
                </Field>
                <Field label="Body (Markdown)">
                  <textarea
                    name="body"
                    required
                    rows={18}
                    defaultValue={current?.body_md ?? starter.body}
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <Button>Publish</Button>
              </ActionForm>

              {history.length > 1 && (
                <p className="text-xs text-muted">
                  History: {history.map((t) => `v${t.version} (${fmtDate(t.created_at)})`).join(", ")}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
