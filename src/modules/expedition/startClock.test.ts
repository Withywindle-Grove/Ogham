// M5 step 10, starting and the clock (ruled 2026-10-30, DG1, DG3, DG4, DG6, DG7, S2-7): the engine's and the pure
// helpers' part. Invented rules only.
//   Check now gives the wandering checks in play now, once each, with what a hit rolls; a location's own check stands
//   in; with none, the GM's encounter-check reminders; with nothing at all, nothing. It schedules nothing.
//   Check now's card lines have their own keys and no "next at", and a split party gets one per group.
//   A check with onlyWithOption (a gutter check for the party's lights, DG6) runs only while its option is on: one
//   prompt each turn for the party, never one per light; off, it's neither prompted nor on the hour track.
//   Each pack's own procedure order (DG4): a check-first pack prompts the check first; a decide-first pack's note
//   comes first and its check after, and the card keeps that order.
//   The light warning comes at the pack's warnAt, one step before the end when the pack gives none (A6).
//   Darkness: a turn mode is dark without a light in the group; a day mode only while Travelling in darkness is on;
//   anyone's light in the group lights it; the button names the light.
//   Recent places: newest first, each name once, at most five.
import { describe, expect, it } from 'vitest';
import { cardFrom, checkNowLines, perGroup } from './card.ts';
import { timeUnits } from './clock.ts';
import { darkMode, inDarkness, lightButtonWords } from './darkness.ts';
import { readLightType } from './light.ts';
import { modeById, readCheck, readExploration } from './modes.ts';
import { recentPlaces } from './play.ts';
import { checkNow, hourTrackNow, nextStep, type Expedition } from './procedure.ts';
import type { Schedule } from './schedule.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const TURN = 600;

/** Invented rules: a check-first delve with a gutter check behind an option, and a decide-first crawl. */
const rules = readExploration([
  {
    id: 'mire-rules',
    exploration: {
      modes: [
        {
          id: 'delve',
          name: 'Delve',
          step: { value: 1, unit: 'turn' },
          procedure: [
            { id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' },
            { id: 'gutter', name: 'Lights gutter', icon: 'light', kind: 'check', checkId: 'gutter' },
            { id: 'act', name: 'Decide actions', icon: 'dot', kind: 'note' },
          ],
          checks: [
            { id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'mire-things' } },
            { id: 'gutter', name: 'Lights gutter', chance: { die: 'd6', on: [1] }, onlyWithOption: 'mire-adversity' },
          ],
        },
        {
          id: 'crawl',
          name: 'Crawl',
          step: { value: 1, unit: 'turn' },
          procedure: [
            { id: 'act', name: 'Decide actions', icon: 'dot', kind: 'note' },
            { id: 'look', name: 'Look about', icon: 'dot', kind: 'roll', tableId: 'mire-sights' },
            { id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' },
          ],
          checks: [{ id: 'wander', name: 'Wandering things', chance: { die: 'd6', on: [1, 2] } }],
        },
        { id: 'quiet', name: 'Quiet', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] },
      ],
    },
  },
]);
const delve = modeById(rules.modes, 'delve')!;
const crawl = modeById(rules.modes, 'crawl')!;
const quiet = modeById(rules.modes, 'quiet')!;
const gmEncounter: Schedule = { id: 'gm:enc', name: 'Encounter check', kind: 'check', encounterCheck: true, anchor: 0, interval: 3 * TURN, group: 'gm' };

const under = (mode = delve, extra: Partial<Expedition> = {}): Expedition => ({ rules, mode, units, startedAt: 0, now: TURN, ...extra });

describe('Check now (DG3)', () => {
  it('gives the wandering checks in play now, once each, with what a hit rolls, and schedules nothing', () => {
    const found = checkNow(under());
    expect(found.prompts.map((p) => (p.kind === 'check' ? `${p.checkId} ${p.count}` : p.kind))).toEqual(['wander 1']);
    const prompt = found.prompts[0]!;
    expect(prompt.kind === 'check' && prompt.hit.tables).toEqual(['mire-things']);
    expect(found.reminders).toEqual([]);
    expect(found.to).toBe(TURN);
  });

  it("a location's own check stands in for the mode's", () => {
    const own = readCheck({ id: 'abbey', name: 'Abbey stirrings', chance: { die: 'd6', on: [1, 2] } })!;
    const found = checkNow(under(delve, { situation: { locationCheck: own } }));
    expect(found.prompts.map((p) => p.kind === 'check' && `${p.source} ${p.checkId}`)).toEqual(['location abbey']);
  });

  it("with no wandering check in the mode, the GM's encounter-check reminders; with neither, nothing", () => {
    expect(checkNow(under(quiet, { reminders: [gmEncounter] })).reminders.map((r) => `${r.name} next ${r.nextAt}`)).toEqual([`Encounter check next ${3 * TURN}`]);
    expect(checkNow(under(quiet)).prompts).toEqual([]);
    expect(checkNow(under(quiet)).reminders).toEqual([]);
  });

  it('its card lines have their own keys and no "next at"; a split party gets one per group', () => {
    const lines = checkNowLines(checkNow(under()), { mode: delve, units, startedAt: 0 });
    expect(lines.map((l) => [l.key, l.name, l.decision, l.nextAt, l.check?.now])).toEqual([['now:check:mode:wander', 'Wandering things, now', 'check', null, true]]);
    // The schedule's own line for the same check has another key, so the two never merge.
    const scheduled = cardFrom(nextStep(under(delve, { now: TURN }))!, { mode: delve, units, startedAt: 0 });
    expect(scheduled.map((l) => l.key)).toContain('check:mode:wander');
    expect(perGroup(lines, [1, 2]).map((l) => l.name)).toEqual(['Wandering things, now, Group 1', 'Wandering things, now, Group 2']);
  });
});

describe('checks behind an option (DG6: the gutter check, one roll for the party)', () => {
  const lights = [
    { id: 'ash', name: "Ash's torch", litAt: 0, seconds: 6 * TURN, warnSeconds: TURN },
    { id: 'wren', name: "Wren's torch", litAt: 0, seconds: 6 * TURN, warnSeconds: TURN },
  ];
  it('with the option on, one gutter prompt each turn, whatever the number of lights', () => {
    const step = nextStep(under(delve, { now: 0, lights, situation: { choices: { 'mire-adversity': 'on' } } }))!;
    expect(step.prompts.filter((p) => p.kind === 'check' && p.checkId === 'gutter').map((p) => p.count)).toEqual([1]);
  });
  it('with the option off, no gutter prompt, and nothing on the hour track for it', () => {
    const step = nextStep(under(delve, { now: 0, lights }))!;
    expect(step.prompts.some((p) => p.kind === 'check' && p.checkId === 'gutter')).toBe(false);
    const pips = hourTrackNow(under(delve, { now: 0, lights }), 'gm')!;
    expect(pips.flatMap((p) => p.events.map((e) => e.label))).not.toContain('Lights gutter');
  });
});

describe("each pack's own procedure order (DG4)", () => {
  it('a check-first pack prompts the check first; a decide-first pack its roll after the note, and the check after it', () => {
    const first = nextStep(under(delve, { now: TURN }))!;
    expect(first.prompts.map((p) => p.stepId)).toEqual(['wander']);
    expect(first.quiet.map((q) => q.stepId)).toEqual(['act']);
    const later = nextStep(under(crawl, { now: 0 }))!;
    expect(later.prompts.map((p) => p.stepId)).toEqual(['look', 'wander']);
    expect(cardFrom(later, { mode: crawl, units, startedAt: 0 }).map((l) => l.stepId)).toEqual(['look', 'wander']);
  });
});

describe('the light warning (DG6, A6)', () => {
  it("comes at the pack's warnAt, and one step before the end when the pack gives none", () => {
    expect(readLightType({ id: 'reed', name: 'Reed light', duration: 6, unit: 'turn', warnAt: 2 }, units)?.warnSeconds).toBe(2 * TURN);
    expect(readLightType({ id: 'reed', name: 'Reed light', duration: 6, unit: 'turn' }, units)?.warnSeconds).toBe(TURN);
  });
});

describe('darkness (DG7, S2-7)', () => {
  const base = { underWay: true, pace: 'turn' as const, travellingInDarkness: false, group: ['ash', 'wren'], litBy: [] as string[] };
  it('a turn mode is dark when nobody in the group has a light lit', () => {
    expect(inDarkness(base)).toBe(true);
    expect(inDarkness({ ...base, litBy: ['wren'] })).toBe(false);
    // Another group's light doesn't light this one.
    expect(inDarkness({ ...base, litBy: ['moss'] })).toBe(true);
  });
  it('a day mode is dark only while Travelling in darkness is on; nothing is dark between expeditions', () => {
    expect(inDarkness({ ...base, pace: 'day' })).toBe(false);
    expect(inDarkness({ ...base, pace: 'day', travellingInDarkness: true })).toBe(true);
    expect(inDarkness({ ...base, underWay: false, pace: null })).toBe(false);
  });
  // Purpose (⚑ 1 on #958, "yes, b", 2026-11-18): a dark mode, where the band hides the sun's line, is a turn mode, or a
  // day mode while Travelling in darkness is on; no mode is dark with no expedition.
  it('a dark mode hides the sun: turn modes, and day modes travelling in darkness', () => {
    expect(darkMode('turn', false)).toBe(true);
    expect(darkMode('day', false)).toBe(false);
    expect(darkMode('day', true)).toBe(true);
    expect(darkMode(null, true)).toBe(false);
  });
  it('the button names the light and how many are left', () => {
    const option = { line: { id: 'l', name: 'Rushlights', qty: 4, version: 1, needsFuel: false, fuelLeftSeconds: null }, type: readLightType({ id: 'rush', name: 'Rushlight', duration: 6, unit: 'turn' }, units)! };
    expect(lightButtonWords(option)).toBe('Light a rushlight (4 left)');
    expect(lightButtonWords({ ...option, type: { ...option.type, name: 'Oil lamp' }, line: { ...option.line, qty: 1 } })).toBe('Light an oil lamp (1 left)');
    expect(lightButtonWords(null)).toBeNull();
  });
});

describe('recent places (DG1)', () => {
  it('lists the newest first, each name once (whatever its case), at most five', () => {
    const rows = ['The Drowned Stair', 'Reed Hollow', 'the drowned stair ', 'Bog Gate', 'Eel Pool', 'Mill Race', 'Far Weir'].map((name, i) => ({ name, mode: i === 0 ? 'delve' : 'crawl' }));
    expect(recentPlaces(rows)).toEqual([
      { name: 'The Drowned Stair', mode: 'delve' },
      { name: 'Reed Hollow', mode: 'crawl' },
      { name: 'Bog Gate', mode: 'crawl' },
      { name: 'Eel Pool', mode: 'crawl' },
      { name: 'Mill Race', mode: 'crawl' },
    ]);
  });
});
