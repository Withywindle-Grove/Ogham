// The Reminders sheet's words (S10; st-3; page 16, T6): the GM's reminders, what is to come first, each with when it
// next falls due on the campaign clock. Pure: the sheet (`GmReminders`, SceneReminders.tsx) draws what this says.
// When a reminder falls due is read as the procedure reads it (`reminderSchedules`: its anchor and interval).
import type { TimeUnits } from './clock.ts';
import { everyWords, unitWords } from './reminderPlay.ts';
import { reminderSchedules, type ReminderSpec } from './reminders.ts';
import { nextAfter } from './schedule.ts';

/** One reminder as the sheet lists it. */
export interface ReminderToCome<R extends ReminderSpec = ReminderSpec> {
  reminder: R;
  /** Its small line: "Encounter check. Every 3 turns. Next in 1 turn. Players see it." */
  line: string;
  /** Seconds until it next falls due; null when it is stopped or its unit can't be read. */
  nextIn: number | null;
}

/** Said of a running reminder whose unit the campaign's clock can't read: it runs, but when is unknown. */
export const CANT_TELL_WHEN = "Can't tell when";

/**
 * "Next in 2 turns": the time to the next fall in the reminder's own unit, rounded up (a fall inside the next turn is
 * "Next in 1 turn"). Null when it is stopped or its unit can't be read.
 */
export function nextInWords(reminder: ReminderSpec, now: number, units: TimeUnits): { words: string; seconds: number } | null {
  const schedule = reminderSchedules([reminder], units)[0];
  if (!schedule) return null;
  const per = schedule.interval / reminder.every.value;
  const seconds = nextAfter(schedule.anchor, schedule.interval, now) - now;
  return { words: `Next in ${unitWords(Math.max(1, Math.ceil(seconds / per)), reminder.every.unit)}`, seconds };
}

/**
 * The GM's reminders as the sheet lists them: what is to come first, soonest first; then any running one whose unit
 * can't be read ("Can't tell when"); then the stopped ones, in the order they came. Each line says what it is (a check
 * or an encounter check; a plain reminder says nothing), how often, when next, and who sees it: today's facts about a
 * reminder, kept and moved (the icon row's spoken line).
 */
export function remindersToCome<R extends ReminderSpec>(reminders: readonly R[], now: number, units: TimeUnits): ReminderToCome<R>[] {
  const rows = reminders.map((reminder) => {
    const next = reminder.active ? nextInWords(reminder, now, units) : null;
    const what = reminder.kind === 'check' ? (reminder.encounterCheck ? 'Encounter check' : 'Check') : null;
    const when = !reminder.active ? 'Stopped' : (next?.words ?? CANT_TELL_WHEN);
    const line = [what, everyWords(reminder.every), when, reminder.isPublic ? 'Players see it' : 'GM only'].filter(Boolean).join('. ');
    return { reminder, line: `${line}.`, nextIn: next?.seconds ?? null };
  });
  const coming = rows.filter((r) => r.nextIn !== null).sort((a, b) => a.nextIn! - b.nextIn!);
  const unknown = rows.filter((r) => r.nextIn === null && r.reminder.active);
  return [...coming, ...unknown, ...rows.filter((r) => !r.reminder.active)];
}
