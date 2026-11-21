// What the rules work out from the race and the rules set beyond the hooks (the third creation test, ct3-10 and
// ct3-12a; fills.ts ruleFills). Every name and number is invented.
//   Movement: the character's own speed (the race's, else the rules set's), one figure per mode written as a formula
//   of speed (under the rules set's own key only, ruled B 2026-11-03), the combat rate from its formula; words that aren't a formula are no figure; a
//   rules set with only words for its default gives those words as `movement`.
//   Skills: the better of the default, the class's value and the kindred's target; lower is better when the skill
//   rolls equal-or-over, higher otherwise; a target "when" something is a situation and leaves the number alone; the
//   skill's own per-race and per-class numbers count too.
//   Save modifiers: an ability's modifier plus the kindred's field; or a fill path into the filled values.
import { describe, expect, it } from 'vitest';
import { fillName, ownSpeed, ruleFills, wasRoundedDown, wholeDown } from './fills.ts';

const rules = {
  defaultSpeed: 30,
  movement: { default: 30, exploration: 'speed * 3', overland: 'floor(speed / 4)', partySpeed: 'slowest member', combat: { formula: 'speed / 3', unit: 'ft per round' } },
  skills: [
    { id: 'hark', name: 'Hark', default: 6, rollMode: 'equal-or-over' },
    { id: 'delve', name: 'Delve', default: 6, rollMode: 'equal-or-over' },
    { id: 'forage', name: 'Forage', default: 6, rollMode: 'equal-or-over' },
  ],
  saveModifiers: [{ id: 'spell-ward', name: 'Spell ward', value: { from: 'LORE', plusRaceField: 'spellWard' } }],
};
const mothKin = { id: 'moth-kin', name: 'Moth kin', skillTargets: { hark: 5, forage: { value: 4, when: 'at dusk' } }, spellWard: 2 };
const loreRow = { 'abilityModifiers.LORE': { saveBonus: 1 } };

describe('movement from the pack (ct3-10)', () => {
  // Ruled B 2026-11-03: the fill reads only the rules set's own key; no copy under another name (`movement.explore`).
  it('works out each mode from the speed, under the rules set’s own key only', () => {
    const out = ruleFills([rules], { klass: null, race: null }, {});
    expect(out['movement.speed']).toBe(30);
    expect(out.movement).toBe(30);
    expect(out['movement.exploration']).toBe(90);
    expect(out['movement.explore']).toBeUndefined();
    expect(Object.keys(out).filter((k) => k.startsWith('movement.')).sort()).toEqual(['movement.combat', 'movement.exploration', 'movement.overland', 'movement.speed']);
    expect(out['movement.overland']).toBe(7);
    expect(out['movement.combat']).toBe(10);
    // "slowest member" is words, not a figure.
    expect(out['movement.partySpeed']).toBeUndefined();
  });

  it('a figure worked out from an odd speed is a whole number, rounded down, unless the pack rounds it itself', () => {
    // Purpose: a speed that doesn't divide evenly (125, 40, 10 by 3) never shows a long fraction on the sheet; the
    // figure is rounded down (hard rule 8: never more movement than the rule gives), and a pack that writes its own
    // rounding in the formula (ceil) keeps it.
    const odd = { movement: { default: 125, combat: { formula: 'speed / 3', unit: 'ft per round' }, wading: 'ceil(speed / 3)' } };
    const at = (speed: number) => ruleFills([odd], { klass: null, race: { speed } }, {});
    expect(at(125)['movement.combat']).toBe(41);
    expect(at(40)['movement.combat']).toBe(13);
    expect(at(10)['movement.combat']).toBe(3);
    expect(at(125)['movement.wading']).toBe(42);
  });

  it('a movement formula that comes out below nothing shows 0', () => {
    // Purpose: a pack's formula that goes negative at a low speed ("speed - 40" at 30) never shows a negative
    // movement; it shows 0, as the travel budget does, through the one rounding helper.
    const short = { movement: { default: 30, sprint: 'speed - 40', lunge: '(speed - 40) / 3' } };
    const out = ruleFills([short], { klass: null, race: { speed: 30 } }, {});
    expect(out['movement.sprint']).toBe(0);
    expect(out['movement.lunge']).toBe(0);
    expect(wholeDown(-2.5)).toBe(0);
    expect(wasRoundedDown(-2.5)).toBe(false);
  });

  it('uses the kindred’s own speed when it gives one', () => {
    expect(ownSpeed([rules], { speed: 20 })).toBe(20);
    expect(ruleFills([rules], { klass: null, race: { speed: 20 } }, {})['movement.exploration']).toBe(60);
  });

  it('gives the rules set’s words as movement when its default isn’t a number', () => {
    const out = ruleFills([{ movement: { default: "80' (25')", combat: { formula: 'speed / 3' } } }], { klass: null, race: null }, {});
    expect(out.movement).toBe("80' (25')");
    expect(out['movement.combat']).toBeUndefined();
  });

  it('names the figures in words', () => {
    expect(fillName('movement.exploration', [rules], null)).toBe('Movement: exploration');
    expect(fillName('skills.hark', [rules], null)).toBe('Hark');
    expect(fillName('saveModifiers.spell-ward', [rules], null)).toBe('Spell ward');
  });
});

describe('a kindred’s skill targets and spell ward (ct3-12a)', () => {
  it('a moth kin hears at 5; the rest stay at the default; a target "when" something leaves the number alone', () => {
    const out = ruleFills([rules], { klass: null, race: mothKin, raceRef: 'moth-kin' }, loreRow);
    expect(out['skills.hark']).toBe(5);
    expect(out['skills.delve']).toBe(6);
    expect(out['skills.forage']).toBe(6);
  });

  it('takes the better of the class and the kindred: lower when the skill rolls equal-or-over, higher otherwise', () => {
    expect(ruleFills([rules], { klass: null, race: mothKin }, { 'skills.hark': 4 })['skills.hark']).toBe(4);
    const rollUnder = { skills: [{ id: 'hark', default: 1, fill: { races: { 'moth-kin': 2 }, classes: { 'reed-witch': 3 } } }] };
    expect(ruleFills([rollUnder], { klass: null, race: null, raceRef: 'moth-kin' }, {})['skills.hark']).toBe(2);
    expect(ruleFills([rollUnder], { klass: null, race: null, raceRef: 'moth-kin', classRef: 'reed-witch' }, {})['skills.hark']).toBe(3);
    expect(ruleFills([rollUnder], { klass: null, race: null }, {})['skills.hark']).toBe(1);
  });

  it('the spell ward is the LORE modifier plus the kindred’s field; without the field, the modifier alone', () => {
    expect(ruleFills([rules], { klass: null, race: mothKin }, loreRow)['saveModifiers.spell-ward']).toBe(3);
    expect(ruleFills([rules], { klass: null, race: { id: 'bog-folk' } }, loreRow)['saveModifiers.spell-ward']).toBe(1);
    // No LORE row (no scores yet): no figure rather than a guess.
    expect(ruleFills([rules], { klass: null, race: mothKin }, {})['saveModifiers.spell-ward']).toBeUndefined();
  });

  it('a save modifier may name a fill path instead', () => {
    const byPath = { saveModifiers: [{ id: 'lore-magic', value: { fill: 'abilityModifiers.LORE.saveBonus' } }] };
    expect(ruleFills([byPath], { klass: null, race: null }, loreRow)['saveModifiers.lore-magic']).toBe(1);
  });
});
