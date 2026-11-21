// The creation options table against the private packs (M5b step 0c, second test, PR F; ct-10). Local only: the packs
// are never committed (hard rule 2), so where packs/ is missing (GitHub) this is skipped, as allClasses.test.ts is.
// This file holds no game content: the option ids come from docs/plans/m5b-0c-creation-options.md.
//   Every option the table lists is an option of one of the newest private packs: a renamed or dropped option shows
//   here, so the table (and the on/off tests it points at) never goes stale silently.
import { describe, expect, it } from 'vitest';
import table from '../../docs/plans/m5b-0c-creation-options.md?raw';
import { readPackJson } from '../modules/library/packFile.ts';
import { newestPerPack } from '../testing/realPacks.ts';

const files = import.meta.glob<string>('../../packs/*/*.pack.json', { query: '?raw', import: 'default', eager: true });
const candidates = import.meta.glob<string>('../../packs/*/build/*candidate-*.pack.json', { query: '?raw', import: 'default', eager: true });
const optionIds = new Set(
  newestPerPack(candidates, files).flatMap(({ raw }) => {
    const read = readPackJson(raw);
    return read.ok ? read.pack.entries.filter((e) => e.kind === 'option').map((e) => e.packEntryId) : [];
  }),
);

const listed = table
  .split('\n')
  .filter((line) => /^\| O\d+ \|/.test(line))
  .map((line) => {
    const cells = line.split('|').map((c) => c.trim());
    return { row: cells[1]!, option: /`([^`]+)`/.exec(cells[3]!)?.[1] ?? '' };
  });

describe.skipIf(optionIds.size === 0)('the creation options table names real options (private packs)', () => {
  it('the table has rows', () => {
    expect(listed.length).toBeGreaterThan(0);
  });

  for (const { row, option } of listed) {
    it(`${row}: its option is in the packs`, () => {
      expect(optionIds.has(option)).toBe(true);
    });
  }
});
