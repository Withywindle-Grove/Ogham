// Experience at a higher starting level (cs-13, plan dec-10 X1), pure. Every name and number is invented.
//   Level 1 starts with 0 experience, as before cs-13, even where the table gives level 1 a figure; level 0 or a
//   negative level reads as level 1.
//   Level 2 or higher starts with the class's own threshold for that level.
//   A class without an XP table, or a level its table doesn't reach, starts with 0: nothing is invented.
//   The table (ruled by the lead on #691): the class's own pack's, else the nearest pack's below it in the stack,
//   never a pack's above it, never the stack's winner; none of those carries it: no table, 0.
//   Twin classes of the same name in two attached packs, each pack with an XP table of the same id but of different
//   lengths: each class reads its own pack's table, whichever pack wins the stack.
//   Two tracks (the `classes` list holds one entry per class): each class gets its own minimum from its own table.
//   The table is read as the campaign plays it: another pack's patch, its own byOption, and an option switching it off.
import { describe, expect, it } from 'vitest';
import { settingFrom } from '../../app/campaignSetting.ts';
import type { CampaignEntry, CampaignPack } from '../library/campaignPacks.ts';
import type { EntryKind } from '../library/packFile.ts';
import { classLevelTable, classXpTable, startingXp } from './startingXp.ts';

const table = (...xp: number[]) => ({ levels: xp.map((figure, n) => ({ level: n + 1, xp: figure })) });

function link(packId: string, priority: number): CampaignPack {
  return { id: `link-${packId}`, campaignId: 'c-1', packId, name: packId, shortName: packId, version: '0.1', kind: 'setting', optionChoices: {}, priority, overrides: {}, campaignHomebrew: false };
}
const entry = (packId: string, kind: EntryKind, packEntryId: string, data: Record<string, unknown>): CampaignEntry => ({ packId, kind, packEntryId, name: String(data.name ?? packEntryId), data: { id: packEntryId, ...data } });

describe('startingXp', () => {
  // Purpose: a character made at level 1 starts with 0 experience, as before cs-13.
  it('level 1 starts with 0, even when the table gives level 1 a figure', () => {
    expect(startingXp(1, table(0, 1800, 3600))).toBe(0);
    expect(startingXp(1, { levels: [{ level: 1, xp: 50 }] })).toBe(0);
  });

  // Purpose: a level of 0 or below reads as level 1: 0 experience, never a figure from the table.
  it('level 0 and a negative level read as level 1: 0', () => {
    expect(startingXp(0, { levels: [{ level: 0, xp: 70 }, { level: 2, xp: 1800 }] })).toBe(0);
    expect(startingXp(-2, { levels: [{ level: -2, xp: 70 }] })).toBe(0);
  });

  // Purpose: a character made at level 2 or 3 starts with its class's threshold for that level.
  it('level 2 starts with the level-2 threshold; level 3 with the level-3 one', () => {
    expect(startingXp(2, table(0, 1800, 3600))).toBe(1800);
    expect(startingXp(3, table(0, 1800, 3600))).toBe(3600);
  });

  // Purpose: without a table, or past its last row, no experience is invented.
  it('no table, or a level the table does not reach, starts with 0', () => {
    expect(startingXp(2, null)).toBe(0);
    expect(startingXp(2, {})).toBe(0);
    expect(startingXp(4, table(0, 1800, 3600))).toBe(0);
    expect(startingXp(2, { levels: [{ level: 2, xp: 'lots' }] })).toBe(0);
  });
});

describe('classXpTable', () => {
  // Two packs, each with a Lamp Keeper and an XP table `keeper-xp`; the Mire zine's is longer and sits on top.
  const packs = [link('fen-book', 1), link('mire-zine', 2)];
  const entries = [
    entry('fen-book', 'class', 'lamp-keeper', { name: 'Lamp Keeper', xpTableId: 'keeper-xp' }),
    entry('fen-book', 'xpTable', 'keeper-xp', table(0, 1500, 3000)),
    entry('mire-zine', 'class', 'lamp-keeper-mire', { name: 'Lamp Keeper', xpTableId: 'keeper-xp' }),
    entry('mire-zine', 'xpTable', 'keeper-xp', table(0, 2200, 4400, 8800)),
    // The zine's singer leans on the book's table below it; the book's hermit names a table only the zine (above) has.
    entry('mire-zine', 'class', 'reed-singer', { name: 'Reed Singer', xpTableId: 'singer-xp' }),
    entry('fen-book', 'xpTable', 'singer-xp', table(0, 1250)),
    entry('fen-book', 'class', 'bog-hermit', { name: 'Bog Hermit', xpTableId: 'hermit-xp' }),
    entry('mire-zine', 'xpTable', 'hermit-xp', table(0, 900)),
    entry('fen-book', 'class', 'moss-friar', { name: 'Moss Friar', xpTableId: 'friar-xp' }),
    entry('fen-book', 'class', 'peat-monk', { name: 'Peat Monk' }),
  ];
  const setting = settingFrom(packs, entries, {});
  const klass = (id: string) => setting.all.find((e) => e.kind === 'class' && e.packEntryId === id)!;
  const minimum = (id: string, level: number) => startingXp(level, classXpTable(klass(id), setting.xpTables ?? [], setting.packs));

  // Purpose: the stacked setting keeps only the top pack's `keeper-xp`; the book's twin still reads its own.
  it('twin classes of the same name read their own pack’s table of the same id, not the stack’s winner', () => {
    expect(setting.all.filter((e) => e.kind === 'xpTable' && e.packEntryId === 'keeper-xp').map((e) => e.packId)).toEqual(['mire-zine']);
    expect(minimum('lamp-keeper', 2)).toBe(1500);
    expect(minimum('lamp-keeper-mire', 2)).toBe(2200);
    // The tables' lengths differ: level 4 is only in the zine's.
    expect(minimum('lamp-keeper', 4)).toBe(0);
    expect(minimum('lamp-keeper-mire', 4)).toBe(8800);
  });

  // Purpose (cs-16, dec-10 C; #756's review): in the class's entry each twin's level table shows its own pack's
  // experience, the book's three levels and the zine's four, never the stack's winner.
  it('twin classes of the same name each show their own Experience column in their entry', () => {
    const levels = (id: string) => classLevelTable(klass(id).data, classXpTable(klass(id), setting.xpTables ?? [], setting.packs))?.rows;
    expect(levels('lamp-keeper')).toEqual([['1', '0'], ['2', '1,500'], ['3', '3,000']]);
    expect(levels('lamp-keeper-mire')).toEqual([['1', '0'], ['2', '2,200'], ['3', '4,400'], ['4', '8,800']]);
  });

  // Purpose: with more than one class entry (the `classes` list's shape), each gets its own minimum from its own table.
  it('two tracks: each class gets its own minimum at the same level', () => {
    expect([minimum('lamp-keeper', 3), minimum('lamp-keeper-mire', 3)]).toEqual([3000, 4400]);
  });

  // Purpose: a class whose own pack lacks its table reads the pack below it.
  it('a class whose own pack has no table of its id reads the pack’s below it', () => {
    expect(minimum('reed-singer', 2)).toBe(1250);
  });

  // Purpose: a pack above the class's own never supplies its table, even when it is the only one that has it.
  it('a pack above the class’s own is never read: no table, 0', () => {
    expect(classXpTable(klass('bog-hermit'), setting.xpTables ?? [], setting.packs)).toBeNull();
    expect(minimum('bog-hermit', 2)).toBe(0);
  });

  // Purpose: a table no pack at or below the class's carries, or no table id at all, is no table.
  it('no pack carries it, or the class names none: no table, 0', () => {
    expect(classXpTable(klass('moss-friar'), setting.xpTables ?? [], setting.packs)).toBeNull();
    expect(minimum('moss-friar', 3)).toBe(0);
    expect(classXpTable(klass('peat-monk'), setting.xpTables ?? [], setting.packs)).toBeNull();
    expect(minimum('peat-monk', 3)).toBe(0);
    expect(classXpTable(null, [], [])).toBeNull();
  });

  // Purpose: below means the stack's order, nearest first, and every homebrew pack sits above the rest whatever its priority.
  it('the nearest pack below wins, and a homebrew class leans on the setting packs under it', () => {
    const brew: CampaignPack = { ...link('my-brew', 0), kind: 'homebrew' };
    const three = [link('fen-book', 1), link('mire-zine', 2), brew];
    const stacked = settingFrom(three, [
      entry('my-brew', 'class', 'lamp-keeper-brew', { name: 'Lamp Keeper', xpTableId: 'keeper-xp' }),
      entry('fen-book', 'xpTable', 'keeper-xp', table(0, 1500)),
      entry('mire-zine', 'xpTable', 'keeper-xp', table(0, 2200)),
    ], {});
    const brewKeeper = stacked.all.find((e) => e.packEntryId === 'lamp-keeper-brew')!;
    expect(startingXp(2, classXpTable(brewKeeper, stacked.xpTables ?? [], stacked.packs))).toBe(2200);
  });
});

describe('classXpTable: the table as the campaign plays it', () => {
  // The zine (on top) has an option, the ink, and a patch that rewrites the book's `keeper-xp` under red ink.
  const ink = (choice: string) => [link('fen-book', 1), { ...link('mire-zine', 2), optionChoices: { 'mire-ink': choice } }];
  const entries = [
    entry('mire-zine', 'option', 'mire-ink', { name: 'Ink', default: 'black', choices: [{ id: 'black', name: 'Black' }, { id: 'red', name: 'Red' }] }),
    entry('mire-zine', 'patch', 'red-ledgers', { byOption: 'mire-ink=red', match: { kind: 'xpTable', ids: ['keeper-xp'] }, change: { levels: table(0, 1700, 3400).levels } }),
    entry('fen-book', 'class', 'lamp-keeper', { name: 'Lamp Keeper', xpTableId: 'keeper-xp' }),
    entry('fen-book', 'xpTable', 'keeper-xp', table(0, 1500, 3000)),
    entry('mire-zine', 'class', 'gloam-scribe', { name: 'Gloam Scribe', xpTableId: 'scribe-xp' }),
    // The zine's scribe table: its own byOption under red ink, and a second copy that only exists under red ink.
    entry('mire-zine', 'xpTable', 'scribe-xp', { ...table(0, 1100), byOption: { 'mire-ink=red': { levels: table(0, 1300).levels } } }),
    entry('mire-zine', 'class', 'wick-reader', { name: 'Wick Reader', xpTableId: 'reader-xp' }),
    entry('mire-zine', 'xpTable', 'reader-xp', { ...table(0, 2600), option: 'mire-ink=red' }),
    entry('fen-book', 'xpTable', 'reader-xp', table(0, 1900)),
  ];
  const minimum = (choice: string, id: string, level = 2) => {
    const setting = settingFrom(ink(choice), entries, {});
    const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === id)!;
    return startingXp(level, classXpTable(klass, setting.xpTables ?? [], setting.packs));
  };

  // Purpose: another attached pack's patch changes the class's own table, as it changes every other entry.
  it('a patch from another pack is applied to the class’s own table', () => {
    expect(minimum('black', 'lamp-keeper')).toBe(1500);
    expect(minimum('red', 'lamp-keeper')).toBe(1700);
    expect(minimum('red', 'lamp-keeper', 3)).toBe(3400);
  });

  // Purpose: the table's own byOption is read for the campaign's choice.
  it('the table’s own byOption follows the campaign’s choice', () => {
    expect(minimum('black', 'gloam-scribe')).toBe(1100);
    expect(minimum('red', 'gloam-scribe')).toBe(1300);
  });

  // Purpose: a copy an option switches off is not carried, so the pack below's copy is read.
  it('a table switched off by an option is not carried: the pack below’s is read', () => {
    expect(minimum('red', 'wick-reader')).toBe(2600);
    expect(minimum('black', 'wick-reader')).toBe(1900);
  });
});

describe("a class's level table in its entry (dec-10 C, cs-16)", () => {
  // Purpose: the class's entry shows its level table whole from the class's own data: each level its title (where the
  // class has titles; none past the last), its experience from the class's own table (level 1 is 0), and its hit dice
  // from its progression; a class with no titles has no Title column; nothing is invented, and with nothing to show,
  // no table.
  const xp = { levels: [{ level: 2, xp: 1500 }, { level: 3, xp: 3500 }, { level: 4, xp: 7000 }] };
  const klass = {
    progression: [
      { level: 1, hitDice: '1d8' },
      { level: 2, hitDice: '2d8' },
      { level: 3, hitDice: '3d8' },
      { level: 4, hitDice: '3d8+2' },
    ],
    levelTitles: ['Lamp-bearer', 'Wick-trimmer'],
  };
  it('titles, experience and hit dice by level; empty title cells past the last', () => {
    expect(classLevelTable(klass, xp)).toEqual({
      head: ['Level', 'Title', 'Experience', 'Hit dice'],
      rows: [
        ['1', 'Lamp-bearer', '0', '1d8'],
        ['2', 'Wick-trimmer', '1,500', '2d8'],
        ['3', '', '3,500', '3d8'],
        ['4', '', '7,000', '3d8+2'],
      ],
    });
  });
  it('no titles: no Title column; a level missing a figure is left empty; nothing at all: no table', () => {
    expect(classLevelTable({ progression: [{ level: 1, hitDice: '1d4' }, { level: 3, hitDice: '3d4' }] }, xp)).toEqual({
      head: ['Level', 'Experience', 'Hit dice'],
      rows: [
        ['1', '0', '1d4'],
        ['2', '1,500', ''],
        ['3', '3,500', '3d4'],
        ['4', '7,000', ''],
      ],
    });
    expect(classLevelTable({}, null)).toBeNull();
  });
  it('a level between two titled ones carries the earlier title, as the sheet does; past the last, empty', () => {
    // Purpose: the entry and the sheet agree on a level's title (#756's review): a gap carries the title before it.
    expect(classLevelTable({ levelTitles: [{ level: 1, title: 'Reed-reader' }, { level: 3, title: 'Witch' }] }, xp)!.rows).toEqual([
      ['1', 'Reed-reader', '0'],
      ['2', 'Reed-reader', '1,500'],
      ['3', 'Witch', '3,500'],
      ['4', '', '7,000'],
    ]);
  });

  it('titles given by level are read at their level', () => {
    expect(classLevelTable({ levelTitles: [{ level: 1, title: 'Reed-reader' }, { level: 3, title: 'Witch' }] }, null)!.rows).toEqual([
      ['1', 'Reed-reader'],
      ['3', 'Witch'],
    ]);
  });
});
