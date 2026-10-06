import { redirect } from "next/navigation";
import { requireAdminPasswordSession } from "@/lib/auth";
import { MfaSetup } from "./MfaSetup";

export default async function MfaSetupPage() {
  const { supabase } = await requireAdminPasswordSession();
  const { data } = await supabase.auth.mfa.listFactors();
  if (data?.totp.length) redirect("/mfa/verify");

  return (
    <main lang="en" className="flex flex-1 items-center justify-center p-6">
      <MfaSetup />
    </main>
  );
}
