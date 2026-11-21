// How a patch's path is read for a set (pf-19, design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md):
// the one reading the app's patches and pack:check share. Invented fields only.
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_STEPS, planSet, readPath, withSet } from './patchPath.ts';

describe('planSet: what a set on a path would do', () => {
  // Purpose: a path the entry has is set where it is.
  it('reads an existing path as existing', () => {
    expect(planSet({ armour: { ac: 7 } }, 'armour.ac')).toEqual({ kind: 'existing' });
    expect(planSet({ name: 'Reed shield' }, 'name')).toEqual({ kind: 'existing' });
  });

  // Purpose: a path the entry lacks, through objects only, is created from its first missing step.
  it('creates the missing keys, one level and three levels deep', () => {
    expect(planSet({ name: 'Otter kin' }, 'age')).toEqual({ kind: 'create', from: 'age' });
    expect(planSet({ name: 'Otter kin', figures: {} }, 'figures.height.base.inches')).toEqual({ kind: 'create', from: 'figures.height' });
    expect(planSet({}, 'a.b.c')).toEqual({ kind: 'create', from: 'a' });
  });

  // Purpose (pf-19c, widening pf-19; the lead, 2026-11-14, for lv-1's levelNames): a numeric step under an object is an
  // ordinary key, whether the object is there or this set makes it; the object made is an object, never a list.
  it('a numeric step under an object is a key: under one that is there, and under one the set makes', () => {
    expect(planSet({}, 'levelNames.0')).toEqual({ kind: 'create', from: 'levelNames' });
    expect(planSet({ levelNames: { '2': { one: 'Deep rite' } } }, 'levelNames.0')).toEqual({ kind: 'create', from: 'levelNames.0' });
    expect(planSet({ titles: {} }, 'titles.3.name')).toEqual({ kind: 'create', from: 'titles.3' });
    expect(withSet({}, 'levelNames.0', { one: 'Glimmer', many: 'Glimmers' })).toEqual({ levelNames: { '0': { one: 'Glimmer', many: 'Glimmers' } } });
    expect(Array.isArray(withSet({}, 'levelNames.0', 'x')!.levelNames)).toBe(false);
    expect(withSet({ levelNames: { '2': 'Deep rites' } }, 'levelNames.0', 'Glimmers')).toEqual({ levelNames: { '2': 'Deep rites', '0': 'Glimmers' } });
  });

  // Purpose: a list that is there is never indexed into or padded by a set: still refused, nothing overwritten.
  it('a list that is there is never set into or padded', () => {
    expect(planSet({ titles: ['Pup'] }, 'titles.0')).toMatchObject({ kind: 'refused', reason: 'not-object', at: 'titles' });
    expect(planSet({ titles: ['Pup'] }, 'titles.3')).toMatchObject({ kind: 'refused', reason: 'not-object', at: 'titles' });
    expect(withSet({ titles: ['Pup'] }, 'titles.3', 'Elder')).toBeNull();
  });

  // Purpose: a step that is there and isn't an object (words, a number, a list, nothing) is refused, never overwritten.
  it('refuses a step that is words, a number, a list or null', () => {
    for (const value of ['Reed', 7, [1, 2], null, true]) {
      expect(planSet({ size: value }, 'size.height')).toMatchObject({ kind: 'refused', reason: 'not-object', at: 'size' });
    }
  });

  // Purpose: __proto__, constructor and prototype are refused as any step, whatever the entry holds.
  it('refuses the forbidden names anywhere in the path', () => {
    for (const name of FORBIDDEN_STEPS) {
      expect(planSet({}, name)).toMatchObject({ kind: 'refused', reason: 'forbidden' });
      expect(planSet({ a: {} }, `a.${name}.b`)).toMatchObject({ kind: 'refused', reason: 'forbidden' });
      expect(planSet({ a: { b: 1 } }, `a.b.${name}`)).toMatchObject({ kind: 'refused', reason: 'forbidden' });
    }
  });

  // Purpose: an empty step ("a..b", a trailing dot) is refused.
  it('refuses an empty step', () => {
    expect(planSet({}, 'a..b')).toMatchObject({ kind: 'refused', reason: 'empty' });
    expect(planSet({ a: {} }, 'a.')).toMatchObject({ kind: 'refused', reason: 'empty' });
  });

  // Purpose: each refusal carries its reason in words, naming the step.
  it('words each refusal', () => {
    expect(planSet({ titles: ['Pup'] }, 'titles.0')).toMatchObject({ text: '"titles" is a list, not a group of fields; a patch never overwrites it' });
    expect(planSet({ size: 'Large' }, 'size.height')).toMatchObject({ text: '"size" is words, not a group of fields; a patch never overwrites it' });
    expect(planSet({}, 'a.__proto__')).toMatchObject({ text: '"__proto__" is a name a patch may never use' });
  });
});

describe('readPath: the value at a path, own fields only', () => {
  // Purpose: a value the entry has is found as before.
  it('finds what the entry has', () => {
    expect(readPath({ armour: { ac: 7 } }, 'armour.ac')).toEqual({ found: true, value: 7 });
    expect(readPath({ armour: { ac: 7 } }, 'armour.aac')).toEqual({ found: false, value: undefined });
  });

  // Purpose: an inherited or forbidden name is never followed (a plain object's constructor isn't "there").
  it('never follows an inherited or forbidden name', () => {
    expect(readPath({}, 'constructor')).toEqual({ found: false, value: undefined });
    expect(readPath({}, '__proto__')).toEqual({ found: false, value: undefined });
    expect(readPath({}, 'toString')).toEqual({ found: false, value: undefined });
    expect(readPath({ a: [1] }, 'a.length')).toEqual({ found: false, value: undefined });
  });
});
