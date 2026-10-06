"use server";

import { adminContext, done, fail, sgDate, text, type ActionState } from "@/lib/admin/actions-common";
import { Constants, type Database } from "@/types/database";

type SignupStatus = Database["public"]["Enums"]["signup_status"];

export async function updateSignup(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = text(form, "id", 64);

  const status = text(form, "status", 20) as SignupStatus;
  if (!Constants.public.Enums.signup_status.includes(status)) return fail("Invalid status.");

  const customer_started_at = sgDate(form, "customer_started_at");
  const outbound_completed_at = sgDate(form, "outbound_completed_at");
  const customer_ended_at = sgDate(form, "customer_ended_at");
  if ([customer_started_at, outbound_completed_at, customer_ended_at].includes(undefined)) {
    return fail("Dates must be valid.");
  }

  const rentRaw = text(form, "first_month_net_rent", 20);
  const first_month_net_rent = rentRaw === "" ? null : Number(rentRaw);
  if (first_month_net_rent !== null && (!Number.isFinite(first_month_net_rent) || first_month_net_rent < 0)) {
    return fail("First month's net rent must be a positive amount.");
  }

  const { data: current } = await db
    .from("affiliate_signups")
    .select("commission_status, first_month_net_rent")
    .eq("id", id)
    .single();
  if (!current) return fail("Signup not found.");

  // The rent is the commission base. Once commission is qualified (amount
  // snapshotted) it must not drift, or the record stops matching the payout.
  if (current.commission_status !== "pending" && first_month_net_rent !== current.first_month_net_rent) {
    return fail(`Rent can't be changed once commission is ${current.commission_status}.`);
  }

  const changes = {
    status,
    customer_started_at: customer_started_at ?? null,
    outbound_completed_at: outbound_completed_at ?? null,
    customer_ended_at: customer_ended_at ?? null,
    first_month_net_rent,
  };

  const { error } = await db.from("affiliate_signups").update(changes).eq("id", id);
  if (error) return fail("Could not save changes.");

  await audit("signup.updated", "affiliate_signup", id, changes);
  return done("Saved.");
}

export async function qualifySignup(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = text(form, "id", 64);

  const { data, error } = await db.rpc("qualify_signup", { p_signup_id: id });
  // qualify_signup raises readable messages (not pending, 60 days not reached, …).
  if (error) return fail(error.message);

  await audit("signup.qualified", "affiliate_signup", id, {
    tier: data.tier_name,
    rate: data.commission_rate,
    amount: data.commission_amount,
    payout_due_at: data.payout_due_at,
  });
  return done(`Qualified at ${data.tier_name} tier.`);
}

export async function forfeitSignup(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = text(form, "id", 64);
  const reason = text(form, "reason", 500);
  if (!reason) return fail("A reason is required.");

  const { data, error } = await db
    .from("affiliate_signups")
    .update({ commission_status: "forfeited", forfeit_reason: reason, payout_due_at: null })
    .eq("id", id)
    .in("commission_status", ["pending", "qualified"])
    .select("id");

  if (error) return fail("Could not forfeit the commission.");
  if (!data.length) return fail("Only pending or qualified commissions can be forfeited.");

  await audit("signup.forfeited", "affiliate_signup", id, { reason });
  return done("Commission forfeited.");
}
