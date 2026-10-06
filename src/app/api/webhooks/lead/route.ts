import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/email";
import { notifyAffiliateOfLead } from "@/lib/lead-notify";
import { EMAIL, PHONE, UUID, isoDate, jsonError, normalizeCode, readSignedJson, str } from "@/lib/signed-request";
import { Constants, type Database, type Json } from "@/types/database";

/**
 * Lead relay from the main site. Called server-to-server, signed, whenever an
 * enquiry carries a typed promo code and/or a ?ref= cookie. This route
 * records it; ingest_lead() in the database decides attribution (typed code
 * beats link, 14-day link window, self-referral, existing/duplicate
 * customer) under a per-person lock, and is idempotent on the inquiry id.
 *
 * Responses: 200 {signup_id, attributed} · 202 {recorded:false} nothing to
 * attribute · 400 invalid · 401 bad signature · 413 too large.
 */

const MAX_BODY_BYTES = 20_000;
const MAX_QUOTE_BYTES = 8_000;
const MAX_RELAY_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // retries allowed for a week
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type LeadSource = Database["public"]["Enums"]["lead_source"];

export async function POST(request: Request) {
  const parsed = await readSignedJson(request, MAX_BODY_BYTES);
  if ("response" in parsed) return parsed.response;
  const body = parsed.body;

  const inquiryId = str(body.main_site_inquiry_id, 36);
  const source = body.source as LeadSource;
  const fullName = str(body.full_name, 200);
  const email = str(body.email, 320).toLowerCase();
  const phone = str(body.phone, 32);
  const submittedAt = isoDate(body.submitted_at);
  const linkClickedAt = body.link_clicked_at == null ? null : isoDate(body.link_clicked_at);
  const promoCode = body.promo_code == null || body.promo_code === "" ? null : normalizeCode(body.promo_code);
  const refCode = body.ref_code == null || body.ref_code === "" ? null : normalizeCode(body.ref_code);
  const isExistingCustomer = body.is_existing_customer === true;
  const quote = body.quote ?? {};
  const now = Date.now();

  if (!UUID.test(inquiryId)) return jsonError("main_site_inquiry_id must be a UUID");
  if (!Constants.public.Enums.lead_source.includes(source)) return jsonError("Invalid source");
  if (!fullName || fullName.length > 200) return jsonError("full_name is required (max 200)");
  if (!EMAIL.test(email) || email.length > 320) return jsonError("A valid email is required");
  if (phone && !PHONE.test(phone)) return jsonError("Invalid phone");
  if (!submittedAt) return jsonError("submitted_at must be an ISO timestamp");
  if (submittedAt.getTime() > now + MAX_CLOCK_SKEW_MS || submittedAt.getTime() < now - MAX_RELAY_DELAY_MS) {
    return jsonError("submitted_at is out of range");
  }
  if (body.link_clicked_at != null && (!linkClickedAt || linkClickedAt.getTime() > now + MAX_CLOCK_SKEW_MS)) {
    return jsonError("Invalid link_clicked_at");
  }
  if (body.is_existing_customer != null && typeof body.is_existing_customer !== "boolean") {
    return jsonError("is_existing_customer must be a boolean");
  }
  if (typeof quote !== "object" || quote === null || Array.isArray(quote) || JSON.stringify(quote).length > MAX_QUOTE_BYTES) {
    return jsonError("quote must be an object under 8 KB");
  }
  // Malformed codes are treated as absent (a typo isn't a reason to lose the lead).
  if (!promoCode && !refCode) {
    return NextResponse.json({ recorded: false, reason: "no_referral" }, { status: 202 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .rpc("ingest_lead", {
      p_main_site_inquiry_id: inquiryId,
      p_source: source,
      p_full_name: fullName,
      p_email: email,
      // SQL param is nullable; the generated type just doesn't say so.
      p_phone: (phone || null) as string,
      p_quote: quote as Json,
      p_submitted_at: submittedAt.toISOString(),
      p_promo_code: promoCode ?? undefined,
      p_ref_code: refCode ?? undefined,
      p_link_clicked_at: linkClickedAt?.toISOString(),
      p_is_existing_customer: isExistingCustomer,
    })
    .single();

  if (error || !data) {
    return jsonError("Could not record the lead", 500);
  }

  if (data.attributed) {
    // Best effort; a failed email never fails the relay.
    await Promise.allSettled([
      notifyAffiliateOfLead(db, data.signup_id),
      notifyAdmin(
        "New referred lead",
        `A referred enquiry was recorded.\n\nReview: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/signups/${data.signup_id}`
      ),
    ]);
  }

  // The reason is only for the main site's logs; never show it to visitors.
  return NextResponse.json({ signup_id: data.signup_id, attributed: data.attributed, reason: data.reason });
}
