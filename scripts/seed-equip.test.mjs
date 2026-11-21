// Tests for putting a seeded character's kit on (scripts/seed-equip.mjs). Invented content only; no network.
// wearKit itself (it reads the pack and calls inventory.equip) is only exercised by a live run.
import { describe, expect, it } from 'vitest';
import { equipCheckWith, equipOrder } from './seed-equip.mjs';

const line = (id, details, extra = {}) => ({ id, name: `Thing ${id}`, qty: 1, equipped: false, sourceEntryId: id, details, version: 1, ...extra });
const armour = line('mail', { slot: 'armour', armourType: 'heavy' });
const shield = line('buckler', { slot: 'shield' });
const spear = line('spear', { slot: 'hand', hands: 1, weapon: { damage: 'd6' } });
const pike = line('pike', { slot: 'hand', hands: 2, weapon: { damage: 'd8' } });

describe('which kit things go on', () => {
  // Purpose: the first armour and shield are worn and the first weapon that fits the free hands is held.
  it('wears the armour and shield and holds the first weapon, in that order', () => {
    const { order, left } = equipOrder([spear, shield, armour, pike]);
    expect(order.map((o) => [o.line.id, o.role])).toEqual([['mail', 'worn'], ['buckler', 'worn'], ['spear', 'held']]);
    expect(left).toEqual([]);
  });

  it('says so when a two-handed weapon cannot be held with the shield on, and never holds a stack', () => {
    const two = equipOrder([shield, pike]);
    expect(two.order.map((o) => o.line.id)).toEqual(['buckler']);
    expect(two.left[0]).toContain('both hands');
    const stack = equipOrder([line('darts', { slot: 'hand', weapon: {} }, { qty: 6 })]);
    expect(stack.order).toEqual([]);
  });

  it('does nothing for a kit with no armour, shield or weapon', () => {
    expect(equipOrder([line('rope', {}), line('lamp', { container: { capacity: 3 } })])).toEqual({ order: [], left: [] });
  });
});

describe('the class rules and the setting warnings', () => {
  // Purpose: what the class cannot use is reported, not forced; a character with nothing to check is let through.
  const context = (armourAllowed) => ({ hooks: [], character: { name: 'Test', level: 1, class: { name: 'Lamplighter', armourAllowed } } });

  it('blocks armour the class rule leaves out, with the class and item named', () => {
    const check = equipCheckWith(context({ types: ['light'] }), armour, [armour]);
    expect(check.blocked).toHaveLength(1);
    expect(check.blocked[0]).toContain("can't use");
  });

  it('lets through armour the class rule allows, and everything when there is no context to check', () => {
    expect(equipCheckWith(context({ types: 'any' }), armour, [armour]).blocked).toEqual([]);
    expect(equipCheckWith(null, armour, [armour])).toMatchObject({ blocked: [], warnings: [] });
  });

  it('knows what is already worn, by where, so a second suit can be warned about', () => {
    const worn = line('old', { slot: 'armour' }, { equipped: true });
    expect(equipCheckWith(null, armour, [armour, worn]).equipped.armour.id).toBe('old');
  });
});
