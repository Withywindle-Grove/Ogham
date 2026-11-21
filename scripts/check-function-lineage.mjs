// Function-lineage check (rvw-7). Part of `npm run check`.
// A migration that (re)defines the log, Undo or pack-import function must say which earlier
// migration's version it was built on, and that must be the NEWEST earlier version. Otherwise two
// pull requests can copy the same old definition and the later one silently drops the other's change.
// Marker, one line per watched function in the migration:
//   -- builds on: private.undo_body from 20261110120000_some_migration.sql
// Reads only the files on disk: no git, no network.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WATCHED = ['private.undo_body', 'private.log_change', 'public.import_pack', 'public.undo_request'];

// Migrations up to and including this one are grandfathered (they are applied and never edited).
export const CUTOFF = '20261115170000_dec13_c8_pins.sql';

// The functions a migration file defines (create function / create or replace function), comments ignored.
export function definedWatched(sql) {
  const code = sql.replace(/--[^\n]*/g, '');
  return WATCHED.filter((name) => {
    const [schema, fn] = name.split('.');
    const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+"?${schema}"?\\s*\\.\\s*"?${fn}"?\\s*\\(`, 'i');
    return re.test(code);
  });
}

// files: [{ name, sql }]. Returns a list of plain-language problems (empty = fine).
export function checkLineage(files, cutoff = CUTOFF) {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const newest = new Map(); // function -> file name of the newest definition so far
  const problems = [];
  for (const file of sorted) {
    const defined = definedWatched(file.sql);
    for (const fn of defined) {
      const previous = newest.get(fn);
      if (file.name > cutoff && previous) {
        const re = new RegExp(`^[ \\t]*--[ \\t]*builds on:[ \\t]*${fn.replace('.', '\\.')}[ \\t]+from[ \\t]+(\\S+)`, 'im');
        const named = file.sql.match(re)?.[1];
        if (named !== previous) {
          problems.push(
            `${file.name} rewrites ${fn} but ${named ? `builds on ${named}` : 'has no "-- builds on:" marker for it'}; ` +
              `the newest version is in ${previous}. Rebuild it on ${previous}'s version and ` +
              `${named ? 'update the marker' : `add the line "-- builds on: ${fn} from ${previous}"`}.`,
          );
        }
      }
      newest.set(fn, file.name);
    }
  }
  return problems;
}

export function readMigrations(dir) {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = checkLineage(readMigrations(join(here, '..', 'supabase', 'migrations')));
  if (problems.length) {
    console.error('Function-lineage check failed (rvw-7):\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Function-lineage check: ok');
}
