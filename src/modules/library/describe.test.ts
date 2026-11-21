// Describing an entry in plain words for the setting-rules browser. Invented content only.
import { describe, expect, it } from 'vitest';
import { BOOKKEEPING_KEYS, STAT_BLOCK_BEHAVIOUR_KEYS, describeEntry, hasFormula, sourceLine } from './describe.ts';
import type { PackEntry } from './packFile.ts';
import { layOutStatBlock } from './statBlockLayout.ts';

const names: Record<string, string> = { 'lantern-warden': 'Lantern Warden', 'warden-xp': 'Warden XP', torch: 'Torch', glimmer: 'Glimmer' };
const nameOf = (id: string) => names[id];
const entry = (kind: PackEntry['kind'], data: Record<string, unknown>): PackEntry => ({
  kind,
  packEntryId: String(data.id),
  name: String(data.name ?? data.id),
  data,
});

describe('describing an entry', () => {
  it('a class reads as plain labelled lines, with ids shown as names and notes kept apart', () => {
    const described = describeEntry(
      entry('class', { id: 'lantern-warden', name: 'Lantern Warden', xpTableId: 'warden-xp', hitDie: 'd8', fields: { 'Prime stat': 'WIS' }, notes: 'Keeps the lamps lit.' }),
      nameOf,
    );
    expect(described.notes).toEqual(['Keeps the lamps lit.']);
    expect(described.lines).toEqual([
      { label: 'XP table', value: 'Warden XP' },
      { label: 'Hit die', value: 'd8' },
      { label: 'Prime stat', value: 'WIS' },
    ]);
  });

  it('an item shows its value as money, leaves out empty parts, and says yes or no', () => {
    const described = describeEntry(
      entry('item', { id: 'rope', name: 'Rope', category: 'gear', weightCoin: 50, value: { gp: 1 }, container: null, lightTypeId: null, notes: '', cursed: false }),
      nameOf,
    );
    expect(described.notes).toEqual([]);
    expect(described.lines).toEqual([
      { label: 'Category', value: 'gear' },
      { label: 'Weight (coins)', value: '50' },
      { label: 'Value', value: '1 gp' },
      { label: 'Cursed', value: 'No' },
    ]);
  });

  // Purpose: a stat block's details list its abilities by name and its free-form fields as written; its tags print no
  // row (of-7, 2026-11-20).
  it('a stat block lists its abilities by name, and its free-form fields as they were written', () => {
    const described = describeEntry(
      entry('statBlock', { id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', fields: { AC: '6', Move: '60 ft' }, abilities: [{ name: 'Still water', note: 'Hides well.' }], tags: ['swamp', 'river'] }),
      nameOf,
    );
    expect(described.lines).toEqual([
      { label: 'Hit points', value: '3d8' },
      { label: 'AC', value: '6' },
      { label: 'Move', value: '60 ft' },
      { label: 'Abilities', lines: [{ label: 'Still water', value: 'Hides well.' }] },
    ]);
  });

  it('formulas and durations read as text (working them out comes later)', () => {
    const described = describeEntry(
      entry('spell', { id: 'glimmer', name: 'Glimmer', lists: { 'lantern-warden': 1 }, range: '30 ft', duration: { formula: '2 + level', unit: 'turn' } }),
      nameOf,
    );
    expect(described.lines).toEqual([
      { label: 'Lists', value: 'Lantern Warden 1' },
      { label: 'Range', value: '30 ft' },
      { label: 'Duration', value: '2 + level turns' },
    ]);
    expect(describeEntry(entry('lightType', { id: 'torch', name: 'Torch', duration: 6, unit: 'turn' }), nameOf).lines[0]).toEqual({ label: 'Duration', value: '6' });
    expect(describeEntry(entry('spell', { id: 'x', duration: { value: 1, unit: 'round' } }), nameOf).lines).toEqual([{ label: 'Duration', value: '1 round' }]);
  });

  it('lists of rows get readable labels: by level, by range, or by chance', () => {
    expect(describeEntry(entry('xpTable', { id: 'warden-xp', levels: [{ level: 2, xp: 2000 }] }), nameOf).lines).toEqual([
      { label: 'Levels', lines: [{ label: 'Level 2', value: 'XP 2000' }] },
    ]);
    expect(describeEntry(entry('table', { id: 't', die: 'd6', rows: [{ min: 1, max: 2, result: 'Surprised' }, { min: 3, max: 3, result: 'Calm' }] }), nameOf).lines).toEqual([
      { label: 'Die', value: 'd6' },
      { label: 'Rows', lines: [{ label: '1–2', value: 'Surprised' }, { label: '3', value: 'Calm' }] },
    ]);
    expect(describeEntry(entry('treasureType', { id: 'tt', entries: [{ chance: 40, amount: '2d6 coins' }] }), nameOf).lines).toEqual([
      { label: 'Entries', lines: [{ label: '40%', value: '2d6 coins' }] },
    ]);
  });

  it('players don’t see the fields marked GM-only; the GM sees which they are', () => {
    const cursed = entry('item', { id: 'ring', name: 'Ring', category: 'ring', cursed: true, gmOnly: ['cursed'], fields: { Glow: 'faint' } });
    expect(describeEntry(cursed, nameOf).lines).toEqual([
      { label: 'Category', value: 'ring' },
      { label: 'Glow', value: 'faint' },
    ]);
    expect(describeEntry(cursed, nameOf, { gm: true }).lines).toEqual([
      { label: 'Category', value: 'ring' },
      { label: 'Cursed', value: 'Yes' },
      { label: 'Hidden from players', value: 'Cursed' },
      { label: 'Glow', value: 'faint' },
    ]);
  });

  it('a row with a level and a note reads as a sentence', () => {
    const described = describeEntry(entry('class', { id: 'c', abilities: [{ name: 'Lamp lore', fromLevel: 3, notes: 'Knows how long a flame burns.' }] }), nameOf);
    expect(described.lines).toEqual([{ label: 'Abilities', lines: [{ label: 'Lamp lore', value: 'From level 3. Knows how long a flame burns.' }] }]);
  });

  it('at a level, formulas show their worked value beside them; without one, just the formula', () => {
    const glimmer = entry('spell', { id: 'glimmer', duration: { formula: '2 + level', unit: 'turn' }, damage: { formula: 'level d6' }, bonus: { formula: 'level / 2' } });
    expect(describeEntry(glimmer, nameOf, { level: 3 }).lines).toEqual([
      { label: 'Duration', value: '2 + level turns → 5 turns' },
      { label: 'Damage', value: 'level d6 → 3d6' },
      { label: 'Bonus', value: 'level / 2 → 1 (rounded down)' },
    ]);
    expect(describeEntry(entry('spell', { id: 'x', duration: { formula: 'level - 2', unit: 'round' } }), nameOf, { level: 3 }).lines).toEqual([
      { label: 'Duration', value: 'level - 2 rounds → 1 round' },
    ]);
    expect(describeEntry(entry('spell', { id: 'x', duration: { formula: 'level + strength', unit: 'turn' } }), nameOf, { level: 3 }).lines).toEqual([
      { label: 'Duration', value: 'level + strength turns' },
    ]);
  });

  it('knows whether an entry has formulas (so the level picker shows only then)', () => {
    expect(hasFormula(entry('spell', { id: 'x', duration: { formula: '2 + level', unit: 'turn' } }))).toBe(true);
    expect(hasFormula(entry('class', { id: 'c', progression: [{ level: 2, saves: { a: { formula: '10 - level' } } }] }))).toBe(true);
    expect(hasFormula(entry('item', { id: 'rope', weightCoin: 50 }))).toBe(false);
  });

  it('deeply nested values still show, flattened to text', () => {
    const described = describeEntry(entry('class', { id: 'c', a: { b: { c: { d: { e: 'deep' } } } } }), nameOf);
    expect(JSON.stringify(described.lines)).toContain('deep');
  });
});

describe("the app's own bookkeeping never prints (test feedback 2026-11-19, A4)", () => {
  const bookkeeping = { pinnedFrom: 'fen-rules', convertedFrom: 'old-fen-rules', sameAs: 'reed-lamp', imageId: 'fen-lamp-picture', turnAs: 3 };
  const lamp = entry('item', { id: 'lantern', name: 'Fen lantern', category: 'light', weightCoin: 30, ...bookkeeping });

  // Purpose: an item pinned from another pack shows no "Pinned from" row in its pop-up, for a player or the GM.
  it('an item carrying pinnedFrom shows no "Pinned from" row, for a player or the GM', () => {
    for (const gm of [false, true]) {
      const labels = describeEntry(lamp, nameOf, { gm }).lines.map((l) => l.label);
      expect(labels).not.toContain('Pinned from');
      expect(labels).toEqual(['Category', 'Weight (coins)']);
    }
  });

  // Purpose: each bookkeeping key on its own, on any kind of entry, prints no row of the entry's details.
  it.each(BOOKKEEPING_KEYS)('%s prints no row on an item, a class or a stat block', (key) => {
    for (const kind of ['item', 'class', 'statBlock'] as const) {
      expect(describeEntry(entry(kind, { id: 'x', name: 'Fen thing', [key]: 'fen-rules' }), nameOf, { gm: true }).lines).toEqual([]);
    }
  });

  // Purpose: the stat block hides the same list, so the two never drift apart.
  it("the stat block's leftover lines hide every key on the shared list", () => {
    const shown = layOutStatBlock({ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', ...bookkeeping, group: 'Reed folk' }, null);
    expect(shown.rest.map((l) => l.label)).toEqual(['Group']);
  });

  // Purpose: the list names the keys the plan calls the app's own, starting with sn-1b's pinnedFrom, with of-7's tags
  // and baseId.
  it('the shared list holds pinnedFrom, convertedFrom, sameAs, imageId, turnAs, tags and baseId', () => {
    expect([...BOOKKEEPING_KEYS].sort()).toEqual(['baseId', 'convertedFrom', 'imageId', 'pinnedFrom', 'sameAs', 'tags', 'turnAs']);
  });
});

describe("an entry's details without internal keys (of-7, ruled 2026-11-20)", () => {
  // Purpose: a magic variant's tags and its baseId print no row, for a player or the GM; its other lines still show.
  it('an item with tags and a baseId shows no "Tags" or "Base" row', () => {
    const blade = entry('item', { id: 'glow-hook', name: 'Glow hook', category: 'weapon', weightCoin: 60, tags: ['Melee', 'Fen'], baseId: 'hookstaff' });
    for (const gm of [false, true]) {
      const labels = describeEntry(blade, nameOf, { gm }).lines.map((l) => l.label);
      expect(labels).toEqual(['Category', 'Weight (coins)']);
    }
  });

  // Purpose: a stat block's behaviour fields (profile, nudges, triggers, actionMenu, tables) print no row in its
  // details, even for the GM; its other fields still show.
  it("a stat block's behaviour fields print no row, even for the GM", () => {
    const lurker = entry('statBlock', {
      id: 'bog-lurker',
      name: 'Bog lurker',
      group: 'Reed folk',
      profile: { wants: 'Warm feet', voice: 'A wet hiss' },
      nudges: [{ text: 'It circles the lamp.', when: 'start' }],
      triggers: [{ when: 'belowHalf', text: 'It flees into the reeds.' }],
      actionMenu: { pick: 1, options: ['grab', 'drag'] },
      tables: { tactics: 'lurker-tactics', other: [] },
    });
    expect(describeEntry(lurker, nameOf, { gm: true }).lines.map((l) => l.label)).toEqual(['Group']);
    expect([...STAT_BLOCK_BEHAVIOUR_KEYS].sort()).toEqual(['actionMenu', 'nudges', 'profile', 'tables', 'triggers']);
  });

  // Purpose: only a stat block hides them: a kindred's own creation tables still show as a row.
  it("another kind's tables still show", () => {
    const kin = entry('race', { id: 'reed-kin', name: 'Reed kin', tables: ['reed-kin-names'] });
    expect(describeEntry(kin, nameOf).lines.map((l) => l.label)).toEqual(['Tables']);
  });

  // Purpose: the GM still reads the "Hidden from players" row; a player doesn't.
  it('keeps the GM\'s "Hidden from players" row', () => {
    const hook = entry('item', { id: 'grim-hook', name: 'Grim hook', tags: ['Melee'], cursed: true, gmOnly: ['cursed'] });
    expect(describeEntry(hook, nameOf, { gm: true }).lines).toContainEqual({ label: 'Hidden from players', value: 'Cursed' });
    expect(describeEntry(hook, nameOf).lines.map((l) => l.label)).not.toContain('Hidden from players');
  });
});

describe('the page reference at the foot of a rules popup (2026-10-23)', () => {
  const nameOf = (id: string) => ({ 'lantern-warden': 'Lantern Warden', 'reed-witch': 'Reed Witch' })[id];

  it('reads "From your setting: <short name>, <page>", and nothing without a source', () => {
    expect(sourceLine('Book p. 196', 'River', nameOf)).toBe('From your setting: River, Book p. 196');
    expect(sourceLine(undefined, 'River', nameOf)).toBeNull();
    expect(sourceLine('  ', 'River', nameOf)).toBeNull();
  });

  it('a source keyed by class shows the character’s class, or else all of them', () => {
    const pages = { 'lantern-warden': 'p. 12', 'reed-witch': 'p. 30' };
    expect(sourceLine(pages, 'River', nameOf, 'reed-witch')).toBe('From your setting: River, p. 30');
    expect(sourceLine(pages, 'River', nameOf)).toBe('From your setting: River, Lantern Warden p. 12; Reed Witch p. 30');
  });

  it('is left out of the entry’s own lines', () => {
    expect(describeEntry({ kind: 'item', packEntryId: 'rope', name: 'Rope', data: { id: 'rope', name: 'Rope', source: 'Book p. 9', weightCoin: 5 } }, () => undefined).lines.map((l) => l.label)).not.toContain('Source');
  });
});
