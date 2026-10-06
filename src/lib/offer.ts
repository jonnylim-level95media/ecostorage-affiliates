/**
 * What a customer gets for using an affiliate code (decision 6a, placeholder
 * pending final pricing). Returned to the main site by /api/promo/validate so
 * the calculator shows the offer without hardcoding it in two places.
 * Storage fees only: the admin fee and security deposit always apply.
 */
export const REFERRAL_OFFER = {
  commitment_months: 4,
  free_months: 1,
} as const;
