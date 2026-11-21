// A weapon's range on the Attack sheet (as-2, G-219 as ruled on #588), "two-handed" said once (as-3), and ammunition that
// carries a `weapon` block for its magic bonus not counting as a weapon (mw-3's watch-out). Invented items only.
import { describe, expect, it } from 'vitest';
import { attackRange, attackRules, rangeBands, rangeHeading, rangeOf, weaponModesOf } from './weaponModes.ts';
import { isWeapon } from './packView.ts';
import { equipBlocks } from './equipWarnings.ts';
import { isWeapon as isWeaponEntry } from '../characters/weaponSkills.ts';
import type { InventoryLine } from './inventory.ts';

const REED_RANGE = { unit: 'feet', wildernessUnit: 'yards', from: 5, bands: [{ name: 'Short', upTo: 160, toHit: 1 }, { name: 'Medium', upTo: 320, toHit: 0 }, { name: 'Long', upTo: 480, toHit: -1 }] };
const REED_BOW = { name: 'Reed bow', hands: 2, weapon: { damage: '1d6', qualities: ['Missile', 'Two-handed'], range: REED_RANGE } };
const EEL_SPEAR = {
  name: 'Eel spear',
  weapon: {
    damage: '1d6',
    qualities: ['Melee', 'Missile'],
    modes: {
      button: 'grip',
      list: [
        { id: 'melee', name: 'Melee', qualities: ['Melee'] },
        { id: 'thrown', name: 'Thrown', qualities: ['Missile'], range: { unit: 'feet', bands: [{ name: 'Short', upTo: 20, toHit: 1 }, { name: 'Medium', upTo: 40, toHit: 0 }, { name: 'Long', upTo: 60, toHit: -1 }] } },
      ],
    },
  },
};

describe('a weapon’s range (as-2, G-219)', () => {
  it('reads the range as the pack writes it, with its unit and its bands', () => {
    // Purpose: the field's shape: unit, the wilderness's unit, where the first band starts, and the bands in order.
    expect(rangeOf(REED_RANGE)).toEqual({ unit: 'feet', wildernessUnit: 'yards', from: 5, bands: REED_RANGE.bands });
  });

  it('heads the range with its unit, following where the party is', () => {
    // Purpose: #588's words: yards on a wilderness expedition, feet with yards outdoors beside it when not known, and
    // feet alone for a range with no wilderness unit.
    const range = rangeOf(REED_RANGE)!;
    expect(rangeHeading(range)).toBe('Range, in feet (yards outdoors)');
    expect(rangeHeading(range, 'wilderness')).toBe('Range, in yards');
    expect(rangeHeading(range, 'dungeon')).toBe('Range, in feet');
    expect(rangeHeading({ ...range, wildernessUnit: null }, 'wilderness')).toBe('Range, in feet');
  });

  it('says each band’s reach and what it does to the roll', () => {
    // Purpose: the first band "5 to 160" with `from`, else "up to 20"; later bands "up to 320"; "+0 to hit" for a zero.
    expect(rangeBands(rangeOf(REED_RANGE)!)).toEqual([
      { name: 'Short', reach: '5 to 160', effect: '+1 to hit' },
      { name: 'Medium', reach: 'up to 320', effect: '+0 to hit' },
      { name: 'Long', reach: 'up to 480', effect: '−1 to hit' },
    ]);
    const thrown = weaponModesOf(EEL_SPEAR)!.list[1]!.range!;
    expect(rangeBands(thrown).map((b) => b.reach)).toEqual(['up to 20', 'up to 40', 'up to 60']);
  });

  it('ignores a range it can’t trust, so the quality’s text says it as before', () => {
    // Purpose: bad data falls back: a missing unit, no bands, a figure that isn't whole, bands that don't reach further,
    // a band with no name, a `from` past the first band's end.
    const bad = [
      { ...REED_RANGE, unit: '' },
      { ...REED_RANGE, bands: [] },
      { ...REED_RANGE, bands: [{ name: 'Short', upTo: 70.5, toHit: 1 }] },
      { ...REED_RANGE, bands: [{ name: 'Short', upTo: 160, toHit: 0.5 }] },
      { ...REED_RANGE, bands: [{ name: 'Short', upTo: 160, toHit: 1 }, { name: 'Medium', upTo: 100, toHit: 0 }] },
      { ...REED_RANGE, bands: [{ name: '', upTo: 160, toHit: 1 }] },
      { ...REED_RANGE, from: 200 },
      { ...REED_RANGE, wildernessUnit: 3 },
      '70/140/210',
    ];
    for (const range of bad) expect(rangeOf(range)).toBeNull();
    expect(attackRange({ weapon: { damage: '1d6', range: { ...REED_RANGE, unit: '' } } }, null)).toBeNull();
  });

  it('reads the mode’s own range first, else the weapon’s: a thrown spear has one, held in melee it has none', () => {
    // Purpose: the reading rule: the selected mode's `range`, else `weapon.range`, else nothing.
    const modes = weaponModesOf(EEL_SPEAR)!;
    expect(attackRange(EEL_SPEAR, modes.list[1]!)?.bands.map((b) => b.upTo)).toEqual([20, 40, 60]);
    expect(attackRange(EEL_SPEAR, modes.list[0]!)).toBeNull();
    expect(attackRange(REED_BOW, null)?.unit).toBe('feet');
  });
});

describe('no word twice (as-3)', () => {
  it('doesn’t add the app’s "two-handed" when a quality already says it, whatever its case', () => {
    // Purpose: a bow whose qualities say "Two-handed" shows the word once; one whose don't still gets the app's.
    expect(attackRules(REED_BOW, null)).toEqual(['Missile', 'Two-handed']);
    expect(attackRules({ hands: 2, weapon: { qualities: ['TWO-HANDED'] } }, null)).toEqual(['TWO-HANDED']);
    expect(attackRules({ hands: 2, weapon: { qualities: ['Missile'] } }, null)).toEqual(['Missile', 'two-handed']);
  });
});

describe('ammunition is not a weapon (mw-3’s watch-out)', () => {
  it('leaves magic arrows that carry a weapon block out of the weapons, the class check and the weapon lists', () => {
    // Purpose: ammunition carries `weapon.magicBonus` for its bonus; by its category it stays ammunition everywhere.
    const arrows = { category: 'ammunition', details: { weapon: { magicBonus: 1 } } } as unknown as InventoryLine;
    expect(isWeapon(arrows)).toBe(false);
    expect(isWeapon({ category: 'weapon', details: { weapon: { damage: '1d6' } } } as unknown as InventoryLine)).toBe(true);
    expect(isWeaponEntry({ packEntryId: 'ember-arrows', name: 'Ember arrows', data: { category: 'ammunition', weapon: { magicBonus: 1 } } } as never)).toBe(false);
    const character = { class: { name: 'Fen warden', weaponsAllowed: { ids: ['reed-bow'] } } };
    expect(equipBlocks(character, { id: 'ember-arrows', name: 'Ember arrows', category: 'ammunition', weapon: { magicBonus: 1 } })).toEqual([]);
  });
});
