"use server";

import { adminContext, done, EMAIL_UNDELIVERABLE, fail, uuid, type ActionState } from "@/lib/admin/actions-common";
import { sendOnboarding } from "@/lib/onboarding";
import { authCallbackUrl } from "@/lib/site";

export async function resendOnboarding(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");

  const result = await sendOnboarding(db, id, user.id);
  if (!result.sent) return fail(`Onboarding email not sent: ${result.reason}.`);

  await audit("affiliate.onboarding_resent", "affiliate_profile", id);
  return done("Onboarding pack sent.");
}

/** Emails a fresh one-time set-password link (also works if the invite expired). */
export async function sendPasswordLink(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");

  const { data: affiliate } = await db.from("affiliate_profiles").select("email").eq("id", id).maybeSingle();
  if (!affiliate) return fail("Affiliate not found.");

  const { error } = await db.auth.resetPasswordForEmail(affiliate.email, { redirectTo: authCallbackUrl() });
  if (!error) {
    await audit("affiliate.password_link_sent", "affiliate_profile", id, { emailed: true });
    return done("Set-password link emailed.");
  }
  if (!error.code || !EMAIL_UNDELIVERABLE.has(error.code)) return fail(`Couldn't send the link: ${error.message}`);

  // Same fallback as approval: generate the one-time link for the admin to pass on.
  const generated = await db.auth.admin.generateLink({
    type: "recovery",
    email: affiliate.email,
    options: { redirectTo: authCallbackUrl() },
  });
  if (generated.error) return fail(`Couldn't create the link: ${generated.error.message}`);

  await audit("affiliate.password_link_sent", "affiliate_profile", id, { emailed: false });
  return { ...done("Supabase can't email this address yet. Send them the link below."), link: generated.data.properties.action_link };
}

export async function setSuspended(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");
  const suspend = form.get("suspend") === "true";

  const { data: status, error } = await db.rpc("set_affiliate_suspended", {
    p_affiliate_id: id,
    p_suspended: suspend,
  });
  if (error) return fail(error.message);

  await audit(suspend ? "affiliate.suspended" : "affiliate.reactivated", "affiliate_profile", id, { status });
  return done(suspend ? "Suspended. Their codes no longer earn commission." : `Reactivated (${status}).`);
}

export async function rotateCode(_: ActionState, form: FormData): Promise<ActionState> {
  const { db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");

  const { data: code, error } = await db.rpc("rotate_affiliate_code", { p_affiliate_id: id });
  if (error) return fail(error.message);

  await audit("affiliate.code_rotated", "affiliate_profile", id, { new_code: code });
  return done(`Old code retired. New code: ${code}. Let the affiliate know.`);
}
