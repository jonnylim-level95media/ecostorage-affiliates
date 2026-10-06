import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Field, commissionTone, inputClass } from "@/components/admin/ui";
import { addDays, fmtDate, fmtRate, fmtSgd, isPast, label, toDateInput } from "@/lib/admin/format";
import { Constants } from "@/types/database";
import { forfeitSignup, qualifySignup, updateSignup } from "../actions";

const QUALIFY_DAYS = 60;

export default async function SignupDetailPage({ params }: PageProps<"/admin/signups/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: s } = await supabase
    .from("affiliate_signups")
    .select("*, affiliate_profiles(full_name, email), affiliate_codes(code)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const qualifiesOn = s.customer_started_at ? addDays(s.customer_started_at, QUALIFY_DAYS) : null;
  const pastSixtyDays = isPast(qualifiesOn);
  const canQualify =
    s.commission_status === "pending" &&
    s.first_month_net_rent != null &&
    (pastSixtyDays || (s.customer_started_at != null && s.outbound_completed_at != null));

  const rentLocked = s.commission_status !== "pending";

  return (
    <>
      <Link href="/admin/signups" className="text-sm text-muted hover:text-foreground">← All signups</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{s.full_name}</h1>
        <Badge tone={commissionTone[s.commission_status]}>{s.commission_status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Lead">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Row k="Email" v={s.email} />
            <Row k="Mobile" v={s.phone ?? "—"} />
            <Row k="Submitted" v={fmtDate(s.submitted_at)} />
            <Row k="Source" v={label(s.source)} />
            <Row k="Affiliate" v={s.affiliate_profiles ? `${s.affiliate_profiles.full_name} (${s.affiliate_profiles.email})` : "Unattributed"} />
            <Row k="Code / via" v={`${s.affiliate_codes?.code ?? "—"} · ${label(s.attribution_method)}`} />
            {s.ineligible_reason && <Row k="Ineligible" v={label(s.ineligible_reason)} />}
            <Row k="Main-site inquiry" v={<span className="font-mono text-xs">{s.main_site_inquiry_id}</span>} />
          </dl>
          {Object.keys(s.quote as object).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Quote details</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs">{JSON.stringify(s.quote, null, 2)}</pre>
            </details>
          )}
        </Card>

        <Card title="Commission">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Row k="Status" v={<span className="capitalize">{s.commission_status}</span>} />
            <Row k="Tier" v={s.tier_name ? `${s.tier_name} · ${fmtRate(s.commission_rate)}` : "—"} />
            <Row k="Amount" v={fmtSgd(s.commission_amount)} />
            <Row k="Qualifies on" v={qualifiesOn ? `${fmtDate(qualifiesOn)} (or on outbound)` : "Set the customer start date"} />
            <Row k="Qualified" v={fmtDate(s.qualified_at)} />
            <Row k="Payout due" v={fmtDate(s.payout_due_at)} />
            <Row k="Paid" v={s.paid_at ? `${fmtDate(s.paid_at)} · ${s.payout_reference ?? ""}` : "—"} />
            {s.forfeit_reason && <Row k="Forfeit reason" v={s.forfeit_reason} />}
          </dl>

          {s.commission_status === "pending" && s.affiliate_id && (
            <ActionForm
              action={qualifySignup}
              confirm="Qualify this commission? Confirm the customer had no late payment (>3 days), default or cancellation."
              className="space-y-2"
            >
              <input type="hidden" name="id" value={s.id} />
              <Button disabled={!canQualify}>Qualify commission</Button>
              {!canQualify && (
                <p className="text-xs text-muted">
                  Needs a start date, first month&apos;s net rent, and either {QUALIFY_DAYS} days elapsed or a completed outbound.
                </p>
              )}
            </ActionForm>
          )}

          {(s.commission_status === "pending" || s.commission_status === "qualified") && s.affiliate_id && (
            <ActionForm action={forfeitSignup} confirm="Forfeit this commission? This can't be undone." className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input name="reason" required placeholder="Reason (e.g. late payment on 3 Nov)" className={`${inputClass} min-w-48 flex-1`} />
              <Button variant="danger">Forfeit</Button>
            </ActionForm>
          )}
        </Card>
      </div>

      <Card title="Customer record">
        <ActionForm action={updateSignup} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={s.id} />
          <Field label="Customer status">
            <select name="status" defaultValue={s.status} className={inputClass}>
              {Constants.public.Enums.signup_status.map((o) => (
                <option key={o} value={o}>{label(o)}</option>
              ))}
            </select>
          </Field>
          <Field label="Storage start date">
            <input type="date" name="customer_started_at" defaultValue={toDateInput(s.customer_started_at)} className={inputClass} />
          </Field>
          <Field label={`First month's net rent (SGD)${rentLocked ? " · locked" : ""}`}>
            <input
              type="number"
              name="first_month_net_rent"
              step="0.01"
              min="0"
              defaultValue={s.first_month_net_rent ?? ""}
              readOnly={rentLocked}
              className={inputClass}
            />
          </Field>
          <Field label="Outbound completed (moved out of warehouse)">
            <input type="date" name="outbound_completed_at" defaultValue={toDateInput(s.outbound_completed_at)} className={inputClass} />
          </Field>
          <Field label="Customer end date">
            <input type="date" name="customer_ended_at" defaultValue={toDateInput(s.customer_ended_at)} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <Button>Save</Button>
          </div>
        </ActionForm>
        <p className="text-xs text-muted">
          Net rent excludes the admin fee, security deposit, GST and any free or discounted month.
        </p>
      </Card>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
