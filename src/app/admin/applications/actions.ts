"use server";

import { adminContext, done, fail, text, type ActionState } from "@/lib/admin/actions-common";

export async function rejectApplication(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, db, audit } = await adminContext();
  const id = text(form, "id", 64);
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
