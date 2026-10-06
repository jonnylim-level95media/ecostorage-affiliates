"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

// Injected from our own (nonce-trusted) bundle, which 'strict-dynamic' in the
// CSP allows; challenges.cloudflare.com is also allowed in frame-src.
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile bot check. Calls `onToken` with a single-use token, or
 * null when it expires/errors. Change `resetKey` to get a fresh token after
 * one has been spent (e.g. a failed sign-in).
 */
export function Turnstile({
  onToken,
  resetKey = 0,
  locale = "en",
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
  locale?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    callback.current(null);

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "dark",
          language: locale === "zh-Hans" ? "zh-cn" : "en",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey, locale]);

  return <div ref={container} className="min-h-[65px]" />;
}
