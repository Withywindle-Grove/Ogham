// A skill's pop-up starts with one line on what succeeds and what to roll (tfs-1, 2026-11-19; plan
// test-feedback-2026-11-19 row C12; mockup december/26 frames M2c, M2d). Invented skills and dice only.
import { describe, expect, it } from 'vitest';
import { skillLines, skillRoll, skillTop } from './explain.ts';
import { skillOdds } from './skillOdds.ts';

describe('which skills are rolled the target or higher on one die (tfs-1)', () => {
  // Purpose: a d6 skill "2 in 6" succeeds on its top two faces, so it is the target 5 or higher; 1 in 6 is 6+.
  it('reads "N in 6" on a d6 as the target 7 − N or higher', () => {
    expect(skillRoll(2, 'd6')).toEqual({ target: 5, sides: 6 });
    expect(skillRoll('1-in-6', undefined)).toEqual({ target: 6, sides: 6 });
    expect(skillRoll('6 in 6', undefined)).toEqual({ target: 1, sides: 6 });
  });

  // Purpose: a skill rolled equal-or-over its number reads that number as its target, on the die it names.
  it('reads an equal-or-over skill as its own number, on its own die', () => {
    expect(skillRoll(5, 'd6', 'equal-or-over')).toEqual({ target: 5, sides: 6 });
    expect(skillRoll(14, 'd20', 'equal-or-over')).toEqual({ target: 14, sides: 20 });
    expect(skillRoll('5+', 'd8')).toEqual({ target: 5, sides: 8 });
  });

  // Purpose: a percentage, a low roll written as faces ("1-2"), a value in words, an unknown die or a target past the
  // die is not this kind: it keeps today's top line (⚑ 13), so nothing is invented for it.
  it('gives nothing for any other kind, or a die or target it cannot name', () => {
    expect(skillRoll(35, '%')).toBeNull();
    expect(skillRoll('1-2', 'd6')).toBeNull();
    expect(skillRoll('special', undefined)).toBeNull();
    expect(skillRoll(5, undefined, 'equal-or-over')).toBeNull();
    expect(skillRoll(5, 'd7', 'equal-or-over')).toBeNull();
    expect(skillRoll(7, 'd6', 'equal-or-over')).toBeNull();
    expect(skillRoll(0, 'd6', 'equal-or-over')).toBeNull();
    expect(skillRoll('5+', undefined)).toBeNull();
    expect(skillRoll(999, 'd6')).toBeNull();
  });
});

describe("the skill's row and its pop-up read the same value the same way (tfs-1)", () => {
  // Purpose: skillOdds writes the row ("2-in-6", "5+", "35%") and skillRoll the pop-up's top line; run over the same
  // inputs, a skill the row writes "N in 6" pops up "Succeeds on a (7 − N)+", one the row writes "T+" pops up
  // "Succeeds on a T+", and anything else keeps today's words, so the two can never disagree (a "D6" in capitals
  // included: the row doesn't read it as a d6, so neither does the pop-up).
  const cases: { value: string | number; die?: string; rollMode?: string; shown: string; top: string }[] = [
    { value: 2, die: 'd6', shown: '2-in-6', top: 'Succeeds on a 5+, roll 1d6' },
    { value: 1, die: 'd6', shown: '1-in-6', top: 'Succeeds on a 6+, roll 1d6' },
    { value: 6, die: 'd6', shown: '6-in-6', top: 'Succeeds on a 1+, roll 1d6' },
    { value: '3-in-6', shown: '3-in-6', top: 'Succeeds on a 4+, roll 1d6' },
    { value: 2, die: ' d6 ', shown: '2-in-6', top: 'Succeeds on a 5+, roll 1d6' },
    { value: 2, die: 'D6', shown: '2', top: '2, as your setting gives it.' },
    { value: 5, die: 'd6', rollMode: 'equal-or-over', shown: '5+', top: 'Succeeds on a 5+, roll 1d6' },
    { value: 14, die: 'd20', rollMode: 'equal-or-over', shown: '14+', top: 'Succeeds on a 14+, roll 1d20' },
    { value: '5+', die: 'd8', shown: '5+', top: 'Succeeds on a 5+, roll 1d8' },
    { value: '5+', shown: '5+', top: 'Succeeds on 5 or more' },
    { value: 35, die: '%', shown: '35%', top: 'Succeeds on 35 or less on d100, 35 in 100' },
    { value: '1-2', die: 'd6', shown: '1-2', top: '1-2, as your setting gives it.' },
    { value: 0, die: 'd6', shown: '0', top: '0, as your setting gives it.' },
    { value: 999, die: 'd6', shown: '999', top: '999, as your setting gives it.' },
  ];
  for (const c of cases) {
    it(`${JSON.stringify(c.value)} on ${c.die ?? 'no die'}${c.rollMode ? `, ${c.rollMode}` : ''}: the row "${c.shown}", the pop-up "${c.top}"`, () => {
      const odds = skillOdds(c.value, c.die, c.rollMode);
      expect(odds.shown).toBe(c.shown);
      expect(skillTop(odds, skillRoll(c.value, c.die, c.rollMode))).toBe(c.top);
    });
  }

  // Purpose: 6 in 6 succeeds on every face, and the line says so plainly as the target 1.
  it('6-in-6 reads "Succeeds on a 1+"', () => {
    expect(skillRoll('6-in-6', undefined)).toEqual({ target: 1, sides: 6 });
    expect(skillTop(skillOdds('6-in-6', undefined), skillRoll('6-in-6', undefined))).toBe('Succeeds on a 1+, roll 1d6');
  });
});

describe("a skill's top line in words (tfs-1)", () => {
  // Purpose: the line is "Succeeds on a 5+, roll 1d6", with no "+0" and no "+N" (nothing in a pack adds to a skill's
  // roll yet), and a skill rolled another way keeps today's words.
  it('reads "Succeeds on a 5+, roll 1d6", and today\'s words for any other kind', () => {
    expect(skillTop(skillOdds(2, 'd6'), skillRoll(2, 'd6'))).toBe('Succeeds on a 5+, roll 1d6');
    expect(skillTop(skillOdds(35, '%'), skillRoll(35, '%'))).toBe('Succeeds on 35 or less on d100, 35 in 100');
    expect(skillTop(skillOdds('1-2', 'd6'), null)).toBe('1-2, as your setting gives it.');
  });

  // Purpose: under the top line only the GM's secret roll may follow; nothing on where the number comes from.
  it('adds only the line about the GM rolling it in secret', () => {
    const hark = { ...skillOdds(6, 'd6', 'equal-or-over'), gmRolls: false };
    expect(skillLines(hark, skillRoll(6, 'd6', 'equal-or-over'))).toEqual(['Succeeds on a 6+, roll 1d6']);
    expect(skillLines({ ...hark, gmRolls: true }, skillRoll(6, 'd6', 'equal-or-over'))).toEqual(['Succeeds on a 6+, roll 1d6', 'Your GM rolls this one secretly and tells you what happens.']);
  });
});
