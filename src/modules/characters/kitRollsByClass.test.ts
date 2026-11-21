// Quick-kit rolls by class (eq-9; plan docs/plans/m5b-review-area-3.md, build order 13). Invented content only.
// Purposes:
//   A fighter sees only the fighter's quick-kit rolls (and the rolls for every class); a reed-witch sees only hers.
//   A roll without forClasses shows to every class; one id written alone counts like a list of one.
//   With no class known, every roll shows (the reader's default for other callers).
//   The picks follow the class's own rolls: the fighter's first pick is the fighter's first roll's row.
import { describe, expect, it } from 'vitest';
import { gearContextOf, kitRolls, kitTaken, noRollPicks, rollForClass } from './startingGear.ts';

const quickKit = {
  items: [{ itemId: 'reed-lamp', qty: 1 }],
  rolls: [
    { name: 'Weapon', die: '1d6', forClasses: ['lantern-warden'], rows: [{ min: 1, max: 3, items: [{ itemId: 'hooked-staff' }] }, { min: 4, max: 6, items: [{ itemId: 'eel-spear' }] }] },
    { name: 'Charm', die: '1d4', forClasses: ['reed-witch'], rows: [{ min: 1, max: 4, items: [{ itemId: 'bone-charm' }] }] },
    { name: 'Armour', die: '1d6', forClasses: ['lantern-warden', 'bog-knight'], rows: [{ min: 1, max: 6, items: [{ itemId: 'quilted-coat' }] }] },
    { name: 'Trinket', die: '1d4', rows: [{ min: 1, max: 4, items: [{ itemId: 'tin-whistle' }] }] },
    { name: 'Satchel', die: '1d4', forClasses: 'reed-witch', rows: [{ min: 1, max: 4, items: [{ itemId: 'herb-satchel' }] }] },
  ],
};

describe('quick-kit rolls by class (eq-9)', () => {
  it("a fighter sees only the fighter's quick-kit rolls, and the rolls for every class", () => {
    expect(kitRolls(quickKit, gearContextOf(null, undefined, 'lantern-warden')).map((r) => r.name)).toEqual(['Weapon', 'Armour', 'Trinket']);
    expect(kitRolls(quickKit, gearContextOf(null, undefined, 'reed-witch')).map((r) => r.name)).toEqual(['Charm', 'Trinket', 'Satchel']);
  });

  it('a roll without forClasses shows to every class; one id alone counts like a list of one', () => {
    expect(rollForClass({ name: 'Trinket' }, 'anyone')).toBe(true);
    expect(rollForClass({ forClasses: [] }, 'anyone')).toBe(true);
    expect(rollForClass({ forClasses: 'reed-witch' }, 'reed-witch')).toBe(true);
    expect(rollForClass({ forClasses: 'reed-witch' }, 'bog-knight')).toBe(false);
  });

  it('with no class known, every roll shows', () => {
    expect(kitRolls(quickKit).map((r) => r.name)).toEqual(['Weapon', 'Charm', 'Armour', 'Trinket', 'Satchel']);
    expect(kitRolls(quickKit, gearContextOf(null)).length).toBe(5);
  });

  it("the picks follow the class's own rolls", () => {
    const ctx = gearContextOf(null, undefined, 'lantern-warden');
    expect(noRollPicks(quickKit, ctx)).toHaveLength(3);
    expect(kitTaken(quickKit, [[1], [0], [0]], ctx).map((l) => l.itemId)).toEqual(['reed-lamp', 'eel-spear', 'quilted-coat', 'tin-whistle']);
  });
});
