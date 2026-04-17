import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.DEV && typeof window !== 'undefined')
  ? `${window.location.origin}/supabase-api`
  : import.meta.env.VITE_SUPABASE_URL;

export const REAL_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;


const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables! Check your .env file.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sb-qjkvvbuububgqgljsyjb-auth-token",
    },
  }
);

// Expose supabase globally for console access
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
