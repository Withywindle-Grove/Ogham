// The nine engine rulings of 2026-10-29 (docs/05 "Exploration modes", docs/07 "Exploration"; 09 2026-10-29).
// Invented rules sets only: every name, table and number here is made up.
import { describe, expect, it } from 'vitest';
import { chanceText } from './checks.ts';
import { readClock, timeUnits } from './clock.ts';
import { startEffect } from './effects.ts';
import { fenRules } from './fixtures.ts';
import { modeById, readExploration } from './modes.ts';
import { nextStep, nextSteps, ranOutLine, setTime, undoSetTime, type Advance, type Expedition, type Prompt } from './procedure.ts';
import { startTimer } from './statusTimer.ts';
import type { Schedule } from './schedule.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const TURN = 600;
const DAY = 86400;

/** An invented rules set with one day-by-day mode, its checks and terrain given here. */
function bogRules(mode: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return readExploration([
    {
      id: 'bog-rules',
      exploration: {
        modes: [
          {
            id: 'wade',
            name: 'Wading',
            step: { value: 1, unit: 'day' },
            terrain: [
              { id: 'reedbed', name: 'Reedbed', cost: 2, lostChance: [1, 2], wanderChance: [1], encounterTableId: 'reedbed-things' },
              { id: 'mere', name: 'Mere', cost: 3, lostChance: [1, 2, 3], wanderChance: [1, 2] },
            ],
            ...mode,
          },
        ],
      },
      ...extra,
    },
  ]);
}

const checksOf = (a: Advance) => [
  ...a.prompts.flatMap((p) => (p.kind === 'check' ? [p] : [])),
  ...a.prompts.flatMap((p) => (p.kind === 'camp' ? p.checks : [])),
];
const checkIn = (a: Advance, id: string) => checksOf(a).find((c) => c.checkId === id);
const wade = (rules: ReturnType<typeof bogRules>, situation: Expedition['situation'] = { terrainId: 'reedbed' }): Expedition => ({
  rules,
  mode: modeById(rules.modes, 'wade')!,
  units,
  startedAt: 0,
  now: 0,
  situation,
});

describe('ruling 1: a byTerrain check names its terrain chance', () => {
  it('terrainChance says which chance is used, whatever the step’s symbol, with no warning', () => {
    const rules = bogRules({
      procedure: [{ id: 'drift', name: 'Drifting', icon: 'lost', kind: 'check', checkId: 'bog-wander' }],
      checks: [{ id: 'bog-wander', name: 'Bog lurkers', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'wanderChance', onHit: { tableId: 'lurkers' } }],
    });
    const day = nextStep(wade(rules, { terrainId: 'mere' }))!;
    expect(checkIn(day, 'bog-wander')).toMatchObject({ terrainChance: 'wanderChance', chance: { on: [1, 2] }, warnings: [] });
    expect(day.warnings).toEqual([]);
  });

  it('without terrainChance the step’s symbol is a fallback guess, reported as a warning on the prompt and the advance', () => {
    const rules = bogRules({
      procedure: [{ id: 'drift', name: 'Drifting', icon: 'lost', kind: 'check', checkId: 'bog-drift' }],
      checks: [{ id: 'bog-drift', name: 'Drifting', every: { value: 1, unit: 'day' }, byTerrain: true, onHit: { tableId: 'drift-result' } }],
    });
    const day = nextStep(wade(rules, { terrainId: 'mere' }))!;
    expect(checkIn(day, 'bog-drift')).toMatchObject({ terrainChance: 'lostChance', chance: { on: [1, 2, 3] } });
    const warning = 'Check "bog-drift" doesn\'t name its terrainChance; lostChance was guessed from the step\'s symbol.';
    expect(checkIn(day, 'bog-drift')!.warnings).toEqual([warning]);
    // Three days summed up still say it once.
    expect(nextSteps(wade(rules, { terrainId: 'mere' }), 3)!.warnings).toEqual([warning]);
  });
});

describe('ruling 2: the die for terrain faces', () => {
  const check = (die?: string) => ({ id: 'bog-wander', name: 'Bog lurkers', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'wanderChance', ...(die ? { chance: { die, on: [1] } } : {}), onHit: { tableId: 'lurkers' } });
  const proc = [{ id: 'w', name: 'Lurkers', icon: 'monster', kind: 'check', checkId: 'bog-wander' }];

  it('the check’s own die first, then the mode’s chanceDie, then d6; the prompt says "1–2 on d6"', () => {
    const own = nextStep(wade(bogRules({ procedure: proc, checks: [check('d8')], chanceDie: 'd10' }), { terrainId: 'mere' }))!;
    expect(checkIn(own, 'bog-wander')).toMatchObject({ chance: { die: 'd8', on: [1, 2] }, chanceText: '1–2 on d8' });
    const modeDie = nextStep(wade(bogRules({ procedure: proc, checks: [check()], chanceDie: 'd10' }), { terrainId: 'mere' }))!;
    expect(checkIn(modeDie, 'bog-wander')).toMatchObject({ chance: { die: 'd10', on: [1, 2] }, chanceText: '1–2 on d10' });
    const plain = nextStep(wade(bogRules({ procedure: proc, checks: [check()] }), { terrainId: 'mere' }))!;
    expect(checkIn(plain, 'bog-wander')).toMatchObject({ chance: { die: 'd6', on: [1, 2] }, chanceText: '1–2 on d6' });
  });

  it('a chanceDie that isn’t a die ("lots") is left out, so d6 applies', () => {
    const odd = nextStep(wade(bogRules({ procedure: proc, checks: [check()], chanceDie: 'lots' }), { terrainId: 'mere' }))!;
    expect(checkIn(odd, 'bog-wander')!.chanceText).toBe('1–2 on d6');
  });

  it('the chance in words joins runs of faces and keeps gaps', () => {
    expect(chanceText({ die: 'd6', on: [1] })).toBe('1 on d6');
    expect(chanceText({ die: 'd8', on: [3, 1, 2, 6] })).toBe('1–3, 6 on d8');
    expect(chanceText({ die: null, on: [1, 2] })).toBe('1–2');
    expect(chanceText({ die: 'd6', on: [] })).toBe('none on d6');
  });
});

describe('ruling 3: which table a hit rolls', () => {
  const rules = bogRules({
    procedure: [
      { id: 'drift', name: 'Drifting', icon: 'lost', kind: 'check', checkId: 'bog-drift' },
      { id: 'w', name: 'Lurkers', icon: 'monster', kind: 'check', checkId: 'bog-wander' },
    ],
    checks: [
      { id: 'bog-drift', name: 'Drifting', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'lostChance', onHit: { tableId: 'drift-result' } },
      { id: 'bog-wander', name: 'Bog lurkers', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'wanderChance', onHit: { tableId: 'lurkers' } },
    ],
  });
  const hit = (situation: Expedition['situation'], id: string) => checkIn(nextStep(wade(rules, situation))!, id)!.hit;

  it('the GM’s pick, then the place’s default, then the terrain’s, then the check’s own', () => {
    expect(hit({ terrainId: 'reedbed', pickedTableId: 'gm-table', placeTableId: 'place-table' }, 'bog-wander')).toMatchObject({ tables: ['gm-table'], tableFrom: 'gm' });
    expect(hit({ terrainId: 'reedbed', placeTableId: 'place-table' }, 'bog-wander')).toMatchObject({ tables: ['place-table'], tableFrom: 'place' });
    expect(hit({ terrainId: 'reedbed' }, 'bog-wander')).toMatchObject({ tables: ['reedbed-things'], tableFrom: 'terrain' });
    expect(hit({ terrainId: 'mere' }, 'bog-wander')).toMatchObject({ tables: ['lurkers'], tableFrom: 'check' });
  });

  it('a lost check always rolls its own table, even with the GM’s pick, a place table and a terrain table', () => {
    expect(hit({ terrainId: 'reedbed', pickedTableId: 'gm-table', placeTableId: 'place-table' }, 'bog-drift')).toMatchObject({ tables: ['drift-result'], tableFrom: 'check' });
  });

  it('the terrain’s table applies only to checks that use wanderChance', () => {
    const lostOnly = bogRules({
      procedure: [{ id: 'x', name: 'Odd', icon: 'monster', kind: 'check', checkId: 'odd' }],
      checks: [{ id: 'odd', name: 'Odd', byTerrain: true, terrainChance: 'lostChance', onHit: { tableId: 'odd-table' } }],
    });
    expect(checkIn(nextStep(wade(lostOnly))!, 'odd')!.hit).toMatchObject({ tables: ['odd-table'], tableFrom: 'check' });
  });
});

describe('ruling 4: weather switched off by its option', () => {
  it('skips the weather block and every weather step, with no prompt; switched on, they come back', () => {
    const roam = { rules: readExploration([fenRules]), mode: modeById(readExploration([fenRules]).modes, 'roam')!, units, startedAt: 0, now: 0 };
    const off = nextSteps({ ...roam, situation: { season: 'dry', choices: {} } }, 3)!;
    expect(off.prompts.some((p) => p.kind === 'weather')).toBe(false);
    expect(off.quiet.some((q) => q.icon === 'weather')).toBe(false);
    const town = nextStep({ ...roam, mode: modeById(roam.rules.modes, 'town')!, situation: { season: 'dry', choices: {} } })!;
    expect(town.prompts).toEqual([]);
    const on = nextStep({ ...roam, situation: { season: 'dry', choices: { 'weather-rules': 'on' } } })!;
    expect(on.prompts[0]).toMatchObject({ kind: 'weather', tableId: 'weather-dry' });
  });

  it('a weather step with no weather block at all still prompts (the GM types the result)', () => {
    const rules = bogRules({ procedure: [{ id: 'sky', name: 'Sky', icon: 'weather', kind: 'roll' }], checks: [] });
    expect(nextStep(wade(rules))!.prompts).toEqual([{ kind: 'weather', stepId: 'sky', tableId: null, season: null, count: 1, tableChoices: [] }]);
  });
});

describe('ruling 5: Set time… moves timers and lights with the clock', () => {
  const dazed = { id: 's1', name: 'Dazed', timer: startTimer({ value: 3, unit: 'turn' }, units)! };
  const forever = { id: 's2', name: 'Marked', timer: { remaining: null, total: null, unit: 'turn', secret: false } };
  const lantern = { id: 'l1', name: 'Lantern', litAt: 0, seconds: 4 * TURN, warnSeconds: TURN };
  const ward = startEffect('e1', 'Reed ward', { kind: 'timed', seconds: 5 * TURN }, 0)!;
  const here = { now: 0, statuses: [dazed, forever], lights: [lantern], effects: [ward] };

  it('forward: status timers lose the same time; what runs out is listed for one quiet log line; nothing else runs', () => {
    const two = setTime(here, 2 * TURN)!;
    expect(two.statuses.map((s) => s.timer.remaining)).toEqual([TURN, null]);
    expect(two.ranOut).toEqual([]);
    expect(ranOutLine(two)).toBeNull();
    const six = setTime(here, 6 * TURN)!;
    expect(six.statuses[0]!.timer.remaining).toBe(0);
    expect(six.ranOut).toEqual([
      { kind: 'light', id: 'l1', name: 'Lantern' },
      { kind: 'effect', id: 'e1', name: 'Reed ward' },
      { kind: 'status', id: 's1', name: 'Dazed' },
    ]);
    expect(ranOutLine(six)).toBe('Ran out with the clock: Lantern, Reed ward, Dazed.');
    expect(Object.keys(six).sort()).toEqual(['correction', 'from', 'ranOut', 'statuses', 'statusesBefore', 'to']);
  });

  it('back: time comes back to status timers, up to their full length; nothing runs out', () => {
    const later = { ...here, now: 2 * TURN, statuses: [{ ...dazed, timer: { ...dazed.timer, remaining: TURN } }] };
    expect(setTime(later, TURN)!.statuses[0]!.timer.remaining).toBe(2 * TURN);
    expect(setTime(later, 0)!.statuses[0]!.timer.remaining).toBe(3 * TURN);
    expect(setTime({ ...later, now: 9 * TURN }, 0)!.statuses[0]!.timer.remaining).toBe(3 * TURN);
    expect(setTime(later, 0)!.ranOut).toEqual([]);
  });

  it('Undo puts the clock and the status timers back as they were', () => {
    const six = setTime(here, 6 * TURN)!;
    expect(undoSetTime(six)).toEqual({ from: 6 * TURN, to: 0, correction: true, statuses: here.statuses, statusesBefore: six.statuses, ranOut: [] });
  });
});

describe('ruling 6: a check runs at most once per its every period', () => {
  const rules = bogRules({
    procedure: [
      { id: 'w', name: 'Lurkers', icon: 'monster', kind: 'check', checkId: 'bog-wander' },
      { id: 'camp', name: 'Camp', icon: 'camp', kind: 'camp' },
    ],
    checks: [{ id: 'bog-wander', name: 'Bog lurkers', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'wanderChance', onHit: { tableId: 'lurkers' } }],
    camp: { procedure: [{ id: 'night', name: 'Night lurkers', icon: 'monster', kind: 'check', checkId: 'bog-wander' }] },
  });

  it('a camp that references the day’s check offers "Check again" instead of a second prompt', () => {
    const day = nextStep(wade(rules))!;
    const first = day.prompts.find((p) => p.kind === 'check') as Extract<Prompt, { kind: 'check' }>;
    expect(first).toMatchObject({ checkId: 'bog-wander', again: false });
    const camp = day.prompts.find((p) => p.kind === 'camp');
    expect(camp?.kind === 'camp' && camp.checks.map((c) => [c.checkId, c.again])).toEqual([['bog-wander', true]]);
  });

  it('the next day the check prompts again: the period is its every', () => {
    const three = nextSteps(wade(rules), 3)!;
    expect(three.prompts.find((p) => p.kind === 'check')).toMatchObject({ again: false, count: 3 });
    const camp = three.prompts.find((p) => p.kind === 'camp');
    expect(camp?.kind === 'camp' && camp.checks[0]).toMatchObject({ again: true, count: 3 });
  });

  it('two procedure steps running the same check: the second is the optional Check again', () => {
    const twice = bogRules({
      procedure: [
        { id: 'a', name: 'Lurkers', icon: 'monster', kind: 'check', checkId: 'bog-wander' },
        { id: 'b', name: 'Lurkers again', icon: 'monster', kind: 'check', checkId: 'bog-wander' },
      ],
      checks: [{ id: 'bog-wander', name: 'Bog lurkers', chance: { die: 'd6', on: [1] }, onHit: { tableId: 'lurkers' } }],
    });
    expect(nextStep(wade(twice))!.prompts.map((p) => (p.kind === 'check' ? [p.stepId, p.again] : p.kind))).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });
});

describe('ruling 7: checks no step runs are placed by when', () => {
  it('start comes before the procedure; middle, end and a missing when come after it', () => {
    const rules = bogRules({
      procedure: [{ id: 'n', name: 'Wade on', icon: 'travel', kind: 'roll', tableId: 'wade-table' }],
      checks: [
        { id: 'late', name: 'Late', chance: { die: 'd6', on: [1] }, when: 'end' },
        { id: 'early', name: 'Early', chance: { die: 'd6', on: [1] }, when: 'start' },
        { id: 'anytime', name: 'Any time', chance: { die: 'd6', on: [1] } },
      ],
    });
    expect(nextStep(wade(rules))!.prompts.map((p) => (p.kind === 'check' ? p.checkId : p.kind))).toEqual(['early', 'roll', 'late', 'anytime']);
  });
});

describe('ruling 8: one encounter check per period for the GM', () => {
  const creepRules = readExploration([fenRules]);
  const creep: Expedition = { rules: creepRules, mode: modeById(creepRules.modes, 'creep')!, units, startedAt: 0, now: 0 };
  const gmEvery3: Schedule = { id: 'gm-enc', name: 'Encounter check', kind: 'check', encounterCheck: true, anchor: 0, interval: 3 * TURN, group: 'gm' };
  const gmNote: Schedule = { id: 'gm-note', name: 'Torches', kind: 'reminder', encounterCheck: false, anchor: 0, interval: 3 * TURN, group: 'gm' };

  it('when the mode’s check and the GM’s encounter-check reminder fall due together, the GM is prompted once', () => {
    const turns: Advance[] = [];
    let state: Expedition = { ...creep, reminders: [gmEvery3, gmNote] };
    for (let i = 0; i < 6; i++) {
      const a = nextStep(state)!;
      turns.push(a);
      state = { ...state, now: a.to };
    }
    const lines = turns.map((t) => [...t.prompts.map((p) => (p.kind === 'check' ? p.checkId : p.kind)), ...t.reminders.map((r) => r.name)]);
    // Turn 3: only the GM's reminder is due, so it prompts; turn 6: the mode's check counts as it. Other reminders keep running.
    expect(lines).toEqual([[], ['creep-wander'], ['Encounter check', 'Torches'], ['creep-wander'], [], ['creep-wander', 'Torches']]);
    expect(turns[5]!.satisfied).toEqual(['gm-enc']);
  });

  it('a lost check doesn’t count as an encounter check', () => {
    const rules = bogRules({
      procedure: [{ id: 'drift', name: 'Drifting', icon: 'lost', kind: 'check', checkId: 'bog-drift' }],
      checks: [{ id: 'bog-drift', name: 'Drifting', every: { value: 1, unit: 'day' }, byTerrain: true, terrainChance: 'lostChance', onHit: { tableId: 'drift-result' } }],
    });
    const gmDaily: Schedule = { ...gmEvery3, interval: DAY };
    const day = nextStep({ ...wade(rules), reminders: [gmDaily] })!;
    expect(day.reminders.map((r) => r.id)).toEqual(['gm-enc']);
    expect(day.satisfied).toEqual([]);
  });
});

describe('ruling 9: turnsPerHour wins over turnMinutes', () => {
  it('an hour is that many turns, even when the turn length doesn’t make 60 minutes', () => {
    const odd = timeUnits({ roundSeconds: 6, turnMinutes: 12, dayHours: 24, turnsPerHour: 6 });
    expect(odd.hour).toBe(6 * 12 * 60);
    const hour = 6 * 12 * 60;
    expect(readClock(hour, odd)).toMatchObject({ hour: 1, turnInHour: 1, turnsPerHour: 6 });
  });
});
