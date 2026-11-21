// Tests for the function-lineage check (scripts/check-function-lineage.mjs, rvw-7).
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLineage, readMigrations } from './check-function-lineage.mjs';

const CUT = '20260101000000_cutoff.sql';
const OLD = '20250101000000_old.sql';
const def = (fn) => `create or replace function ${fn}(a int) returns int as $$ select 1 $$ language sql;\n`;
const f = (name, sql) => ({ name, sql });

describe('the function-lineage check', () => {
  it('passes when the new migration names the newest earlier version of the function', () => {
    const files = [f(OLD, def('private.undo_body')), f('20260201000000_new.sql', '-- builds on: private.undo_body from ' + OLD + '\n' + def('private.undo_body'))];
    expect(checkLineage(files, CUT)).toEqual([]);
  });

  it('fails, and says what to add, when the marker is missing', () => {
    const files = [f(OLD, def('private.log_change')), f('20260201000000_new.sql', def('private.log_change'))];
    const [msg] = checkLineage(files, CUT);
    expect(msg).toMatch(/20260201000000_new\.sql rewrites private\.log_change/);
    expect(msg).toContain(`newest version is in ${OLD}`);
  });

  it('fails when two pull requests copied the same old version (the marker names an older file)', () => {
    const mid = '20250601000000_mid.sql';
    const files = [
      f(OLD, def('public.import_pack')),
      f(mid, '-- builds on: public.import_pack from ' + OLD + '\n' + def('public.import_pack')),
      f('20260201000000_late.sql', '-- builds on: public.import_pack from ' + OLD + '\n' + def('public.import_pack')),
    ];
    const [msg] = checkLineage(files, CUT);
    expect(msg).toContain(`builds on ${OLD}`);
    expect(msg).toContain(`newest version is in ${mid}`);
  });

  it('needs a marker for each watched function when a migration defines two', () => {
    const both = def('private.undo_body') + def('public.undo_request');
    const files = [f(OLD, both), f('20260201000000_new.sql', '-- builds on: private.undo_body from ' + OLD + '\n' + both)];
    const problems = checkLineage(files, CUT);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('public.undo_request');
  });

  it('ignores files at or before the cutoff', () => {
    const files = [f(OLD, def('private.undo_body')), f(CUT, def('private.undo_body')), f('20250201000000_x.sql', def('private.undo_body'))];
    expect(checkLineage(files, CUT)).toEqual([]);
  });

  it('needs nothing for a function that is not watched, or a near-miss name', () => {
    const files = [f(OLD, def('public.other_fn') + def('public.undo_request_said')), f('20260201000000_new.sql', def('public.other_fn') + def('public.undo_request_said'))];
    expect(checkLineage(files, CUT)).toEqual([]);
  });

  it('the real migrations pass', () => {
    const dir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'supabase', 'migrations');
    expect(checkLineage(readMigrations(dir))).toEqual([]);
  });
});
