import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Authoritative access checks for pages, route handlers and server actions.
 * The proxy only does an optimistic signed-in check; every protected
 * layout/route/action must call one of these, which re-validate the session
 * and read the role from the database (RLS-scoped to the caller's profile).
 */

export async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, user, role: profile?.role ?? null } as const;
}

/**
 * Admin with a two-factor (AAL2) session. Admins without an authenticator
 * are sent to enroll one; admins with one but a password-only session are
 * sent to enter their code. is_admin() in the database enforces the same
 * rule, so RLS reads fail closed even if this check were skipped.
 */
export async function requireAdmin() {
  const ctx = await requireAdminPasswordSession();
  const { data: aal } = await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel !== "aal2") {
    redirect(aal?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/setup");
  }
  return ctx;
}

/** Admin role, any assurance level. Only for the MFA setup/verify pages. */
export async function requireAdminPasswordSession() {
  const ctx = await getCurrentUserRole();
  if (!ctx.user) redirect("/login");
  if (ctx.role !== "admin") redirect("/affiliate");
  return { ...ctx, user: ctx.user };
}

export async function requireAffiliate() {
  const ctx = await getCurrentUserRole();
  if (!ctx.user) redirect("/login");
  if (ctx.role === "admin") redirect("/admin");
  return ctx;
}
