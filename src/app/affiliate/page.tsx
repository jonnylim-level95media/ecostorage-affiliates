import { redirect } from "next/navigation";
import { requireAffiliate } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getDictionary } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/dictionaries";
import { intlTag } from "@/lib/i18n/config";
import { referralLink } from "@/lib/referral";

export default async function AffiliateDashboard() {
  const { supabase } = await requireAffiliate();
  const { locale, t } = await getDictionary();
  const d = t.dashboard;

  const [{ data: profile }, { data: codes }, { data: signups }] = await Promise.all([
    supabase.from("affiliate_profiles").select("full_name, status").single(),
    supabase.from("affiliate_codes").select("code, is_active"),
    supabase.rpc("get_my_signups"),
  ]);

  // First login: language → terms → code reveal before anything else.
  if (profile?.status === "invited") redirect("/affiliate/welcome");

  const sgd = new Intl.NumberFormat(intlTag(locale), { style: "currency", currency: "SGD" });
  const date = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium" });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{fill(d.greeting, { name: profile?.full_name ?? "" })}</h1>
          <p className="text-sm text-muted">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitch current={locale} label={t.common.language} />
          <SignOutButton label={t.common.signOut} />
        </div>
      </header>

      <section className="rounded-xl bg-surface p-6">
        <h2 className="mb-3 font-semibold">{d.codeHeading}</h2>
        {codes?.length ? (
          <ul className="space-y-2">
            {codes.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-lg">{c.code}</span>
                <span className={c.is_active ? "text-accent text-sm" : "text-muted text-sm"}>
                  {c.is_active ? d.active : d.inactive}
                </span>
                {c.is_active && <span className="break-all font-mono text-sm text-muted">{referralLink(c.code)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{d.noCode}</p>
        )}
      </section>

      <section className="rounded-xl bg-surface p-6">
        <h2 className="mb-3 font-semibold">{d.referralsHeading}</h2>
        {signups?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-4">{d.columns.name}</th>
                  <th className="py-2 pr-4">{d.columns.mobile}</th>
                  <th className="py-2 pr-4">{d.columns.email}</th>
                  <th className="py-2 pr-4">{d.columns.submitted}</th>
                  <th className="py-2 pr-4">{d.columns.status}</th>
                  <th className="py-2 pr-4">{d.columns.commission}</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 pr-4">{s.masked_name}</td>
                    <td className="py-2 pr-4">{s.masked_phone ?? "—"}</td>
                    <td className="py-2 pr-4">{s.masked_email}</td>
                    <td className="py-2 pr-4">{date.format(new Date(s.submitted_at))}</td>
                    <td className="py-2 pr-4">{d.signupStatus[s.status]}</td>
                    <td className="py-2 pr-4">
                      {d.commissionStatus[s.commission_status]}
                      {s.commission_amount != null && ` · ${sgd.format(s.commission_amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">{d.noReferrals}</p>
        )}
      </section>
    </main>
  );
}
