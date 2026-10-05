import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Authoritative access checks for pages and route handlers. The proxy only
 * does an optimistic signed-in check; every protected layout/route must call
 * one of these, which re-validate the session and read the role from the
 * database (RLS-scoped to the caller's own profile).
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

export async function requireAdmin() {
  const ctx = await getCurrentUserRole();
  if (!ctx.user) redirect("/login");
  if (ctx.role !== "admin") redirect("/affiliate");
  return ctx;
}

export async function requireAffiliate() {
  const ctx = await getCurrentUserRole();
  if (!ctx.user) redirect("/login");
  if (ctx.role === "admin") redirect("/admin");
  return ctx;
}
