import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed server-to-server requests between the main EcoStorage site and this
 * app (applications, leads, promo validation).
 *
 *   X-Eco-Timestamp: <unix seconds>
 *   X-Eco-Signature: v1=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
 *
 * The timestamp is inside the signed payload, so it can't be swapped for a
 * fresh one. Requests older (or further in the future) than 5 minutes are
 * rejected. During a secret rotation, set AFFILIATE_WEBHOOK_SECRET_PREVIOUS
 * to the old value so both are accepted until the main site is updated.
 *
 * The main site needs an identical `signRequest` — keep the two in sync
 * (spec also in docs/main-site-integration.md).
 */

export const TIMESTAMP_HEADER = "x-eco-timestamp";
export const SIGNATURE_HEADER = "x-eco-signature";
export const MAX_SKEW_SECONDS = 5 * 60;

function hmac(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signRequest(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const ts = String(timestamp);
  return {
    [TIMESTAMP_HEADER]: ts,
    [SIGNATURE_HEADER]: `v1=${hmac(secret, ts, rawBody)}`,
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyRequest(rawBody: string, headers: Headers, now = Date.now()): VerifyResult {
  const secrets = [process.env.AFFILIATE_WEBHOOK_SECRET, process.env.AFFILIATE_WEBHOOK_SECRET_PREVIOUS].filter(
    (s): s is string => Boolean(s && s.length >= 32)
  );
  if (!secrets.length) return { ok: false, reason: "signing secret not configured" };

  const timestamp = headers.get(TIMESTAMP_HEADER) ?? "";
  const signature = headers.get(SIGNATURE_HEADER) ?? "";

  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "missing or malformed timestamp" };
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale timestamp" };

  const match = /^v1=([0-9a-f]{64})$/.exec(signature);
  if (!match) return { ok: false, reason: "missing or malformed signature" };
  const given = Buffer.from(match[1], "hex");

  for (const secret of secrets) {
    const expected = Buffer.from(hmac(secret, timestamp, rawBody), "hex");
    if (timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "signature mismatch" };
}

/** Reads the raw body with a size cap, before any parsing (the HMAC covers raw bytes). */
export async function readRawBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const body = await request.text();
  return Buffer.byteLength(body) > maxBytes ? null : body;
}
