// Comparing skills written on different scales (ex-3, ga-4; skillChance.ts). Every name and number is invented.
import { describe, expect, it } from 'vitest';
import { bestSkill, compareChance, onScale, successChance } from './skillChance.ts';

describe('a skill value as its chance of success', () => {
  it('reads each notation the packs use: a target on its die, x-in-N, a run of faces, a percentage', () => {
    expect(successChance(5, { die: 'd6', rollMode: 'equal-or-over' })).toEqual({ hits: 2, sides: 6 });
    expect(successChance('5+', { die: 'd6' })).toEqual({ hits: 2, sides: 6 });
    expect(successChance(2, { die: 'd6' })).toEqual({ hits: 2, sides: 6 });
    expect(successChance('2-in-6', {})).toEqual({ hits: 2, sides: 6 });
    expect(successChance('1-3', { die: 'd6' })).toEqual({ hits: 3, sides: 6 });
    expect(successChance(35, { die: '%' })).toEqual({ hits: 35, sides: 100 });
    expect(successChance('40%', {})).toEqual({ hits: 40, sides: 100 });
  });

  it("a run of faces counts on a d6 when the die's words name one, and is never guessed otherwise", () => {
    expect(successChance('1-2', { die: 'd% (EAR on d6)' })).toEqual({ hits: 2, sides: 6 });
    expect(successChance('1-2', { die: 'd%' })).toBeNull();
    expect(successChance('1-9', { die: 'd6' })).toBeNull();
    expect(successChance('special', { die: 'd6' })).toBeNull();
    expect(successChance(null, { die: 'd6' })).toBeNull();
  });

  it('compares chances on different dice by whole numbers', () => {
    expect(compareChance({ hits: 2, sides: 6 }, { hits: 1, sides: 3 })).toBe(0);
    expect(compareChance({ hits: 35, sides: 100 }, { hits: 2, sides: 6 })).toBeGreaterThan(0);
  });
});

describe('the best of several skills', () => {
  const chance = (c: { value: unknown; die: string; rollMode?: string }) => successChance(c.value, c);

  it('counts the highest chance; on a tie the first listed; one that cannot be told is passed over', () => {
    const hark = { value: 6, die: 'd6', rollMode: 'equal-or-over' };
    const ear = { value: '1-2', die: 'd6' };
    const sense = { value: 'by feel', die: 'd6' };
    expect(bestSkill([hark, ear], chance)).toBe(ear);
    expect(bestSkill([{ value: 5, die: 'd6', rollMode: 'equal-or-over' }, ear], chance)?.value).toBe(5);
    expect(bestSkill([sense, hark], chance)).toBe(hark);
    expect(bestSkill([sense], chance)).toBeNull();
  });

  it("writes a chance back on another skill's scale, only on a whole face", () => {
    expect(onScale({ hits: 2, sides: 6 }, { die: 'd6', rollMode: 'equal-or-over' })).toBe(5);
    expect(onScale({ hits: 3, sides: 6 }, { die: 'd6' })).toBe(3);
    expect(onScale({ hits: 1, sides: 4 }, { die: '%' })).toBe(25);
    expect(onScale({ hits: 1, sides: 4 }, { die: 'd6' })).toBeNull();
    expect(onScale({ hits: 1, sides: 6 }, { die: 'by feel' })).toBeNull();
  });
});
