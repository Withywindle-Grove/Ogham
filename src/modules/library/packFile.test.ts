import { BRAND } from '../../brand.ts';
import { describe, expect, it } from 'vitest';
import { comparePacks, PLAYER_FACING, readPackJson, type PackEntry } from './packFile.ts';

// Invented content only (hard rule 2).
const pack = (extra: Record<string, unknown> = {}, formatVersion = 2) =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion,
    meta: { name: 'River Rules', version: '0.2', source: 'Invented for tests', kind: 'setting' },
    items: [
      { id: 'rope-50ft', name: 'Rope, 50 ft', weightCoin: 50, slots: 1 },
      { id: 'lantern', name: 'Lantern', weightCoin: 30, lightTypeId: 'lantern-light' },
    ],
    classes: [{ id: 'lantern-warden', name: 'Lantern Warden', xpTableId: 'warden-xp' }],
    xpTables: [{ id: 'warden-xp', levels: [{ level: 2, xp: 2000 }] }],
    statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', fields: { Move: '60 ft' } }],
    ...extra,
  });

describe('reading a pack file', () => {
  // Purpose: a pack's patches (of-13) import as entries of kind patch, named by what they do and numbered by their place,
  // with no "isn't a part" line; and players may read them (bq3-16).
  it("reads patches as entries of their own kind, named by what they do", () => {
    const read = readPackJson(
      pack({
        patches: [
          { byOption: 'metals=bronze', match: { kind: 'item', category: 'armour' }, change: { 'armour.ac': { delta: 1 } } },
          { id: 'no-shields', byOption: 'metals=stone', match: { kind: 'item', ids: ['reed-shield', 'bog-shield'] }, option: null },
        ],
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.pack.warnings.filter((w) => w.includes("isn't a part"))).toEqual([]);
    expect(read.pack.counts.patch).toBe(2);
    expect(read.pack.entries.filter((e) => e.kind === 'patch').map((e) => [e.packEntryId, e.name])).toEqual([
      // A patch's name is stored (the entry's name, the update event's list): its old form, " · " kept (#561).
      ['patch-1', 'metals=bronze · item armour'],
      ['no-shields', 'metals=stone · item reed-shield, bog-shield'],
    ]);
    expect(PLAYER_FACING).toContain('patch');
  });

  it('keeps what the file says about itself beyond the keys the app reads', () => {
    const read = readPackJson(pack({ meta: { name: 'River Rules', author: 'Priya', built: ['by hand'] } }));
    expect(read.ok && read.pack.meta.extra).toEqual({ author: 'Priya', built: ['by hand'] });
  });

  it("warns about a format version it doesn't know instead of quietly reading it as version 1", () => {
    const read = readPackJson(pack({}, 3));
    expect(read.ok && read.pack.warnings.some((w) => w.includes(`format version 3, which ${BRAND.appName} doesn't know`))).toBe(true);
    expect(read.ok && readPackJson(pack({}, 2)).ok && (readPackJson(pack({}, 2)) as { pack: { warnings: string[] } }).pack.warnings).toEqual([]);
  });

  it('reads the pack, its kind and every entry, and counts them by kind', () => {
    const read = readPackJson(pack());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.pack.meta).toMatchObject({ name: 'River Rules', version: '0.2', kind: 'setting', formatVersion: 2 });
    expect(read.pack.counts).toEqual({ item: 2, class: 1, xpTable: 1, statBlock: 1 });
    expect(read.pack.entries.find((e) => e.packEntryId === 'bog-lurker')).toMatchObject({
      kind: 'statBlock',
      name: 'Bog lurker',
      data: { id: 'bog-lurker', hp: '3d8' },
    });
    expect(read.pack.problems).toEqual([]);
    expect(read.pack.warnings).toEqual([]);
  });

  it('an entry without a name is named after its id, like an XP table', () => {
    const read = readPackJson(pack());
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.entries.find((e) => e.kind === 'xpTable')?.name).toBe('warden-xp');
  });

  it('a version-1 file using version-2 kinds is read anyway, with a warning', () => {
    const read = readPackJson(pack({ races: [{ id: 'marsh-folk', name: 'Marsh folk' }] }, 1));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.counts.race).toBe(1);
    expect(read.pack.warnings).toContain('The file says format version 1 but uses version-2 parts (races); it was read as version 2.');
  });

  it('an empty classMaxLevels is noted as "no class limits" (a conversion may lift them on purpose)', () => {
    const read = readPackJson(pack({ races: [{ id: 'marsh-folk', name: 'Marsh folk', classMaxLevels: {} }] }));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.warnings).toEqual(['races: "marsh-folk": classMaxLevels is empty, so this race has no class limits; every class is offered.']);
  });

  it('a table\'s "gmOnly": false is the flag that opens it to players (fs-1), not a mistaken list; any other non-list still warns', () => {
    const read = readPackJson(
      pack({
        tables: [
          { id: 'first-whispers', name: 'First whispers', die: 'd4', gmOnly: false, rows: [] },
          { id: 'bog-omens', name: 'Bog omens', die: 'd6', gmOnly: true, rows: [] },
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.warnings).toEqual(['tables: "Bog omens" has gmOnly that isn\'t a list, so nothing is hidden. Write it like ["cursed"].']);
    expect(read.pack.entries.find((e: PackEntry) => e.packEntryId === 'first-whispers')?.data.gmOnly).toBe(false);
  });

  it("a rules set's defaultRace names one of the pack's races, or the checker says so (ruled 2026-10-26)", () => {
    const races = [{ id: 'marsh-folk', name: 'Marsh folk' }];
    const ok = readPackJson(pack({ races, rulesSets: [{ id: 'river', name: 'River', defaultRace: 'marsh-folk' }] }));
    if (!ok.ok) throw new Error(ok.message);
    expect(ok.pack.warnings).toEqual([]);
    const unknown = readPackJson(pack({ races, rulesSets: [{ id: 'river', name: 'River', defaultRace: 'hill-folk' }] }));
    if (!unknown.ok) throw new Error(unknown.message);
    expect(unknown.pack.warnings).toEqual([`rulesSets: "river": defaultRace names "hill-folk", which isn't one of this pack's races. Another attached pack must supply it.`]);
    const notAnId = readPackJson(pack({ races, rulesSets: [{ id: 'river', name: 'River', defaultRace: 3 }] }));
    if (!notAnId.ok) throw new Error(notAnId.message);
    expect(notAnId.pack.warnings).toEqual([`rulesSets: "river": defaultRace should be a race's id, like "race-reedfolk".`]);
  });

  it("skips entries it can't use and says why, keeping the rest", () => {
    const read = readPackJson(
      pack({
        conditions: [
          { id: 'stunned', name: 'Stunned' },
          { id: 'stunned', name: 'Stunned again' },
          { id: 'Bad Id!', name: 'Shaken' },
          { name: 'No id' },
          'not an entry',
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.counts.condition).toBe(1);
    expect(read.pack.problems).toEqual([
      'conditions: "stunned" appears twice; the second was skipped.',
      'conditions: "Bad Id!" isn\'t a valid id (lowercase letters, digits and dashes); skipped.',
      'conditions: entry 4 has no id; skipped.',
      "conditions: entry 5 isn't an entry; skipped.",
    ]);
  });

  // unitName / pluralName (ruled 2026-10-26): words for toasts and the how-many prompt.
  it("warns when an item's unitName or pluralName isn't words, and accepts them when they are", () => {
    const read = readPackJson(pack({ items: [{ id: 'torch', name: 'Torch', unitName: 'torch', pluralName: 'torches' }, { id: 'reed', name: 'Reed', pluralName: 3 }] }));
    expect(read.ok && read.pack.warnings.filter((w) => w.includes("isn't words"))).toEqual([`items: "Reed" has a pluralName that isn't words, so the app says "Reed ×N" instead.`]);
  });

  it("warns when gmOnly names something that isn't one of the entry's own fields, since that hides nothing", () => {
    const read = readPackJson(
      pack({
        items: [
          { id: 'grumbling-blade', name: 'Grumbling blade', cursed: true, fields: { Curse: 'Hums' }, gmOnly: ['cursed', 'Curse', 'cursd'] },
          { id: 'odd-ring', name: 'Odd ring', gmOnly: 'cursed' },
          { id: 'rope', name: 'Rope', cursed: false, gmOnly: ['cursed'] },
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.warnings).toEqual([
      'items: "Grumbling blade" hides "Curse", which isn\'t one of its own fields, so nothing is hidden. Name a field of the entry itself, like "fields".',
      'items: "Grumbling blade" hides "cursd", which isn\'t one of its own fields, so nothing is hidden. Name a field of the entry itself, like "fields".',
      'items: "Odd ring" has gmOnly that isn\'t a list, so nothing is hidden. Write it like ["cursed"].',
    ]);
  });

  it('mentions parts it doesn\'t know instead of dropping them silently', () => {
    const read = readPackJson(pack({ dragons: [{ id: 'x' }] }));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.warnings).toContain(`"dragons" isn't a part ${BRAND.appName} knows; it was left out.`);
  });

  it("refuses files that aren't packs, in plain words", () => {
    expect(readPackJson('not json')).toEqual({ ok: false, message: "That file isn't valid JSON." });
    expect(readPackJson(JSON.stringify({ format: 'something-else' }))).toEqual({
      ok: false,
      message: 'That file isn\'t a setting-rules pack (its "format" should be "tabletop-pack").',
    });
    expect(readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 1 }))).toEqual({
      ok: false,
      message: 'The pack needs a name (meta.name).',
    });
    expect(readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 1, meta: { name: 'Empty' } }))).toEqual({
      ok: false,
      message: 'The pack has no entries to import.',
    });
  });
});

describe('comparing a newer file with what is in the library', () => {
  const entry = (kind: PackEntry['kind'], id: string, data: Record<string, unknown>): PackEntry => ({
    kind,
    packEntryId: id,
    name: String(data.name ?? id),
    data: { id, ...data },
  });

  it('the same entry with its details in a different order is unchanged (the database reorders them)', () => {
    const saved = [entry('item', 'rope-50ft', { slots: 1, name: 'Rope, 50 ft', value: { gp: 1, sp: 5 }, tags: ['a', 'b'] })];
    const fromFile = [entry('item', 'rope-50ft', { name: 'Rope, 50 ft', tags: ['a', 'b'], value: { sp: 5, gp: 1 }, slots: 1 })];
    expect(comparePacks(saved, fromFile)).toEqual({ added: [], changed: [], removed: [], unchanged: 1 });
    // A list in a different order is a real change.
    const reordered = [entry('item', 'rope-50ft', { name: 'Rope, 50 ft', tags: ['b', 'a'], value: { sp: 5, gp: 1 }, slots: 1 })];
    expect(comparePacks(saved, reordered).changed).toHaveLength(1);
  });

  it('lists what would be added, changed and removed, and leaves the same alone', () => {
    const before = [
      entry('item', 'rope-50ft', { name: 'Rope, 50 ft', slots: 1 }),
      entry('item', 'lantern', { name: 'Lantern' }),
      entry('condition', 'stunned', { name: 'Stunned' }),
    ];
    const after = [
      entry('item', 'rope-50ft', { name: 'Rope, 50 ft', slots: 2 }),
      entry('item', 'lantern', { name: 'Lantern' }),
      entry('class', 'reedblade', { name: 'Reedblade' }),
    ];
    expect(comparePacks(before, after)).toEqual({
      added: [{ kind: 'class', packEntryId: 'reedblade', name: 'Reedblade' }],
      changed: [{ kind: 'item', packEntryId: 'rope-50ft', name: 'Rope, 50 ft' }],
      removed: [{ kind: 'condition', packEntryId: 'stunned', name: 'Stunned' }],
      unchanged: 1,
    });
  });
});
