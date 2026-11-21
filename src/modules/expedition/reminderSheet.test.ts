// The Reminders sheet's words (S10; st-3; page 16, T6). Invented reminders only.
//   What is to come is listed soonest first, then the stopped ones.
//   Each line says what it is, how often, when it next falls due in its own unit (rounded up), and who sees it.
//   A stopped reminder says so and has no "Next in".
import { describe, expect, it } from 'vitest';
import type { TimeUnits } from './clock.ts';
import type { ReminderSpec } from './reminders.ts';
import { nextInWords, remindersToCome } from './reminderSheet.ts';

const units: TimeUnits = { turn: 600, hour: 3600, day: 86400, week: 604800 };
const reminder = (over: Partial<ReminderSpec>): ReminderSpec => ({
  id: 'r',
  label: 'The tide turns',
  kind: 'reminder',
  encounterCheck: false,
  every: { value: 6, unit: 'turn' },
  anchor: 0,
  active: true,
  isPublic: false,
  chance: null,
  tableId: null,
  note: null,
  ...over,
});

describe('the Reminders sheet (S10)', () => {
  // Purpose: what is to come comes first, soonest first; stopped reminders after, in the order they came.
  it('lists what is to come soonest first, then the stopped ones', () => {
    const now = 4 * 600; // turn 4 on the clock
    const rows = remindersToCome(
      [
        reminder({ id: 'tide', label: 'The tide turns', every: { value: 6, unit: 'turn' } }),
        reminder({ id: 'stopped', label: 'Bail the boat', active: false }),
        reminder({ id: 'doors', label: 'Listen at the doors', kind: 'check', encounterCheck: true, every: { value: 5, unit: 'turn' } }),
      ],
      now,
      units,
    );
    expect(rows.map((r) => r.reminder.id)).toEqual(['doors', 'tide', 'stopped']);
  });

  // Purpose: each line says what it is, how often, when next in its own unit, and who sees it; a stopped one says so.
  it('says what it is, how often, when next and who sees it', () => {
    const now = 4 * 600;
    const [check, plain, stopped] = remindersToCome(
      [
        reminder({ id: 'doors', label: 'Listen at the doors', kind: 'check', encounterCheck: true, every: { value: 5, unit: 'turn' }, isPublic: true }),
        reminder({ id: 'tide', every: { value: 6, unit: 'turns' } }),
        reminder({ id: 'stopped', active: false }),
      ],
      now,
      units,
    );
    expect(check!.line).toBe('Encounter check. Every 5 turns. Next in 1 turn. Players see it.');
    expect(plain!.line).toBe('Every 6 turns. Next in 2 turns. GM only.');
    expect(stopped!.line).toBe('Every 6 turns. Stopped. GM only.');
    expect(stopped!.nextIn).toBeNull();
  });

  // Purpose: "Next in" rounds up in the reminder's own unit, so a fall later today is "Next in 1 day".
  it('rounds the time to the next fall up, in its own unit', () => {
    expect(nextInWords(reminder({ every: { value: 1, unit: 'day' } }), 3600, units)?.words).toBe('Next in 1 day');
    expect(nextInWords(reminder({ every: { value: 2, unit: 'hour' } }), 7200, units)?.words).toBe('Next in 2 hours');
    expect(nextInWords(reminder({ every: { value: 1, unit: 'fortnight' } }), 0, units)).toBeNull();
  });

  // Purpose (#877's review): a running reminder whose unit the clock can't read stays with the running ones and says
  // "Can't tell when.", never "Stopped"; it comes after those whose time is known, before the stopped ones.
  it('a running reminder with an unreadable unit says it cannot tell when and sits before the stopped ones', () => {
    const rows = remindersToCome(
      [reminder({ id: 'stopped', active: false }), reminder({ id: 'odd', every: { value: 1, unit: 'fortnight' } }), reminder({ id: 'tide' })],
      0,
      units,
    );
    expect(rows.map((r) => r.reminder.id)).toEqual(['tide', 'odd', 'stopped']);
    expect(rows[1]!.line).toBe("Every fortnight. Can't tell when. GM only.");
  });

  // Purpose (#877's review): one helper names the unit in both halves of the line, and a word ending in -ch, -sh, -s, -x
  // or -z takes "es": "Every 2 watches. Next in 1 watch."
  it('names the unit the same way in both halves, "watches" included', () => {
    const watchUnits: TimeUnits = { ...units, watch: 4 * 3600 };
    const [row] = remindersToCome([reminder({ every: { value: 2, unit: 'watch' } })], 4 * 3600 + 1, watchUnits);
    expect(row!.line).toBe('Every 2 watches. Next in 1 watch. GM only.');
    const [three] = remindersToCome([reminder({ every: { value: 3, unit: 'watch' } })], 0, watchUnits);
    expect(three!.line).toBe('Every 3 watches. Next in 3 watches. GM only.');
  });
});
