/**
 * In-memory sliding-window rate limiter for the proxy/middleware and API
 * routes. State lives per server instance, so on a multi-region or
 * multi-instance deployment (e.g. Vercel's edge network) a client can get a
 * fresh bucket per instance rather than one true global limit. That's an
 * acceptable first line of defense for this site's traffic today; if abuse
 * becomes a real problem, swap this for a shared store (Upstash Redis's
 * free tier is the standard pairing for Vercel + Next.js middleware).
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function clientIp(request: Request): string {
  // `x-forwarded-for` is a comma-separated hop chain (`client, proxy1, ...`)
  // that each proxy *appends* to rather than replaces. The first entry is
  // whatever the original client sent and is trivially spoofable; the last
  // entry is the one our own trusted edge (Vercel) appended based on the
  // actual connection, so that's the only value safe to key the rate
  // limiter on. Taking the first entry here previously let a client bypass
  // the limiter entirely by rotating a fake IP on every request.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
