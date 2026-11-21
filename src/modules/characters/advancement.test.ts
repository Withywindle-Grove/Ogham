// The full sheet's Advancement section (sr-5): XP with a bar to the next level, the prime bonus and its reason, the
// title. Invented names and numbers only.
import { describe, expect, it } from 'vitest';
import { advancementOf } from './advancement.ts';
import { levelExperience } from './sheetCombat.ts';

const xpTable = { levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }, { level: 3, xp: 3000 }] };
const rulesSets = [{ primeRequisiteXp: [{ range: '3-8', xp: -10 }, { range: '9-12', xp: 0 }, { range: '13-18', xp: 5 }] }];
const warden = { name: 'Lantern Warden', primeRequisites: ['MUS'], primeXp: { type: 'standard' } };
const base = { xp: 0, level: 1, xpTable, klass: warden, rulesSets, scores: { MUS: 13 }, shortName: (k: string) => k, title: 'Lamplighter' };

describe('Advancement (sr-5)', () => {
  // Purpose: the XP line, the experience over the next level's figure as the bar, and how far to go in words.
  it('says the XP and how far it is to the next level', () => {
    expect(advancementOf(base)).toMatchObject({ line: 'Level 1, 0 XP', fraction: 0, next: '1,500 to level 2' });
    expect(advancementOf({ ...base, xp: 2250, level: 2 })).toMatchObject({ line: 'Level 2, 2,250 XP', fraction: 0.75, next: '750 to level 3' });
  });

  // Purpose (tf-A5): a character exactly at a level's start shows a bar filled to its experience over the next level's
  // figure, never empty above 0 experience; the bar's width matches the two numbers of the line beside it.
  it('fills the bar to the experience over the next level, as the line beside it reads', () => {
    expect(advancementOf({ ...base, xp: 1500, level: 2 }).fraction).toBe(0.5);
    expect(advancementOf({ ...base, xp: 3000, level: 2 }).fraction).toBe(1);
    expect(advancementOf({ ...base, xp: 1, level: 1 }).fraction).toBeGreaterThan(0);
    for (const [xp, level] of [[0, 1], [600, 1], [1500, 2], [2400, 2], [2999, 2]] as const) {
      const { fraction } = advancementOf({ ...base, xp, level });
      const [have, of] = levelExperience(xp, level, xpTable).match(/[\d,]+/g)!.map((n) => Number(n.replace(/,/g, '')));
      expect(fraction, `${xp} at level ${level}`).toBeCloseTo(have! / of!);
      if (xp > 0) expect(fraction).toBeGreaterThan(0);
    }
  });

  // Purpose: XP at or past the next level's says so in words and fills the bar; the table's top level has no bar.
  it('says when there is enough for the next level, and shows no bar at the top', () => {
    expect(advancementOf({ ...base, xp: 1600 })).toMatchObject({ fraction: 1, next: 'Enough for level 2' });
    expect(advancementOf({ ...base, xp: 3200, level: 3 })).toMatchObject({ fraction: null, next: '' });
    expect(advancementOf({ ...base, xpTable: null })).toMatchObject({ fraction: null, next: '' });
  });

  // Purpose: the prime bonus shows with its reason (the prime and its score); a class with no prime has no bonus row.
  it('gives the prime bonus with its reason', () => {
    expect(advancementOf(base).bonus).toEqual({ value: '+5%', reason: 'prime MUS 13' });
    expect(advancementOf({ ...base, scores: { MUS: 6 } }).bonus).toEqual({ value: '−10%', reason: 'prime MUS 6' });
    expect(advancementOf({ ...base, klass: { name: 'Mudlark' } }).bonus).toBeNull();
  });

  // Purpose: the level title comes through as written, and no XP recorded reads as 0, never a blank.
  it('keeps the title and reads no XP as 0', () => {
    expect(advancementOf(base).title).toBe('Lamplighter');
    expect(advancementOf({ ...base, title: undefined }).title).toBe('');
    expect(advancementOf({ ...base, xp: null }).line).toBe('Level 1, 0 XP');
  });
});
