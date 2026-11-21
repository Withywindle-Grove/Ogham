// Reads the app's settings from .env (locally) or Vercel's environment
// variables (deployed). Only checks they are present; nothing connects yet.

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type EnvCheck = { ok: true; env: AppEnv } | { ok: false; missing: string[] };

type RawEnv = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY', string>>;

export function checkEnv(raw: RawEnv = import.meta.env): EnvCheck {
  const supabaseUrl = raw.VITE_SUPABASE_URL?.trim() ?? '';
  const supabasePublishableKey = raw.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, env: { supabaseUrl, supabasePublishableKey } };
}
