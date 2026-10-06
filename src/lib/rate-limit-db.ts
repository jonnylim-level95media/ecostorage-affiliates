import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared (cross-instance) rate limit backed by Postgres. Use for sensitive
 * endpoints; the in-memory limiter in rate-limit.ts only sees one instance.
 * Fails closed: if the check itself errors, the request is refused.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key.slice(0, 300),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}
