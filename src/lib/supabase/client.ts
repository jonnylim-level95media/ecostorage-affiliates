import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client for Client Components ("use client"). Runs as the signed-in
 * user, so RLS applies — affiliates can only read what their policies allow.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
