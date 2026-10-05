import { requireAffiliate } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

const sgd = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const date = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" });

export default async function AffiliateDashboard() {
  const { supabase } = await requireAffiliate();

  const [{ data: profile }, { data: codes }, { data: signups }] = await Promise.all([
    supabase.from("affiliate_profiles").select("full_name, status").single(),
    supabase.from("affiliate_codes").select("code, is_active"),
    supabase.rpc("get_my_signups"),
  ]);

  const siteUrl = process.env.MAIN_SITE_URL ?? "";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hi {profile?.full_name ?? "there"}</h1>
          <p className="text-sm text-muted">Your referrals and commission.</p>
        </div>
        <SignOutButton />
      </header>

      {profile?.status === "invited" && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
          Accept the affiliate terms to activate your referral code.
        </p>
      )}

      <section className="rounded-xl bg-surface p-6">
        <h2 className="mb-3 font-semibold">Your referral code</h2>
        {codes?.length ? (
          <ul className="space-y-2">
            {codes.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-lg">{c.code}</span>
                <span className={c.is_active ? "text-accent text-sm" : "text-muted text-sm"}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
                {c.is_active && (
                  <span className="font-mono text-sm text-muted">{`${siteUrl}/?ref=${c.code}`}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No code yet.</p>
        )}
      </section>

      <section className="rounded-xl bg-surface p-6">
        <h2 className="mb-3 font-semibold">Referrals</h2>
        {signups?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Mobile</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Commission</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 pr-4">{s.masked_name}</td>
                    <td className="py-2 pr-4">{s.masked_phone ?? "—"}</td>
                    <td className="py-2 pr-4">{s.masked_email}</td>
                    <td className="py-2 pr-4">{date.format(new Date(s.submitted_at))}</td>
                    <td className="py-2 pr-4 capitalize">{s.status.replace("_", " ")}</td>
                    <td className="py-2 pr-4">
                      <span className="capitalize">{s.commission_status}</span>
                      {s.commission_amount != null && ` · ${sgd.format(s.commission_amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No referrals yet. Share your link to get started.</p>
        )}
      </section>
    </main>
  );
}
