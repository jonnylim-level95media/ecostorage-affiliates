import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** Result shape every admin server action returns, shown by <ActionForm>. */
export type ActionState = { ok?: string; error?: string } | null;

/**
 * Every admin mutation goes through here: re-checks the caller is an admin
 * (server actions are public endpoints, so the page-level check isn't
 * enough), hands back a service-role client, and records the audit entry.
 */
export async function adminContext() {
  const { user } = await requireAdmin();
  const db = createAdminClient();

  async function audit(action: string, entityType: string, entityId: string | null, details: Json = {}) {
    await db.from("audit_log").insert({
      actor_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  }

  return { user, db, audit };
}

export function done(message: string): ActionState {
  revalidatePath("/admin", "layout");
  return { ok: message };
}

export function fail(message: string): ActionState {
  return { error: message };
}

export function text(form: FormData, key: string, max = 10_000) {
  const value = String(form.get(key) ?? "").trim();
  return value.length > max ? value.slice(0, max) : value;
}

const SG_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `<input type="date">` value (Singapore calendar day) → timestamptz, or null if blank. */
export function sgDate(form: FormData, key: string): string | null | undefined {
  const value = text(form, key, 10);
  if (!value) return null;
  if (!SG_DATE.test(value)) return undefined; // invalid
  return `${value}T00:00:00+08:00`;
}
