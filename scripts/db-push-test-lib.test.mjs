// db:push:test and the migrations other pull requests left on TEST (ruled 2026-11-11, db-1; docs/plans/process-db-1.md).
// Purposes:
//   1. A version TEST holds that this branch doesn't is found, so it gets a stand-in and the push can go on.
//   2. Versions both sides hold, and this branch's own new ones, are never stood in for (they're real or still to apply).
//   3. If the list can't be read (no Local | Remote table), the script stops instead of pushing blind.
//   4. A stand-in is an empty, commented SQL file named for its version, so it counts as applied and runs nothing.
//   5. A table whose first columns aren't exactly Local and Remote (a changed CLI) stops the script.
//   6. A version said to be TEST's alone that this branch has is a misreading: the script stops.
//   7. The push always passes --include-all; with something held it runs from the copy.
import { describe, expect, it } from 'vitest';
import { checkHeldAgainstLocal, pushArgs, remoteOnlyVersions, stubFile } from './db-push-test-lib.mjs';

// The shape `supabase migration list` prints (CLI 2.x), with invented versions.
const LIST = [
  'Connecting to remote database...',
  '',
  '  ',
  '   Local          | Remote         | Time (UTC)          ',
  '  ----------------|----------------|---------------------',
  '   20261019170000 | 20261019170000 | 2026-10-19 17:00:00 ',
  '                  | 20261105120000 | 2026-11-05 12:00:00 ',
  '   20261108090000 | 20261108090000 | 2026-11-08 09:00:00 ',
  '                  | 20261110153000 | 2026-11-10 15:30:00 ',
  '   20261111100000 |                | 2026-11-11 10:00:00 ',
  '',
].join('\n');

describe('db:push:test with migrations from other pull requests on TEST', () => {
  it('finds each version TEST holds that this branch does not', () => {
    expect(remoteOnlyVersions(LIST)).toEqual(['20261105120000', '20261110153000']);
  });

  it('never stands in for a shared version or for one of this branch\'s own new ones', () => {
    const held = remoteOnlyVersions(LIST);
    expect(held).not.toContain('20261019170000');
    expect(held).not.toContain('20261111100000');
  });

  it('finds nothing to stand in for when TEST holds only what this branch has', () => {
    const inStep = LIST.split('\n').filter((line) => !line.startsWith('                  |')).join('\n');
    expect(remoteOnlyVersions(inStep)).toEqual([]);
  });

  it('stops when the list has no Local | Remote table, instead of pushing blind', () => {
    expect(() => remoteOnlyVersions('Connecting to remote database...\nsomething else\n')).toThrow(/could not read the migration list/);
  });

  it('writes a stand-in as an empty, commented file named for its version', () => {
    const stub = stubFile('20261110153000');
    expect(stub.name).toBe('20261110153000_held_on_test.sql');
    expect(stub.text.split('\n').filter((line) => line.trim() && !line.startsWith('--'))).toEqual([]);
  });

  it('stops when the columns are not exactly Local then Remote', () => {
    const swapped = LIST.replace('   Local          | Remote         |', '   Remote         | Local          |');
    expect(() => remoteOnlyVersions(swapped)).toThrow(/could not read the migration list/);
  });

  it("stops when a version said to be TEST's alone is one of this branch's own files", () => {
    expect(() => checkHeldAgainstLocal(['20261111100000'], ['20261111100000_fm1_group_log_audience.sql'])).toThrow(/stopped rather than guess/);
    expect(() => checkHeldAgainstLocal(['20261105120000'], ['20261111100000_fm1_group_log_audience.sql'])).not.toThrow();
  });

  it('pushes from the copy with --include-all when something is held', () => {
    expect(pushArgs('postgres://x', ['20261105120000'], 'C:/tmp/grimoire-push-test-1')).toEqual(['db', 'push', '--db-url', 'postgres://x', '--include-all', '--workdir', 'C:/tmp/grimoire-push-test-1']);
  });
  // Purpose (database session 2, 2026-11-12): with nothing held on TEST, a migration stamped older than TEST's newest still
  // goes on: the plain push refused it ("Found local migration files to be inserted before the last migration").
  it('passes --include-all even with nothing held', () => {
    expect(pushArgs('postgres://x', [], '')).toEqual(['db', 'push', '--db-url', 'postgres://x', '--include-all']);
  });
  // Purpose (database session 4, 2026-11-12): outside an interactive terminal the CLI prints the list as JSON
  // ({"migrations":[{"local","remote","time"}]}); the versions TEST holds alone are read from it the same way.
  it('reads the list when the CLI prints it as JSON', () => {
    const json = ['Initialising login role...', 'Connecting to remote database...', JSON.stringify({ migrations: [
      { local: '20261105120000', remote: '20261105120000', time: '2026-11-05 12:00:00' },
      { local: '', remote: '20261105130000', time: '2026-11-05 13:00:00' },
      { local: '20261105140000', remote: '', time: '2026-11-05 14:00:00' },
    ], message: 'Migrations listed' })].join('\n');
    expect(remoteOnlyVersions(json)).toEqual(['20261105130000']);
  });
});
