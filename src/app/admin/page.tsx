import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminConsole() {
  const { supabase } = await requireAdmin();

  const head = { count: "exact", head: true } as const;

  const [pending, affiliates, signups, dueForPayout] = await Promise.all([
    supabase.from("affiliate_applications").select("id", head).eq("status", "pending"),
    supabase.from("affiliate_profiles").select("id", head).eq("status", "active"),
    supabase.from("affiliate_signups").select("id", head).not("affiliate_id", "is", null),
    supabase.from("affiliate_signups").select("id", head).eq("commission_status", "qualified"),
  ]);

  const stats = [
    { label: "Pending applications", value: pending.count ?? 0 },
    { label: "Active affiliates", value: affiliates.count ?? 0 },
    { label: "Attributed signups", value: signups.count ?? 0 },
    { label: "Qualified, awaiting payout", value: dueForPayout.count ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin console</h1>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface p-5">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
