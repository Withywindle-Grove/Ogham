// The patch reader (patches.ts; of-13, bq3-17 "of-14"): what one patch does to one entry, pure. Invented names and
// numbers; the campaign-level tests (one pack's patches on another's entries, the lines and the Off marker) are in
// src/app/optionPatches.test.ts.
import { describe, expect, it } from 'vitest';
import { adjustDice, applyPatches, atPath, figureName, patchMatches, patchesInPlay, readPatches, type Patch } from './patches.ts';

const packs = [
  { packId: 'zine', name: 'Mire zine', shortName: 'Mire zine' },
  { packId: 'base', name: 'Fen rules', shortName: 'Fen' },
];
const patch = (data: Record<string, unknown>, packId = 'zine', packEntryId = 'patch-1') => ({ kind: 'patch', packId, packEntryId, data });
const coat = { kind: 'item', packEntryId: 'reed-coat', data: { category: 'armour', armour: { ac: 7, aac: 12 }, value: { gp: 10 } } };
const words = (spec: string) => ({ 'metals=bronze': 'Bronze', 'metals=bone': 'Bone', 'metals=bone,metals=bronze': 'Bone, Bronze' })[spec] ?? spec;

describe('reading patches', () => {
  // Purpose: a well-formed patch is read with its pack's words and rank; a malformed one is left out (pack:check names it).
  it('reads well-formed patches and leaves malformed ones out', () => {
    const read = readPatches(
      [
        patch({ byOption: 'metals=bronze', match: { kind: 'item', category: 'armour' }, change: { 'armour.ac': { delta: 1 } } }),
        patch({ byOption: 'metals=stone', match: { kind: 'item', ids: ['reed-shield'] }, option: null }, 'base', 'patch-2'),
        patch({ byOption: 'metals', match: { kind: 'item' }, change: { weightCoin: { delta: 1 } } }),
        patch({ byOption: 'metals=bone', match: {}, change: { weightCoin: { delta: 1 } } }),
        patch({ byOption: 'metals=bone', match: { kind: 'item' } }),
        patch({ byOption: 'metals=bone', match: { kind: 'item' }, change: { weightCoin: { delta: 0.5 } } }),
        { kind: 'item', packId: 'zine', packEntryId: 'x', data: { byOption: 'metals=bone' } },
      ],
      packs,
    );
    expect(read.map((p) => [p.packEntryId, p.packName, p.rank, p.removes])).toEqual([
      ['patch-1', 'Mire zine', 0, false],
      ['patch-2', 'Fen', 1, true],
    ]);
    expect(read[0]!.changes).toEqual([{ path: 'armour.ac', change: { kind: 'delta', by: 1 } }]);
    expect(read[1]!.match).toEqual({ kind: 'item', category: null, ids: ['reed-shield'] });
  });

  // Purpose: a patch is in play under any of the choices its byOption lists, and only those; its words name the choice made.
  it('is in play under any of its choices', () => {
    const [p] = readPatches([patch({ byOption: 'metals=bronze,metals=bone', match: { kind: 'item' }, change: { x: 1 } })], packs);
    expect(patchesInPlay([p!], { metals: 'bronze' }).map((q) => q.chosen)).toEqual(['metals=bronze']);
    expect(patchesInPlay([p!], { metals: 'bone' }).map((q) => q.chosen)).toEqual(['metals=bone']);
    expect(patchesInPlay([p!], { metals: 'steel' })).toHaveLength(0);
    expect(patchesInPlay([p!], {})).toHaveLength(0);
  });

  // Purpose: match reads the kind, the category when given, and the ids when listed.
  it('matches by kind, category and ids', () => {
    const of = (match: Record<string, unknown>) => readPatches([patch({ byOption: 'metals=bone', match, change: { x: 1 } })], packs)[0]!;
    expect(patchMatches(of({ kind: 'item' }), coat)).toBe(true);
    expect(patchMatches(of({ kind: 'spell' }), coat)).toBe(false);
    expect(patchMatches(of({ kind: 'item', category: 'armour' }), coat)).toBe(true);
    expect(patchMatches(of({ kind: 'item', category: 'shield' }), coat)).toBe(false);
    expect(patchMatches(of({ kind: 'item', ids: ['reed-coat', 'other'] }), coat)).toBe(true);
    expect(patchMatches(of({ kind: 'item', ids: ['other'] }), coat)).toBe(false);
  });
});

describe('dice and paths', () => {
  // Purpose: a delta on dice adjusts the modifier, never the dice (bq3-17 (2)); words that aren't dice are left alone.
  it('adjusts the modifier of a dice expression', () => {
    expect(adjustDice('1d8', -1)).toBe('1d8−1');
    expect(adjustDice('1d8+1', -1)).toBe('1d8');
    expect(adjustDice('1d6−1', -1)).toBe('1d6−2');
    expect(adjustDice('d6', 2)).toBe('d6+2');
    expect(adjustDice('2d4-1', 3)).toBe('2d4+2');
    expect(adjustDice('a sharp stick', -1)).toBeNull();
  });

  // Purpose: a dotted path finds a nested field, and says when the entry lacks it.
  it('reads a dotted path', () => {
    expect(atPath(coat.data, 'armour.ac')).toEqual({ found: true, value: 7 });
    expect(atPath(coat.data, 'armour.tier')).toEqual({ found: false, value: undefined });
    expect(atPath(coat.data, 'weapon.damage')).toEqual({ found: false, value: undefined });
  });

  // Purpose: the breakdown names the figure in the player's words.
  it('names the figure a path changes', () => {
    expect(figureName('armour.ac')).toBe('AC');
    expect(figureName('armour.aac')).toBe('AC');
    expect(figureName('weapon.damage')).toBe('Damage');
    expect(figureName('value.gp')).toBe('Price');
    expect(figureName('weightCoin')).toBe('Weight');
    expect(figureName('armourType')).toBe('ArmourType');
  });
});

describe('applying patches to one entry', () => {
  const read = (...list: Record<string, unknown>[]) => readPatches(list.map((data, i) => patch(data, (data.pack as string) ?? 'zine', `patch-${i + 1}`)), packs);

  // Purpose: a delta adds to a number, a multiplier multiplies, a set value replaces; each figure names its patch and pack.
  it('adds, multiplies and sets, naming each change', () => {
    const patches = read(
      { byOption: 'metals=bronze', match: { kind: 'item', category: 'armour' }, change: { 'armour.ac': { delta: 1 }, 'value.gp': { times: 10 }, category: 'bronze-armour' } },
    );
    const done = applyPatches(coat, patches, words);
    expect(done.data).toEqual({ category: 'bronze-armour', armour: { ac: 8, aac: 12 }, value: { gp: 100 } });
    expect(done.lines.map((l) => l.text)).toEqual(['AC +1: Bronze, Mire zine', 'Price ×10: Bronze, Mire zine', 'Category bronze-armour: Bronze, Mire zine']);
    expect(done.removedBy).toBe('');
  });

  // Purpose: a path the entry lacks changes nothing, with no line (bq3-17 (2)); so does a multiplier on words. (A set
  // value on a path the entry lacks makes it since pf-19: patches.pf19.test.ts.)
  it('changes nothing where the entry lacks the field', () => {
    const patches = read({ byOption: 'metals=bone', match: { kind: 'item' }, change: { 'weapon.damage': { delta: -1 }, 'value': { times: 2 } } });
    const done = applyPatches(coat, patches, words);
    expect(done.data).toBe(coat.data);
    expect(done.lines).toEqual([]);
  });

  // Purpose: a delta on dice adjusts the modifier (bq3-17 (2)).
  it('adjusts dice by their modifier', () => {
    const knife = { kind: 'item', packEntryId: 'eel-knife', data: { category: 'weapon', weapon: { damage: '1d4' } } };
    const done = applyPatches(knife, read({ byOption: 'metals=bone', match: { kind: 'item', category: 'weapon' }, change: { 'weapon.damage': { delta: -1 } } }), words);
    expect(done.data.weapon).toEqual({ damage: '1d4−1' });
    expect(done.lines.map((l) => l.text)).toEqual(['Damage −1: Bone, Mire zine']);
  });

  // Purpose: two patches on one field: deltas add and multipliers stack; a set value follows the pack on top (bq3-17 (3)).
  it('combines several patches on one field', () => {
    const patches = read(
      { byOption: 'metals=bone', match: { kind: 'item' }, change: { 'armour.ac': { delta: 1 }, 'value.gp': { times: 2 }, category: 'from-the-base' }, pack: 'base' },
      { byOption: 'metals=bone', match: { kind: 'item' }, change: { 'armour.ac': { delta: 2 }, 'value.gp': { times: 3 }, category: 'from-the-zine' }, pack: 'zine' },
    );
    const done = applyPatches(coat, patches, words);
    expect(done.data).toEqual({ category: 'from-the-zine', armour: { ac: 10, aac: 12 }, value: { gp: 60 } });
    expect(done.lines.map((l) => l.text)).toEqual([
      'AC +1: Bone, Fen',
      'AC +2: Bone, Mire zine',
      'Price ×2: Bone, Fen',
      'Price ×3: Bone, Mire zine',
      'Category from-the-base: Bone, Fen',
      'Category from-the-zine: Bone, Mire zine',
    ]);
  });

  // Purpose: a set value is applied before a delta on the same field, whichever pack each comes from.
  it('applies a set value, then the deltas', () => {
    const patches = read(
      { byOption: 'metals=bone', match: { kind: 'item' }, change: { 'armour.ac': { delta: 1 } } },
      { byOption: 'metals=bone', match: { kind: 'item' }, change: { 'armour.ac': 5 }, pack: 'base' },
    );
    expect(applyPatches(coat, patches, words).data.armour).toEqual({ ac: 6, aac: 12 });
  });

  // Purpose: `option: null` marks the entry removed under those choices, with the spec that removes it; a set `null` removes a field.
  it('marks a removed entry, and a null value removes a field', () => {
    const patches = read({ byOption: 'metals=stone', match: { kind: 'item', category: 'armour' }, option: null }, { byOption: 'metals=stone', match: { kind: 'item' }, change: { value: null } });
    const done = applyPatches(coat, patches, words);
    expect(done.removedBy).toBe('metals=stone');
    expect(done.data).toEqual({ category: 'armour', armour: { ac: 7, aac: 12 } });
  });

  // Purpose: an entry no patch matches comes back as the same object (nothing to re-render).
  it('gives the same object back when nothing matches', () => {
    const patches: Patch[] = read({ byOption: 'metals=bone', match: { kind: 'spell' }, change: { level: { delta: 1 } } });
    expect(applyPatches(coat, patches, words)).toEqual({ data: coat.data, lines: [], removedBy: '' });
    expect(applyPatches(coat, patches, words).data).toBe(coat.data);
  });
});
