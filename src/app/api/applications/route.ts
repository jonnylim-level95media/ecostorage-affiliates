import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRawBody, verifyRequest } from "@/lib/signing";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyAdmin } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit-db";
import { isLocale } from "@/lib/i18n/config";

/**
 * Affiliate application intake. The public form lives on the main site,
 * which forwards submissions here server-to-server, signed with the shared
 * secret. The applicant's Turnstile token and IP are forwarded in the body
 * and verified here (tokens are single-use).
 *
 * Responses: 201 created · 400 invalid · 401 bad signature · 403 bot check
 * failed · 409 already pending for this email · 413 too large · 429 limited.
 */

const MAX_BODY_BYTES = 10_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d\s()-]{6,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function str(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

export async function POST(request: Request) {
  const raw = await readRawBody(request, MAX_BODY_BYTES);
  if (raw === null) return bad("Request too large", 413);

  const verified = verifyRequest(raw, request.headers);
  if (!verified.ok) return bad("Invalid signature", 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON");
  }

  const fullName = str(body.full_name, 200);
  const email = str(body.email, 320).toLowerCase();
  const phone = str(body.phone, 32);
  const promotionPlan = str(body.promotion_plan, 2000);
  const locale = body.preferred_locale ?? "en";
  const clientIp = str(body.client_ip, 45);
  const inquiryId = str(body.main_site_inquiry_id, 36);
  const turnstileToken = str(body.turnstile_token, 2048);

  if (!fullName || fullName.length > 200) return bad("Name is required (max 200 characters)");
  if (!EMAIL.test(email) || email.length > 320) return bad("A valid email is required");
  if (phone && !PHONE.test(phone)) return bad("Phone number looks invalid");
  if (promotionPlan.length > 2000) return bad("Promotion plan is too long (max 2000 characters)");
  if (body.contact_consent !== true) return bad("Contact consent is required");
  if (!isLocale(locale)) return bad("Invalid preferred_locale");
  if (clientIp && !isIP(clientIp)) return bad("Invalid client_ip");
  if (inquiryId && !UUID.test(inquiryId)) return bad("Invalid main_site_inquiry_id");
  if (!turnstileToken) return bad("Missing bot check token");

  // Every request comes from the main site's server, so the proxy's per-IP
  // limit can't tell applicants apart; limit on the forwarded applicant IP
  // and the email, in the shared (cross-instance) limiter.
  const limits = await Promise.all([
    clientIp ? rateLimit(`apply:ip:${clientIp}`, 5, 60 * 60) : true,
    rateLimit(`apply:email:${email}`, 3, 24 * 60 * 60),
  ]);
  if (limits.includes(false)) return bad("Too many applications. Please try again later.", 429);

  if (!(await verifyTurnstile(turnstileToken, clientIp || undefined))) {
    return bad("Bot check failed. Please try again.", 403);
  }

  const { data, error } = await createAdminClient()
    .from("affiliate_applications")
    .insert({
      full_name: fullName,
      email,
      phone: phone || null,
      promotion_plan: promotionPlan || null,
      contact_consent: true,
      preferred_locale: locale,
      main_site_inquiry_id: inquiryId || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return bad("An application for this email is already being reviewed.", 409);
    return bad("Could not save the application. Please try again.", 500);
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/applications`;
  await notifyAdmin(
    `New affiliate application: ${fullName}`,
    [
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Mobile: ${phone || "-"}`,
      `Language: ${locale}`,
      "",
      "How they plan to promote:",
      promotionPlan || "-",
      "",
      `Review: ${adminUrl}`,
    ].join("\n")
  );

  return NextResponse.json({ id: data.id }, { status: 201 });
}
