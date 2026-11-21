// Expertise points (G-208, ex-1, ex-2, ex-8; characters/expertise.ts, library/fills.ts). Every class, skill and number
// is invented (hard rule 2): the Reed-runner, its skills Slip by and Work locks, and the Mire zine's patch on it.
import { describe, expect, it } from 'vitest';
import {
  atItsBest,
  classSkillCodes,
  expertiseFigures,
  mayTakeBack,
  pointsAllowed,
  pointsRule,
  pointsSpent,
  pointsUnspent,
  readExpertise,
  skillDirection,
  skillFigure,
  spentBefore,
  POINTS_NAME,
} from './expertise.ts';
import { fillsAtCreation } from '../library/fills.ts';
import { optionGate } from '../library/optionGate.ts';
import { applyPatches, patchesInPlay, readPatches } from '../library/patches.ts';
import { skillsOf } from './play.ts';

const points = { atStart: 2, perLevel: 1, base: 2, best: 5, name: 'Knack' };
const byLevel = [
  { level: 1, SB: 3, WL: 1 },
  { level: 3, SB: 4, WL: 2 },
];
const runner = (extra: Record<string, unknown> = {}) => ({
  skills: { die: 'd6', names: { SB: 'Slip by', WL: 'Work locks' }, byLevel, ...extra },
});
const hooks = [{ id: 'fill-level', kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['skills'] }];
const fill = (klass: Record<string, unknown>, level: number, expertise?: Record<string, number>, rules: Record<string, unknown>[] = []) =>
  fillsAtCreation(hooks, rules, { level, scores: {}, klass, race: null, ...(expertise ? { expertise } : {}) }).filled;

describe('reading a class’s skills.points', () => {
  // Purpose: points are in force only when every figure is a whole number and the counts aren't below nought; the
  // pack's name titles them, else "Skill points".
  it('reads a well-formed rule, its name or the default, and nothing from a malformed one', () => {
    expect(pointsRule(runner({ points }))).toEqual(points);
    expect(pointsRule(runner({ points: { ...points, name: undefined } }))!.name).toBe(POINTS_NAME);
    expect(pointsRule(runner())).toBeNull();
    expect(pointsRule(runner({ points: { ...points, best: 4.5 } }))).toBeNull();
    expect(pointsRule(runner({ points: { ...points, atStart: -1 } }))).toBeNull();
    expect(pointsRule(runner({ points: { ...points, perLevel: '1' } }))).toBeNull();
    expect(pointsRule(null)).toBeNull();
  });

  // Purpose: the skills the points go on are the ones the class names, in its order, else its byLevel rows' codes.
  it('lists the class’s own skills', () => {
    expect(classSkillCodes(runner())).toEqual(['SB', 'WL']);
    expect(classSkillCodes({ skills: { byLevel } })).toEqual(['SB', 'WL']);
    expect(classSkillCodes({})).toEqual([]);
  });
});

describe('the figures', () => {
  const rule = pointsRule(runner({ points }))!;

  // Purpose: a skill with no points reads its base.
  it('reads the base with no points', () => {
    expect(skillFigure(rule, 'up', 0)).toBe(2);
    expect(expertiseFigures(runner({ points }), {})).toEqual({ 'skills.SB': 2, 'skills.WL': 2 });
    expect(expertiseFigures(runner({ points }), undefined)).toEqual({ 'skills.SB': 2, 'skills.WL': 2 });
  });

  // Purpose: each point moves an x-in-6 skill up one step and an equal-or-over skill down one step.
  it('moves up for x-in-6 and down for equal-or-over', () => {
    expect(skillFigure(rule, 'up', 1)).toBe(3);
    expect(skillFigure(rule, 'up', 2)).toBe(4);
    const overRule = pointsRule(runner({ rollMode: 'equal-or-over', points: { ...points, base: 6, best: 3 } }))!;
    expect(skillFigure(overRule, 'down', 1)).toBe(5);
    expect(skillFigure(overRule, 'down', 2)).toBe(4);
    expect(skillDirection(runner(), 'SB')).toBe('up');
    expect(skillDirection(runner({ rollMode: 'equal-or-over' }), 'SB')).toBe('down');
    // The rules set's own skill of that id says first.
    expect(skillDirection(runner(), 'SB', [{ skills: [{ id: 'SB', rollMode: 'equal-or-over' }] }])).toBe('down');
    expect(skillDirection(runner({ rollMode: 'equal-or-over' }), 'SB', [{ skills: [{ id: 'SB', rollMode: 'x-in-6' }] }])).toBe('up');
  });

  // Purpose: no skill passes its best, however many points are on it, and "at its best" says when one more would.
  it('never passes the best', () => {
    expect(skillFigure(rule, 'up', 3)).toBe(5);
    expect(skillFigure(rule, 'up', 9)).toBe(5);
    expect(atItsBest(rule, 'up', 2)).toBe(false);
    expect(atItsBest(rule, 'up', 3)).toBe(true);
    const overRule = { ...rule, base: 6, best: 3 };
    expect(skillFigure(overRule, 'down', 9)).toBe(3);
    expect(atItsBest(overRule, 'down', 3)).toBe(true);
    // A best not past the base that way takes no point at all.
    expect(skillFigure({ ...rule, best: 2 }, 'up', 2)).toBe(2);
    expect(atItsBest({ ...rule, best: 1 }, 'up', 0)).toBe(true);
  });

  // Purpose: the points allowed grow with the level, atStart + perLevel × (level − 1); spent and unspent follow.
  it('allows more points at each level', () => {
    expect(pointsAllowed(rule, 1)).toBe(2);
    expect(pointsAllowed(rule, 2)).toBe(3);
    expect(pointsAllowed(rule, 5)).toBe(6);
    expect(pointsAllowed(rule, 0)).toBe(2);
    expect(pointsSpent({ SB: 2, WL: 1 })).toBe(3);
    expect(pointsSpent({ SB: 2, GONE: 4 }, ['SB', 'WL'])).toBe(2);
    expect(pointsUnspent(rule, 2, { SB: 1 })).toBe(2);
    expect(pointsUnspent(rule, 1, { SB: 3 })).toBe(0);
  });

  // Purpose: saved points are read as skill codes with whole numbers of at least 1; anything else is passed over.
  it('reads the saved points', () => {
    expect(readExpertise({ SB: 2, WL: 0, XX: 1.5, YY: '2', '': 1 })).toEqual({ SB: 2 });
    expect(readExpertise(null)).toEqual({});
    expect(readExpertise([1])).toEqual({});
  });

  // Purpose: before approval the owner takes any point back; after it only one added this visit, never one spent
  // before; the GM always.
  it('says which points may be taken back', () => {
    const saved = { SB: 1 };
    expect(mayTakeBack({ gm: false, approved: false }, saved, { SB: 1 }, 'SB')).toBe(true);
    expect(mayTakeBack({ gm: false, approved: true }, saved, { SB: 1 }, 'SB')).toBe(false);
    expect(mayTakeBack({ gm: false, approved: true }, saved, { SB: 2 }, 'SB')).toBe(true);
    expect(mayTakeBack({ gm: false, approved: true }, saved, { SB: 1, WL: 1 }, 'WL')).toBe(true);
    expect(mayTakeBack({ gm: true, approved: true }, saved, { SB: 1 }, 'SB')).toBe(true);
    expect(mayTakeBack({ gm: true, approved: true }, saved, {}, 'SB')).toBe(false);
    expect(spentBefore(saved, 'SB')).toBe(1);
    expect(spentBefore(saved, 'WL')).toBe(0);
  });
});

describe('the fills with points in force', () => {
  // Purpose: with points in force the class skills are base moved by the points, and its byLevel rows are not read.
  it('fills each class skill from the points, not byLevel', () => {
    expect(fill(runner({ points }), 3, { SB: 2 })).toEqual({ 'skills.SB': 4, 'skills.WL': 2 });
    // ex-8: nothing spent yet (a character the option reaches later) reads the base on every skill.
    expect(fill(runner({ points }), 3)).toEqual({ 'skills.SB': 2, 'skills.WL': 2 });
  });

  // Purpose: with the option off (no points on the class), the class's byLevel figures are read as before, and saved
  // points change nothing.
  it('reads byLevel as before with the option off', () => {
    expect(fill(runner(), 1, { SB: 2 })).toEqual({ 'skills.SB': 3, 'skills.WL': 1 });
    expect(fill(runner(), 4)).toEqual({ 'skills.SB': 4, 'skills.WL': 2 });
  });

  // Purpose: the class's byOption puts points on it only while the campaign's choice is made (fae-woodland's way).
  it('a byOption switches it on under the choice', () => {
    const klass = { ...runner(), byOption: { 'runner-knacks=on': { skills: { points } } } };
    expect(fill(optionGate({ kind: 'class', data: klass }, { 'runner-knacks': 'on' }).data, 1, { WL: 1 })).toEqual({ 'skills.SB': 2, 'skills.WL': 3 });
    expect(fill(optionGate({ kind: 'class', data: klass }, { 'runner-knacks': 'off' }).data, 1, { WL: 1 })).toEqual({ 'skills.SB': 3, 'skills.WL': 1 });
  });

  // Purpose: a patch from another pack on the class switches it on (the zine overlay's way), and may change the
  // skills' names and die too; the extra skill it names takes points like the others.
  it('a patch on another pack’s class switches it on', () => {
    const packs = [{ packId: 'mire-zine', name: 'Mire zine' }];
    const patch = {
      kind: 'patch',
      packId: 'mire-zine',
      packEntryId: 'runner-knacks',
      data: {
        byOption: 'runner-knacks=on',
        match: { kind: 'class', ids: ['reed-runner'] },
        change: { 'skills.points': points, 'skills.names': { SB: 'Slip by', WL: 'Work locks', HR: 'Hear the reeds' } },
      },
    };
    const entry = { kind: 'class', packEntryId: 'reed-runner', data: runner() };
    const on = applyPatches(entry, patchesInPlay(readPatches([patch], packs), { 'runner-knacks': 'on' })).data;
    expect(fill(on, 2, { HR: 1, SB: 2 })).toEqual({ 'skills.SB': 4, 'skills.WL': 2, 'skills.HR': 3 });
    const off = applyPatches(entry, patchesInPlay(readPatches([patch], packs), { 'runner-knacks': 'off' })).data;
    expect(fill(off, 2, { HR: 1, SB: 2 })).toEqual({ 'skills.SB': 3, 'skills.WL': 1 });
  });

  // Purpose: the sheet's skills read the filled figure in the pack's style (play.ts skillsOf, unchanged).
  it('the sheet shows the filled figure', () => {
    const klass = runner({ points });
    const shown = skillsOf(fill(klass, 1, { SB: 1 }), klass).map((s) => [s.name, s.shown]);
    expect(shown).toEqual([
      ['Slip by', '3-in-6'],
      ['Work locks', '2-in-6'],
    ]);
  });
});
