// pf-19 (design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md): a patch that sets a value creates the
// missing keys on its way, objects only; never a list, never over a value, never a forbidden name; every other kind
// of patch changes nothing on a path the entry lacks, as before. Invented names and figures.
import { describe, expect, it } from 'vitest';
import baseFixture from '../../../scripts/fixtures/options-gates.fixture.json?raw';
import materialsFixture from '../../../scripts/fixtures/options-gates-3b-materials.fixture.json?raw';
import mainResult from './patches.pf19.main-result.json?raw';
import { applyPatches, patchesInPlay, readPatches } from './patches.ts';

const packs = [{ packId: 'zine', name: 'Mire zine', shortName: 'Mire zine' }];
const read = (change: Record<string, unknown>) =>
  readPatches([{ kind: 'patch', packId: 'zine', packEntryId: 'patch-1', data: { byOption: 'metals=bone', match: { kind: 'race' }, change } }], packs);
const otter = () => ({ kind: 'race', packEntryId: 'otter-kin', data: { name: 'Otter kin', size: 'Small', titles: ['Pup'], figures: { age: 'young' } } as Record<string, unknown> });

describe('a set on a path the entry lacks (pf-19)', () => {
  // Purpose: a set on a path the entry lacks creates it, one level deep.
  it('creates a missing key one level deep', () => {
    const done = applyPatches(otter(), read({ height: 40 }));
    expect(done.data.height).toBe(40);
    expect(done.lines.map((l) => l.text)).toEqual(['Height 40: metals=bone, Mire zine']);
  });

  // Purpose: a set on a path the entry lacks creates every missing object on its way, three levels deep.
  it('creates the missing keys three levels deep', () => {
    const done = applyPatches(otter(), read({ 'creation.height.base': 40, 'creation.height.dice': '2d6' }));
    expect(done.data.creation).toEqual({ height: { base: 40, dice: '2d6' } });
    expect(done.data.name).toBe('Otter kin');
  });

  // Purpose: a set on an existing path still works as before, and keeps the rest of the object.
  it('still sets an existing path', () => {
    const done = applyPatches(otter(), read({ 'figures.age': 'old', size: 'Tiny' }));
    expect(done.data.figures).toEqual({ age: 'old' });
    expect(done.data.size).toBe('Tiny');
  });

  // Purpose: a set on a missing path that the deltas on the same path then adjust, as on an existing one.
  it('applies a delta on the same path after the set that made it', () => {
    const done = applyPatches(otter(), read({ weight: 30 }).concat(read({ weight: { delta: 5 } })));
    expect(done.data.weight).toBe(35);
  });

  // Purpose: a missing step whose next step is a number is refused and changes nothing: no list is made or padded.
  it('refuses to make or pad a list', () => {
    const entry = otter();
    for (const change of [{ 'titles.3': 'Elder' }, { 'titles.0': 'Elder' }]) {
      const done = applyPatches(entry, read(change));
      expect(done.data).toBe(entry.data);
      expect(done.lines).toEqual([]);
    }
    expect(entry.data.titles).toEqual(['Pup']);
  });

  // Purpose (pf-19c, widening pf-19): a numeric step under an object is a key, so the set makes objects, never a list.
  it('a numeric step under an object makes an object key, never a list', () => {
    const made = applyPatches(otter(), read({ 'ranks.0': 'Pup', 'figures.2': 'x' }));
    expect(made.data.ranks).toEqual({ '0': 'Pup' });
    expect(Array.isArray(made.data.ranks)).toBe(false);
    expect(made.data.figures).toEqual({ age: 'young', '2': 'x' });
  });

  // Purpose: a step that is there and is words or a number is refused and is not overwritten.
  it('never overwrites words or a number on the way', () => {
    const entry = { kind: 'race', packEntryId: 'otter-kin', data: { size: 'Small', speed: 30 } as Record<string, unknown> };
    const done = applyPatches(entry, read({ 'size.height': 40, 'speed.swim': 40 }));
    expect(done.data).toBe(entry.data);
    expect(done.data).toEqual({ size: 'Small', speed: 30 });
    expect(done.lines).toEqual([]);
  });

  // Purpose: __proto__, constructor and prototype, as any step, are refused, change nothing and touch no prototype.
  it('never makes or follows __proto__, constructor or prototype', () => {
    const entry = otter();
    const paths = ['__proto__.polluted', 'constructor.prototype.polluted', 'prototype.polluted', 'figures.__proto__.polluted', 'figures.constructor', 'polluted.prototype', '__proto__'];
    for (const path of paths) {
      const done = applyPatches(entry, read({ [path]: 'yes' }));
      expect(done.data).toBe(entry.data);
      expect(done.lines).toEqual([]);
    }
    const fresh: Record<string, unknown> = {};
    expect(fresh.polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
    expect(Object.getPrototypeOf(entry.data)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(entry.data.figures)).toBe(Object.prototype);
  });

  // Purpose: a patch that isn't a set (a delta, a multiplier), or a set of null, on a path the entry lacks still changes nothing.
  it('changes nothing for a delta, a multiplier or a removal on a path the entry lacks', () => {
    const entry = otter();
    const done = applyPatches(entry, read({ weight: { delta: 5 }, 'creation.height': { times: 2 }, notes: null }));
    expect(done.data).toBe(entry.data);
    expect(done.lines).toEqual([]);
  });

  // Purpose: the patches fixture gives the same result as on main (saved from main's own code, under each choice).
  it('gives the materials fixture the same result as main', () => {
    const base = JSON.parse(baseFixture);
    const mat = JSON.parse(materialsFixture);
    const items = [...(base.items ?? []), ...(mat.items ?? [])].map((d: { id: string }) => ({ kind: 'item', packEntryId: d.id, data: d as unknown as Record<string, unknown> }));
    const patches = readPatches(
      (mat.patches as unknown[]).map((p, i) => ({ kind: 'patch', packId: 'mat', packEntryId: `patch-${i + 1}`, data: p as Record<string, unknown> })),
      [{ packId: 'mat', name: 'Mire materials' }],
    );
    const out: Record<string, unknown> = {};
    for (const choice of ['steel', 'bronze', 'bone', 'stone']) {
      const inPlay = patchesInPlay(patches, { 'mire-metals': choice });
      out[choice] = items.map((e) => {
        const r = applyPatches(e, inPlay);
        return { id: e.packEntryId, data: r.data, lines: r.lines.map((l) => l.text), removedBy: r.removedBy };
      });
    }
    expect(out).toEqual(JSON.parse(mainResult));
  });
});
