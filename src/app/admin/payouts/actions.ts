"use server";

import { adminContext, done, fail, text, uuid, type ActionState } from "@/lib/admin/actions-common";

export async function markPaid(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");
  const reference = text(form, "reference", 200);
  if (!reference) return fail("Enter the PayNow / bank transfer reference.");

  const { data, error } = await db
    .from("affiliate_signups")
    .update({ commission_status: "paid", paid_at: new Date().toISOString(), payout_reference: reference })
    .eq("id", id)
    .eq("commission_status", "qualified")
    .select("id, commission_amount");

  if (error) return fail("Could not mark as paid.");
  if (!data.length) return fail("Only qualified commissions can be marked paid.");

  await audit("payout.paid", "affiliate_signup", id, { reference, amount: data[0].commission_amount });
  return done("Marked as paid.");
}
