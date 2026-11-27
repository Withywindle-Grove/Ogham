// Runs one SQL statement through the Supabase CLI (a dev dependency), for the database tests that need SQL the
// Supabase client can't send (float-columns.test.ts). Plain JavaScript because the tests' TypeScript has no Node types.
// Run with Node directly, so no shell touches the connection string (as scripts/db-push-test.mjs does).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI = resolve('node_modules/supabase/dist/supabase.js');

/** @param {string[]} target `['--local']` or `['--db-url', url]` @param {string} sql one statement @returns {string} */
export function runSql(target, sql) {
  const done = spawnSync(process.execPath, [CLI, 'db', 'query', '--agent', 'no', '-o', 'json', ...target, sql], { encoding: 'utf8' });
  if (done.status !== 0) throw new Error(`The database query failed: ${done.stderr || done.stdout || done.error?.message || `the Supabase CLI ended with no message (status ${done.status})`}`);
  return done.stdout;
}
