// Lights burning down (docs/05; 07 lightTypes; ruled M5-8, M5-9). Invented light types.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { burnOnJump, firstToRunOut, leftIn, lightNow, readLightType } from './light.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
const TURN = 600;

describe('light types', () => {
  it('reads durations (a number, a formula from the level, permanent) and warnings (a number in the unit, or default one step)', () => {
    expect(readLightType({ id: 'rushlight', name: 'Rushlight', duration: 6, unit: 'turn', warnAt: 1, consumed: true }, units)).toMatchObject({ seconds: 6 * TURN, warnSeconds: TURN, consumed: true, fuel: null });
    expect(readLightType({ id: 'glim', duration: { formula: '6 + level' }, unit: 'turn' }, units, 3, TURN)).toMatchObject({ seconds: 9 * TURN, warnSeconds: TURN });
    expect(readLightType({ id: 'lamp', duration: 24, unit: 'turn', warnAt: { value: 2, unit: 'turn' }, fuelItemId: 'oil' }, units)).toMatchObject({ warnSeconds: 2 * TURN, fuel: 'oil' });
    expect(readLightType({ id: 'everglow', duration: 'permanent', unit: 'turn' }, units)).toMatchObject({ seconds: null, warnSeconds: null });
    expect(readLightType({ id: 'odd', duration: { formula: 'level d6' }, unit: 'turn' }, units)).toBeNull();
  });
});

describe('a lit light', () => {
  const rushlight = { id: 'r', litAt: 0, seconds: 6 * TURN, warnSeconds: TURN };

  it('warns in its last step, then goes out; time left reads in whole steps, rounded up', () => {
    expect(lightNow(rushlight, 4 * TURN)).toEqual({ left: 2 * TURN, warn: false, out: false });
    expect(lightNow(rushlight, 5 * TURN)).toEqual({ left: TURN, warn: true, out: false });
    expect(lightNow(rushlight, 6 * TURN)).toEqual({ left: 0, warn: false, out: true });
    expect(leftIn(TURN + 1, TURN)).toBe(2);
  });

  it('a jump past its end warns and burns it out once; a long jump with two lights says when each went out', () => {
    const lamp = { id: 'l', litAt: 0, seconds: 24 * TURN, warnSeconds: 2 * TURN };
    expect(burnOnJump([rushlight, lamp], 0, 10 * TURN)).toEqual([{ id: 'r', warned: true, outAt: 6 * TURN }]);
    expect(burnOnJump([rushlight, lamp], 10 * TURN, 30 * TURN)).toEqual([{ id: 'l', warned: true, outAt: 24 * TURN }]);
    expect(burnOnJump([rushlight], 6 * TURN, 7 * TURN)).toEqual([]);
  });

  it('the first light to run out (the hour track shows one light symbol)', () => {
    expect(firstToRunOut([{ id: 'l', litAt: 0, seconds: 24 * TURN, warnSeconds: null }, rushlight, { id: 'p', litAt: 0, seconds: null, warnSeconds: null }], 0)).toEqual({ id: 'r', at: 6 * TURN });
  });
});
