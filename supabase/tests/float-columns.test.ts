// Check 6 (hard rule 8, spec docs/specs/hard-rule-and-size-checks.md): no database column holds a decimal or a float.
// Money, quantities, weights and slots are integers; the generated database types can't show this (every number is
// `number` there), so the test reads the database's own catalogue. What it says about what it found is
// floatProblems (floatProblems.ts, its cases in floatProblems.test.ts).
//
// The Supabase client can't read the catalogue or make a table, so the SQL goes through the Supabase CLI (a dev
// dependency already): `--local` when the other database tests use the local Supabase (CI), or `--db-url` with
// SUPABASE_TEST_DB_URL (.env.test) when they use the test project, and only if that address is the same project's.
// Never the main project.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KNOWN_FLOAT_COLUMNS } from './float-columns.known.ts';
import { floatProblems, type FoundFloatColumn } from './floatProblems.ts';
import { runSql } from './sqlQuery.mjs';
import { MAIN_PROJECT_REF } from './testProject.ts';

const MIGRATIONS = Object.values(import.meta.glob<string>('../migrations/*.sql', { query: '?raw', import: 'default', eager: true }));
// The base types that break hard rule 8: `numeric` (with or without a scale), `real` and `double precision`. A column
// on a domain over one of them, or an array of one (or of such a domain), is resolved down to it.
const FLOAT_TYPES = ['numeric', 'float4', 'float8'];
// The invented table (and domain) the planted case makes and drops, in `private` (out of the API, and it proves the
// second schema is read). A random suffix, so two runs at once on the shared test project never drop each other's.
const PLANTED_PREFIX = 'planted_float_check_';
const suffix = Math.random().toString(36).slice(2, 10);
const PLANTED = `private.${PLANTED_PREFIX}${suffix}`;
const PLANTED_DOMAIN = `private.planted_float_amount_${suffix}`;

/** Where the CLI connects: the same database the other database tests use. */
function target(): string[] {
  const apiUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(apiUrl)) return ['--local'];
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl)?.[1];
  if (!ref) throw new Error('The float check needs VITE_SUPABASE_URL in .env.test: the test project, or a local Supabase (see docs/testing.md).');
  if (ref === MAIN_PROJECT_REF) throw new Error('VITE_SUPABASE_URL points at the main project. Use the test project.');
  const dbUrl = (import.meta.env.SUPABASE_TEST_DB_URL as string | undefined)?.trim() ?? '';
  if (!dbUrl) throw new Error('The float check needs SUPABASE_TEST_DB_URL in .env.test, the test project\'s database address (see docs/testing.md).');
  if (dbUrl.includes(MAIN_PROJECT_REF)) throw new Error('SUPABASE_TEST_DB_URL points at the main project. Use the test project.');
  if (!dbUrl.includes(ref)) throw new Error('SUPABASE_TEST_DB_URL is not the database of the project in VITE_SUPABASE_URL: give the same project\'s.');
  return ['--db-url', dbUrl];
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

/**
 * Each column of a table, partitioned table, view, materialized view or foreign table in these schemas whose type is,
 * or resolves to, a decimal or float, with its type as declared. Read from the catalogue (pg_attribute), which shows
 * every column whatever the role may see, following domains to their base type and arrays to their element.
 */
function floatColumns(schemas: string[]): FoundFloatColumn[] {
  const list = (values: string[]) => values.map((value) => `'${value}'`).join(', ');
  return query<FoundFloatColumn>(
    'with recursive cols as (' +
      "select n.nspname || '.' || c.relname || '.' || a.attname as col, format_type(a.atttypid, a.atttypmod) as declared, a.atttypid as start " +
      'from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace ' +
      `where n.nspname in (${list(schemas)}) and c.relkind in ('r', 'p', 'v', 'm', 'f') and a.attnum > 0 and not a.attisdropped` +
      '), resolved(col, declared, type_oid, depth) as (' +
      'select col, declared, start, 0 from cols ' +
      'union all ' +
      "select r.col, r.declared, case when t.typtype = 'd' then t.typbasetype else t.typelem end, r.depth + 1 " +
      'from resolved r join pg_type t on t.oid = r.type_oid ' +
      "where (t.typtype = 'd' or (t.typcategory = 'A' and t.typelem <> 0)) and r.depth < 10" +
      ') ' +
      'select distinct r.col as "column", r.declared as "type" from resolved r join pg_type t on t.oid = r.type_oid ' +
      `where t.typname in (${list(FLOAT_TYPES)}) order by 1`,
  );
}

const dropPlanted = () => {
  run(`drop table if exists ${PLANTED}`);
  run(`drop domain if exists ${PLANTED_DOMAIN}`);
};

beforeAll(dropPlanted, 60_000);
afterAll(dropPlanted, 60_000);

describe('check 6: no decimal or float column (hard rule 8)', () => {
  // Purpose: a schema added later is scanned without anyone remembering to add it here.
  it('reads public and every schema the migrations create', () => {
    expect(appSchemas()).toEqual(expect.arrayContaining(['public', 'private']));
  });

  // Purpose: the check sees a break when there is one, in the second schema too, through a domain and an array: an
  // invented table, made and dropped inside this test, fails with a message that names the rule and the fix.
  it('a planted table with decimal and float columns is reported, with the rule and the fix', () => {
    run(`create domain ${PLANTED_DOMAIN} as numeric`);
    run(`create table ${PLANTED} (id integer, weight numeric(8, 2), share real, ratio double precision, shares real[], amounts ${PLANTED_DOMAIN}[], name text)`);
    try {
      const planted = floatColumns(appSchemas()).filter((found) => found.column.startsWith(`${PLANTED}.`));
      expect(planted.map((found) => found.column)).toEqual(['amounts', 'ratio', 'share', 'shares', 'weight'].map((name) => `${PLANTED}.${name}`));
      expect(floatProblems(planted, [])).toContain(
        `${PLANTED}.weight is numeric(8,2); store whole numbers in an integer column (hard rule 8), or add it to supabase/tests/float-columns.known.ts with its reason`,
      );
    } finally {
      dropPlanted();
    }
  });

  // Purpose: the real database matches the known list: no decimal or float column beyond it, and every listed one
  // still exists (the list only shrinks). Another run's planted table, on the shared test project, is not counted.
  it('the real database has no decimal or float column beyond the known list, and every known one still exists', () => {
    const found = floatColumns(appSchemas()).filter((entry) => !entry.column.startsWith(`private.${PLANTED_PREFIX}`));
    expect(floatProblems(found, KNOWN_FLOAT_COLUMNS)).toEqual([]);
  });

  // Purpose: every known column says why it is let through.
  it('every known column says why', () => {
    for (const entry of KNOWN_FLOAT_COLUMNS) expect([entry.column, entry.reason.trim().length > 0]).toEqual([entry.column, true]);
  });
});
