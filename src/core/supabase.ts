// The app's connection to Supabase. Only commands use it; screens never touch the database directly.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './databaseWithNulls.ts';
import type { AppEnv } from './env.ts';

export type Db = SupabaseClient<Database>;

export function createDb(env: AppEnv): Db {
  return createClient<Database>(env.supabaseUrl, env.supabasePublishableKey);
}
