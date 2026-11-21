// Tests for the starting set the seed buys in shop campaigns (design ruling si-3; scripts/seed-extras.mjs shopSet).
// Invented items only. No network.
import { describe, expect, it } from 'vitest';
import { shopSet } from './seed-extras.mjs';

const coins = [{ key: 'gp', label: 'Gold', valueInBase: 10 }, { key: 'sp', label: 'Silver', valueInBase: 1 }];
const unit = coins[0];
const item = (id, name, data) => ({ kind: 'item', packEntryId: id, name, data });

const shelf = [
  item('plate-shell', 'Plate shell', { slot: 'armour', armourType: 'heavy', value: { gp: 1 } }), // cheapest, but the class can't wear it
  item('cloth-vest', 'Cloth vest', { slot: 'armour', armourType: 'light', value: { gp: 5 } }),
  item('quilted-coat', 'Quilted coat', { slot: 'armour', armourType: 'light', value: { gp: 9 } }),
  item('wicker-shield', 'Wicker shield', { slot: 'shield', value: { gp: 2 } }),
  item('long-pike', 'Long pike', { slot: 'hand', hands: 2, weapon: { damage: 'd8' }, value: { gp: 1 } }), // cheaper, but two-handed
  item('reed-spear', 'Reed spear', { slot: 'hand', hands: 1, weapon: { damage: 'd6' }, value: { gp: 3 } }),
  item('small-sack', 'Small sack', { container: { capacity: 3 }, value: { sp: 2 } }), // the cheapest container, not a backpack
  item('trail-pack', 'Trail backpack', { container: { capacity: 8 }, value: { gp: 5 } }),
  item('daily-bread', 'Dry rations (1 day)', { value: { sp: 5 } }),
  item('tallow-candle', 'Tallow candle', { value: { sp: 1 } }),
  item('storm-lantern', 'Storm lantern', { light: { hours: 4 }, value: { gp: 10 } }),
  item('moon-lamp', 'Moon lamp', { category: 'magic-light', value: { gp: 1 } }), // not for sale
];
const klass = (armourAllowed) => ({ packEntryId: 'test-class', name: 'Lamplighter', data: { armourAllowed } });
const names = (set) => set.groups.map((g) => g.label);

describe('the starting set bought in a shop campaign', () => {
  // Purpose: with no kit, a class buys the cheapest armour and shield it may use, one weapon it may use, a backpack, a
  // week of rations and a light source, within its starting money; what can't be found or afforded is reported.
  it('buys the cheapest armour the class may use, a one-handed weapon beside the shield, the backpack by name and a week of rations', () => {
    const set = shopSet({ items: shelf, coins, unit, klass: klass({ types: ['light'], shields: true }), race: null, budget: 1000 });
    expect(names(set)).toEqual(['Cloth vest', 'Wicker shield', 'Reed spear', 'Trail backpack', 'Dry rations (1 day)', 'Tallow candle']);
    expect(set.groups.find((g) => g.label === 'Dry rations (1 day)').lines[0].qty).toBe(7); // one per day: a week is seven
    expect(set.notes).toEqual([]);
  });

  it('prices each purchase and totals them, and never sells what the pack marks as magic', () => {
    const set = shopSet({ items: shelf, coins, unit, klass: klass({ types: ['light'], shields: true }), race: null, budget: 1000 });
    expect(set.total).toBe(set.groups.reduce((n, g) => n + g.price, 0));
    expect(set.groups.find((g) => g.label === 'Cloth vest').cost).toBe('5 gp');
    expect(set.groups.some((g) => g.label === 'Moon lamp')).toBe(false);
  });

  it('takes a ration item that already feeds for a week once', () => {
    const week = [...shelf, item('week-bag', 'Rations (7 days)', { value: { sp: 3 } })];
    const set = shopSet({ items: week, coins, unit, klass: klass({ types: ['light'], shields: true }), race: null, budget: 1000 });
    expect(set.groups.find((g) => g.label === 'Rations (7 days)').lines[0].qty).toBe(1);
  });

  it('stays within the starting money and says what it could not afford', () => {
    const set = shopSet({ items: shelf, coins, unit, klass: klass({ types: ['light'], shields: true }), race: null, budget: 60 });
    expect(set.total).toBeLessThanOrEqual(60);
    expect(set.notes.some((n) => n.includes("couldn't afford"))).toBe(true);
  });

  it('says so when the class may wear no armour in the shop, and still buys the rest', () => {
    const set = shopSet({ items: shelf, coins, unit, klass: klass({ types: [] }), race: null, budget: 1000 });
    expect(set.notes.some((n) => n.includes('no armour'))).toBe(true);
    expect(names(set)).toContain('Long pike'); // no shield, so the cheapest weapon may be two-handed
  });
});
