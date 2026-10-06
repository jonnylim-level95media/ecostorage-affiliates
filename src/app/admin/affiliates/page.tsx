import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Button, Card, Empty } from "@/components/admin/ui";
import { fmtDate } from "@/lib/admin/format";
import { emailConfigured } from "@/lib/email";
import { resendOnboarding, rotateCode, sendPasswordLink, setSuspended } from "./actions";

const statusTone = { invited: "warn", active: "accent", suspended: "danger", terminated: "danger" } as const;

export default async function AffiliatesPage() {
  const { supabase } = await requireAdmin();

  const { data: affiliates } = await supabase
    .from("affiliate_profiles")
    .select(
      "id, full_name, email, phone, status, preferred_locale, activated_at, created_at, " +
        "affiliate_codes(code, is_active, deactivated_at, created_at), " +
        "terms_acceptances(accepted_at), onboarding_sends(sent_at)"
    )
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        status: keyof typeof statusTone;
        preferred_locale: string;
        activated_at: string | null;
        created_at: string;
        affiliate_codes: { code: string; is_active: boolean; deactivated_at: string | null; created_at: string }[];
        terms_acceptances: { accepted_at: string }[];
        onboarding_sends: { sent_at: string }[];
      }[]
    >();

  const canEmail = emailConfigured();

  return (
    <>
      <h1 className="text-2xl font-bold">Affiliates</h1>
      {!canEmail && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          Custom email (Resend) isn&apos;t set up, so onboarding packs can&apos;t be sent yet. Set-password links still go
          out through Supabase&apos;s built-in email, which is limited to a few per hour.
        </p>
      )}

      <Card title={`${affiliates?.length ?? 0} affiliates`}>
        {!affiliates?.length ? (
          <Empty>No affiliates yet. Approve an application to create one.</Empty>
        ) : (
          <ul className="space-y-4">
            {affiliates.map((a) => {
              const codes = [...a.affiliate_codes].sort((x, y) => y.created_at.localeCompare(x.created_at));
              const current = codes.find((c) => c.deactivated_at === null);
              const lastOnboarding = a.onboarding_sends.map((s) => s.sent_at).sort().at(-1);
              const lastTerms = a.terms_acceptances.map((s) => s.accepted_at).sort().at(-1);
              return (
                <li key={a.id} className="space-y-3 rounded-lg border border-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{a.full_name}</strong>
                    <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                    <span className="text-sm text-muted">
                      {a.email}
                      {a.phone && ` · ${a.phone}`} · {a.preferred_locale === "zh-Hans" ? "中文" : "English"}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    Code: <span className="font-mono text-foreground">{current?.code ?? "—"}</span>{" "}
                    {current && (current.is_active ? "(live)" : "(not live)")}
                    {codes.length > 1 && ` · ${codes.length - 1} retired`} · Terms accepted: {fmtDate(lastTerms)} ·
                    Onboarding sent: {fmtDate(lastOnboarding)} · Approved {fmtDate(a.created_at)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={resendOnboarding} className="space-y-1">
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="secondary" disabled={!canEmail}>Resend onboarding</Button>
                    </ActionForm>
                    <ActionForm action={sendPasswordLink} confirm="Email this affiliate a new set-password link?" className="space-y-1">
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="secondary">Send set-password link</Button>
                    </ActionForm>
                    <ActionForm
                      action={rotateCode}
                      confirm="Retire the current code and issue a new one? The old code stops earning commission immediately."
                      className="space-y-1"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="secondary">Replace code</Button>
                    </ActionForm>
                    {a.status !== "terminated" && (
                      <ActionForm
                        action={setSuspended}
                        confirm={a.status === "suspended" ? "Reactivate this affiliate?" : "Suspend this affiliate? Their codes stop working immediately."}
                        className="space-y-1"
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="suspend" value={String(a.status !== "suspended")} />
                        <Button variant={a.status === "suspended" ? "secondary" : "danger"}>
                          {a.status === "suspended" ? "Reactivate" : "Suspend"}
                        </Button>
                      </ActionForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
