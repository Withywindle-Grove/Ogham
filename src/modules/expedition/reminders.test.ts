// What sets reminders going on the clock (M5 step 6). Invented rules and items only.
//   Gate check (docs/testing.md, M5): an every-2-turns check prompts on turns 2, 4 and 6, and on no other turn.
//   The GM's reminders repeat from when they were made; stopped ones don't run; units follow the campaign's lengths.
//   A remind hook runs on the clock when its test holds, its message filled in; one whose test can't be worked out
//   is skipped and named, never guessed; one with no `every` comes due each step.
//   A timed recharge comes due on its own timer ("recharges today"), with its amount; odd shapes are left out.
//   A chance the GM types ("1 in 6", "1-2 in 6") reads, and reads back the same way.
import { describe, expect, it } from 'vitest';
import { cardFrom } from './card.ts';
import { campaignUnits } from './play.ts';
import { FALLBACK_MODES, readExploration } from './modes.ts';
import { nextStep, nextSteps } from './procedure.ts';
import { chanceTyped, chanceTypedBack, fillMessage, hookSchedules, rechargeSchedules, reminderSchedules, type ReminderSpec } from './reminders.ts';

const units = campaignUnits({ time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 } }, []);
const turn = units.turn!;
const dungeon = FALLBACK_MODES[0]!;
const rules = readExploration([]);

const reminder = (extra: Partial<ReminderSpec> = {}): ReminderSpec => ({
  id: 'r1',
  label: 'Wandering check',
  kind: 'check',
  encounterCheck: true,
  every: { value: 2, unit: 'turn' },
  anchor: 0,
  active: true,
  isPublic: false,
  chance: { die: 'd6', on: [1] },
  tableId: 'bog-things',
  note: null,
  ...extra,
});

describe('the gate check: an every-2-turns check', () => {
  it('prompts on turns 2, 4 and 6, and on no other turn, over six Next turns', () => {
    const schedules = reminderSchedules([reminder()], units);
    let now = 0;
    const prompted: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const advance = nextStep({ rules, mode: dungeon, units, startedAt: 0, now, reminders: schedules })!;
      const card = cardFrom(advance, { info: new Map(schedules.map((s) => [s.id, s.info])) });
      if (card.some((l) => l.decision === 'check' && l.name === 'Wandering check')) prompted.push(advance.step);
      now = advance.to;
    }
    expect(prompted).toEqual([2, 4, 6]);
  });

  it('a long press of six turns brings it once, counted three times, with Hit / Miss and its table', () => {
    const schedules = reminderSchedules([reminder()], units);
    const summary = nextSteps({ rules, mode: dungeon, units, startedAt: 0, now: 0, reminders: schedules }, 6)!;
    const card = cardFrom(summary, { info: new Map(schedules.map((s) => [s.id, s.info])) });
    expect(card).toHaveLength(1);
    expect(card[0]).toMatchObject({ name: 'Wandering check', count: 3, decision: 'check', nextAt: 8 * turn });
    expect(card[0]!.check).toMatchObject({ source: 'gm', chance: { die: 'd6', on: [1] }, encounter: true, hit: { tables: ['bog-things'], noteOnly: false } });
  });

  it('made mid-expedition, it counts from when it was made', () => {
    const schedules = reminderSchedules([reminder({ anchor: 3 * turn })], units);
    const due = [3, 4, 5, 6].map((n) => nextStep({ rules, mode: dungeon, units, startedAt: 0, now: n * turn, reminders: schedules })!.reminders.length);
    expect(due).toEqual([0, 1, 0, 1]);
  });
});

describe("the GM's reminders", () => {
  it('a stopped one, or one whose unit the campaign has no length for, never runs', () => {
    expect(reminderSchedules([reminder({ active: false })], units)).toEqual([]);
    expect(reminderSchedules([reminder({ every: { value: 1, unit: 'fortnightish' } })], units)).toEqual([]);
  });

  it('a public one is marked public (players see it on the hour track); a reminder has Done, not Hit / Miss', () => {
    const [made] = reminderSchedules([reminder({ kind: 'reminder', isPublic: true, every: { value: 1, unit: 'day' } })], units);
    expect(made).toMatchObject({ kind: 'reminder', public: true, interval: units.day, group: 'gm' });
  });
});

describe('remind hooks', () => {
  const hooks = [
    { id: 'remind-bog', kind: 'remind', when: 'turnAdvanced', every: { value: 3, unit: 'turn' }, test: 'expedition.mode == "dungeon"', message: 'Check for bog lurkers in {expedition.mode}.' },
    { id: 'remind-other-mode', kind: 'remind', when: 'turnAdvanced', every: { value: 1, unit: 'turn' }, test: 'expedition.mode == "wilderness"', message: 'Not now.' },
    { id: 'remind-broken', kind: 'remind', when: 'turnAdvanced', test: 'expedition.mode ==', message: 'Broken.' },
    { id: 'remind-each', kind: 'remind', when: 'turnAdvanced', message: 'Each step {missing.name}.' },
    { id: 'remind-lamp', kind: 'remind', when: 'lightBurning', message: 'Waits for lights.' },
    { id: 'warn-x', kind: 'warn', when: 'equip', message: 'Not a reminder.' },
  ];

  it('run when their test holds, their message filled in; a broken test is skipped and named', () => {
    const run = hookSchedules(hooks, { units, stepSeconds: turn, startedAt: 6 * turn, mode: 'dungeon' });
    expect(run.schedules.map((s) => [s.id, s.name, s.interval, s.anchor])).toEqual([
      ['hook:remind-bog', 'Check for bog lurkers in dungeon.', 3 * turn, 6 * turn],
      ['hook:remind-each', 'Each step .', turn, 6 * turn],
    ]);
    expect(run.skipped).toEqual(['remind-broken']);
    const card = cardFrom({ prompts: [], rest: null, reminders: [], to: 0 }, { skippedHooks: run.skipped });
    expect(card[0]).toMatchObject({ decision: 'info', name: "A rule couldn't be checked: remind-broken" });
  });

  it('fills placeholders from the names, blank when unknown', () => {
    expect(fillMessage('Lamp of {light.name} at {x.y}', { light: { name: 'Reed' } })).toBe('Lamp of Reed at');
  });
});

describe('timed recharge', () => {
  it('comes due each day from the clock start, for one tap to confirm; odd shapes are left out', () => {
    const made = rechargeSchedules(
      [
        { lineId: 'line-wand', name: 'Wand of Reeds', recharge: { amount: '1d4', every: 'day' } },
        { lineId: 'line-staff', name: 'Fen staff', recharge: { amount: 2, every: { value: 2, unit: 'day' } } },
        { lineId: 'line-odd', name: 'Odd', recharge: { amount: '', every: 'day' } },
        { lineId: 'line-none', name: 'None', recharge: 'daily' },
      ],
      units,
    );
    expect(made.map((s) => [s.name, s.interval, s.info.amount])).toEqual([
      ['Wand of Reeds recharges today', units.day, '1d4'],
      ['Fen staff recharges after 2 days', 2 * units.day!, '2'],
    ]);
    const card = cardFrom({ prompts: [], rest: null, reminders: [{ id: made[0]!.id, name: made[0]!.name, kind: 'reminder', group: 'gm', count: 1, nextAt: 2 * units.day! }], to: units.day! }, { info: new Map(made.map((s) => [s.id, s.info])) });
    expect(card[0]).toMatchObject({ decision: 'recharge', recharge: { lineId: 'line-wand', amount: '1d4' } });
  });
});

describe('a chance the GM types', () => {
  it('reads "1 in 6", "2 in 6", "1-2 in 6", "3-4 in 6"; refuses what makes no sense', () => {
    expect(chanceTyped('1 in 6')).toEqual({ die: 'd6', on: [1] });
    expect(chanceTyped('2 in 6')).toEqual({ die: 'd6', on: [1, 2] });
    expect(chanceTyped('1-2 in d6')).toEqual({ die: 'd6', on: [1, 2] });
    expect(chanceTyped('3–4 in 6')).toEqual({ die: 'd6', on: [3, 4] });
    expect(chanceTyped('7 in 6')).toBeNull();
    expect(chanceTyped('often')).toBeNull();
  });

  it('reads back the way it was typed', () => {
    expect(chanceTypedBack({ die: 'd6', on: [1, 2] })).toBe('2 in 6');
    expect(chanceTypedBack({ die: 'd6', on: [3, 4] })).toBe('3-4 in 6');
    expect(chanceTypedBack(null)).toBe('');
  });
});
