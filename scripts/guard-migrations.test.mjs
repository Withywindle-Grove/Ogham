// Tests for the Claude Code hook that locks applied migrations (scripts/guard-migrations.mjs).
import { describe, expect, it } from 'vitest';
import { decide, migrationName } from './guard-migrations.mjs';

const applied = new Set(['20261020000000_first.sql']);
const isOnMain = (name) => applied.has(name);
const edit = (file_path) => ({ tool_name: 'Edit', tool_input: { file_path } });

describe('the applied-migration lock', () => {
  it('finds the migration name in Windows and Unix paths', () => {
    expect(migrationName('C:\\repo\\supabase\\migrations\\20261020000000_first.sql')).toBe('20261020000000_first.sql');
    expect(migrationName('/repo/supabase/migrations/20261020000000_first.sql')).toBe('20261020000000_first.sql');
    expect(migrationName('/repo/supabase/tests/a.test.ts')).toBeNull();
  });

  it('blocks an edit to a migration that is already on main, and says to write a new one', () => {
    const message = decide(edit('/repo/supabase/migrations/20261020000000_first.sql'), isOnMain);
    expect(message).toMatch(/already on main/);
    expect(message).toMatch(/new migration/);
  });

  it('lets a brand-new migration be written', () => {
    expect(decide(edit('/repo/supabase/migrations/20261099000000_new.sql'), isOnMain)).toBeNull();
  });

  it('lets edits to any other file through', () => {
    expect(decide(edit('/repo/src/core/commands.ts'), isOnMain)).toBeNull();
    expect(decide({}, isOnMain)).toBeNull();
  });
});
