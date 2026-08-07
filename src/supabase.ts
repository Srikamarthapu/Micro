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
