import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminOverview() {
  const { supabase } = await requireAdmin();
  const head = { count: "exact", head: true } as const;
  const now = new Date().toISOString();

  const [pending, affiliates, signups, readyToQualify, dueForPayout, enTerms] = await Promise.all([
    supabase.from("affiliate_applications").select("id", head).eq("status", "pending"),
    supabase.from("affiliate_profiles").select("id", head).eq("status", "active"),
    supabase.from("affiliate_signups").select("id", head).not("affiliate_id", "is", null),
    supabase
      .from("affiliate_signups")
      .select("id", head)
      .eq("commission_status", "pending")
      .not("customer_started_at", "is", null),
    supabase
      .from("affiliate_signups")
      .select("id", head)
      .eq("commission_status", "qualified")
      .lte("payout_due_at", now),
    supabase.from("terms_versions").select("id", head).eq("locale", "en").eq("is_current", true),
  ]);

  const stats = [
    { label: "Pending applications", value: pending.count ?? 0, href: "/admin/applications" },
    { label: "Active affiliates", value: affiliates.count ?? 0, href: "/admin/signups" },
    { label: "Attributed signups", value: signups.count ?? 0, href: "/admin/signups" },
    { label: "Customers awaiting qualification", value: readyToQualify.count ?? 0, href: "/admin/signups?commission=pending" },
    { label: "Payouts due now", value: dueForPayout.count ?? 0, href: "/admin/payouts" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Overview</h1>

      {!enTerms.count && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          No affiliate agreement is published yet, so approved affiliates can&apos;t activate their codes.{" "}
          <Link href="/admin/terms" className="underline">Publish the English terms</Link>.
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl bg-surface p-5 hover:ring-1 hover:ring-accent/40">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
