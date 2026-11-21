// The settings check and the database connection, created once. Kept apart from the command registry (services.ts)
// so the sign-in screen can open without loading every module's commands (perf report 2026-11-06, fix 1).
import { checkEnv } from '../core/env.ts';
import { createDb, type Db } from '../core/supabase.ts';

const envCheck = checkEnv();

/** Names of missing settings (empty when everything is set). */
export const missingSettings: string[] = envCheck.ok ? [] : envCheck.missing;

export const db: Db | null = envCheck.ok ? createDb(envCheck.env) : null;
