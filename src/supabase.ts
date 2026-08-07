import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const hasUsablePublishableKey =
  publishableKey.startsWith("sb_publishable_") && publishableKey !== "sb_publishable_replace_me";

export const supabaseConfig = {
  projectUrl: url,
  projectRef: "fkhzqekrzuoatqhkzarx",
  configured: url.startsWith("https://") && hasUsablePublishableKey,
} as const;

export const supabase: SupabaseClient | null = supabaseConfig.configured
  ? createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: "micro-fkhzqekrzuoatqhkzarx-auth",
      },
    })
  : null;

// Sensitive password checks should not replace or persist the primary app
// session. This client lives only for the duration of that single operation.
export function createEphemeralSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfig.configured) return null;
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
