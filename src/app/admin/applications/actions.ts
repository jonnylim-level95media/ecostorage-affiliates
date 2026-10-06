"use server";

import { adminContext, done, EMAIL_UNDELIVERABLE, fail, text, uuid, type ActionState } from "@/lib/admin/actions-common";
import { sendOnboarding } from "@/lib/onboarding";
import { authCallbackUrl } from "@/lib/site";

/**
 * One-click approval: invite the auth user (Supabase sends the set-password
 * email), create the affiliate profile + inactive code, then email the
 * onboarding pack. If profile creation fails, the invited user is deleted so
 * nothing is left half-made. Email failures are reported, not fatal.
 */
export async function approveApplication(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");

  const { data: app } = await db
    .from("affiliate_applications")
    .select("id, email, status, preferred_locale")
    .eq("id", id)
    .maybeSingle();
  if (!app || app.status !== "pending") return fail("This application is no longer pending.");

  const inviteOptions = { data: { preferred_locale: app.preferred_locale }, redirectTo: authCallbackUrl() };
  let userId: string;
  let manualLink: string | undefined;

  const invite = await db.auth.admin.inviteUserByEmail(app.email, inviteOptions);
  if (invite.data.user && !invite.error) {
    userId = invite.data.user.id;
  } else if (invite.error?.code && EMAIL_UNDELIVERABLE.has(invite.error.code)) {
    // Supabase's built-in email only reaches project team members. Until
    // custom SMTP is set up, create the invite without sending and hand the
    // admin the one-time link to pass on.
    const generated = await db.auth.admin.generateLink({ type: "invite", email: app.email, options: inviteOptions });
    if (generated.error || !generated.data.user) {
      return fail(`Couldn't create the invitation: ${generated.error?.message ?? "unknown error"}`);
    }
    userId = generated.data.user.id;
    manualLink = generated.data.properties.action_link;
  } else if (invite.error?.code === "email_exists") {
    return fail("An account with this email already exists, so it can't be invited as a new affiliate.");
  } else {
    return fail(`Couldn't send the invitation: ${invite.error?.message ?? "unknown error"}`);
  }

  const { data: affiliateId, error: createError } = await db.rpc("create_affiliate_from_application", {
    p_application_id: app.id,
    p_user_id: userId,
    p_reviewer_id: user.id,
  });
  if (createError || !affiliateId) {
    await db.auth.admin.deleteUser(userId);
    return fail("Couldn't create the affiliate, so the invitation was cancelled. Please try again.");
  }

  const onboarding = await sendOnboarding(db, affiliateId, user.id);
  await audit("affiliate.invited", "affiliate_profile", affiliateId, {
    application_id: app.id,
    invite_emailed: !manualLink,
    onboarding_sent: onboarding.sent,
    ...(onboarding.sent ? {} : { onboarding_error: onboarding.reason }),
  });

  const inviteNote = manualLink
    ? "Approved. Supabase can't email this address yet, so send them the link below."
    : "Approved. Set-password invitation emailed.";
  const onboardingNote = onboarding.sent
    ? " Onboarding pack sent."
    : ` Onboarding pack NOT sent (${onboarding.reason}); use Resend onboarding on the Affiliates page later.`;
  return { ...done(inviteNote + onboardingNote), link: manualLink };
}

export async function rejectApplication(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, db, audit } = await adminContext();
  const id = uuid(form, "id");
  if (!id) return fail("Invalid request.");
  const notes = text(form, "notes", 2000);

  const { data, error } = await db
    .from("affiliate_applications")
    .update({ status: "rejected", review_notes: notes || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) return fail("Could not reject the application.");
  if (!data.length) return fail("This application is no longer pending.");

  await audit("application.rejected", "affiliate_application", id, { notes });
  return done("Application rejected.");
}
