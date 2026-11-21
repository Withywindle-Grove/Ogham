// mb-5 (ruled 2026-11-04): a `worn` slot. Gloves, rings and belts go on without taking a hand or the armour place;
// any number may be worn; Wear and Take off work as for armour; their effects (a carryBonus) count only while worn.
// Invented names only.
import { describe, expect, it } from 'vitest';
import { placeKit, type KitPiece } from '../modules/characters/kitPlaces.ts';
import { equipCheckWith } from './EquipWarning.tsx';
import { carriedLoad, combineEncumbrance, toLoadLine } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { isWornSlot, wornText } from '../modules/inventory/packView.ts';

const rules = combineEncumbrance([
  { mode: 'coin', coin: { maxLoadCoin: 1000, tiers: [{ label: 'Easy', max: 300 }, { label: 'Bowed', max: 1000 }], overMax: 'Stuck' } },
]);

let next = 0;
const line = (name: string, details: Record<string, unknown>, extra: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `line-${++next}`,
    campaignId: 'campaign-reedmouth',
    actorId: 'actor-wren',
    locationId: null,
    libraryEntryId: null,
    name,
    category: 'gear',
    weightCoin: 10,
    slots: null,
    stack: 1,
    qty: 1,
    containerLineId: null,
    equipped: false,
    details,
    perUnits: 1,
    approval: 'approved',
    ...extra,
  }) as InventoryLine;

describe('the worn slot (mb-5)', () => {
  // Purpose: gauntlets worn beside a sword and shield raise the limit; in the pack they don't.
  it('gauntlets worn beside a sword and shield raise the limit; carried in the pack, they do not', () => {
    const piece = (name: string, data: Record<string, unknown>): KitPiece<string> => ({ item: name, name, qty: 1, data });
    const placed = placeKit(
      [piece('Reed sword', { slot: 'hand' }), piece('Round shield', { slot: 'shield' }), piece('Ogre grips', { slot: 'worn', carryBonus: 200 }), piece('Backpack', { container: {} })],
      () => null,
    );
    expect(placed.map((p) => [p.name, p.place])).toEqual([
      ['Backpack', 'carried'],
      ['Reed sword', 'hand'],
      ['Round shield', 'hand'],
      ['Ogre grips', 'worn'],
    ]);
    const sword = line('Reed sword', { slot: 'hand' }, { equipped: true });
    const shield = line('Round shield', { slot: 'shield' }, { equipped: true });
    const grips = (equipped: boolean) => line('Ogre grips', { slot: 'worn', carryBonus: 200 }, { equipped });
    expect(carriedLoad([sword, shield, grips(true)].map(toLoadLine), rules, 'coin')).toMatchObject({ capacity: 1200, bonuses: [{ name: 'Ogre grips', amount: 200 }] });
    expect(carriedLoad([sword, shield, grips(false)].map(toLoadLine), rules, 'coin')).toMatchObject({ capacity: 1000 });
  });

  // Purpose: any number of worn things go on, beside armour, and none is offered for taking off to make room.
  it('any number may be worn, beside armour, and none is in the way of another', () => {
    const piece = (name: string, data: Record<string, unknown>): KitPiece<string> => ({ item: name, name, qty: 1, data });
    const placed = placeKit([piece('Quilted coat', { slot: 'armour' }), piece('Reed ring', { slot: 'worn' }), piece('Otter belt', { slot: 'worn' })], () => null);
    expect(placed.map((p) => p.place)).toEqual(['worn', 'worn', 'worn']);
    const ring = line('Reed ring', { slot: 'worn' }, { equipped: true });
    const belt = line('Otter belt', { slot: 'worn' });
    expect(equipCheckWith(null, belt, [ring, belt]).equipped).toEqual({});
  });

  // Purpose: a worn item reads "Worn" on the Pack, like armour, and its sheet offers Wear.
  it('reads as worn, like armour', () => {
    expect(wornText(line('Reed ring', { slot: 'worn' }, { equipped: true }))).toBe('Worn');
    expect(isWornSlot('worn')).toBe(true);
    expect(isWornSlot('armour')).toBe(true);
    expect(isWornSlot('hand')).toBe(false);
  });
});
