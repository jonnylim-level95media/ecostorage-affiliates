import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Rate-limits the API and login, refreshes the Supabase auth cookie, and
 * bounces signed-out users away from /affiliate and /admin. This is an
 * optimistic check only — role enforcement lives in requireAdmin() /
 * requireAffiliate() and in RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);

  if (pathname.startsWith("/api/")) {
    const { allowed } = checkRateLimit(`api:${ip}:${pathname}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }
    return NextResponse.next({ request });
  }

  if (pathname === "/login" && request.method === "POST") {
    const { allowed } = checkRateLimit(`login:${ip}`, 10, 5 * 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = pathname.startsWith("/affiliate") || pathname.startsWith("/admin");
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/affiliate/:path*", "/admin/:path*", "/login", "/api/:path*"],
};
