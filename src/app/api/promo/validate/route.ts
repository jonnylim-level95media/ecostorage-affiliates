import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit-db";
import { REFERRAL_OFFER } from "@/lib/offer";
import { jsonError, normalizeCode, readSignedJson, str } from "@/lib/signed-request";

/**
 * Promo code check for the main site's "Apply" button. Signed
 * server-to-server; the visitor's IP is forwarded so guessing can be limited
 * per visitor. Only says whether the code works and what the customer gets,
 * never who the affiliate is.
 *
 * Responses: 200 {valid, offer?} · 400 invalid · 401 bad signature · 429 limited.
 */
export async function POST(request: Request) {
  const parsed = await readSignedJson(request, 2_000);
  if ("response" in parsed) return parsed.response;
  const { body } = parsed;

  const clientIp = str(body.client_ip, 45);
  if (!clientIp || !isIP(clientIp)) return jsonError("client_ip is required");

  // 10 checks per 10 minutes per visitor. Codes have ~10^12 possibilities, so
  // this makes guessing pointless while leaving room for typos.
  if (!(await rateLimit(`promo:ip:${clientIp}`, 10, 10 * 60))) {
    return jsonError("Too many attempts. Please try again later.", 429);
  }

  const code = normalizeCode(body.code);
  if (!code) return NextResponse.json({ valid: false });

  const { data: valid, error } = await createAdminClient().rpc("is_code_redeemable", { p_code: code });
  if (error) return jsonError("Could not check the code", 500);

  return NextResponse.json(valid ? { valid: true, code, offer: REFERRAL_OFFER } : { valid: false });
}
