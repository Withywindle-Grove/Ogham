// Database access-rule tests (`npm run test:db`): locally against the shared TEST project, with settings from
// .env.test; on GitHub against a throwaway local Supabase, with settings from environment variables (which
// win over .env.test). Never the main project. See docs/testing.md.
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';

const KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'] as const;

export default defineConfig(() => {
  const all = loadEnv('test', '.', '');
  const env = Object.fromEntries(KEYS.map((key) => [key, all[key] ?? '']));
  return {
    test: {
      include: ['supabase/tests/**/*.test.ts'],
      env,
      // One test file at a time: they share one database.
      fileParallelism: false,
      // Each test talks to a server over the internet; allow for a slow moment on the free tier.
      testTimeout: 20_000,
    },
  };
});
