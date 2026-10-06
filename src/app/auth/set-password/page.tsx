import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function SetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Accounts with two-factor (admins) must pass it before changing password;
  // Supabase rejects the update from a password-only session.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/mfa/verify?next=set-password");

  const { t } = await getDictionary();
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SetPasswordForm t={t.setPassword} />
    </main>
  );
}
