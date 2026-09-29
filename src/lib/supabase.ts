import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for document storage.
 *
 * The app works fully without Supabase (documents open via URL), so the
 * client is only created when both env vars are present. Vite exposes env
 * vars prefixed with VITE_ to client code.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false },
    })
  : null;

/** Storage bucket where ficha PDFs are kept. */
export const FICHAS_BUCKET = "fichas";
