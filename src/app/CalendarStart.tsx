// The calendar start (ruled 2026-10-29; docs/04 calendarStart, 05 "Seasons, weather and the calendar", 06 Time
// line). Until it's set, the time strip reads "Day N" with a quiet Set date › for the GM; nothing blocks.
//   * CalendarStartForm: the month and the day the campaign's clock starts on. The same form serves Set date › on
//     Scene and Calendar start in Rules for this campaign. A pack's `calendar.defaultStart` prefills it.
//   * WhichSeason: the first step that needs the season asks "Which season?" with one chip per season; a tap makes
//     the day the advance lands on that season's first day (today, outside an advance), the start worked back from
//     the clock (ruled 2026-10-30; editable later). "Not
//     now" goes on without one, and holds on every GM device until the next session (ruled 2026-10-30).
import { useId, useState } from 'react';
import type { CalendarMonth, CalendarStart } from '../modules/expedition/clock.ts';
import type { StartTime } from '../modules/expedition/play.ts';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { ActionBar, Chip, OptionRow, StackedButton } from '../ui/parts.tsx';
import './SceneTime.css';

/**
 * "14 Reedmonth": a start date in words (the month's name; "Month 3" if the calendar has no such month). A day past
 * the month's last is one of its extra days: "Lanternsday, after Reedmonth".
 */
export function startWords(months: readonly CalendarMonth[], start: CalendarStart): string {
  const month = months[start.month - 1];
  const extra = month && start.day > month.days ? month.extraDays[start.day - month.days - 1] : undefined;
  if (month && extra) return `${extra.name}, after ${month.name}`;
  return `${start.day} ${month?.name ?? `Month ${start.month}`}`;
}

/** The start's day checked against its month: the start, or what's wrong in words. */
export function checkStart(months: readonly CalendarMonth[], month: number, dayText: string): CalendarStart | { problem: string } {
  const chosen = months[month - 1];
  const d = /^\d{1,3}$/.test(dayText.trim()) ? Number(dayText.trim()) : 0;
  if (!chosen) return { problem: 'Pick a month.' };
  // A day past the month's last names one of its extra days ("Which season?" can start on one), so a start it set
  // saves again unchanged.
  if (d < 1 || d > chosen.days + chosen.extraDays.length) return { problem: `${chosen.name} has days 1 to ${chosen.days}.` };
  return { month, day: d };
}

/** The first day's start time checked against the campaign's day and hour: the time, or what's wrong in words. */
export function checkStartTime(hourText: string, minuteText: string, hoursInDay: number, minutesInHour: number): StartTime | { problem: string } {
  const whole = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null);
  const h = whole(hourText);
  const m = whole(minuteText);
  if (h === null || h >= hoursInDay) return { problem: `The hour is a whole number from 0 to ${hoursInDay - 1}.` };
  if (m === null || m >= minutesInHour) return { problem: `The minute is a whole number from 0 to ${minutesInHour - 1}.` };
  return { hour: h, minute: m };
}

export function CalendarStartForm({
  months,
  start,
  onSave,
}: {
  months: readonly CalendarMonth[];
  /** What it's set to now, or the pack's default; the first day of the year when neither says. */
  start: CalendarStart | null;
  onSave: (start: CalendarStart) => void;
}) {
  const monthId = useId();
  const dayId = useId();
  const [month, setMonth] = useState(String(start?.month ?? 1));
  const [day, setDay] = useState(String(start?.day ?? 1));
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="calendar-start">
      <label className="field" htmlFor={monthId}>
        <span className="label">Month</span>
        <select id={monthId} className="field__input" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m, i) => (
            <option key={`${i}-${m.name}`} value={String(i + 1)}>
              {m.season ? `${m.name} (${m.season})` : m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor={dayId}>
        <span className="label">Day</span>
        <input id={dayId} className="field__input field__input--short" inputMode="numeric" pattern="[0-9]*" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            const checked = checkStart(months, Number(month), day);
            if ('problem' in checked) return setProblem(checked.problem);
            setProblem(null);
            onSave(checked);
          }}
        >
          Set the date
        </button>
      </ActionBar>
    </div>
  );
}

/** "Which season?": one chip per season of the calendar; Not now goes on without one (nothing blocks). */
export function WhichSeason({
  seasons,
  nameOf,
  onPick,
  onNotNow,
  onCancel,
}: {
  seasons: readonly string[];
  /** A season's name (the rules set's, else its id). */
  nameOf: (season: string) => string;
  onPick: (season: string) => void;
  onNotNow: () => void;
  /** Closed without an answer: nothing happens (the step isn't taken). */
  onCancel: () => void;
}) {
  return (
    <Dialog label="Which season?" onClose={onCancel}>
      <p className="time-strip__notes">This step reads the season. Pick it, and today becomes its first day; change the date later in Rules for this campaign.</p>
      <div className="calendar-start__seasons" role="group" aria-label="Seasons">
        {seasons.map((season) => (
          <Chip key={season} onClick={() => onPick(season)}>
            {nameOf(season)}
          </Chip>
        ))}
      </div>
      <button type="button" className="button-secondary button-secondary--small" onClick={onNotNow}>
        Not now
      </button>
    </Dialog>
  );
}

/**
 * The first day's start time (B13; ruled 2026-11-01, g1's scope check, option A), in Rules for this campaign's Time
 * and calendar group. While the clock hasn't moved (Day 1, no expedition, no advances), saving it puts the clock at
 * that time (logged); once the clock has moved, the start time only shows, and the way to change the time is Advance
 * by… → To a time. The hour runs to the campaign's day length, the minute to its hour.
 */
export function StartTimeForm({
  start,
  moved,
  hoursInDay,
  minutesInHour,
  onSave,
}: {
  /** The saved start time, or the default (06:00). */
  start: { hour: number; minute: number };
  /** The clock has moved: the start time only shows. */
  moved: boolean;
  hoursInDay: number;
  minutesInHour: number;
  onSave: (start: { hour: number; minute: number }) => void;
}) {
  const [hour, setHour] = useState(String(start.hour));
  const [minute, setMinute] = useState(String(start.minute).padStart(2, '0'));
  const [problem, setProblem] = useState<string | null>(null);
  const shown = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`;
  if (moved) {
    return (
      <div className="calendar-start">
        <p className="reading">The first day started at {shown}.</p>
        <p className="time-strip__notes">The clock has moved since, so this only shows. To change the time, use Advance by… → To a time on Scene.</p>
      </div>
    );
  }
  return (
    <div className="calendar-start">
      <p className="time-strip__notes">The time the adventure's first day starts. The clock hasn't moved yet, so setting it puts the clock there.</p>
      <StartHourFields hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            const checked = checkStartTime(hour, minute, hoursInDay, minutesInHour);
            if ('problem' in checked) return setProblem(checked.problem);
            setProblem(null);
            onSave(checked);
          }}
        >
          Set start time
        </button>
      </ActionBar>
    </div>
  );
}

/**
 * The hour play starts, as the sheets ask it (mc-25; the lead, 2026-11-15): today's Hour and Minute, everywhere. Dawn,
 * noon and dusk as three stacked buttons with their icons wait until a setting carries them (no pack-format field
 * names them yet). This is the one place that choice is made: the Start session sheet asks the hour through it too.
 */
export function StartHourFields({ hour, minute, onHour, onMinute }: { hour: string; minute: string; onHour: (hour: string) => void; onMinute: (minute: string) => void }) {
  const hourId = useId();
  const minuteId = useId();
  return (
    <div className="start-time__fields">
      <label className="field" htmlFor={hourId}>
        <span className="label">Hour</span>
        <input id={hourId} className="field__input field__input--short" inputMode="numeric" pattern="[0-9]*" value={hour} onChange={(e) => onHour(e.target.value)} />
      </label>
      <label className="field" htmlFor={minuteId}>
        <span className="label">Minute</span>
        <input id={minuteId} className="field__input field__input--short" inputMode="numeric" pattern="[0-9]*" value={minute} onChange={(e) => onMinute(e.target.value)} />
      </label>
    </div>
  );
}

/**
 * Set the date (S10; st-3; page 16, T6), the band's date line while it is unset: one sheet for the day, the month and
 * the hour play starts, asking only what isn't known (mc-24). The day is a field; the month is one field that opens a
 * sheet of the calendar's months in order (a tap picks one); the hour is today's Hour and Minute (`StartHourFields`),
 * asked only while the clock hasn't moved (once it has, the time changes through Advance by…). Its one accent is the
 * stacked "Set the date". Today's options are kept: a pack's default start prefills it; a day past the month's last
 * names one of its extra days.
 */
export function SetDateSheet({
  months,
  start,
  time,
  hoursInDay,
  minutesInHour,
  over,
  onSave,
  onClose,
}: {
  months: readonly CalendarMonth[];
  /** Whether the date is asked, and what it starts at (what it's set to, the pack's default, or null for the year's first day). */
  start: { ask: false } | { ask: true; from: CalendarStart | null };
  /** The start time to ask (the saved one, or the default); null when it isn't asked (the clock has moved). */
  time: StartTime | null;
  hoursInDay: number;
  minutesInHour: number;
  over?: string;
  /** Resolves true when saved; the sheet then closes. */
  onSave: (next: { date: CalendarStart | null; time: StartTime | null }) => Promise<boolean>;
  onClose: () => void;
}) {
  const dayId = useId();
  const asksDate = start.ask && months.length > 0;
  const from = start.ask ? start.from : null;
  const [month, setMonth] = useState(from?.month ?? 1);
  const [day, setDay] = useState(String(from?.day ?? 1));
  const [hour, setHour] = useState(String(time?.hour ?? 0));
  const [minute, setMinute] = useState(String(time?.minute ?? 0).padStart(2, '0'));
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = months[month - 1];
  const monthName = chosen?.name ?? `Month ${month}`;

  async function save() {
    const date = asksDate ? checkStart(months, month, day) : null;
    if (date && 'problem' in date) return setProblem(date.problem);
    const at = time ? checkStartTime(hour, minute, hoursInDay, minutesInHour) : null;
    if (at && 'problem' in at) return setProblem(at.problem);
    setProblem(null);
    if (await onSave({ date, time: at })) onClose();
  }

  return (
    <SheetScope.Provider value>
      <Dialog label="Set the date" over={over} onClose={onClose}>
        <div className="top-sheet calendar-start">
          {asksDate && (
            <>
              <div className="top-sheet__field">
                <label className="label" htmlFor={dayId}>
                  Day
                </label>
                <input id={dayId} className="field__input field__input--short" inputMode="numeric" pattern="[0-9]*" value={day} onChange={(e) => setDay(e.target.value)} />
              </div>
              <div className="top-sheet__field">
                <span className="label" aria-hidden="true">
                  Month
                </span>
                <button type="button" className="field__input set-date__month" aria-label={`Month: ${monthName}. Change`} onClick={() => setPicking(true)}>
                  <span className="set-date__month-name">{monthName}</span>
                  <Icon name="chevron" size={20} />
                </button>
              </div>
            </>
          )}
          {time && (
            <div className="top-sheet__field">
              <span className="label" aria-hidden="true">
                The hour play starts
              </span>
              <StartHourFields hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
            </div>
          )}
          {problem && (
            <p className="form-error" role="alert">
              {problem}
            </p>
          )}
          <div className="top-sheet__foot">
            <StackedButton icon="calendar" label="Set the date" variant="primary" onClick={() => void save()} />
          </div>
        </div>
        {picking && (
          <Dialog label="Month" over="Set the date" onClose={() => setPicking(false)}>
            {/* The calendar's months in order; a tap picks one and closes (st-3). A long calendar scrolls. */}
            <div className="set-date__months" role="radiogroup" aria-label="Months">
              {months.map((m, i) => (
                <OptionRow
                  key={`${i}-${m.name}`}
                  compact
                  name={m.name}
                  summary={m.season ?? ''}
                  selected={month === i + 1}
                  onPick={() => {
                    setMonth(i + 1);
                    setPicking(false);
                  }}
                />
              ))}
            </div>
          </Dialog>
        )}
      </Dialog>
    </SheetScope.Provider>
  );
}
