import { describe, expect, it } from 'vitest';
import { diceRange, readRoll } from './rolls.ts';

describe('dice entry', () => {
  it('knows the lowest and highest a dice expression can give', () => {
    expect(diceRange('2d10')).toEqual({ min: 2, max: 20 });
    expect(diceRange('d6')).toEqual({ min: 1, max: 6 });
    expect(diceRange('1d6+1')).toEqual({ min: 2, max: 7 });
    expect(diceRange('3d6 - 2')).toEqual({ min: 1, max: 16 });
    expect(diceRange('4')).toEqual({ min: 4, max: 4 });
  });

  it("doesn't guess at something that isn't dice", () => {
    expect(diceRange('')).toBeNull();
    expect(diceRange('two dice')).toBeNull();
    expect(diceRange('2d0')).toBeNull();
    expect(diceRange('0d6')).toBeNull();
  });

  it('takes a whole number the dice could give, and says plainly what is wrong otherwise', () => {
    expect(readRoll(' 13 ', '2d10')).toEqual({ ok: true, value: 13 });
    expect(readRoll('21', '2d10')).toEqual({ ok: false, message: '2d10 gives 2 to 20.' });
    expect(readRoll('1', '2d10')).toEqual({ ok: false, message: '2d10 gives 2 to 20.' });
    expect(readRoll('six', '1d6')).toEqual({ ok: false, message: 'Type the number you rolled.' });
    expect(readRoll('7', 'whatever the GM says')).toEqual({ ok: true, value: 7 });
  });
});
