import { redirect } from "next/navigation";
import { requireAdminPasswordSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { MfaVerify } from "./MfaVerify";

export default async function MfaVerifyPage({ searchParams }: PageProps<"/mfa/verify">) {
  const { supabase } = await requireAdminPasswordSession();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp[0];
  if (!factor) redirect("/mfa/setup");

  // Only a fixed set of destinations, never a URL from the query string.
  const { next } = await searchParams;
  const destination = next === "set-password" ? "/auth/set-password" : "/admin";

  return (
    <main lang="en" className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <MfaVerify factorId={factor.id} destination={destination} />
      <SignOutButton />
    </main>
  );
}
