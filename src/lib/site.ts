/** Where auth emails send people back to. Must be in Supabase's redirect URL allowlist. */
export function authCallbackUrl() {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`;
}
