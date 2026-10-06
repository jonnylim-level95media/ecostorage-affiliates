import "server-only";
import { Resend } from "resend";

/**
 * Email via Resend. Until RESEND_API_KEY and EMAIL_FROM are set (pending a
 * verified domain), sends are skipped and reported as `{ sent: false }` so
 * callers can carry on and surface it, rather than failing the request.
 */

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type SendResult = { sent: true; id: string | null } | { sent: false; reason: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, reason: "email not configured" };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, text });
    if (error) return { sent: false, reason: error.message };
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}

/** Best-effort note to the admin inbox; never throws. */
export async function notifyAdmin(subject: string, text: string) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return { sent: false, reason: "ADMIN_NOTIFY_EMAIL not set" } as const;
  return sendEmail(to, subject, text);
}
