// Weapon skills (M5b-0b part A): the pure parts. Invented content only.
import { describe, expect, it } from 'vitest';
import { allowedPicks, isNotAWeaponType, optionIsOn, ownerMayChange, picksUsed, proficiencyFor, unspentPicks, weaponChoices, weaponLine, weaponPenalty, weaponSkillsOf } from './weaponSkills.ts';
import { classAllowsWeapon } from '../inventory/equipWarnings.ts';

const rules = {
  weaponProficiency: {
    option: 'weapon-skills',
    note: 'Fighters train with a few weapons.',
    byCategory: { martial: { start: 3, gainEvery: 3, penalty: -2 }, mild: { start: 1, gainEvery: 6, penalty: -5 } },
    specialisation: { option: 'specialise', categories: ['martial'], cost: 2, bonus: { attack: 1, damage: 2 }, note: 'One weapon only.' },
    restrictedWeapons: { option: 'restricted', note: 'Usable with the penalty.' },
  },
};
const warden = { weaponProficiencyCategory: 'martial', weaponsAllowed: { mode: 'tags', allowTags: ['Melee'] } };
const on = { 'weapon-skills': 'on', specialise: 'on', restricted: 'on' };
const item = (id: string, data: Record<string, unknown>) => ({ packEntryId: id, name: id.replace('-', ' '), data });
const spear = item('reed-spear', { weapon: { damage: 'd6' }, weaponTags: ['Melee'], hands: 2, category: 'polearms' });
const knife = item('eel-knife', { weapon: { damage: 'd4' }, weaponTags: ['Melee'], hands: 1, category: 'blades' });
const sling = item('bog-sling', { weapon: { damage: 'd4' }, weaponTags: ['Missile'], category: 'missiles' });
const lamp = item('reed-lamp', { category: 'tools' });

describe('weapon skills', () => {
  it('there is a step only while the option is on and the class names a category the rule knows', () => {
    expect(proficiencyFor([rules], warden, on)).not.toBeNull();
    expect(proficiencyFor([rules], warden, { ...on, 'weapon-skills': 'off' })).toBeNull();
    expect(proficiencyFor([rules], {}, on)).toBeNull();
    expect(proficiencyFor([rules], { weaponProficiencyCategory: 'none-such' }, on)).toBeNull();
    expect(proficiencyFor([{}], warden, on)).toBeNull();
    expect(optionIsOn('weapon-skills:full', { 'weapon-skills': 'full' })).toBe(true);
  });

  it('specialisation and restricted weapons apply only with their options on (and the category for specialising)', () => {
    expect(proficiencyFor([rules], warden, on)?.specialisation).toEqual({ cost: 2, attack: 1, damage: 2, note: 'One weapon only.' });
    expect(proficiencyFor([rules], warden, { 'weapon-skills': 'on' })?.specialisation).toBeNull();
    expect(proficiencyFor([rules], { weaponProficiencyCategory: 'mild' }, on)?.specialisation).toBeNull();
    expect(proficiencyFor([rules], warden, on)?.restricted).toEqual({ note: 'Usable with the penalty.' });
  });

  it('the count is start, plus one every gainEvery levels; a specialised weapon counts its cost', () => {
    const p = proficiencyFor([rules], warden, on)!;
    expect(allowedPicks(p, 1)).toBe(3);
    expect(allowedPicks(p, 3)).toBe(3);
    expect(allowedPicks(p, 4)).toBe(4);
    expect(picksUsed([{ itemId: 'reed-spear', specialised: true }, { itemId: 'eel-knife' }], p)).toBe(3);
    expect(unspentPicks([{ itemId: 'reed-spear' }], p, 4)).toBe(3);
  });

  it('offers the weapons the class may use, grouped by category; the rest are restricted; non-weapons left out', () => {
    const { groups, restricted } = weaponChoices([spear, knife, sling, lamp], warden, (id) => (id === 'blades' ? { name: 'Blades', order: 1 } : undefined));
    expect(groups.map((g) => [g.name, g.items.map((i) => i.packEntryId)])).toEqual([
      ['Blades', ['eel-knife']],
      ['Polearms', ['reed-spear']],
    ]);
    expect(restricted.map((i) => i.packEntryId)).toEqual(['bog-sling']);
    expect(weaponLine(spear)).toBe('d6, melee, two-handed');
  });

  // Purpose (R3-12): a weapon is a skill pick unless the pack says it isn't a type: a variant (baseId) or an improvised
  // weapon (weapon.improvised) is left out of the list, and a variant counts as skilled when its base type is picked.
  it('leaves variants and improvised weapons out; a variant is skilled through its base type', () => {
    const keen = { ...knife, packEntryId: 'keen-eel-knife', name: 'Keen eel knife', data: { ...knife.data, baseId: 'eel-knife' } };
    const pole = { packEntryId: 'reed-pole', name: 'Reed pole', data: { category: 'polearms', weapon: { damage: 'd4', improvised: true }, weaponTags: ['Melee'] } };
    expect(isNotAWeaponType(keen)).toBe(true);
    expect(isNotAWeaponType(pole)).toBe(true);
    expect(isNotAWeaponType(knife)).toBe(false);
    const { groups, restricted } = weaponChoices([spear, knife, keen, pole, sling], warden, () => undefined);
    const offered = [...groups.flatMap((g) => g.items), ...restricted].map((i) => i.packEntryId);
    expect(offered).not.toContain('keen-eel-knife');
    expect(offered).not.toContain('reed-pole');
    expect(offered).toEqual(expect.arrayContaining(['eel-knife', 'reed-spear', 'bog-sling']));
    const p = proficiencyFor([rules], warden, on)!;
    expect(weaponPenalty([{ itemId: 'eel-knife' }], keen, warden, p)).toEqual([]);
    expect(weaponPenalty([{ itemId: 'reed-spear' }], keen, warden, p)).toEqual([{ attack: -2, damage: 0, source: 'not a weapon skill of yours', label: 'Not a weapon skill of yours' }]);
  });

  it('weaponPenalty: the penalty with its source for an unpicked or restricted weapon, the bonus when specialised, else nothing', () => {
    const p = proficiencyFor([rules], warden, on)!;
    const picks = [{ itemId: 'reed-spear', specialised: true as const }, { itemId: 'eel-knife' }];
    expect(weaponPenalty(picks, spear, warden, p)).toEqual([{ attack: 1, damage: 2, source: 'specialised', label: 'Specialised' }]);
    expect(weaponPenalty(picks, knife, warden, p)).toEqual([]);
    expect(weaponPenalty([], knife, warden, p)).toEqual([{ attack: -2, damage: 0, source: 'not a weapon skill of yours', label: 'Not a weapon skill of yours' }]);
    expect(weaponPenalty([], sling, warden, p)).toEqual([{ attack: -2, damage: 0, source: "not your class's weapon", label: 'Not your class’s weapon' }]);
    expect(weaponPenalty([], knife, warden, null)).toEqual([]);
  });

  // Purpose (as-4, R3-5 "usable with the penalty"): a weapon outside the class that the GM approved as a pick keeps the
  // penalty, with the class as its source; before as-4 the pick made it return nothing.
  it('weaponPenalty: an out-of-class weapon the GM approved as a pick still carries the penalty', () => {
    const p = proficiencyFor([rules], warden, on)!;
    expect(weaponPenalty([{ itemId: 'bog-sling' }], sling, warden, p)).toEqual([{ attack: -2, damage: 0, source: "not your class's weapon", label: 'Not your class’s weapon' }]);
  });

  // Purpose (#606 review): the class side agrees with the equip check: a weapon a rules set's weapon rule allows for the
  // class's combat category, or one the class's current form allows, carries no class penalty (only the skill's).
  it('weaponPenalty: a weapon allowed by a weapon rule or by the form in play carries no class penalty', () => {
    const p = proficiencyFor([rules], warden, on)!;
    const slingData = { ...sling.data, id: 'bog-sling', name: 'bog sling' };
    const byRule = [{ category: 'Missile', classCategories: ['martial'] }];
    const ruleOk = classAllowsWeapon({ class: warden }, slingData, byRule);
    expect(ruleOk).toBe(true);
    expect(weaponPenalty([], sling, warden, p, ruleOk)[0]?.source).toBe('not a weapon skill of yours');
    expect(weaponPenalty([{ itemId: 'bog-sling' }], sling, warden, p, ruleOk)).toEqual([]);
    const shifter = { ...warden, forms: [{ id: 'heron', name: 'Heron', weaponsAllowed: { mode: 'tags', allowTags: ['Missile'] } }] };
    const formOk = classAllowsWeapon({ class: shifter, formId: 'heron' }, slingData);
    expect(formOk).toBe(true);
    expect(weaponPenalty([{ itemId: 'bog-sling' }], sling, shifter, p, formOk)).toEqual([]);
    // Without either, the equip check blocks it and the penalty is the class's.
    const blocked = classAllowsWeapon({ class: warden }, slingData);
    expect(blocked).toBe(false);
    expect(weaponPenalty([{ itemId: 'bog-sling' }], sling, warden, p, blocked)[0]?.source).toBe("not your class's weapon");
  });

  // Purpose (as-7, ruled 2026-11-10, m5b-evening-rulings): specialised in a weapon outside the class (the GM approved it)
  // brings both rows, "Specialised" and "Not your class’s weapon", so the line nets them; before, the class penalty alone.
  it('weaponPenalty: specialised in an out-of-class weapon, both the specialisation and the class penalty', () => {
    const p = proficiencyFor([rules], warden, on)!;
    expect(weaponPenalty([{ itemId: 'bog-sling', specialised: true }], sling, warden, p)).toEqual([
      { attack: 1, damage: 2, source: 'specialised', label: 'Specialised' },
      { attack: -2, damage: 0, source: "not your class's weapon", label: 'Not your class’s weapon' },
    ]);
  });

  // Purpose (as-4, R3-12): a variant is specialised through its base type; a specialisation with no bonus in the pack
  // brings no row (nothing), and a rule without a penalty brings nothing for an out-of-class weapon.
  it('weaponPenalty: a variant specialised through its base; no bonus and no penalty bring nothing', () => {
    const p = proficiencyFor([rules], warden, on)!;
    const keen = { ...knife, packEntryId: 'keen-eel-knife', name: 'Keen eel knife', data: { ...knife.data, baseId: 'eel-knife' } };
    expect(weaponPenalty([{ itemId: 'eel-knife', specialised: true }], keen, warden, p)[0]?.label).toBe('Specialised');
    const bare = { ...p, specialisation: { ...p.specialisation!, attack: 0, damage: 0 } };
    expect(weaponPenalty([{ itemId: 'eel-knife', specialised: true }], knife, warden, bare)).toEqual([]);
    expect(weaponPenalty([], sling, warden, { ...p, penalty: 0 })).toEqual([]);
  });

  it('after approval the owner may only add unspecialised picks', () => {
    const was = [{ itemId: 'reed-spear' }];
    expect(ownerMayChange(was, [...was, { itemId: 'eel-knife' }])).toBe(true);
    expect(ownerMayChange(was, [])).toBe(false);
    expect(ownerMayChange(was, [{ itemId: 'reed-spear', specialised: true }])).toBe(false);
    expect(ownerMayChange(was, [...was, { itemId: 'eel-knife', specialised: true }])).toBe(false);
  });

  it('reads saved picks safely: each weapon once, specialised only as true', () => {
    expect(weaponSkillsOf([{ itemId: 'a' }, { itemId: 'a' }, { itemId: 'b', specialised: true }, 'c', { itemId: '' }])).toEqual([{ itemId: 'a' }, { itemId: 'b', specialised: true }]);
    expect(weaponSkillsOf(null)).toEqual([]);
  });
});
