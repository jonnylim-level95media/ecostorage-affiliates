import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Empty, inputClass } from "@/components/admin/ui";
import { fmtDate, fmtRate, fmtSgd, isPast, label } from "@/lib/admin/format";
import { markPaid } from "./actions";

export default async function PayoutsPage() {
  const { supabase } = await requireAdmin();
  const affiliateCols = "affiliate_profiles(full_name, payout_method, payout_details)";

  const [{ data: queue }, { data: paid }] = await Promise.all([
    supabase
      .from("affiliate_signups")
      .select(`id, full_name, tier_name, commission_rate, commission_amount, qualified_at, payout_due_at, ${affiliateCols}`)
      .eq("commission_status", "qualified")
      .order("payout_due_at"),
    supabase
      .from("affiliate_signups")
      .select(`id, full_name, commission_amount, paid_at, payout_reference, ${affiliateCols}`)
      .eq("commission_status", "paid")
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  const dueTotal = (queue ?? [])
    .filter((s) => isPast(s.payout_due_at))
    .reduce((sum, s) => sum + (s.commission_amount ?? 0), 0);

  return (
    <>
      <h1 className="text-2xl font-bold">Payouts</h1>
      <p className="text-sm text-muted">
        Commission becomes payable 30 days after qualifying. Pay it outside the system (PayNow / bank transfer), then
        record the reference here.
      </p>

      <Card title={`Qualified (${queue?.length ?? 0})`} actions={<span className="text-sm">Due now: <strong>{fmtSgd(dueTotal)}</strong></span>}>
        {!queue?.length ? (
          <Empty>No qualified commissions.</Empty>
        ) : (
          <ul className="space-y-3">
            {queue.map((s) => {
              const due = isPast(s.payout_due_at);
              const a = s.affiliate_profiles;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/5 p-4">
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>{fmtSgd(s.commission_amount)}</strong> to {a?.full_name ?? "—"}{" "}
                      <Badge tone={due ? "accent" : "muted"}>{due ? "due" : `due ${fmtDate(s.payout_due_at)}`}</Badge>
                    </p>
                    <p className="text-xs text-muted">
                      For <Link href={`/admin/signups/${s.id}`} className="underline">{s.full_name}</Link> · {s.tier_name}{" "}
                      {fmtRate(s.commission_rate)} · qualified {fmtDate(s.qualified_at)}
                    </p>
                    <p className="text-xs text-muted">
                      Payout: {a?.payout_method ? label(a.payout_method) : "not set"}
                      {a?.payout_details && ` · ${a.payout_details}`}
                    </p>
                  </div>
                  <ActionForm action={markPaid} confirm="Mark this commission as paid?" className="flex gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="reference" required placeholder="Payment reference" className={`${inputClass} w-44`} />
                    <Button disabled={!due}>Mark paid</Button>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Recently paid">
        {!paid?.length ? (
          <Empty>No payouts yet.</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {paid.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="py-2 pr-4">{s.affiliate_profiles?.full_name}</td>
                  <td className="py-2 pr-4">{fmtSgd(s.commission_amount)}</td>
                  <td className="py-2 pr-4 text-muted">{s.full_name}</td>
                  <td className="py-2 pr-4 text-muted">{s.payout_reference}</td>
                  <td className="py-2 text-muted">{fmtDate(s.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
