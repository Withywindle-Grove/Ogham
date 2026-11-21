// What the Light section and the burnout toast work out (M5 step 7; docs/05; ruled M5-8, M5-9, D29). Invented lights.
//   The light items a carrier can light come from its approved lines whose item names a light type the setting has;
//   used up or a holder comes from the item if it says, else the light type.
//   "Light another" picks another of the same light first, never a holder that's out of fuel.
//   The burnout toast: "Torch burnt out" with Light another, a holder's Refill (N left), or the plain words.
//   A light reads as lit, low (its warning), out (burnt out) or unlit; time left reads in its own unit.
import { describe, expect, it } from 'vitest';
import type { InventoryLine } from '../inventory/inventory.ts';
import { timeUnits } from './clock.ts';
import { anotherLight, asLit, burnoutWords, fuelLeft, leftWords, lightable, lightOfWords, lightOptions, lightState, mayLight, othersThan, pluralName, refillable, type CharacterLight } from './lightPlay.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
const TURN = 600;

const line = (id: string, name: string, qty: number, details: Record<string, unknown>, extra: Partial<InventoryLine> = {}): InventoryLine =>
  ({ id, name, qty, details, approval: 'approved', version: 1, sourceEntryId: null, ...extra }) as InventoryLine;

const types = new Map<string, Record<string, unknown>>([
  ['rushlight', { name: 'Rushlight', duration: 6, unit: 'turn', radius: '30 ft', warnAt: 1, consumed: true }],
  ['reed-lamp', { name: 'Reed lamp', duration: 4, unit: 'turn', fuel: 'fen-oil' }],
  ['glow-moss', { name: 'Glow-moss', duration: 'permanent', unit: 'turn' }],
  ['wisp', { name: 'Wisp', duration: { formula: '2 + level' }, unit: 'turn' }],
]);

const light = (over: Partial<CharacterLight>): CharacterLight => ({
  id: 'light-1',
  actorId: 'wren',
  campaignId: 'c',
  lineId: 'rush',
  typeId: 'rushlight',
  name: 'Rushlight',
  litAt: 0,
  burnSeconds: 6 * TURN,
  fullSeconds: 6 * TURN,
  warnSeconds: TURN,
  leftSeconds: null,
  consumed: true,
  fuelItem: null,
  keepLit: false,
  outAt: null,
  version: 1,
  ...over,
});

describe('the light items in a pack', () => {
  it('lists approved lines with a light type the setting has, worked out for the level; a waiting or spent line is left out', () => {
    const options = lightOptions(
      [
        line('rush', 'Rushlights', 4, { lightTypeId: 'rushlight' }),
        line('lamp', 'Reed lamp', 1, { lightTypeId: 'reed-lamp' }),
        line('wisp', 'Wisp charm', 1, { lightTypeId: 'wisp' }),
        line('rope', 'Rope', 1, {}),
        line('odd', 'Odd lamp', 1, { lightTypeId: 'not-in-the-setting' }),
        line('wait', 'Waiting lamp', 1, { lightTypeId: 'reed-lamp' }, { approval: 'pending' }),
        line('none', 'Spent rushlights', 0, { lightTypeId: 'rushlight' }),
      ],
      types,
      units,
      3,
    );
    expect(options.map((o) => [o.line.id, o.type.seconds, o.type.consumed, o.type.fuel])).toEqual([
      ['rush', 6 * TURN, true, null],
      ['lamp', 4 * TURN, false, 'fen-oil'],
      ['wisp', 5 * TURN, false, null],
    ]);
    expect(options[0]).toMatchObject({ unit: { name: 'turn', seconds: TURN }, radius: '30 ft' });
  });

  it("the item's own consumed or fuel wins over the light type's", () => {
    const [lamp] = lightOptions([line('lamp', 'Bog lantern', 1, { lightTypeId: 'rushlight', fuel: 'fen-oil' })], types, units);
    expect(lamp!.type).toMatchObject({ consumed: false, fuel: 'fen-oil' });
  });

  it('counts the fuel left in the pack', () => {
    const lines = [line('a', 'Fen oil', 2, {}, { sourceEntryId: 'fen-oil' }), line('b', 'Fen oil', 1, {}, { sourceEntryId: 'fen-oil' }), line('c', 'Fen oil', 5, {}, { sourceEntryId: 'fen-oil', approval: 'pending' })];
    expect(fuelLeft(lines, 'fen-oil')).toBe(3);
    expect(fuelLeft(lines, null)).toBe(0);
  });
});

describe('Light another and the burnout toast (D29)', () => {
  const options = lightOptions([line('lamp', 'Reed lamp', 1, { lightTypeId: 'reed-lamp' }), line('rush', 'Rushlights', 2, { lightTypeId: 'rushlight' }), line('rush-2', 'Rushlights', 1, { lightTypeId: 'rushlight' })], types, units);

  it('lights another of the same first (the same stack, then the same light), never the burnt-out lamp itself', () => {
    expect(anotherLight(options, light({ lineId: 'rush' }))?.line.id).toBe('rush');
    expect(anotherLight(options, light({ lineId: 'gone' }))?.line.id).toBe('rush');
    expect(anotherLight(options, light({ lineId: 'lamp', typeId: 'reed-lamp', fuelItem: 'fen-oil', consumed: false }))?.line.id).toBe('rush');
  });

  it('says what burnt out, with its one action, or plainly that nothing is left', () => {
    expect(burnoutWords(light({}), options, { left: 0, name: null })).toEqual({ text: 'Rushlight burnt out', action: 'light', actionLabel: 'Light another' });
    expect(burnoutWords(light({}), [], { left: 0, name: null })).toEqual({ text: 'Rushlight burnt out, No rushlights left', action: null, actionLabel: null });
    const lamp = light({ name: 'Reed lamp', lineId: 'lamp', fuelItem: 'fen-oil' });
    expect(burnoutWords(lamp, options, { left: 2, name: 'Fen oil' })).toEqual({ text: 'Reed lamp burnt out', action: 'refill', actionLabel: 'Refill (2 left)' });
    expect(burnoutWords(lamp, options, { left: 0, name: 'Fen oil' })).toEqual({ text: 'Reed lamp burnt out, Out of fen oil', action: 'light', actionLabel: 'Light another' });
    expect(burnoutWords(lamp, options.filter((o) => o.line.id === 'lamp'), { left: 0, name: 'Fen oil' }).action).toBeNull();
  });

  it('a lamp that burnt out earlier stays out of what can be lit (its line remembers), and is offered as Refill and light only with fuel', () => {
    const lines = [
      line('lamp', 'Reed lamp', 1, { lightTypeId: 'reed-lamp' }, { needsFuel: true }),
      line('rush', 'Rushlights', 2, { lightTypeId: 'rushlight' }),
      line('oil', 'Fen oil', 1, {}, { sourceEntryId: 'fen-oil' }),
    ];
    const withLamp = lightOptions(lines, types, units);
    expect(lightable(withLamp).map((o) => o.line.id)).toEqual(['rush']);
    // The current light is the rushlight, put out: the lamp isn't lightable even though it isn't the current light.
    expect(othersThan(withLamp, light({ lineId: 'rush' })).map((o) => o.line.id)).toEqual(['rush']);
    expect(refillable(withLamp, lines, 'rush').map((o) => o.line.id)).toEqual(['lamp']);
    // The current light (it has its own Refill), or no fuel in the pack: not offered.
    expect(refillable(withLamp, lines, 'lamp')).toEqual([]);
    expect(refillable(withLamp, lines.filter((l) => l.id !== 'oil'), 'rush')).toEqual([]);
  });

  it('plural names for "No … left"', () => {
    expect(['Torch', 'Rushlight', 'Lily', 'Glow-moss'].map(pluralName)).toEqual(['torches', 'rushlights', 'lilies', 'glow-mosses']);
  });
});

describe('a light now', () => {
  it('lit, then low in its last turn, then (once the clock burns it out) out; a doused one is unlit', () => {
    expect(lightState(light({}), 4 * TURN)).toBe('lit');
    expect(lightState(light({}), 5 * TURN)).toBe('low');
    expect(lightState(light({ litAt: null, outAt: 6 * TURN }), 6 * TURN)).toBe('out');
    expect(lightState(light({ litAt: null, leftSeconds: TURN }), 6 * TURN)).toBe('unlit');
    expect(lightState(null, 0)).toBe('unlit');
    expect(asLit(light({ litAt: null }))).toBeNull();
  });

  it('time left in the light type\'s own unit, rounded up; a light that never runs out "burns on"', () => {
    expect(leftWords(TURN + 1, { name: 'turn', seconds: TURN })).toBe('2 turns left');
    expect(leftWords(TURN, { name: 'turn', seconds: TURN })).toBe('1 turn left');
    expect(leftWords(null, { name: 'turn', seconds: TURN })).toBe('burns on');
  });

  it('names a light with its character, for the card and the log', () => {
    expect(lightOfWords('Ash', 'Rushlight')).toBe("Ash's rushlight");
    expect(lightOfWords('Wren of the Wardens', 'Reed lamp')).toBe("Wren of the Wardens' reed lamp");
  });
});

describe('who may light (03: the GM, or the player for their own carrier)', () => {
  const wren = { id: 'wren', campaignId: 'c', ownerUserId: 'sam' };
  it("the owner and the GM (as the database's may_play, like Spells and Abilities); not another player or an outsider", () => {
    expect(mayLight({ id: 'sam', roles: { c: 'player' } }, wren)).toBe(true);
    expect(mayLight({ id: 'priya', roles: { c: 'gm' } }, wren)).toBe(true);
    expect(mayLight({ id: 'jo', roles: { c: 'player' } }, wren)).toBe(false);
    expect(mayLight({ id: 'sam', roles: {} }, wren)).toBe(false);
  });
});
