// Backs up the MAIN Supabase project before a migration is pushed to it: the structure and the data of our
// own tables, as two SQL files in backups/ (git-ignored, never committed). See docs/testing.md, Backups.
//
// How: the Supabase CLI (linked to the main project) writes a pg_dump script with short-lived connection
// details (`supabase db dump --dry-run`); we run that script with PostgreSQL's own pg_dump (the PostgreSQL 17
// command-line tools), so no Docker is needed and no password is typed. The script is never printed or saved.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';

const windows = process.platform === 'win32';
const PG_BIN = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const BASH = windows ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
if (windows && !existsSync(`${PG_BIN}\\pg_dump.exe`)) {
  console.error(`pg_dump not found in ${PG_BIN}. Install the PostgreSQL 17 command-line tools first (docs/testing.md, Backups).`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
mkdirSync('backups', { recursive: true });

for (const [label, flags] of [
  ['structure', []],
  ['data', ['--data-only', '--use-copy']],
]) {
  // Our own fixed flags only, so running it as one command line is safe.
  const script = execSync(`npx supabase db dump --linked --dry-run ${flags.join(' ')}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  // The CLI abbreviates --quote-all-identifiers, which Windows' pg_dump doesn't accept.
  const runnable = script.replaceAll('--quote-all-identifier ', '--quote-all-identifiers ');
  const dump = spawnSync(BASH, ['-s'], {
    input: runnable,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, PATH: windows ? `${PG_BIN};${process.env.PATH}` : process.env.PATH },
  });
  const file = `backups/main-${stamp}-${label}.sql`;
  if (dump.status !== 0 || !dump.stdout) {
    console.error(`The ${label} backup failed: ${(dump.stderr || 'no output').split('\n').slice(-3).join(' ').trim()}`);
    process.exit(1);
  }
  writeFileSync(file, dump.stdout);
  console.log(`Saved ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
}
