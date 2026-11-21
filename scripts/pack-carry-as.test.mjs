// npm run pack:check's armour that carries as another category (al-1) and a carry bonus in a banded stack (cb-1),
// ruled 2026-11-05 (scripts/pack-carry-as.mjs; docs/plans/m5b-review-area-3.md, build orders 14 and 15). A list and a
// note, never errors. Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { carriesAsList, carryBonusBandNotes } from './pack-carry-as.mjs';

const armour = (id, armourType, type) => ({ id, name: id, slot: 'armour', armourType, armour: { base: 3, ...(type === undefined ? {} : { type }) } });
const rules = (encumbrance) => ({ rulesSets: [{ id: 'gleam-rules', name: 'Gleam rules', encumbrance }] });
const mapped = rules({ armour: { armourTypes: { 'reed-weave': 'light', 'iron-scale': 'heavy' } } });
const banded = rules({ slot: { bands: { equipped: [{ maxSlots: 3, speed: '40 ft' }], stowed: [{ maxSlots: 10, speed: '40 ft' }] } } });

const run = (...files) => {
  try {
    return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout);
  }
};

describe('armour that carries as another category (al-1)', () => {
  // Purpose: magic armour worn as medium that carries as light is listed; plain armour whose two fields agree, and
  // armour with no armour.type, are not.
  it('lists an armour whose armour.type differs from its armourType', () => {
    const file = { items: [armour('Gleamwoven mail', 'medium', 'light'), armour('Plain mail', 'medium', 'medium'), armour('Old mail', 'medium')] };
    expect(carriesAsList([file])).toEqual(['"Gleamwoven mail" (Gleamwoven mail): worn as medium, carries as light']);
  });

  // Purpose: an armourType that is an id ("reed-weave") is read as the row the rules set maps it to, so plain armour
  // in an id-style pack isn't listed and a lighter-carrying one is; an id no rules set maps can't be compared and
  // stays off the list (checked together with its rules set's pack, it is compared).
  it('reads an id-style armourType through the rules set', () => {
    const items = [armour('Reed coat', 'reed-weave', 'light'), armour('Gleam scale', 'iron-scale', 'light')];
    expect(carriesAsList([{ ...mapped, items }])).toEqual(['"Gleam scale" (Gleam scale): worn as iron-scale (heavy), carries as light']);
    expect(carriesAsList([{ items }])).toEqual([]);
    expect(carriesAsList([mapped, { items }])).toEqual(['"Gleam scale" (Gleam scale): worn as iron-scale (heavy), carries as light']);
  });

  // Purpose: chosen-base armour that names its own armour.type carries as that whatever base is picked, so it is
  // listed; one that names none carries as the picked base and isn't.
  it('lists chosen-base armour that names its own category', () => {
    const file = { items: [armour('Found gleam coat', 'chosen', 'light'), armour('Found coat', 'chosen')] };
    expect(carriesAsList([file])).toEqual(['"Found gleam coat" (Found gleam coat): the base is chosen when found, but it carries as light whatever base is picked']);
  });

  // Purpose: odd input (no items, an armour block that's a number, no armourType) never throws and lists nothing.
  it('stays quiet on odd input', () => {
    expect(carriesAsList([null, {}, { items: [{ id: 'x', armour: 4 }, { id: 'y', armour: { type: 'light' } }] }])).toEqual([]);
  });
});

describe('a carry bonus in a banded stack (cb-1)', () => {
  // Purpose (the plan's test): the checker notes a carry-bonus item when the rules set has slot bands, and stays quiet
  // with one list (no bands).
  it('notes a carryBonus item with slot bands and stays quiet without', () => {
    const items = [{ id: 'heron-grips', slot: 'worn', carryBonus: 2 }, { id: 'reed-rope', slot: 'worn' }];
    expect(carryBonusBandNotes([{ ...banded, items }])).toEqual([
      'items: "heron-grips" has a carryBonus and the rules set "gleam-rules" uses slot bands: a carry bonus goes to the stowed band (cb-1). Ask for a ruling if it should raise the equipped band instead.',
    ]);
    expect(carryBonusBandNotes([{ ...rules({ slot: { equipped: 3, stowed: 10 } }), items }])).toEqual([]);
    expect(carryBonusBandNotes([{ items }])).toEqual([]);
  });

  // Purpose: the item in one pack and the bands in another are noted when the two are read together.
  it('reads the bands across a stack', () => {
    const items = { items: [{ id: 'heron-grips', slot: 'worn', carryBonus: 2 }] };
    expect(carryBonusBandNotes([items])).toEqual([]);
    expect(carryBonusBandNotes([banded, items])).toHaveLength(1);
  });
});

describe('npm run pack:check on the Gleam fen fixture', () => {
  // Purpose: the checker prints the al-1 list as its own section (three armours: a category word, a mapped id and a
  // chosen base) and the cb-1 note among the format notes; plain armour stays off the list.
  it('prints the list and the note', () => {
    const out = run('scripts/fixtures/pack-check-after-gate.fixture.json');
    expect(out).toMatch(/Armour that carries as another category than it's worn as \(3\):/);
    expect(out).toMatch(/"gleamwoven-mail" \(Gleamwoven mail\): worn as medium, carries as light/);
    expect(out).toMatch(/"gleam-scale" \(Gleam scale\): worn as iron-scale \(heavy\), carries as light/);
    expect(out).toMatch(/"found-gleam-coat" .*carries as light whatever base is picked/);
    expect(out).not.toMatch(/"plain-mail"|"reed-coat" \(/);
    expect(out).toMatch(/items: "heron-grips" has a carryBonus .*goes to the stowed band \(cb-1\)/);
  });
});
