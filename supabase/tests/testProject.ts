// Connection to the TEST project (grimoire-test) for access-rule tests, or, in CI, to a throwaway local
// Supabase started inside the runner (http://127.0.0.1:<port>). Refuses to run against the main project,
// so tests never touch real data.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const MAIN_PROJECT_REF = 'nplkqwzjdprpgpklatji';

export interface TestProject {
  url: string;
  publishableKey: string;
  secretKey: string;
}

export function readTestProject(env: Record<string, string | undefined> = import.meta.env): TestProject {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() ?? '';
  const missing = [
    ['VITE_SUPABASE_URL', url],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', publishableKey],
    ['SUPABASE_SECRET_KEY', secretKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Test project settings missing: ${missing.join(', ')}. Fill in .env.test (see docs/testing.md).`);
  }
  const hosted = /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url);
  const local = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url);
  if (!hosted && !local) {
    throw new Error('VITE_SUPABASE_URL in .env.test should be just https://<ref>.supabase.co, with nothing after it.');
  }
  if (url.includes(MAIN_PROJECT_REF)) {
    throw new Error('VITE_SUPABASE_URL in .env.test points at the main project. Use the test project.');
  }
  return { url, publishableKey, secretKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Signed-out visitor: what the app sees before anyone signs in. */
export function visitorClient(project: TestProject): SupabaseClient {
  return createClient(project.url, project.publishableKey, noSession);
}

/** Full access, for setting up and cleaning test data only. Never used by the app. */
export function adminClient(project: TestProject): SupabaseClient {
  return createClient(project.url, project.secretKey, noSession);
}
