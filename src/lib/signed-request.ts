import "server-only";
import { NextResponse } from "next/server";
import { readRawBody, verifyRequest } from "@/lib/signing";

/** Shared input handling for the signed server-to-server routes. */

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * Reads, size-limits, signature-checks and parses a signed JSON request.
 * Returns the body object, or a ready-to-return error response.
 */
export async function readSignedJson(
  request: Request,
  maxBytes: number
): Promise<{ body: Record<string, unknown> } | { response: NextResponse }> {
  const raw = await readRawBody(request, maxBytes);
  if (raw === null) return { response: jsonError("Request too large", 413) };
  if (!verifyRequest(raw, request.headers).ok) return { response: jsonError("Invalid signature", 401) };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { response: jsonError("Invalid JSON") };
  }
}

/** Trimmed string, or "" if missing / not a string. Over-long input is kept long so callers can reject it. */
export function str(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE = /^[+\d\s()-]{6,32}$/;

/** Referral codes: 8 chars, no look-alike letters. Normalises case and spaces. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/\s/g, "").toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}

/** ISO timestamp → Date, or null if missing/invalid. */
export function isoDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
