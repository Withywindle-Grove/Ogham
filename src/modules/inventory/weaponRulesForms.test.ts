// Weapon rules by combat category (eq-7, mb-4) and class forms (eq-8), ruled 2026-11-04
// (docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md, m5b-magic-items-base-2026-11-04.md; area 3 order 10).
// Invented setting throughout.
import { describe, expect, it } from 'vitest';
import type { Value } from '../library/expression.ts';
import { allowedByRule, currentForm, equipBlocks, formsOf, limitsInPlay, weaponRuleFor, weaponRuleVerdict } from './equipWarnings.ts';

const thunderTube = { id: 'reed-thunder-tube', name: 'Reed thunder-tube', slot: 'hand', hands: 2, weaponTags: ['Thunder-tube', 'Missile'] };
const eelKnife = { id: 'eel-knife', name: 'Eel knife', slot: 'hand', hands: 1, weaponTags: ['Melee'] };
const ironCoat = { id: 'iron-coat', name: 'Iron coat', slot: 'armour', armourType: 'heavy' };
const reedShield = { id: 'reed-shield', name: 'Reed shield', slot: 'shield', material: ['wood'] };

const rules: Value = [
  { category: 'Thunder-tube', classCategories: ['semi-martial', 'martial'], exceptClasses: ['bog-knight'], note: 'The marsh referee decides for chaplains.' },
  { category: 'Hand-cannon', classCategories: ['martial'] },
];
const warden: Value = { id: 'reed-warden', name: 'Reed warden', weaponProficiencyCategory: 'martial', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] } };
const knight: Value = { id: 'bog-knight', name: 'Bog knight', weaponProficiencyCategory: 'martial', weaponsAllowed: { mode: 'list', ids: ['eel-knife'], note: 'No missile weapons.' } };
const witch: Value = { id: 'bog-witch', name: 'Bog witch', weaponProficiencyCategory: 'gentle', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] } };
const converted: Value = { id: 'old-sage', name: 'Old sage', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] } };

describe('weapon rules by combat category (eq-7, mb-4)', () => {
  // Purpose: a rule is found by a weapon tag or the item's category, without regard to case; an item no rule names
  // has none.
  it('finds the rule for an item by its tag or category', () => {
    expect(weaponRuleFor(rules, thunderTube)?.category).toBe('Thunder-tube');
    expect(weaponRuleFor(rules, { ...thunderTube, weaponTags: ['thunder-TUBE'] })?.category).toBe('Thunder-tube');
    expect(weaponRuleFor(rules, { id: 'x', name: 'X', category: 'Hand-cannon', weapon: {} })?.category).toBe('Hand-cannon');
    expect(weaponRuleFor(rules, eelKnife)).toBeNull();
    expect(weaponRuleFor([{ category: 'Thunder-tube' }], thunderTube)).toBeNull();
  });

  // Purpose (the plan's test): a firearm is allowed to a martial class by its category though its list lacks it; a
  // gentle class is blocked, and the reason names the rule, its categories and its note.
  it('allows a weapon by the class’s combat category; blocked, it names the rule and its note', () => {
    expect(equipBlocks({ class: warden }, thunderTube, rules)).toEqual([]);
    expect(allowedByRule({ class: warden }, thunderTube, rules)?.category).toBe('Thunder-tube');
    expect(allowedByRule({ class: warden }, eelKnife, rules)).toBeNull();
    expect(equipBlocks({ class: witch }, thunderTube, rules)).toEqual([
      "Bog witch can't use Reed thunder-tube. The Thunder-tube rule allows semi-martial and martial classes; Bog witch is gentle. The marsh referee decides for chaplains.",
    ]);
  });

  // Purpose (the plan's test, mb-4): a martial class on exceptClasses is blocked from a firearm its list lacks; the
  // reason carries the class's own note and says the rule doesn't apply to it.
  it('a martial class on exceptClasses is blocked from a firearm its list lacks', () => {
    expect(equipBlocks({ class: knight }, thunderTube, rules)).toEqual([
      "Bog knight can't use Reed thunder-tube. No missile weapons. The Thunder-tube rule doesn't apply to Bog knight: its own list decides. The marsh referee decides for chaplains.",
    ]);
    expect(equipBlocks({ class: knight }, eelKnife, rules)).toEqual([]);
  });

  // Purpose (mb-4): a converted class with no combat category follows its list only; without any rules, nothing changes.
  it('a class with no combat category, and a setting with no rules, follow the list alone', () => {
    expect(equipBlocks({ class: converted }, thunderTube, rules)[0]).toContain('has no combat category');
    expect(equipBlocks({ class: witch }, thunderTube)).toEqual(["Bog witch can't use Reed thunder-tube."]);
    expect(weaponRuleVerdict(null, witch, thunderTube)).toBeNull();
  });

  // Purpose: a rule whose name starts with "The" keeps its own article in every reason (words rule 13): "Allowed by
  // The Reed-tube rule", "The Reed-tube rule allows …", never "the The …".
  it('a rule named "The Reed-tube" is never "the The Reed-tube rule"', () => {
    const reedTube = { ...thunderTube, weaponTags: ['The Reed-tube'] };
    const theRules: Value = [{ category: 'The Reed-tube', classCategories: ['martial'], exceptClasses: ['bog-knight'] }];
    expect(weaponRuleVerdict(theRules, warden, reedTube)?.why).toBe('Allowed by The Reed-tube rule (martial classes).');
    expect(weaponRuleVerdict(theRules, witch, reedTube)?.why).toBe('The Reed-tube rule allows martial classes; Bog witch is gentle.');
    expect(weaponRuleVerdict(theRules, knight, reedTube)?.why).toBe("The Reed-tube rule doesn't apply to Bog knight: its own list decides.");
  });
});

const phaseClass: Value = {
  id: 'phase-kin',
  name: 'Phase kin',
  armourAllowed: { types: 'any', shields: true },
  weaponsAllowed: { mode: 'any' },
  forms: [
    { id: 'dawn-phase', name: 'Dawn phase', weaponsAllowed: { mode: 'any' }, armourAllowed: { types: 'any', shields: true }, note: 'Any weapon or armour.' },
    { id: 'dusk-phase', name: 'Dusk phase', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] }, armourAllowed: { types: [], shields: false }, note: 'Knives only; no armour or shield.' },
    { id: 'half-phase', name: 'Half phase', armourAllowed: { types: ['light'] } },
    { name: 'No id: left out' },
  ],
};

describe('class forms (eq-8)', () => {
  // Purpose: forms are read with an id and a name (a form without an id is left out); the current form is the one
  // kept with the character, else the first; a class without forms has none.
  it('reads the forms; the current one is the stored one, else the first', () => {
    expect(formsOf(phaseClass).map((f) => f.id)).toEqual(['dawn-phase', 'dusk-phase', 'half-phase']);
    expect(currentForm(phaseClass, null)?.name).toBe('Dawn phase');
    expect(currentForm(phaseClass, 'dusk-phase')?.name).toBe('Dusk phase');
    expect(currentForm(phaseClass, 'gone-phase')?.name).toBe('Dawn phase');
    expect(currentForm(warden, 'dusk-phase')).toBeNull();
    expect(formsOf({ ...warden, forms: 'nope' })).toEqual([]);
  });

  // Purpose: the equip check reads the current form's limits, and a limit the form leaves out is the class's own.
  it('reads the current form’s limits, falling back to the class’s', () => {
    expect(limitsInPlay(phaseClass, 'half-phase').weaponsAllowed).toEqual({ mode: 'any' });
    expect(limitsInPlay(phaseClass, 'half-phase').armourAllowed).toEqual({ types: ['light'] });
    expect(limitsInPlay(warden, null)).toEqual({ weaponsAllowed: warden.weaponsAllowed, armourAllowed: null, form: null });
  });

  // Purpose: in the dusk form, armour, a shield and a sword the form forbids are blocked, naming the form and its
  // note; in the dawn form (or with no switch yet) all pass.
  it('blocks what the current form forbids, naming the form', () => {
    const dusk = { class: phaseClass, formId: 'dusk-phase' };
    expect(equipBlocks(dusk, ironCoat)).toEqual(["Phase kin can't use Iron coat in Dusk phase. Knives only; no armour or shield."]);
    expect(equipBlocks(dusk, reedShield)).toEqual(["Phase kin can't use Reed shield in Dusk phase. Knives only; no armour or shield."]);
    expect(equipBlocks(dusk, thunderTube)).toEqual(["Phase kin can't use Reed thunder-tube in Dusk phase. Knives only; no armour or shield."]);
    expect(equipBlocks(dusk, eelKnife)).toEqual([]);
    expect(equipBlocks({ class: phaseClass, formId: null }, ironCoat)).toEqual([]);
    expect(equipBlocks({ class: phaseClass, formId: 'dawn-phase' }, thunderTube)).toEqual([]);
  });

  // Purpose: a weapon rule still speaks beside a form's list, by the class's combat category.
  it('a weapon rule applies on top of the form’s list', () => {
    const dusk = { class: { ...phaseClass, weaponProficiencyCategory: 'martial' }, formId: 'dusk-phase' };
    expect(equipBlocks(dusk, thunderTube, rules)).toEqual([]);
    expect(equipBlocks({ ...dusk, class: { ...dusk.class, weaponProficiencyCategory: 'gentle' } }, thunderTube, rules)[0]).toContain('in Dusk phase');
  });
});
