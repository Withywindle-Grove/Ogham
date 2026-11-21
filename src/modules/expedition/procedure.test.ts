// What one main advance does (docs/05; ruled 2026-10-29, D19 and afternoon ruling 1). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { startEffect } from './effects.ts';
import { fenRules, plainRules } from './fixtures.ts';
import { modeById, pointToPoint, readCheck, readExploration } from './modes.ts';
import { advanceBy, checkNow, encounterCheckOf, needsSeason, nextStep, nextSteps, setTime, stepSeconds, weatherFor, weatherNow, weatherOff, type Advance, type Expedition, type Prompt } from './procedure.ts';
import { startTimer } from './statusTimer.ts';
import type { Schedule } from './schedule.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const TURN = 600;
const DAY = 86400;
const plain = readExploration([plainRules]);
const fen = readExploration([fenRules]);
const on = { 'weather-rules': 'on' };

const rushlight = { id: 'rush', name: 'Rushlight', litAt: 0, seconds: 6 * TURN, warnSeconds: TURN };
const gmEncounter: Schedule = { id: 'gm-enc', name: 'Encounter check', kind: 'check', encounterCheck: true, anchor: 0, interval: 2 * TURN, group: 'gm' };

/** One line per advance: what the GM is asked or told, in order, for exact comparisons. */
function said(a: Pick<Advance, 'prompts' | 'reminders' | 'lights' | 'rest' | 'effectsEnded' | 'statusesEnded'>): string[] {
  const promptLine = (p: Prompt) => {
    if (p.kind === 'check') return `check ${p.checkId}${p.count > 1 ? ` ×${p.count}` : ''}`;
    if (p.kind === 'weather') return `weather ${p.tableId ?? '(typed)'}${p.count > 1 ? ` ×${p.count}` : ''}`;
    return `${p.kind} ${p.stepId}${p.count > 1 ? ` ×${p.count}` : ''}`;
  };
  return [
    ...a.prompts.map(promptLine),
    ...(a.rest ? [`rest${a.rest.count > 1 ? ` ×${a.rest.count}` : ''}`] : []),
    ...a.reminders.map((r) => `${r.name}${r.count > 1 ? ` ×${r.count}` : ''}`),
    ...a.lights.flatMap((l) => [...(l.warned ? [`${l.name} low`] : []), ...(l.outAt !== null ? [`${l.name} out`] : [])]),
    ...a.effectsEnded.map((e) => `${e.name} ends`),
    ...a.statusesEnded.map((s) => `${s.name} ends`),
  ];
}

/** Presses the main advance n times, one at a time, carrying the clock and status timers forward. */
function pressNext(expedition: Expedition, n: number): Advance[] {
  const out: Advance[] = [];
  let state = expedition;
  for (let i = 0; i < n; i++) {
    const a = nextStep(state)!;
    out.push(a);
    state = { ...state, now: a.to, statuses: a.statuses };
  }
  return out;
}

describe('the fallback Dungeon', () => {
  const dungeon: Expedition = { rules: plain, mode: modeById(plain.modes, 'dungeon')!, units, startedAt: 0, now: 0, lights: [rushlight], reminders: [gmEncounter] };

  it('10 fallback turns give exactly these prompts', () => {
    const turns = pressNext(dungeon, 10);
    expect(turns.map((t) => [t.step, said(t)])).toEqual([
      [1, []],
      [2, ['Encounter check']],
      [3, []],
      [4, ['Encounter check']],
      [5, ['Rushlight low']],
      [6, ['Encounter check', 'Rushlight out']],
      [7, []],
      [8, ['Encounter check']],
      [9, []],
      [10, ['Encounter check']],
    ]);
    // The fallback has no checks of its own: the app's clock step runs quietly every turn.
    expect(turns.every((t) => t.prompts.length === 0 && t.quiet.map((q) => q.kind).join() === 'auto')).toBe(true);
  });

  it('long-press +10 runs the same ten turns and sums them up: the encounter check once, ×5', () => {
    const ten = nextSteps(dungeon, 10)!;
    expect(ten.steps).toBe(10);
    expect(ten.to).toBe(10 * TURN);
    expect(said(ten)).toEqual(['Encounter check ×5', 'Rushlight low', 'Rushlight out']);
    expect(ten.correction).toBe(false);
  });

  it('the hour track shows one pip per turn, the next encounter check and the light running out', () => {
    const second = nextStep({ ...dungeon, now: TURN })!; // now on the third turn of the hour
    expect(second.hourTrack!.map((p) => [p.turn, p.current, p.events.map((e) => e.symbol)])).toEqual([
      [1, false, []],
      [2, false, []],
      [3, true, ['encounter']],
      [4, false, []],
      [5, false, ['encounter']],
      [6, false, []],
    ]);
    // B8: the check this Next turn brought due is played now (turn 3), the next one on turn 5; the light runs out as
    // the hour turns over, so it isn't on this hour's track.
    expect(second.trackEvents.find((e) => e.symbol === 'light')).toMatchObject({ at: 6 * TURN, public: true });
  });

  it('the Wilderness fallback is day by day: no hour track, the clock moves a day', () => {
    const wild = nextStep({ ...dungeon, mode: modeById(plain.modes, 'wilderness')!, lights: [] })!;
    expect(wild.to).toBe(DAY);
    expect(wild.hourTrack).toBeNull();
    expect(wild.reminders).toEqual([expect.objectContaining({ id: 'gm-enc', count: 72 })]);
  });
});

describe('a turn mode from a pack', () => {
  const creep: Expedition = { rules: fen, mode: modeById(fen.modes, 'creep')!, units, startedAt: 0, now: 0 };

  it('an every-2-turns check prompts on turns 2, 4, 6, with the GM picking the table by depth; rest every 5 turns', () => {
    const turns = pressNext(creep, 6);
    expect(turns.map((t) => said(t))).toEqual([[], ['check creep-wander'], [], ['check creep-wander'], ['rest'], ['check creep-wander']]);
    const check = turns[1]!.prompts[0]!;
    expect(check).toMatchObject({ kind: 'check', stepId: 'wander', chance: { die: 'd8', on: [1] }, hit: { tables: ['creep-shallow', 'creep-deep'], pick: true, noteOnly: false, note: 'Pick by depth.' } });
    expect(turns[4]!.rest).toEqual({ count: 1, condition: 'weary', length: { value: 1, unit: 'turn' }, note: 'Five turns on, one off.' });
  });

  it('note steps are quiet lines and auto steps are done by the app, in procedure order, every turn', () => {
    expect(nextStep(creep)!.quiet.map((q) => [q.stepId, q.kind])).toEqual([
      ['listen', 'note'],
      ['odd', 'note'],
      ['tick', 'auto'],
    ]);
  });

  it('activities in a turn mode: usable ones only, costed in clock time; onlyIn lists modes', () => {
    const a = nextStep(creep)!.activities;
    expect(a.map((u) => [u.activity.id, u.cost])).toEqual([
      ['tap-walls', { kind: 'time', seconds: TURN }],
      ['pry-lid', { kind: 'time', seconds: 0 }],
      ['old-search', { kind: 'gm' }],
    ]);
  });

  it('timed effects and status timers end on the turn they run out, and the hour track shows the effect ending', () => {
    const effect = startEffect('e1', 'Fen-sight', { kind: 'timed', seconds: 2 * TURN }, 0)!;
    const statuses = [{ id: 's1', name: 'Dazzled', timer: startTimer({ value: 3, unit: 'turn' }, units)! }];
    const turns = pressNext({ ...creep, effects: [effect], statuses }, 3);
    expect(turns.map((t) => said(t))).toEqual([[], ['check creep-wander', 'Fen-sight ends'], ['Dazzled ends']]);
    expect(turns[0]!.trackEvents.find((e) => e.label === 'Fen-sight')).toMatchObject({ at: 2 * TURN, public: true });
  });

  it('Advance by 40 minutes runs the procedure for each of the 4 turns, and is not a correction', () => {
    const by = advanceBy(creep, { value: 40, unit: 'minutes' })!;
    expect(by).toMatchObject({ steps: 4, to: 4 * TURN, correction: false });
    expect(said(by)).toEqual(['check creep-wander ×2']);
  });

  it('Advance by 15 minutes runs one turn’s procedure; the leftover 5 minutes move only the timers', () => {
    const by = advanceBy({ ...creep, lights: [{ ...rushlight, seconds: TURN + 300, warnSeconds: null }] }, { value: 15, unit: 'minute' })!;
    expect(by.steps).toBe(1);
    expect(by.to).toBe(TURN + 300);
    expect(by.each.map((a) => a.prompts.length + a.quiet.length)).toEqual([3, 0]);
    expect(said(by)).toEqual(['Rushlight out']);
  });

  it('+N and Advance by refuse what they cannot read', () => {
    expect(nextSteps(creep, 0)).toBeNull();
    expect(nextSteps(creep, 1.5)).toBeNull();
    expect(advanceBy(creep, { value: 3, unit: 'fortnights' })).toBeNull();
    expect(advanceBy(creep, { value: 0, unit: 'turn' })).toBeNull();
  });

  it('Set time… is a correction: the clock jumps, nothing runs, and it can go back', () => {
    expect(setTime(creep, 10 * TURN)).toEqual({ from: 0, to: 10 * TURN, correction: true, statuses: [], statusesBefore: [], ranOut: [] });
    expect(setTime({ now: 10 * TURN }, 2 * TURN)).toMatchObject({ from: 10 * TURN, to: 2 * TURN, correction: true });
    expect(setTime(creep, -1)).toBeNull();
  });

  // Purpose (dec-7 piece 3, pf-12b): a place's check rolled on each move still stands in, so the clock raises neither
  // the mode's encounter check nor the place's, and sets the GM's encounter-check reminders aside; Encounter check (⋯)
  // still rolls the place's by hand.
  it('a location’s check rolled on each move stands in, and the clock never raises it', () => {
    const own = readCheck({ id: 'harbour', name: 'Encounters on the water', chance: { die: 'd6', on: [1] }, tableId: 'harbour-things' })!;
    const there = { ...creep, reminders: [gmEncounter], situation: { locationCheck: own, locationCheckOnMove: true } };
    const turns = pressNext(there, 4);
    expect(turns.map((t) => said(t))).toEqual([[], [], [], []]);
    expect(turns[1]!.suspended).toEqual(['gm-enc']);
    expect(checkNow(there).prompts).toMatchObject([{ kind: 'check', source: 'location', checkId: 'harbour' }]);
  });

  // Purpose (S4, rg-4): the Encounter check fact states the place's own check where it stands in, else the mode's.
  it('names the encounter check in force for the facts row', () => {
    expect(encounterCheckOf(creep)).toMatchObject({ source: 'mode', eachMove: false });
    const own = readCheck({ id: 'harbour', name: 'Encounters on the water', chance: { die: 'd6', on: [1] }, tableId: 'harbour-things' })!;
    expect(encounterCheckOf({ ...creep, situation: { locationCheck: own, locationCheckOnMove: true } })).toMatchObject({ source: 'location', eachMove: true, check: { id: 'harbour' } });
  });

  it('a location’s own check stands in for the mode’s encounter check and the GM’s encounter-check reminders', () => {
    const own = readCheck({ id: 'crypt', name: 'Crypt stirrings', every: { value: 1, unit: 'turn' }, chance: { die: 'd6', on: [1, 2] }, tableId: 'crypt-things' })!;
    const there = { ...creep, reminders: [gmEncounter], situation: { locationCheck: own } };
    const second = pressNext(there, 2)[1]!;
    expect(said(second)).toEqual(['check crypt']);
    expect(second.prompts[0]).toMatchObject({ source: 'location', hit: { tables: ['crypt-things'] } });
    expect(second.suspended).toEqual(['gm-enc']);
    // "Use my check here instead": the mode's check runs again, and counts as the GM's encounter check that turn.
    const mine = pressNext({ ...there, situation: { locationCheck: own, useMineHere: true } }, 2)[1]!;
    expect(said(mine)).toEqual(['check creep-wander']);
    expect(mine.satisfied).toEqual(['gm-enc']);
  });
});

// Point to point (plan scene-point-to-point, piece B8; p2p-6 and the plan's flag 10, both ruled 2026-11-18): the app's
// own method. Its step is one unit of the place's ways, its check is the place's, and light, rest and the day's
// weather run by the setting's rules. The setting here is the invented fen rules.
describe('point to point (p2p-6)', () => {
  const byTurn: Expedition = { rules: fen, mode: pointToPoint(fen.modes), units, startedAt: 0, now: 0 };
  const byHour: Expedition = { ...byTurn, mode: pointToPoint(fen.modes, 'hour') };
  const byDay: Expedition = { ...byTurn, mode: pointToPoint(fen.modes, 'day') };

  // Purpose: light and rest still fall due by the setting's rules: a light burns down and goes out on the same turns
  // as in the setting's own turn mode, and the rest reminder comes on the setting's fifth turn, while none of that
  // mode's checks is raised.
  it('light and rest fall due by the setting’s rules, with none of the setting’s checks', () => {
    const turns = pressNext({ ...byTurn, lights: [rushlight] }, 6);
    expect(turns.map((t) => said(t))).toEqual([[], [], [], [], ['rest', 'Rushlight low'], ['Rushlight out']]);
    const creep = pressNext({ ...byTurn, mode: modeById(fen.modes, 'creep')!, lights: [rushlight] }, 6);
    expect(turns.map((t) => [t.rest, t.lights])).toEqual(creep.map((t) => [t.rest, t.lights]));
    expect(turns[4]!.rest).toEqual({ count: 1, condition: 'weary', length: { value: 1, unit: 'turn' }, note: 'Five turns on, one off.' });
  });

  // Purpose: by days, the rest reminder is the setting's day rule (every sixth day), not its turn rule.
  it('by days, rest is the setting’s day rule', () => {
    const days = pressNext(byDay, 6);
    expect(days.map((d) => d.rest?.count ?? 0)).toEqual([0, 0, 0, 0, 0, 1]);
    expect(days[5]!.rest).toMatchObject({ condition: 'weary', length: { value: 1, unit: 'day' } });
  });

  // Purpose: its encounter check is the place's own: with none, no check is in force; a place's timed check prompts as
  // the place's; one rolled on each move stands, and the clock never raises it.
  it('takes its encounter check from the place', () => {
    expect(encounterCheckOf(byTurn)).toBeNull();
    expect(pressNext(byTurn, 4).flatMap((t) => t.prompts)).toEqual([]);
    const timed = readCheck({ id: 'crypt', name: 'Crypt stirrings', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1, 2] }, tableId: 'crypt-things' })!;
    const there = pressNext({ ...byTurn, situation: { locationCheck: timed } }, 4);
    expect(there.map((t) => said(t))).toEqual([[], ['check crypt'], [], ['check crypt']]);
    expect(there[1]!.prompts[0]).toMatchObject({ source: 'location', hit: { tables: ['crypt-things'] } });
    const onMove = readCheck({ id: 'harbour', name: 'Encounters on the water', chance: { die: 'd6', on: [1] }, tableId: 'harbour-things' })!;
    const afloat = { ...byTurn, situation: { locationCheck: onMove, locationCheckOnMove: true } };
    expect(encounterCheckOf(afloat)).toMatchObject({ source: 'location', eachMove: true, check: { id: 'harbour' } });
    expect(pressNext(afloat, 4).flatMap((t) => t.prompts)).toEqual([]);
  });

  // Purpose: one step is one unit of the place's ways: by turns the clock moves a turn and the hour track shows; by
  // hours it moves an hour and by days a day, with no hour track.
  it('moves the clock by the unit of the place’s ways', () => {
    expect([stepSeconds(byTurn.mode, units), stepSeconds(byHour.mode, units), stepSeconds(byDay.mode, units)]).toEqual([TURN, 6 * TURN, DAY]);
    expect(nextStep(byTurn)).toMatchObject({ from: 0, to: TURN, step: 1 });
    expect(nextStep(byTurn)!.hourTrack).not.toBeNull();
    expect(nextStep(byHour)).toMatchObject({ from: 0, to: 6 * TURN, step: 1, hourTrack: null });
    expect(nextStep(byDay)).toMatchObject({ from: 0, to: DAY, step: 1, hourTrack: null });
    // A unit the campaign's clock doesn't know gives no step, as for any mode.
    expect(nextStep({ ...byTurn, mode: pointToPoint(fen.modes, 'fortnight') })).toBeNull();
  });

  // Purpose (the plan's flag 10, ruled 2026-11-18, "Day weather"): in point to point the setting's day weather runs,
  // rolled once a day whatever the step's unit: by turns it comes once in a day's turns, not every turn and not never,
  // where the setting's own turn mode has no weather at all.
  it('rolls the setting’s day weather once a day, even by turns', () => {
    const wet = { ...byTurn, situation: { choices: on } };
    expect(weatherFor(wet)).toMatchObject({ rollEvery: { value: 1, unit: 'day' }, tables: { any: 'weather-any' } });
    expect(weatherNow(wet)).toMatchObject({ period: 0, startsAt: 0, endsAt: DAY, tableId: 'weather-any' });
    expect(weatherNow({ ...wet, now: DAY + TURN })).toMatchObject({ period: 1, startsAt: DAY, endsAt: 2 * DAY });
    const turnsInDay = DAY / TURN;
    expect(pressNext(wet, turnsInDay - 1).flatMap((t) => t.prompts.filter((p) => p.kind === 'weather'))).toEqual([]);
    const day = nextSteps(wet, turnsInDay)!;
    expect(day.prompts.filter((p) => p.kind === 'weather')).toMatchObject([{ tableId: 'weather-any', count: 1 }]);
    expect(nextSteps(wet, 2 * turnsInDay)!.prompts.filter((p) => p.kind === 'weather')).toMatchObject([{ count: 2 }]);
    expect(weatherNow({ ...wet, mode: modeById(fen.modes, 'creep')! })).toBeNull();
  });

  // Purpose: by days the same weather comes with each day's step; with the setting's weather rule switched off, or a
  // setting with no weather, there is none, as in any mode.
  it('by days rolls it each day, and follows the setting’s weather switch', () => {
    const wet = { ...byDay, situation: { choices: on } };
    expect(pressNext(wet, 2).map((d) => said(d))).toEqual([['weather weather-any'], ['weather weather-any']]);
    expect(weatherNow({ ...byDay, situation: { choices: { 'weather-rules': 'off' } } })).toBeNull();
    expect(weatherOff({ ...byTurn, situation: { choices: { 'weather-rules': 'off' } } })).toBe(true);
    expect(pressNext({ ...byDay, situation: { choices: { 'weather-rules': 'off' } } }, 2).flatMap((d) => d.prompts)).toEqual([]);
    expect(weatherNow({ ...byTurn, rules: plain, mode: pointToPoint(plain.modes) })).toBeNull();
  });
});

describe('a day-by-day mode from a pack', () => {
  const roam: Expedition = { rules: fen, mode: modeById(fen.modes, 'roam')!, units, startedAt: 0, now: 0, situation: { season: 'dry', terrainId: 'meadow', choices: on } };
  const prompt = (a: Advance, id: string) => a.prompts.find((p) => p.kind === 'check' && p.checkId === id) as Extract<Prompt, { kind: 'check' }> | undefined;

  it('Next day runs the whole procedure in order: loose start checks first, the weather, checks, then camp with its own night check', () => {
    const day = nextStep(roam)!;
    expect(day.to).toBe(DAY);
    expect(said(day)).toEqual(['weather weather-dry', 'check roam-astray', 'check roam-wander', 'camp camp']);
    expect(day.quiet.map((q) => q.stepId)).toEqual(['course']);
    const camp = day.prompts.find((p) => p.kind === 'camp')!;
    expect(camp).toMatchObject({ quickOption: 'quick-camp', steps: [{ id: 'setup' }, { id: 'watches' }, { id: 'night' }, { id: 'sleep' }] });
    expect(camp.kind === 'camp' && camp.checks.map((c) => [c.checkId, c.hit.noteOnly, c.hit.note])).toEqual([['roam-night', true, 'Something circles the fire.']]);
    expect(day.hourTrack).toBeNull();
  });

  it('a check every 2 days comes every other day; with chance null it always rolls its table', () => {
    const days = pressNext(roam, 2);
    expect(prompt(days[0]!, 'roam-heron')).toBeUndefined();
    expect(prompt(days[1]!, 'roam-heron')).toMatchObject({ always: true, chance: null, hit: { tables: ['heron-omens'] }, stepId: null });
    expect(days[1]!.prompts[0]).toMatchObject({ checkId: 'roam-heron' });
  });

  it('byTrack: while the track is in range its chance replaces the check’s (a GM-only modifier)', () => {
    const flooded = nextSteps({ ...roam, situation: { ...roam.situation, tracks: { flood: 4 } } }, 2)!;
    expect(flooded.prompts.find((p) => p.kind === 'check' && p.checkId === 'roam-heron')).toMatchObject({ chance: { die: 'd6', on: [1, 2, 3] }, modifiers: [{ kind: 'track', public: false }] });
  });

  it('byTerrain: the lost check takes the terrain’s lostChance and the wandering check its wanderChance, keeping the check’s die', () => {
    const marsh = nextStep({ ...roam, situation: { ...roam.situation, terrainId: 'scrub' } })!;
    expect(prompt(marsh, 'roam-astray')!.chance).toEqual({ die: 'd6', on: [1, 2, 3] });
    expect(prompt(marsh, 'roam-wander')!.chance).toEqual({ die: 'd6', on: [1] });
    expect(prompt(marsh, 'roam-astray')!.modifiers[0]).toMatchObject({ kind: 'terrain', label: 'scrub', source: 'rules' });
  });

  it('modifiers: fog adds a face; a road rules the lost check out; a track replaces its chance; the GM’s + Modifier adds, listed with its source', () => {
    const foggy = nextStep({ ...roam, situation: { ...roam.situation, weatherTags: ['fog'], extraModifiers: [{ checkId: 'roam-astray', source: 'hand', label: 'Lost the map', add: 1, public: false }] } })!;
    expect(prompt(foggy, 'roam-astray')).toMatchObject({ chance: { die: 'd6', on: [1, 2, 3] }, ruledOut: false });
    expect(prompt(foggy, 'roam-astray')!.modifiers.map((m) => [m.source, m.kind, m.add])).toEqual([
      ['rules', 'terrain', null],
      ['rules', 'weatherTag', 1],
      ['hand', 'hand', 1],
    ]);
    const road = nextStep({ ...roam, situation: { ...roam.situation, routeType: 'road' } })!;
    expect(prompt(road, 'roam-astray')).toMatchObject({ ruledOut: true, modifiers: [{ kind: 'terrain' }, { kind: 'routeType', never: true }] });
    const track = nextStep({ ...roam, situation: { ...roam.situation, terrainId: 'marsh', routeType: 'track' } })!;
    expect(prompt(track, 'roam-astray')!.chance).toEqual({ die: 'd6', on: [1] });
  });

  it('onHit: the terrain’s encounterColumn beats the GM’s column pick; the region’s table comes from wildEncounters; the terrain’s own table is rolled there', () => {
    const marsh = nextStep({ ...roam, situation: { ...roam.situation, terrainId: 'marsh', region: 'Fen Reach' } })!;
    expect(prompt(marsh, 'roam-wander')!.hit).toMatchObject({ tables: ['beast-kind'], column: 'Marsh', columns: [], regionTable: 'fen-reach-beasts', regionTables: true });
    const meadow = nextStep(roam)!;
    expect(prompt(meadow, 'roam-wander')!.hit).toMatchObject({ column: null, columns: ['road', 'wild'], regionTable: null });
    const scrub = nextStep({ ...roam, situation: { ...roam.situation, terrainId: 'scrub' } })!;
    expect(prompt(scrub, 'roam-wander')!.hit.tables).toEqual(['scrub-beasts']);
  });

  it('a special season swaps encounters on its chance and brings its own weather table', () => {
    const gloam = nextStep({ ...roam, situation: { ...roam.situation, specialSeasons: ['gloaming'] } })!;
    expect(prompt(gloam, 'roam-wander')!.hit.swap).toEqual({ season: 'gloaming', chance: { die: 'd6', on: [1, 2] }, tableId: 'gloam-things' });
    expect(prompt(gloam, 'roam-astray')!.hit.swap).toBeNull();
    expect(gloam.prompts.find((p) => p.kind === 'weather')).toMatchObject({ kind: 'weather', tableId: 'gloam-weather' });
    const mist = nextStep({ ...roam, situation: { ...roam.situation, specialSeasons: ['mistwane'] } })!;
    expect(mist.prompts.find((p) => p.kind === 'weather')).toMatchObject({ kind: 'weather', tableId: 'step-weather-wet' });
  });

  it('weather: the step’s table by season wins, then the rules set’s by season; with its option off, the weather step is skipped entirely', () => {
    expect(nextStep({ ...roam, situation: { ...roam.situation, season: 'wet' } })!.prompts[0]).toMatchObject({ kind: 'weather', tableId: 'step-weather-wet', season: 'wet' });
    expect(nextStep({ ...roam, situation: { ...roam.situation, season: 'midwinter' } })!.prompts[0]).toMatchObject({ tableId: 'weather-any' });
    const off = nextStep({ ...roam, situation: { ...roam.situation, choices: {} } })!;
    expect(said(off)).toEqual(['check roam-astray', 'check roam-wander', 'camp camp']);
    expect(off.quiet.map((q) => q.stepId)).toEqual(['course']);
  });

  it('weather rolled every 2 days (rollEvery) comes every other day', () => {
    const every2 = { ...fen, weather: { ...fen.weather!, rollEvery: { value: 2, unit: 'day' } } };
    const days = pressNext({ ...roam, rules: every2 }, 4);
    expect(days.map((d) => d.prompts.filter((p) => p.kind === 'weather').length)).toEqual([0, 1, 0, 1]);
  });

  it('a mode with no weather step still gets the rules set’s weather, first; a turn mode doesn’t (the default is for day-by-day modes)', () => {
    const town = nextStep({ ...roam, mode: modeById(fen.modes, 'town')! })!;
    expect(said(town)).toEqual(['weather weather-dry']);
    expect(nextSteps({ ...roam, mode: modeById(fen.modes, 'creep')! }, 144)!.prompts.some((p) => p.kind === 'weather')).toBe(false);
    expect(town.rest).toBeNull();
  });

  it('activities in a day mode: terrain, season, special season and option decide what shows and what it gives', () => {
    const ids = (a: Advance) => a.activities.map((u) => u.activity.id);
    expect(ids(nextStep(roam)!)).toEqual(['forage', 'hunt']);
    const marsh = nextStep({ ...roam, situation: { season: 'wet', terrainId: 'marsh', choices: { eels: 'on' } } })!;
    expect(ids(marsh)).toEqual(['gather-reeds', 'forage', 'hunt', 'eel-run']);
    expect(marsh.activities.map((u) => [u.cost, u.result, u.tableId])).toEqual([
      [{ kind: 'budget', amount: 3 }, '1d4 bundles', null],
      [{ kind: 'budget', amount: 0 }, '1d3 meals', null],
      [{ kind: 'budget', amount: 'all' }, null, 'game-marsh'],
      [{ kind: 'time', seconds: 2 * 3600 }, null, null],
    ]);
    expect(nextStep(roam)!.activities[0]!.result).toBe('1 meal');
    expect(nextStep({ ...roam, situation: { ...roam.situation, specialSeasons: ['gloaming'] } })!.activities[0]!.result).toBe('Nothing grows');
  });

  it('+3 days sums the procedure up: each prompt once with its count, in procedure order', () => {
    expect(said(nextSteps(roam, 3)!)).toEqual(['weather weather-dry ×3', 'check roam-astray ×3', 'check roam-wander ×3', 'camp camp ×3', 'check roam-heron']);
    const camp = nextSteps(roam, 3)!.prompts.find((p) => p.kind === 'camp');
    expect(camp?.kind === 'camp' && camp.checks[0]!.count).toBe(3);
  });

  it('night and day checks: onlyAt follows the GM’s Day / Night switch', () => {
    const owl = readCheck({ id: 'owl', name: 'Owl', chance: { die: 'd6', on: [1] }, onlyAt: 'night' })!;
    const mode = { ...modeById(fen.modes, 'town')!, checks: [owl] };
    expect(nextStep({ ...roam, mode, situation: {} })!.prompts.map((p) => p.kind)).toEqual([]);
    expect(nextStep({ ...roam, mode, situation: { night: true } })!.prompts.map((p) => p.kind)).toEqual(['check']);
  });
});

describe('which steps need the season (ruled 2026-10-29: the first one asks "Which season?")', () => {
  const plain = (extra: Record<string, unknown>) => readExploration([{ exploration: { modes: [{ id: 'wade', name: 'Wading', step: { value: 1, unit: 'day' }, procedure: [], ...extra }] } }]);
  const of = (rules: ReturnType<typeof readExploration>) => ({ rules, mode: rules.modes[0]! });

  it('a step whose roll or weather reads a table by season needs it; a mode with neither does not', () => {
    expect(needsSeason(of(plain({ procedure: [{ id: 'sky', name: 'Sky', kind: 'roll', icon: 'weather', tableBySeason: { spring: 'spring-sky' } }] })))).toBe(true);
    expect(needsSeason(of(plain({ weather: { tables: { spring: 'spring-sky', summer: 'summer-sky' }, rollEvery: { value: 1, unit: 'day' } } })))).toBe(true);
    expect(needsSeason(of(plain({ weather: { tables: { any: 'any-sky' }, rollEvery: { value: 1, unit: 'day' } } })))).toBe(false);
    expect(needsSeason(of(plain({ procedure: [{ id: 'note', name: 'Listen', kind: 'note' }] })))).toBe(false);
  });

  it('without a season ("Not now", ruled 2026-10-30) the weather step offers the setting\'s weather tables to pick from; with one, it reads its own', () => {
    const rules = plain({
      procedure: [{ id: 'sky', name: 'Sky', kind: 'roll', icon: 'weather', tableBySeason: { spring: 'spring-sky' } }],
      weather: { tables: { spring: 'spring-sky', summer: 'summer-sky' }, rollEvery: { value: 1, unit: 'day' } },
    });
    const run = (season: string | null) => nextStep({ ...of(rules), units: timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 }), startedAt: 0, now: 0, situation: { season } })!;
    expect(run(null).prompts[0]).toMatchObject({ kind: 'weather', tableId: null, tableChoices: ['spring-sky', 'summer-sky'] });
    expect(run('summer').prompts[0]).toMatchObject({ kind: 'weather', tableId: 'summer-sky', tableChoices: [] });
    // A table for any season needs no pick.
    const any = plain({ procedure: [{ id: 'sky', name: 'Sky', kind: 'roll', icon: 'weather' }], weather: { tables: { any: 'any-sky' }, rollEvery: { value: 1, unit: 'day' } } });
    expect(nextStep({ ...of(any), units: timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 }), startedAt: 0, now: 0, situation: {} })!.prompts[0]).toMatchObject({ tableId: 'any-sky', tableChoices: [] });
  });
});
