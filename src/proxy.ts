import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

const SERVER_TO_SERVER_PREFIXES = ["/api/applications", "/api/webhooks/", "/api/promo/"];

/**
 * Per-request Content-Security-Policy with a fresh nonce. Next.js reads the
 * nonce from the request's CSP header and applies it to its own scripts;
 * 'strict-dynamic' then lets those scripts load others (e.g. Turnstile).
 * Inline styles are allowed because Turnstile and React style props need
 * them; scripts are the injection risk and those stay nonce-only.
 */
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl}${dev ? " ws: wss:" : ""}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Rate-limits the API, sets the CSP, refreshes the Supabase auth cookie, and
 * bounces signed-out users away from protected areas. This is an optimistic
 * check only — role and 2FA enforcement live in requireAdmin() /
 * requireAffiliate() and in RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Signed server-to-server routes all arrive from the main site's server
    // IP, so a per-IP limit there would throttle every visitor together.
    // They're signature-gated and limit per end user internally; this higher
    // ceiling just stops a runaway caller.
    const serverToServer = SERVER_TO_SERVER_PREFIXES.some((p) => pathname.startsWith(p));
    const { allowed } = checkRateLimit(`api:${clientIp(request)}:${pathname}`, serverToServer ? 300 : 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const next = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  let response = next();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = ["/affiliate", "/admin", "/mfa", "/auth/set-password"].some((p) => pathname.startsWith(p));
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
