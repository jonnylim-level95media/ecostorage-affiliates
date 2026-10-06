"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Landing page for Supabase's default invite / password-reset emails. Their
 * link goes through Supabase's verify endpoint, which redirects here with
 * either `?code=` (resets started in this browser, PKCE) or tokens in the
 * URL fragment (admin-sent invites/links). Either way we create the cookie
 * session, strip the tokens from the address bar, and continue to set a
 * password. Destinations are fixed; nothing in the URL chooses them.
 */
export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    // Remove tokens from the URL and browser history straight away.
    window.history.replaceState(null, "", url.pathname);

    const supabase = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
      isSingleton: false,
      auth: { detectSessionInUrl: false },
    });

    (async () => {
      const code = url.searchParams.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      let ok = false;
      if (!fragment.get("error") && !url.searchParams.get("error")) {
        if (code) {
          ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
        } else if (accessToken && refreshToken) {
          ok = !(await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })).error;
        }
      }

      if (ok) window.location.replace("/auth/set-password");
      else setFailed(true);
    })();
  }, []);

  if (failed) {
    window.location.replace("/login?error=link");
    return null;
  }
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted">…</p>
    </main>
  );
}
