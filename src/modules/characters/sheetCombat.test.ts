// The full sheet's Combat tiles (sr-1, sr-8; A4 from bq3-13), on invented numbers.
import { describe, expect, it } from 'vitest';
import { acTileCaption, attackFigures, hpCaption, levelCaption } from './sheetCombat.ts';

const short = (k: string) => k;
const filled = { attack: 19, hitDice: '1d8', 'abilityModifiers.MUS': { melee: 0, hp: 1 }, 'abilityModifiers.NIM': { missile: 1, ac: 1 } };

describe('the Combat tiles (sr-1)', () => {
  it('each tile has a caption saying what it is: hit dice and modifier, what is worn, the XP to the next level', () => {
    // Purpose: no tile on the full sheet is a bare number.
    expect(hpCaption(filled, null, short)).toBe('1d8, MUS +1');
    expect(acTileCaption([{ name: 'Reed coat', slot: 'armour', armour: 12 }], filled, short, 'ascending')).toBe('Reed coat, NIM +1');
    expect(acTileCaption([], filled, short, 'descending')).toBe('unarmoured, NIM −1');
    expect(acTileCaption([], filled, short, 'ascending', true)).toBe('set by hand');
    expect(levelCaption(0, 1, { levels: [{ level: 2, xp: 2000 }] })).toBe('0 / 2,000 XP');
    expect(levelCaption(2500, 2, { levels: [{ level: 2, xp: 2000 }] })).toBe('2,500 XP');
    expect(levelCaption(null, 1, null)).toBe('');
  });
});

describe("Attack in the campaign's AC style (sr-1, sr-8, A4)", () => {
  const base = { rulesSets: [{ attack: { unarmouredAC: { descending: 9, ascending: 10 } } }], chosenStyle: null, shortName: short, klassName: 'Lantern Warden', level: 1 };

  it('with descending AC: the target number, melee and missile lowering it, and the to-hit row by AC', () => {
    // Purpose: with descending AC, Attack's breakdown has the to-hit row (the figure minus the target's AC).
    const a = attackFigures({ ...base, filled, direction: 'descending', fieldLabel: 'THAC0', styleOption: 'Armour and attacks' });
    expect(a.label).toBe('THAC0');
    expect(a.value).toBe('19');
    expect(a.caption).toBe('Melee 19, Missile 18');
    expect(a.rows).toEqual([
      { label: 'Lantern Warden at level 1', value: '19' },
      { label: 'Melee, MUS +0', value: '19' },
      { label: 'Missile, NIM +1', value: '18' },
    ]);
    expect(a.toHit?.map((t) => `${t.ac}:${t.roll}`).join(' ')).toBe('9:10 8:11 7:12 6:13 5:14 4:15 3:16 2:17 1:18 0:19');
    expect(a.ending).toBe('From the rules: descending AC, the option “Armour and attacks”');
  });

  it("the to-hit row reads the rules set's matrix when it has one", () => {
    // Purpose: a setting's own attack table wins over the sum.
    const rulesSets = [{ attack: { unarmouredAC: 9, matrixAC: [-1, 0, 1, 9], matrix: [{ thac0: 19, rolls: [20, 20, 18, 10] }] } }];
    const a = attackFigures({ ...base, rulesSets, filled, direction: 'descending' });
    expect(a.toHit).toEqual([
      { ac: 9, roll: 10 },
      { ac: 1, roll: 18 },
      { ac: 0, roll: 20 },
    ]);
  });

  it('with ascending AC: the bonus with its sign, no to-hit row, and "+N to the d20 against AC"', () => {
    // Purpose: with ascending AC the breakdown has no to-hit row, and a field named for the target number isn't used.
    const a = attackFigures({ ...base, filled: { ...filled, attack: 1 }, direction: 'ascending', fieldLabel: 'THAC0' });
    expect(a.label).toBe('Attack');
    expect(a.value).toBe('+1');
    expect(a.caption).toBe('Melee +1, Missile +2');
    expect(a.toHit).toBeNull();
    expect(a.ending).toBe('+1 to the d20 against AC');
  });

  it("a setting that doesn't say which way AC runs keeps the class's figure as it is", () => {
    // Purpose: A4 never turns a target number into "+19" when no style is known; the caption still says what it is.
    const a = attackFigures({ ...base, rulesSets: [], filled, direction: null, fieldLabel: 'THAC0' });
    expect(a.label).toBe('THAC0');
    expect(a.value).toBe('19');
    expect(a.caption).toBe('Melee +0, Missile +1');
    expect(a.rows).toEqual([]);
    expect(a.toHit).toBeNull();
  });

  it('a number written on the sheet wins and says so; no class figure leaves no rows', () => {
    // Purpose: never a guess, and what the player wrote is shown as theirs, "Set by hand" (tfw-6).
    const a = attackFigures({ ...base, filled: {}, direction: 'ascending', typed: '+3' });
    expect(a.value).toBe('+3');
    expect(a.rows).toEqual([{ label: 'Set by hand', value: '+3' }]);
    expect(attackFigures({ ...base, filled: {}, direction: 'ascending' }).value).toBeNull();
  });

  it("a typed figure that is the class's own shows one row for it, not two (tfw-6)", () => {
    // Purpose: the Attack pop-up does not list the class's figure twice when the number on the sheet is the class's.
    const ascending = { ...filled, attack: 1, 'abilityModifiers.MUS': { melee: 1 } };
    for (const typed of ['+1', '1', ' +1 ']) {
      const a = attackFigures({ ...base, filled: ascending, direction: 'ascending', typed });
      expect(a.rows.map((r) => r.label)).toEqual(['Lantern Warden at level 1', 'Melee, MUS +1', 'Missile, NIM +1']);
    }
    const descending = attackFigures({ ...base, filled, direction: 'descending', typed: '19' });
    expect(descending.rows.map((r) => r.label)).toEqual(['Lantern Warden at level 1', 'Melee, MUS +0', 'Missile, NIM +1']);
    // With no AC style the pop-up keeps its old lines: an equal typed figure leaves no rows at all.
    expect(attackFigures({ ...base, rulesSets: [], filled, direction: null, typed: '19' }).rows).toEqual([]);
  });

  it('a typed figure that differs from the class\'s shows its own row, "Set by hand" (tfw-6)', () => {
    // Purpose: a figure written by hand that is not the class's own is shown as the player's, never as "Written on the sheet".
    const a = attackFigures({ ...base, filled: { ...filled, attack: 1 }, direction: 'ascending', typed: '+3' });
    expect(a.value).toBe('+3');
    expect(a.rows[0]).toEqual({ label: 'Set by hand', value: '+3' });
    expect(a.rows[1]).toEqual({ label: 'Lantern Warden at level 1', value: '+1' });
    expect(attackFigures({ ...base, filled, direction: 'descending', typed: '−1' }).rows[0]).toEqual({ label: 'Set by hand', value: '−1' });
    expect(attackFigures({ ...base, filled, direction: 'descending', typed: 'see notes' }).rows[0]).toEqual({ label: 'Set by hand', value: 'see notes' });
    expect(a.rows.some((r) => r.label === 'Written on the sheet')).toBe(false);
  });

  it("the small line reads each kind's total with the pack's word and a capital (A3, tfw-7)", () => {
    // Purpose: for a class bonus of +1 and a melee modifier of +1, the small line reads "Melee +2", the same figure as the
    // pop-up's row, and "Melee +2, Missile +1" with a capital on each.
    const a = attackFigures({ ...base, filled: { attack: 1, 'abilityModifiers.MUS': { melee: 1 }, 'abilityModifiers.NIM': { missile: 0 } }, direction: 'ascending' });
    expect(a.caption).toBe('Melee +2, Missile +1');
    expect(a.rows.find((r) => r.label.startsWith('Melee'))?.value).toBe('+2');
    expect(a.rows.find((r) => r.label.startsWith('Missile'))?.value).toBe('+1');
  });
});

// H1 ("Follow hand-set", Francis, 2026-11-19, plan test-feedback-2026-11-19 section H): the small line follows a
// figure set by hand. ⚑ 22 and ⚑ 23 are his: until he rules, the pop-up's Melee and Missile rows follow too, the class's
// row stays under "Set by hand", the last line and the to-hit table stay the class's, and words keep today's line.
describe('the small line under a figure set by hand (H1)', () => {
  const base = { rulesSets: [{ attack: { unarmouredAC: { descending: 9, ascending: 10 } } }], chosenStyle: null, shortName: short, klassName: 'Lantern Warden', level: 1 };
  const plusOne = { attack: 1, 'abilityModifiers.MUS': { melee: 1 }, 'abilityModifiers.NIM': { missile: 0 } };

  it('for a class bonus of +1, a typed +3 and a melee modifier of +1, the line reads "Melee +4, Missile +3"', () => {
    // Purpose: the line's totals are worked from the figure the player typed, not the class's "Melee +2, Missile +1".
    const a = attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: '+3' });
    expect(a.value).toBe('+3');
    expect(a.caption).toBe('Melee +4, Missile +3');
  });

  it("the pop-up's Melee and Missile rows follow the typed figure; Set by hand first, the class's row under it (⚑ 22)", () => {
    // Purpose: the box agrees with its own pop-up (A3), and the class's own figure is still shown under the player's.
    const a = attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: '+3' });
    expect(a.rows).toEqual([
      { label: 'Set by hand', value: '+3' },
      { label: 'Lantern Warden at level 1', value: '+1' },
      { label: 'Melee, MUS +1', value: '+4' },
      { label: 'Missile, NIM +0', value: '+3' },
    ]);
    // ⚑ 22: the last line stays the class's until Francis rules.
    expect(a.ending).toBe('+1 to the d20 against AC');
  });

  it('counting down, a typed target gives the line its targets; the to-hit table stays the class\'s (⚑ 22)', () => {
    // Purpose: in a setting whose figure is a target number, a modifier lowers the typed target as it lowers the class's.
    const a = attackFigures({ ...base, filled, direction: 'descending', typed: '17' });
    expect(a.caption).toBe('Melee 17, Missile 16');
    expect(a.rows.slice(2)).toEqual([
      { label: 'Melee, MUS +0', value: '17' },
      { label: 'Missile, NIM +1', value: '16' },
    ]);
    expect(a.toHit?.[0]).toEqual({ ac: 9, roll: 10 });
  });

  it("a typed figure equal to the class's reads as today", () => {
    // Purpose: tfw-6's copy of the class's figure on the sheet changes nothing, in any spelling of the number.
    for (const typed of ['+1', '1', ' +1 ']) expect(attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed }).caption).toBe('Melee +2, Missile +1');
    expect(attackFigures({ ...base, filled, direction: 'descending', typed: '19' }).caption).toBe('Melee 19, Missile 18');
  });

  it('a typed figure that is not a whole number keeps today\'s line (⚑ 23)', () => {
    // Purpose: there is nothing to add a modifier to, so the class's totals stay, under the player's own words.
    const a = attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: 'see notes' });
    expect(a.value).toBe('see notes');
    expect(a.caption).toBe('Melee +2, Missile +1');
    expect(a.rows[0]).toEqual({ label: 'Set by hand', value: 'see notes' });
  });

  it('a typed number that is not whole ("+2.5") keeps today\'s line (⚑ 23)', () => {
    // Purpose: a fraction is not a whole number, so it is read as words: the class's totals stay, under "+2.5" as typed.
    const a = attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: '+2.5' });
    expect(a.value).toBe('+2.5');
    expect(a.caption).toBe('Melee +2, Missile +1');
    expect(a.rows[0]).toEqual({ label: 'Set by hand', value: '+2.5' });
    expect(a.rows.slice(2)).toEqual([
      { label: 'Melee, MUS +1', value: '+2' },
      { label: 'Missile, NIM +0', value: '+1' },
    ]);
  });

  it('a setting that names no AC style is not touched: the scores\' modifiers alone', () => {
    // Purpose: with no AC style the line has no class figure in it, so a typed figure has nothing to change.
    const a = attackFigures({ ...base, rulesSets: [], filled: plusOne, direction: null, typed: '+3' });
    expect(a.caption).toBe('Melee +1, Missile +0');
  });

  it('extremes: a typed 999 and a typed 0 read as whole totals', () => {
    // Purpose: messy data (0 and 999) never breaks the sum or its sign.
    expect(attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: '999' }).caption).toBe('Melee +1000, Missile +999');
    expect(attackFigures({ ...base, filled: plusOne, direction: 'ascending', typed: '0' }).caption).toBe('Melee +1, Missile +0');
  });
});
