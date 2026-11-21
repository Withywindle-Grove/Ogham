import { describe, expect, it } from 'vitest';
import { carriedLoad, combineEncumbrance, speedOf } from '../modules/inventory/encumbrance.ts';
import type { Mode } from '../modules/expedition/modes.ts';
import { speedFromTier, terrainOf } from './travelView.ts';

// Invented tiers: a carrier's load tier carries its movement as the pack words it ("115 ft", "Move 95 ft (25 ft)").
const coinTiers = [
  { label: 'Light', max: 450, effect: 'Nothing slows you', movement: '115 ft' },
  { label: 'Heavy', max: 900, effect: 'You labour', movement: 'Move 95 ft (25 ft)' },
  { label: 'Stuffed', max: 1200, effect: 'You crawl' },
];
const slotTiers = [
  { label: 'Few things', maxSlots: 8, effect: '', movement: '55 ft' },
  { label: 'Many things', maxSlots: 14, effect: '', movement: '25 ft' },
];
const rules = combineEncumbrance([
  { mode: 'coin', coin: { tiers: coinTiers }, slot: { tiers: slotTiers }, armour: { movement: [{ armour: 'none', withoutTreasure: '115 ft', withTreasure: '95 ft' }] } },
]);

describe('speedFromTier', () => {
  // Purpose: in coin mode a carrier's speed is the first whole number in the movement of the tier they stand in.
  it('reads the first number of the matching tier in coin mode', () => {
    expect(speedFromTier(rules, 'coin', 'Light')).toBe(115);
    expect(speedFromTier(rules, 'coin', 'Heavy')).toBe(95);
  });

  // Purpose: in slot mode the same reading works on the slot tiers, not the coin ones.
  it('reads the first number of the matching tier in slot mode', () => {
    expect(speedFromTier(rules, 'slot', 'Few things')).toBe(55);
    expect(speedFromTier(rules, 'slot', 'Many things')).toBe(25);
    expect(speedFromTier(rules, 'slot', 'Light')).toBeNull();
  });

  // Purpose: in armour mode the database's line is "Move " and the armour row's movement, so the speed is its first
  // whole number, the same as speedOf reads from the load; over the limit (no number) leaves it to the GM.
  it("reads the armour row's movement in armour mode, as speedOf does", () => {
    const load = carriedLoad([], rules, 'armour');
    expect(load.mode === 'armour' && load.movement).toBe('115 ft');
    expect(speedFromTier(rules, 'armour', `Move ${load.mode === 'armour' ? load.movement : ''}`)).toBe(speedOf(load));
    expect(speedFromTier(rules, 'armour', 'Move 115 ft')).toBe(115);
    expect(speedFromTier(rules, 'armour', "Move 95' (25')")).toBe(95);
    expect(speedFromTier(rules, 'armour', 'Over the limit')).toBeNull();
    expect(speedFromTier(rules, 'armour', '')).toBeNull();
  });

  // Purpose: with no load tracked, an unknown tier, no tier or a tier with no movement, the budget asks the GM.
  it('is null in armour mode without a move line, for "not tracked", for an unknown tier, for no tier and for a tier with no movement', () => {
    expect(speedFromTier(rules, 'armour', 'Light')).toBeNull();
    expect(speedFromTier(rules, 'none', 'Light')).toBeNull();
    expect(speedFromTier(rules, 'coin', 'Bottomless')).toBeNull();
    expect(speedFromTier(rules, 'coin', null)).toBeNull();
    expect(speedFromTier(rules, 'coin', 'Stuffed')).toBeNull();
  });

  // Purpose: a rules set that gives no tiers at all leaves every speed unknown instead of throwing.
  it('is null when the rules give no tiers', () => {
    expect(speedFromTier(combineEncumbrance([]), 'coin', 'Light')).toBeNull();
  });
});

describe('terrainOf', () => {
  const mode = { terrain: [{ id: 'bog', name: 'Bog' }, { id: 'sedge', name: 'Sedge' }] } as unknown as Pick<Mode, 'terrain'>;

  // Purpose: a terrain id finds the mode's terrain of that id.
  it('finds a terrain by id', () => {
    expect(terrainOf(mode, 'sedge')?.name).toBe('Sedge');
  });

  // Purpose: no id, or an id the pack doesn't have, is "no terrain" rather than an error.
  it('is null for no id and for an id the pack lacks', () => {
    expect(terrainOf(mode, null)).toBeNull();
    expect(terrainOf(mode, undefined)).toBeNull();
    expect(terrainOf(mode, 'glacier')).toBeNull();
  });
});
