import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Empty, inputClass } from "@/components/admin/ui";
import { fmtDate } from "@/lib/admin/format";
import { approveApplication, rejectApplication } from "./actions";

export default async function ApplicationsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: pending }, { data: reviewed }] = await Promise.all([
    supabase.from("affiliate_applications").select("*").eq("status", "pending").order("created_at"),
    supabase
      .from("affiliate_applications")
      .select("id, full_name, email, status, review_notes, reviewed_at")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Applications</h1>

      <Card title={`Pending (${pending?.length ?? 0})`}>
        {!pending?.length && <Empty>No pending applications.</Empty>}
        <ul className="space-y-4">
          {pending?.map((a) => (
            <li key={a.id} className="space-y-3 rounded-lg border border-white/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {a.full_name} <span className="font-normal text-muted">· {a.email}{a.phone && ` · ${a.phone}`}</span>
                </p>
                <p className="text-xs text-muted">
                  {fmtDate(a.created_at)} · {a.preferred_locale === "zh-Hans" ? "中文" : "English"}
                </p>
              </div>
              {a.promotion_plan && <p className="whitespace-pre-wrap text-sm">{a.promotion_plan}</p>}

              <div className="flex flex-wrap items-start gap-3">
                <ActionForm
                  action={approveApplication}
                  confirm={`Approve ${a.full_name}? This emails them an invitation and creates their referral code.`}
                  className="space-y-1"
                >
                  <input type="hidden" name="id" value={a.id} />
                  <Button>Approve</Button>
                </ActionForm>
                <ActionForm action={rejectApplication} confirm="Reject this application?" className="flex flex-1 flex-wrap gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="notes" placeholder="Rejection notes (internal)" className={`${inputClass} min-w-48 flex-1`} />
                  <Button variant="danger">Reject</Button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Recently reviewed">
        {!reviewed?.length ? (
          <Empty>Nothing reviewed yet.</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {reviewed.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="py-2 pr-4">{a.full_name}</td>
                  <td className="py-2 pr-4 text-muted">{a.email}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={a.status === "approved" ? "accent" : "danger"}>{a.status}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-muted">{a.review_notes ?? ""}</td>
                  <td className="py-2 text-muted">{fmtDate(a.reviewed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
