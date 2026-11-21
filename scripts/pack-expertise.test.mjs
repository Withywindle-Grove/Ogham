// npm run pack:check on a class's expertise points (G-208, ex-1; scripts/pack-expertise.mjs). Every name and number
// is invented.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expertiseNotes, pointsProblems } from './pack-expertise.mjs';
import { formatNotes } from './pack-format.mjs';

const points = { atStart: 2, perLevel: 1, base: 2, best: 5, name: 'Knack' };
const runner = (skills, extra = {}) => ({ id: 'reed-runner', name: 'Reed-runner', skills: { die: 'd6', names: { SB: 'Slip by' }, ...skills }, ...extra });

describe('expertise points in pack:check (G-208)', () => {
  // Purpose: a well-formed rule on the class, under its byOption, or set by a patch gets no note.
  it('accepts well-formed points', () => {
    expect(
      expertiseNotes({
        classes: [runner({ points }), runner({}, { id: 'bog-runner', byOption: { 'knacks=on': { skills: { points } } } })],
        patches: [{ id: 'knacks-on-thief', byOption: 'knacks=on', match: { kind: 'class', ids: ['x'] }, change: { 'skills.points': points } }],
      }),
    ).toEqual([]);
    expect(pointsProblems({ ...points, base: 6, best: 3 }, { rollMode: 'equal-or-over', die: 'd6' })).toEqual([]);
  });

  // Purpose: pack:check notes a best not past the base in the skills' direction (up for x-in-6, down for
  // equal-or-over; equal where the direction isn't known).
  it('notes a best not past the base', () => {
    expect(pointsProblems({ ...points, best: 2 }, { rollMode: 'x-in-6' })).toEqual(["best 2 isn't past base 2 (x-in-6: best is higher)"]);
    expect(pointsProblems({ ...points, best: 1 }, { rollMode: 'x-in-6' })).toEqual(["best 1 isn't past base 2 (x-in-6: best is higher)"]);
    expect(pointsProblems({ ...points, base: 3, best: 5 }, { rollMode: 'equal-or-over' })).toEqual(["best 5 isn't past base 3 (equal-or-over: best is lower)"]);
    expect(pointsProblems({ ...points, best: 2 })).toEqual(["best 2 isn't past base 2"]);
    expect(pointsProblems({ ...points, best: 1 })).toEqual([]);
    expect(expertiseNotes({ classes: [runner({ points: { ...points, best: 2 } })] })).toEqual([
      'classes: "reed-runner": skills.points best 2 isn\'t past base 2 (x-in-6: best is higher) (G-208, 07 Point-buy skills); the app reads no points from it.',
    ]);
  });

  // Purpose (review of #1087, finding 4): pack:check reads a skill's direction as the app does, the skill's own
  // rollMode in the rules sets first, so it notes a skill that rolls the other way from its class (and a best not past
  // the base that way), and it checks the points a patch sets inside a whole `skills` too.
  it("reads each skill's own direction, and a patch's whole skills", () => {
    const rulesSets = [{ id: 'mire-rules', skills: [{ id: 'SB', rollMode: 'equal-or-over' }, { id: 'WL', rollMode: 'x-in-6' }] }];
    const twoWays = runner({ names: { SB: 'Slip by', WL: 'Wade lightly' }, points });
    expect(expertiseNotes({ rulesSets, classes: [twoWays] })).toEqual([
      'classes: "reed-runner": skills.points skill SB rolls equal-or-over, unlike the class\'s x-in-6; best 5 isn\'t past base 2 for SB (equal-or-over: best is lower) (G-208, 07 Point-buy skills); the app reads no points from it.',
    ]);
    // Every skill rolling the class's way: no note, whatever the rules sets say of other skills.
    expect(expertiseNotes({ rulesSets, classes: [runner({ names: { WL: 'Wade lightly' }, points })] })).toEqual([]);
    expect(
      expertiseNotes({ patches: [{ id: 'knacks-whole', match: { kind: 'class', ids: ['x'] }, change: { skills: { die: 'd6', rollMode: 'x-in-6', points: { ...points, best: 2 } } } }] }),
    ).toEqual(['patches: "knacks-whole": skills.points best 2 isn\'t past base 2 (x-in-6: best is higher) (G-208, 07 Point-buy skills); the app reads no points from it.']);
  });

  // Purpose: pack:check notes a figure that isn't a whole number, a count below nought, a name that isn't words, and
  // points on skills whose die isn't one die.
  it('notes malformed figures and a die that isn’t one die', () => {
    expect(pointsProblems({ ...points, atStart: 1.5, perLevel: -1, best: '5', name: 3 }, { die: 'd6' })).toEqual([
      'atStart should be a whole number, not 1.5',
      'perLevel should not be below 0',
      'best should be a whole number, not "5"',
      'name should be words',
    ]);
    expect(pointsProblems(points, { die: '%' })).toEqual(['the skills\' die "%" isn\'t one die (such as "d6")']);
    expect(pointsProblems(points, { die: '2d6' })).toEqual(['the skills\' die "2d6" isn\'t one die (such as "d6")']);
    expect(pointsProblems('lots')).toEqual(['should be { atStart, perLevel, base, best, name? }']);
    expect(expertiseNotes({ classes: [runner({ die: '%', points }, { byOption: { 'knacks=on': { skills: { points: { ...points, base: 'two' } } } } })] })).toEqual([
      'classes: "reed-runner": skills.points the skills\' die "%" isn\'t one die (such as "d6") (G-208, 07 Point-buy skills); the app reads no points from it.',
      'classes: "reed-runner", byOption "knacks=on": skills.points base should be a whole number, not "two"; the skills\' die "%" isn\'t one die (such as "d6") (G-208, 07 Point-buy skills); the app reads no points from it.',
    ]);
  });

  // Purpose: the notes are part of the format notes, and pack:check prints them.
  it('pack:check prints the note', () => {
    const file = { format: 'tabletop-pack', formatVersion: 2, meta: { id: 'mire-knacks', name: 'Mire knacks', version: '0.1', kind: 'setting' }, classes: [runner({ points: { ...points, best: 2 } })] };
    expect(formatNotes(file).some((n) => n.startsWith('classes: "reed-runner": skills.points best 2'))).toBe(true);
    const path = join(mkdtempSync(join(tmpdir(), 'pack-expertise-')), 'mire-knacks.json');
    writeFileSync(path, JSON.stringify(file));
    let out;
    try {
      out = execFileSync(process.execPath, ['scripts/check-pack.mjs', path], { encoding: 'utf8' });
    } catch (error) {
      out = `${String(error.stdout)}${String(error.stderr)}`;
    }
    expect(out).toMatch(/classes: "reed-runner": skills\.points best 2 isn't past base 2/);
  });
});
