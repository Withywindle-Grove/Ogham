import { describe, expect, it } from 'vitest';
import { afterPlus, burstWords, downAtOf, hpLine, readHpInput, shownHp, stepHp } from './hp.ts';

describe('hit points', () => {
  it('an empty current HP shows as full, and stays empty when there is no max either', () => {
    expect(shownHp(null, 14)).toBe(14);
    expect(shownHp(9, 14)).toBe(9);
    expect(shownHp(null, null)).toBeNull();
  });

  it('+ stops at max, but never lowers HP that is already over max', () => {
    expect(afterPlus(13, 14)).toBe(14);
    expect(afterPlus(14, 14)).toBe(14);
    expect(afterPlus(16, 14)).toBe(16);
    expect(afterPlus(-2, 14)).toBe(-1);
    expect(afterPlus(5, null)).toBe(6);
  });

  it('reads "11 of 14", says when HP is over max, and shows just the number with no max', () => {
    expect(hpLine(11, 14)).toBe('11 of 14');
    expect(hpLine(-3, 14)).toBe('-3 of 14');
    expect(hpLine(16, 14)).toBe('16 of 14, over max');
    expect(hpLine(7, null)).toBe('7');
  });

  it('the keypad takes any whole number, negatives too, and nothing else', () => {
    expect(readHpInput(' 12 ')).toBe(12);
    expect(readHpInput('-4')).toBe(-4);
    expect(readHpInput('0')).toBe(0);
    for (const bad of ['', '3.5', 'ten', '1e2', '--1']) expect(readHpInput(bad)).toBeNull();
  });

  // Hit points in place (2026-11-08): − stops at 0 and never raises a figure already below it; + stops at the most.
  it('− and + step by one and stop at 0 and at the most', () => {
    expect(stepHp(5, 8, -1)).toBe(4);
    expect(stepHp(0, 8, -1)).toBe(0);
    expect(stepHp(-2, 8, -1)).toBe(-2);
    expect(stepHp(7, 8, 1)).toBe(8);
    expect(stepHp(8, 8, 1)).toBe(8);
    expect(stepHp(17, 14, 1)).toBe(17);
    expect(stepHp(999, null, 1)).toBe(1000);
  });

  // Down only from the data: the top rules set whose death rule names a whole number.
  it('reads the Down point from the rules sets, or none', () => {
    expect(downAtOf([])).toBeNull();
    expect(downAtOf([{ id: 'a' }, { id: 'b', death: { at: 0 } }, { id: 'c', death: { at: -3 } }])).toBe(0);
    expect(downAtOf([{ id: 'a', death: { at: 'zero' } }])).toBeNull();
  });

  it("words a burst's toast: damage, healing, the limits, Down only when the rules say so", () => {
    const words = (start: number, now: number, step: 1 | -1, max: number | null = 8, downAt: number | null = null) => burstWords({ name: 'Wren', start, now, max, downAt, step });
    expect(words(8, 5, -1)).toBe('Took 3 damage, 5 of 8');
    expect(words(5, 8, 1)).toBe('Healed 3, 8 of 8, at the most');
    expect(words(5, 0, -1)).toBe('Took 5 damage, 0 of 8, the lowest it goes');
    expect(words(5, 0, -1, 8, 0)).toBe('Took 5 damage, 0 of 8: Down');
    expect(words(8, 8, 1)).toBe('Wren is at the most already, 8 of 8');
    expect(words(0, 0, -1)).toBe('Wren is at the lowest already, 0 of 8');
    expect(words(0, 0, -1, 8, 0)).toBe('Wren is at the lowest already, 0 of 8: Down');
    expect(words(5, 5, 1)).toBe('No change, 5 of 8');
    expect(words(6, 5, -1, null)).toBe('Took 1 damage, HP 5');
  });
});
