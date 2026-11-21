// Applies supabase/migrations to the TEST project (grimoire-test), never the main one.
// Reads SUPABASE_TEST_DB_URL from .env.test. Run with `npm run db:push:test`.
//
// TEST is shared: it can already hold migrations from other open pull requests that this branch doesn't have
// (ruled 2026-11-11, db-1, docs/design/rulings/m5b-morning-rulings-2026-11-11.md; plan docs/plans/process-db-1.md).
// A plain `supabase db push` refuses then ("Remote migration versions not found in local migrations directory").
// So the script first reads TEST's list, and pushes from a temporary copy of supabase/ that holds an empty stand-in
// file for each version TEST has and this branch doesn't. Those count as applied; this branch's own unapplied
// migrations go on top (--include-all, because they can be older than another branch's). TEST's history table is
// never rewritten (no `migration repair`): the other pull requests rely on it. The pure parts are in
// db-push-test-lib.mjs (tested there).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkHeldAgainstLocal, pushArgs, remoteOnlyVersions, stubFile } from './db-push-test-lib.mjs';

const MAIN_PROJECT_REF = 'nplkqwzjdprpgpklatji';
const CLI = 'node_modules/supabase/dist/supabase.js';

/** Runs the CLI with Node directly, so no shell touches the connection string. */
function cli(args, options = {}) {
  return spawnSync(process.execPath, [resolve(CLI), ...args], options);
}

function fail(message) {
  console.error(`db:push:test stopped: ${message}`);
  process.exit(1);
}

try {
  process.loadEnvFile('.env.test');
} catch {
  fail('.env.test not found. Copy .env.test.example to .env.test and fill it in (see docs/testing.md).');
}

const dbUrl = process.env.SUPABASE_TEST_DB_URL?.trim();
if (!dbUrl) fail('SUPABASE_TEST_DB_URL is empty in .env.test.');
if (dbUrl.includes(MAIN_PROJECT_REF)) fail('SUPABASE_TEST_DB_URL points at the main project. Use the test project.');

const list = cli(['migration', 'list', '--db-url', dbUrl], { encoding: 'utf8' });
if (list.status !== 0) {
  process.stderr.write(list.stderr ?? '');
  fail("could not read the test project's migration list.");
}
let held;
try {
  held = remoteOnlyVersions(list.stdout ?? '');
  checkHeldAgainstLocal(held, readdirSync('supabase/migrations'));
} catch (error) {
  fail(error.message);
}

if (held.length === 0) {
  const result = cli(pushArgs(dbUrl, held, ''), { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

console.log(`The test project holds ${held.length} migration(s) from other pull requests; they stay as they are:`);
for (const version of held) console.log(`  ${version}`);

const work = mkdtempSync(join(tmpdir(), 'grimoire-push-test-'));
// Ctrl-C at the CLI's prompt goes to the CLI, which stops; this script then cleans up the copy below.
process.on('SIGINT', () => {});
let status = 1;
try {
  const supabase = join(work, 'supabase');
  cpSync('supabase/migrations', join(supabase, 'migrations'), { recursive: true });
  cpSync('supabase/config.toml', join(supabase, 'config.toml'));
  for (const version of held) {
    const stub = stubFile(version);
    writeFileSync(join(supabase, 'migrations', stub.name), stub.text);
  }
  const result = cli(pushArgs(dbUrl, held, work), { stdio: 'inherit' });
  status = result.status ?? 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
