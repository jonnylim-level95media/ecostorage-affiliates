"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const TOKEN_HASH = /^[A-Za-z0-9_-]{10,200}$/;

/** Redeems an invite / password-reset token and starts a session. */
export async function verifyLink(form: FormData) {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");

  if (!TOKEN_HASH.test(tokenHash) || (type !== "invite" && type !== "recovery")) {
    redirect("/login?error=link");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  // Fixed destinations only: nothing from the request decides where we go.
  redirect(error ? "/login?error=link" : "/auth/set-password");
}
