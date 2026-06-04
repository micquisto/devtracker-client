import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = getRequiredEnvVar(
  "VITE_SUPABASE_URL",
  import.meta.env.VITE_SUPABASE_URL,
);

const supabaseAnonKey = getRequiredEnvVar(
  "VITE_SUPABASE_ANON_KEY",
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppSupabaseClient = SupabaseClient;
