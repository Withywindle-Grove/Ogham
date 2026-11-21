// The Traits section as chips (tc-1 … tc-4): the groups by source and what each chip says. Invented names only.
import { describe, expect, it } from 'vitest';
import { traitsOf } from './bonuses.ts';
import { chipLabel, traitGroups, usesWords } from './traitChips.ts';

const reedKin = {
  name: 'Reed kin',
  abilities: [
    { name: 'Moon sight', note: 'Sees by moonlight as by day.' },
    { name: 'Wild revelry', note: 'Once a day, a dance that heals.', uses: { count: 1, per: 'day' } },
    { name: 'Iron-shy', note: 'Cold iron wounds more.', kind: 'disadvantage' },
    { name: 'Fen song', note: 'With the songs option.', option: 'fen-songs' },
  ],
};
const warden = {
  name: 'Lantern Warden',
  abilities: [
    { name: 'Ward the light', note: 'Keeps a flame alive.', uses: { byLevel: [{ level: 1, count: 1 }, { level: 3, count: 2 }], per: 'rest' } },
    { name: 'Steady hand', note: 'From level 3.', fromLevel: 3 },
  ],
};
const ctx = (level: number) => ({ level, race: reedKin, klass: warden, raceTitle: 'Kindred', classTitle: 'Calling' });

describe('traits as chips (tc-1 … tc-4)', () => {
  // Purpose: the traits group by where they come from, each group named with the setting's word and its source, and a
  // trait tied to an option goes under "From options".
  it('groups the kindred’s, the class’s and the options’ traits under their headings', () => {
    const groups = traitGroups(traitsOf(reedKin, warden, () => true), ctx(1));
    expect(groups.map((g) => [g.title, g.chips.map((c) => c.name)])).toEqual([
      ['Kindred: Reed kin', ['Moon sight', 'Wild revelry', 'Iron-shy']],
      ['Calling: Lantern Warden', ['Ward the light', 'Steady hand']],
      ['From options', ['Fen song']],
    ]);
  });

  // Purpose: a group with nothing in it doesn't show (no empty "From options" heading).
  it('leaves out an empty group', () => {
    const groups = traitGroups(traitsOf(reedKin, warden, (t) => !t.option), ctx(1));
    expect(groups.map((g) => g.id)).toEqual(['kindred', 'class']);
    expect(traitGroups([], ctx(1))).toEqual([]);
  });

  // Purpose: a chip carries its uses at this level, a drawback, and a level not reached yet, in words too.
  it('puts the uses, the drawback and the later level inside the chip, in words', () => {
    const at1 = traitGroups(traitsOf(reedKin, warden, () => true), ctx(1)).flatMap((g) => g.chips);
    const chip = (name: string) => at1.find((c) => c.name === name)!;
    expect(chip('Wild revelry')).toMatchObject({ uses: 1, usesWords: '1 use a day', drawback: false, laterLevel: null });
    expect(chip('Iron-shy')).toMatchObject({ uses: 0, drawback: true });
    expect(chip('Steady hand').laterLevel).toBe(3);
    expect(chipLabel(chip('Wild revelry'))).toBe('Wild revelry, 1 use a day');
    expect(chipLabel(chip('Iron-shy'))).toBe('Iron-shy, a drawback');
    expect(chipLabel(chip('Steady hand'))).toBe('Steady hand, from level 3');
    // At level 3 the uses grow and the later level is reached, so it's no longer quiet.
    const at3 = traitGroups(traitsOf(reedKin, warden, () => true), ctx(3)).flatMap((g) => g.chips);
    expect(at3.find((c) => c.name === 'Ward the light')).toMatchObject({ uses: 2, usesWords: '2 uses each rest' });
    expect(at3.find((c) => c.name === 'Steady hand')?.laterLevel).toBeNull();
  });

  // Purpose: the uses read in plain words for each way they come back, and nothing for no uses.
  it('words the uses', () => {
    expect(usesWords(1, 'day')).toBe('1 use a day');
    expect(usesWords(3, 'fight')).toBe('3 uses each fight');
    expect(usesWords(2, '')).toBe('2 uses');
    expect(usesWords(0, 'day')).toBe('');
  });

  // Purpose: the uses spent on the Player screen show on the chip (capped at its uses), and the screen reader hears
  // what's left in the use dots' words; a trait with nothing spent reads as before.
  it('carries the spent uses and says what is left', () => {
    const at3 = traitGroups(traitsOf(reedKin, warden, () => true), { ...ctx(3), usesSpent: { 'Ward the light': 1, 'Wild revelry': 5 } }).flatMap((g) => g.chips);
    const chip = (name: string) => at3.find((c) => c.name === name)!;
    expect(chip('Ward the light')).toMatchObject({ uses: 2, spent: 1 });
    expect(chipLabel(chip('Ward the light'))).toBe('Ward the light, 2 uses each rest, 1 of 2 left');
    expect(chip('Wild revelry').spent).toBe(1);
    expect(chipLabel(chip('Wild revelry'))).toBe('Wild revelry, 1 use a day, 0 of 1 left');
    expect(chip('Moon sight').spent).toBe(0);
    expect(traitGroups(traitsOf(reedKin, warden, () => true), ctx(3)).flatMap((g) => g.chips).every((c) => c.spent === 0)).toBe(true);
  });
});
