// Fill hooks at creation (docs/07 "Rule hooks"; ruled 2026-10-25). Invented setting throughout.
import { describe, expect, it } from 'vitest';
import { fillLinks, fillName, fillsAtCreation, inRange, scoreRange, showFilled } from './fills.ts';

const rules = [
  {
    abilityModifiers: {
      STR: [
        { range: '3', melee: -3 },
        { range: '4-8', melee: -1 },
        { range: '9-12', melee: 0 },
        { range: '13+', melee: 1, wadeDeep: 'yes' },
      ],
    },
    saveCategories: [{ key: 'R', name: 'Save vs river' }],
  },
];
const warden = {
  progression: [
    { level: 1, hitDice: '1d8', thac0: 18, saves: { R: 11, B: 15 } },
    { level: 4, hitDice: '4d8', thac0: 16, saves: { R: 9, B: 13 } },
  ],
  levelTitles: ['Lamp-bearer', 'Wick-keeper', 'Flame-warden', 'Beacon'],
  skills: { names: { HS: 'Hide in reeds' }, byLevel: [{ level: 1, HS: 12 }, { level: 3, HS: 22 }] },
};
const hooks = [
  { id: 'fill-mods', kind: 'fill', when: 'abilityScoreChanged', from: 'abilityModifiers', target: 'abilityModifiers' },
  { id: 'fill-level', kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['hitDice', 'attack', 'saves', 'title', 'skills'] },
];
const at = (level: number, STR = 14) => fillsAtCreation(hooks, rules, { level, scores: { STR }, klass: warden, race: null }).filled;

// A9 (M4b gate 2026-10-25): a score out of range blocked Next without saying why; the range comes from the pack.
describe('the score range an ability table covers', () => {
  it('reads the lowest and highest rows; a "19+" row has no top; none without a table', () => {
    const rules = { abilityModifiers: { STR: [{ range: '3' }, { range: '4-7' }, { range: '12–15' }, { range: '18' }], WIS: [{ range: '3-8' }, { range: '19+' }] } };
    expect(scoreRange([rules], 'STR')).toEqual({ min: 3, max: 18 });
    expect(scoreRange([rules], 'WIS')).toEqual({ min: 3, max: null });
    expect(scoreRange([rules], 'CHA')).toBeNull();
  });
});

describe('fills at creation', () => {
  it('fills the progression at the starting level (the highest row at or below it) and the ability rows', () => {
    expect(at(1)).toEqual({
      hitDice: '1d8',
      attack: 18,
      'saves.R': 11,
      'saves.B': 15,
      title: 'Lamp-bearer',
      'skills.HS': 12,
      'abilityModifiers.STR': { melee: 1, wadeDeep: 'yes' },
    });
    expect(at(5)).toMatchObject({ hitDice: '4d8', attack: 16, 'saves.R': 9, title: 'Beacon', 'skills.HS': 22 });
    expect(at(3, 3)).toMatchObject({ 'abilityModifiers.STR': { melee: -3 } });
  });

  it("keeps only what a hook's target names", () => {
    const onlySaves = fillsAtCreation([{ kind: 'fill', when: 'levelUp', from: 'classProgression', target: 'saves' }], rules, { level: 1, scores: {}, klass: warden, race: null });
    expect(onlySaves.filled).toEqual({ 'saves.R': 11, 'saves.B': 15 });
  });

  it("a hook's test decides; one that can't run is skipped and named, never guessed", () => {
    const tested = [
      { id: 'only-strong', kind: 'fill', when: 'abilityScoreChanged', test: 'character.STR >= 13', target: 'luck', value: '2' },
      { id: 'broken', kind: 'fill', when: 'abilityScoreChanged', test: 'character.STR + "x" > 1', target: 'luck', value: '9' },
    ];
    expect(fillsAtCreation(tested, rules, { level: 1, scores: { STR: 14 }, klass: null, race: null })).toEqual({ filled: { luck: 2 }, skipped: ['broken'] });
    expect(fillsAtCreation(tested, rules, { level: 1, scores: { STR: 9 }, klass: null, race: null }).filled).toEqual({});
  });

  it("the attack figure follows the campaign's AC style (A4): the bonus going up, the target number going down", () => {
    // Purpose: the sheet's attack field never shows the target number with ascending AC, nor the bonus with descending.
    const both = { progression: [{ level: 1, thac0: 19, attackBonus: 0 }] };
    const attackOf = (klass: Record<string, unknown>, acDirection?: 'ascending' | 'descending') =>
      fillsAtCreation(hooks, rules, { level: 1, scores: {}, klass, race: null, ...(acDirection ? { acDirection } : {}) }).filled.attack;
    expect(attackOf(both, 'ascending')).toBe(0);
    expect(attackOf(both, 'descending')).toBe(19);
    expect(attackOf(both)).toBe(19);
    // A class that gives only the target number has no bonus to show going up: none, never a guess.
    expect(attackOf({ progression: [{ level: 1, thac0: 19 }] }, 'ascending')).toBeUndefined();
    // A plain `attack` reads either way when it's all there is.
    expect(attackOf({ progression: [{ level: 1, attack: 1 }] }, 'ascending')).toBe(1);
    expect(attackOf({ progression: [{ level: 1, attack: 1 }] }, 'descending')).toBe(1);
  });
});

describe('showing filled values', () => {
  it('reads ranges like "3", "4-8", "13–15" and "13+"', () => {
    expect([inRange('3', 3), inRange('4-8', 8), inRange('13–15', 14), inRange('13+', 18), inRange('4-8', 9), inRange(5, 5)]).toEqual([true, true, true, true, false, true]);
  });

  it('names and words: the setting’s save names, the class’s skill names, rows as words', () => {
    expect(fillName('saves.R', rules, warden)).toBe('Save vs river');
    expect(fillName('saves.B', rules, warden)).toBe('Save B');
    expect(fillName('skills.HS', rules, warden)).toBe('Hide in reeds');
    expect(fillName('attack', rules, warden)).toBe('Attack');
    expect(showFilled({ melee: -1, wadeDeep: 'no' })).toBe('melee −1, wade deep no');
    expect(showFilled(-2)).toBe('−2');
  });

  it("a sheet layout's fill links map field keys to filled values", () => {
    expect([...fillLinks([{ key: 'saveR', fill: 'saves.R' }, { key: 'STR' }])]).toEqual([['saveR', 'saves.R']]);
  });
});
