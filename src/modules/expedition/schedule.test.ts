// What falls due when the clock moves (docs/05; ruled 2026-10-24, M5-5). Invented reminders.
import { describe, expect, it } from 'vitest';
import { activeSchedules, allDone, dueOnJump, mergeDue, nextAfter, occurrences, reminderCard, resumeFrom, type Schedule } from './schedule.ts';

const TURN = 600;
const encounter: Schedule = { id: 'gm-encounter', name: 'Encounter check', kind: 'check', encounterCheck: true, anchor: 0, interval: 2 * TURN, group: 'gm' };
const rations: Schedule = { id: 'rations', name: 'Eat a ration', kind: 'reminder', anchor: 0, interval: 6 * TURN, group: 'rest' };

describe('occurrences', () => {
  it('counts what falls due after "from" up to and including "to"', () => {
    expect(occurrences(0, 2 * TURN, 0, 6 * TURN)).toBe(3);
    expect(occurrences(0, 2 * TURN, 2 * TURN, 3 * TURN)).toBe(0);
    expect(occurrences(0, 2 * TURN, TURN, 2 * TURN)).toBe(1);
    expect(occurrences(5 * TURN, 2 * TURN, 0, 6 * TURN)).toBe(0);
    expect(occurrences(0, 2 * TURN, 6 * TURN, 6 * TURN)).toBe(0);
    expect(nextAfter(0, 2 * TURN, 5 * TURN)).toBe(6 * TURN);
  });
});

describe('a clock jump', () => {
  it('moving six turns at once fires each once, with its count, in the order given', () => {
    expect(dueOnJump([encounter, rations], 0, 6 * TURN)).toEqual([
      { id: 'gm-encounter', name: 'Encounter check', kind: 'check', group: 'gm', count: 3, nextAt: 8 * TURN },
      { id: 'rations', name: 'Eat a ration', kind: 'reminder', group: 'rest', count: 1, nextAt: 12 * TURN },
    ]);
  });

  it('a repeat still on the card counts up instead of appearing twice', () => {
    const first = dueOnJump([encounter], 0, 2 * TURN);
    const again = dueOnJump([encounter], 2 * TURN, 6 * TURN);
    expect(mergeDue(first, again)).toEqual([{ ...first[0]!, count: 3, nextAt: 8 * TURN }]);
  });
});

describe('the reminder card', () => {
  it('procedure, then lights, then rest, then the GM’s; four lines, then "N more"; All done keeps the checks', () => {
    const due = [
      ...dueOnJump([encounter, rations], 0, 6 * TURN),
      { id: 'step', name: 'Wandering', kind: 'check' as const, group: 'procedure' as const, count: 1, nextAt: 0 },
      { id: 'lamp', name: 'Lamp low', kind: 'reminder' as const, group: 'light' as const, count: 1, nextAt: 0 },
    ];
    const card = reminderCard(due, ['Reed’s torch: 1 turn left']);
    expect(card.lines.map((l) => ('info' in l ? l.info : l.id))).toEqual(['step', 'lamp', 'rations', 'gm-encounter']);
    expect(card.more).toBe(1);
    expect(allDone(due).map((d) => d.id)).toEqual(['gm-encounter', 'step']);
  });
});

describe("a location's own check", () => {
  const roomCheck: Schedule = { id: 'room', name: 'Flooded hall', kind: 'check', anchor: 0, interval: TURN };

  it("replaces the GM's encounter-check reminders while there; other reminders keep running", () => {
    const here = activeSchedules([encounter, rations], { check: roomCheck, useMineHere: false });
    expect(here.active.map((s) => s.id)).toEqual(['rations', 'room']);
    expect(here).toMatchObject({ suspended: ['gm-encounter'], source: 'adventure' });
    expect(activeSchedules([encounter, rations], { check: roomCheck, useMineHere: true })).toMatchObject({ suspended: [], source: 'yours' });
  });

  it('on leaving, the GM’s reminder starts again from now: no catch-up backlog', () => {
    const resumed = resumeFrom([encounter, rations], ['gm-encounter'], 9 * TURN);
    expect(dueOnJump(resumed, 9 * TURN, 10 * TURN)).toEqual([]);
    expect(dueOnJump(resumed, 9 * TURN, 11 * TURN).map((d) => [d.id, d.count])).toEqual([['gm-encounter', 1]]);
  });
});
