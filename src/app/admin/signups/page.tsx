import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Empty, commissionTone, inputClass } from "@/components/admin/ui";
import { fmtDate, fmtSgd, label } from "@/lib/admin/format";
import { Constants, type Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function SignupsPage({ searchParams }: PageProps<"/admin/signups">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const status = pick<Enums["signup_status"]>(params.status, Constants.public.Enums.signup_status);
  const commission = pick<Enums["commission_status"]>(params.commission, Constants.public.Enums.commission_status);
  const affiliate = typeof params.affiliate === "string" ? params.affiliate : "";

  const { data: affiliates } = await supabase
    .from("affiliate_profiles")
    .select("id, full_name")
    .order("full_name");

  let query = supabase
    .from("affiliate_signups")
    .select("id, full_name, email, phone, source, attribution_method, submitted_at, status, commission_status, commission_amount, ineligible_reason, affiliate_profiles(full_name)")
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (commission) query = query.eq("commission_status", commission);
  if (affiliate === "none") query = query.is("affiliate_id", null);
  else if (affiliates?.some((a) => a.id === affiliate)) query = query.eq("affiliate_id", affiliate);

  const { data: signups } = await query;

  return (
    <>
      <h1 className="text-2xl font-bold">Signups</h1>

      <form className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 text-sm">
        <Select name="status" label="Customer status" value={status} options={Constants.public.Enums.signup_status} />
        <Select name="commission" label="Commission" value={commission} options={Constants.public.Enums.commission_status} />
        <label className="space-y-1">
          <span className="block text-xs text-muted">Affiliate</span>
          <select name="affiliate" defaultValue={affiliate} className={inputClass}>
            <option value="">All</option>
            <option value="none">Unattributed</option>
            {affiliates?.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-accent px-3 py-2 font-semibold text-background">Filter</button>
        <Link href="/admin/signups" className="px-2 py-2 text-muted hover:text-foreground">Clear</Link>
      </form>

      <Card title={`${signups?.length ?? 0} signups${signups?.length === 200 ? " (latest 200)" : ""}`}>
        {!signups?.length ? (
          <Empty>No signups match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Affiliate</th>
                  <th className="py-2 pr-4">Via</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Commission</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-white/5 align-top">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/signups/${s.id}`} className="font-medium hover:text-accent">{s.full_name}</Link>
                      <p className="text-xs text-muted">{s.email}{s.phone && ` · ${s.phone}`}</p>
                    </td>
                    <td className="py-2 pr-4">{s.affiliate_profiles?.full_name ?? <span className="text-muted">—</span>}</td>
                    <td className="py-2 pr-4 text-muted">{label(s.attribution_method)} · {label(s.source)}</td>
                    <td className="py-2 pr-4 text-muted">{fmtDate(s.submitted_at)}</td>
                    <td className="py-2 pr-4 capitalize">{label(s.status)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={commissionTone[s.commission_status]}>{s.commission_status}</Badge>
                      {s.commission_amount != null && <span className="ml-2">{fmtSgd(s.commission_amount)}</span>}
                      {s.ineligible_reason && <p className="text-xs text-muted">{label(s.ineligible_reason)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Select({ name, label: text, value, options }: { name: string; label: string; value?: string; options: readonly string[] }) {
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted">{text}</span>
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{label(o)}</option>
        ))}
      </select>
    </label>
  );
}
