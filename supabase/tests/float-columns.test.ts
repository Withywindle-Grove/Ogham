// Check 6 (hard rule 8, spec docs/specs/hard-rule-and-size-checks.md): no database column holds a decimal or a float.
// Money, quantities, weights and slots are integers; the generated database types can't show this (every number is
// `number` there), so the test reads the database's own information schema.
//
// The Supabase client can't read the information schema or make a table, so the SQL goes through the Supabase CLI
// (a dev dependency already): `--local` against the throwaway local Supabase in CI, or `--db-url` with
// SUPABASE_TEST_DB_URL (.env.test) against the test project. Never the main project.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KNOWN_FLOAT_COLUMNS } from './float-columns.known.ts';
import { runSql } from './sqlQuery.mjs';
import { MAIN_PROJECT_REF } from './testProject.ts';

const MIGRATIONS = Object.values(import.meta.glob<string>('../migrations/*.sql', { query: '?raw', import: 'default', eager: true }));
// `numeric`, `real` and `double precision`, and arrays of them; a column on a domain over one of them reports the
// domain's base type here too.
const FLOAT_TYPES = ['numeric', 'float4', 'float8', '_numeric', '_float4', '_float8'];
// An invented table the planted case makes and drops; also dropped before and after the file, in case a run stopped
// half-way and left it behind on the shared test project.
const PLANTED = 'public.planted_float_check';

/** Where the CLI connects: the test project's database when its address is set, else the local Supabase. */
function target(): string[] {
  const dbUrl = (import.meta.env.SUPABASE_TEST_DB_URL as string | undefined)?.trim() ?? '';
  if (dbUrl.includes(MAIN_PROJECT_REF)) throw new Error('SUPABASE_TEST_DB_URL points at the main project. Use the test project.');
  if (dbUrl) return ['--db-url', dbUrl];
  const apiUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(apiUrl)) return ['--local'];
  throw new Error('The float check needs SUPABASE_TEST_DB_URL in .env.test (see docs/testing.md), or a local Supabase.');
}

/** Runs one SQL statement (the CLI takes one at a time) and returns what it prints. */
const run = (sql: string): string => runSql(target(), sql);

/** Runs one select and returns its rows. */
const query = <Row>(sql: string): Row[] => JSON.parse(run(sql)) as Row[];

/** Every schema the app's migrations create, plus `public`, where most of the app's tables live. */
function appSchemas(): string[] {
  const schemas = new Set(['public']);
  for (const sql of MIGRATIONS) {
    for (const match of sql.matchAll(/create\s+schema\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
      if (match[1]) schemas.add(match[1].toLowerCase());
    }
  }
  return [...schemas].sort();
}

/** Each column of a table or view in these schemas with a decimal or float type, as `schema.table.column`. */
function floatColumns(schemas: string[]): string[] {
  const list = (values: string[]) => values.map((value) => `'${value}'`).join(', ');
  const rows = query<{ name: string }>(
    `select table_schema || '.' || table_name || '.' || column_name as name from information_schema.columns ` +
      `where table_schema in (${list(schemas)}) and udt_name in (${list(FLOAT_TYPES)}) order by 1`,
  );
  return rows.map((row) => row.name);
}

const dropPlanted = () => run(`drop table if exists ${PLANTED}`);

beforeAll(dropPlanted, 60_000);
afterAll(dropPlanted, 60_000);

describe('check 6: no decimal or float column (hard rule 8)', () => {
  it('reads public and every schema the migrations create', () => {
    // So a schema added later is scanned without anyone remembering to add it here.
    expect(appSchemas()).toEqual(expect.arrayContaining(['public', 'private']));
  });

  it('a planted table with a decimal column is reported', () => {
    // The check sees a break when there is one: an invented table, made and dropped inside this test.
    run(`create table ${PLANTED} (id integer, weight numeric, share real, ratio double precision)`);
    try {
      expect(floatColumns(appSchemas()).filter((name) => name.startsWith(`${PLANTED}.`))).toEqual([
        `${PLANTED}.ratio`,
        `${PLANTED}.share`,
        `${PLANTED}.weight`,
      ]);
    } finally {
      dropPlanted();
    }
  });

  it('the real database has no decimal or float column beyond the known list, and every known one still exists', () => {
    // A new column fails here; so does a known entry that was fixed but left on the list (the list only shrinks).
    const found = floatColumns(appSchemas());
    const known = KNOWN_FLOAT_COLUMNS.map((entry) => entry.column);
    expect({ notKnown: found.filter((name) => !known.includes(name)), noLongerThere: known.filter((name) => !found.includes(name)) }).toEqual({
      notKnown: [],
      noLongerThere: [],
    });
  });

  it('every known column says why', () => {
    for (const entry of KNOWN_FLOAT_COLUMNS) expect([entry.column, entry.reason.trim().length > 0]).toEqual([entry.column, true]);
  });
});
