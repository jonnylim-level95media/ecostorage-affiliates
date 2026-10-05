/** Public referral link for a code, pointing at the main EcoStorage site. */
export function referralLink(code: string) {
  return `${process.env.MAIN_SITE_URL ?? ""}/?ref=${encodeURIComponent(code)}`;
}
