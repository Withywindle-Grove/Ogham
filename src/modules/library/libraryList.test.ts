// The Rules library list's pure parts (lr-1, lr-2; 2026-11-02) and Export as a pack file (lr-3). Invented packs only.
import { describe, expect, it } from 'vitest';
import { packFile } from './exportPack.ts';
import { findPacks, groupByKind, holdsLine, needsLine, packWords, requiredIds, sortPacks, usedBy, wordPair } from './libraryList.ts';

const pack = (name: string, kind: 'setting' | 'adventure' | 'homebrew', importedAt = '2026-10-20', description = '') => ({ name, kind, importedAt, description });

describe('grouping, sorting and finding', () => {
  it('groups by kind in the order Setting rules, Adventures, Homebrew, leaving out kinds with none', () => {
    const groups = groupByKind([pack('Brew', 'homebrew'), pack('Fen', 'setting'), pack('Moss', 'homebrew')]);
    expect(groups.map((g) => [g.title, g.items.map((p) => p.name)])).toEqual([
      ['Setting rules', ['Fen']],
      ['Homebrew', ['Brew', 'Moss']],
    ]);
  });

  it('sorts by name with case aside, or by last updated with the newest first (ties by name)', () => {
    const list = [pack('marsh', 'setting', '2026-10-01'), pack('Ash', 'setting', '2026-10-03'), pack('bog', 'setting', '2026-10-03')];
    expect(sortPacks(list, 'name').map((p) => p.name)).toEqual(['Ash', 'bog', 'marsh']);
    expect(sortPacks(list, 'updated').map((p) => p.name)).toEqual(['Ash', 'bog', 'marsh']);
    expect(sortPacks([pack('Old', 'setting', '2026-01-01'), pack('New', 'setting', '2026-11-01')], 'updated').map((p) => p.name)).toEqual(['New', 'Old']);
  });

  it('finds by every typed word in the name or the description, case aside; nothing typed finds all', () => {
    const list = [pack('Fen Rules', 'setting', '', 'Marsh and reed.'), pack('Bog Tales', 'adventure')];
    expect(findPacks(list, 'REED fen').map((p) => p.name)).toEqual(['Fen Rules']);
    expect(findPacks(list, '  ')).toHaveLength(2);
    expect(findPacks(list, 'lurker')).toEqual([]);
  });
});

describe('the pack row lines', () => {
  it("makes the pack's singular word into one and many", () => {
    expect(wordPair('Kindred')).toEqual(['kindred', 'kindreds']);
    expect(wordPair('Ancestry')).toEqual(['ancestry', 'ancestries']);
    expect(wordPair('Calling')).toEqual(['calling', 'callings']);
    expect(wordPair('Lineage ')).toEqual(['lineage', 'lineages']);
    expect(wordPair('Path')).toEqual(['path', 'paths']);
    expect(wordPair('Box')).toEqual(['box', 'boxes']);
    expect(wordPair('XP')).toEqual(['XP', 'XPs']);
  });

  it("takes the pack's words for races and classes from its creation guide's step titles, and nothing else", () => {
    expect(packWords({ race: { title: 'Kindred', why: '…' }, class: 'Choose a calling.', spells: { title: 'First glamours' } })).toEqual({ race: ['kindred', 'kindreds'] });
    expect(packWords(null)).toEqual({});
  });

  it("says what a pack holds in the app's order, one or many, in the pack's words where it has them", () => {
    expect(holdsLine({ item: 999, race: 1, class: 2 })).toBe('2 classes, 1 race, 999 items');
    expect(holdsLine({ race: 8, class: 1 }, { race: ['kindred', 'kindreds'] })).toBe('1 class, 8 kindreds');
    expect(holdsLine({ race: 1 }, { race: ['kindred', 'kindreds'] })).toBe('1 kindred');
    expect(holdsLine({ class: 0 })).toBe('');
    // lr-2a (2026-11-13): a rules set is counted too, after the other counts.
    expect(holdsLine({ rulesSet: 1, table: 2 })).toBe('2 tables, 1 rules set');
  });

  // Purpose (lr-2a): every kind is counted, the rules sets last in the pack's words for the rest; '' only for an empty pack.
  it('counts rules sets after the other counts, one or many; nothing only when the pack holds nothing', () => {
    expect(holdsLine({ rulesSet: 1 })).toBe('1 rules set');
    expect(holdsLine({ rulesSet: 2, race: 8, xpTable: 1, class: 1 }, { race: ['kindred', 'kindreds'] })).toBe('1 class, 8 kindreds, 1 XP table, 2 rules sets');
    expect(holdsLine({ rulesSet: 0 })).toBe('');
    expect(holdsLine({})).toBe('');
  });

  it('reads what a pack needs from meta.requires and names it by the library, or by its id when missing', () => {
    expect(requiredIds([{ packId: 'fen-rules', minVersion: '1.0' }, 'moss-rules', { minVersion: '2' }])).toEqual(['fen-rules', 'moss-rules']);
    expect(requiredIds(undefined)).toEqual([]);
    expect(needsLine(['fen-rules', 'moss-rules'], new Map([['fen-rules', 'Fen Rules, Advanced']]))).toBe('Needs: Fen Rules, Advanced, moss-rules.');
    expect(needsLine([], new Map())).toBe('');
  });

  it('says who uses it: the first campaign and how many more, or nobody', () => {
    expect(usedBy(['Ash Hollow', 'Fenmoor', 'Reedmouth'])).toEqual({ first: 'Ash Hollow', more: 2 });
    expect(usedBy([])).toBeNull();
  });
});

describe('Export as a pack file', () => {
  it("writes the pack's own details back (its id, description, needs) with its entries by part", () => {
    const { fileName, file } = packFile(
      { name: 'Fen Rules', version: '0.6', kind: 'setting', source: 'Our table', extra: { id: 'fen-rules', description: 'Fen things.', requires: [{ packId: 'base' }] } },
      [{ kind: 'item', packEntryId: 'rope', name: 'Rope', data: { weightCoin: 5 } }, { kind: 'race', packEntryId: 'marsh-folk', name: 'Marsh folk', data: {} }],
    );
    expect(fileName).toBe('fen-rules.pack.json');
    expect(file).toEqual({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { id: 'fen-rules', description: 'Fen things.', requires: [{ packId: 'base' }], name: 'Fen Rules', kind: 'setting', version: '0.6', source: 'Our table' },
      items: [{ weightCoin: 5, id: 'rope', name: 'Rope' }],
      races: [{ id: 'marsh-folk', name: 'Marsh folk' }],
    });
  });

  it('a pack with no id takes one from its name, as the homebrew export always did', () => {
    expect(packFile({ name: 'Marsh Homebrew!', version: '', kind: 'homebrew' }, []).fileName).toBe('marsh-homebrew.pack.json');
    expect(packFile({ name: '!!', version: '', kind: 'homebrew' }, []).file).toMatchObject({ meta: { id: 'homebrew', version: '1' } });
  });
});
