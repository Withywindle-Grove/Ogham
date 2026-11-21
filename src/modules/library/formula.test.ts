// Working out a pack's formulas at a level (docs/07-content-packs.md, Formulas). Never rolls; anything it
// doesn't understand stays text (null here). Invented examples only.
import { describe, expect, it } from 'vitest';
import { workOut } from './formula.ts';

const at = (formula: string, level: number) => workOut(formula, level)?.text ?? null;

describe('working out a formula', () => {
  it('numbers, level and + - * /', () => {
    expect(at('2 + level', 3)).toBe('5');
    expect(at('6 + level * 2', 4)).toBe('14');
    expect(at('(6 + level) * 2', 4)).toBe('20');
    expect(at('level - 10', 3)).toBe('-7');
    expect(at('-level + 1', 3)).toBe('-2');
    expect(at('Level × 2 ÷ 2', 5)).toBe('5');
  });

  it('floor() and plain division round down, and say so when they did', () => {
    expect(workOut('floor(level / 2)', 5)).toEqual({ text: '2', roundedDown: false });
    expect(workOut('level / 2', 5)).toEqual({ text: '2', roundedDown: true });
    expect(workOut('level / 2', 4)).toEqual({ text: '2', roundedDown: false });
    expect(workOut('-level / 2', 5)).toEqual({ text: '-3', roundedDown: true });
  });

  it('dice come out as dice, never rolled', () => {
    expect(at('1d6', 3)).toBe('1d6');
    expect(at('d8', 3)).toBe('1d8');
    expect(at('level d6', 3)).toBe('3d6');
    expect(at('leveld6', 3)).toBe('3d6');
    expect(at('1d6 + floor(level / 2)', 3)).toBe('1d6 + 1');
    expect(at('2d4 + 1d4 - 1', 1)).toBe('3d4 - 1');
    expect(at('1d6 + 1d8', 1)).toBe('1d6 + 1d8');
    expect(at('(level + 1)d4', 2)).toBe('3d4');
    expect(workOut('(level / 2)d6', 5)).toEqual({ text: '2d6', roundedDown: true });
  });

  it('anything it doesn’t understand stays text', () => {
    for (const odd of ['', 'level + strength', 'level +', '2 ** 3', '1d6 * 2', 'floor 3', '1d0', '1d6 - 1d4', 'alert("hi")', '((level)', 'level 2']) {
      expect(at(odd, 3), odd).toBeNull();
    }
  });

  it('silly sizes are refused, so a bad pack can’t hang the app', () => {
    expect(at('1000d6', 1)).toBeNull();
    expect(at('2 + level', 0)).toBeNull();
    expect(at('2 + level', 100)).toBeNull();
    expect(at('1'.repeat(400), 1)).toBeNull();
    expect(at('level / 0', 3)).toBeNull();
  });

  it('an answer too big to be a game value stays text, never "Infinity"', () => {
    expect(at('9'.repeat(190), 1)).toBeNull();
    expect(at('99999 * 99999 * 99999', 1)).toBeNull();
    expect(at('1000 * level', 99)).toBe('99000');
  });
});
