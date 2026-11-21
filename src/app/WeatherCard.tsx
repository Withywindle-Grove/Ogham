// Today's weather (M5b; ruled 2026-10-30: D1, S2-1, A8–A12; docs/05 "Seasons, weather and the calendar", 06 Weather
// card). One weather per `rollEvery` step of the expedition under way; the first entry counts.
//   * useWeather: what the weather is now for this person: nothing (no expedition, no weather in this mode, or its
//     optional rule off), waiting for the season, due (with the die to roll), or in (the result and each tag in
//     plain words). It reads the clock, the expedition and the setting rules' weather block (player-readable) and
//     the stored weather; the weather table never reaches a player's device (the database reads the row).
//   * WeatherCard (Scene, players): the prompt while due (Enter roll when "Weather rolled by" is Players), then the
//     result and its effects, at once. A tap folds it into the icon beside the date; WeatherIcon reopens it (the
//     8-second automatic fold went at the M5 gate, R3 audit 15). The GM's weather is the Weather fact and its sheet
//     (S10, WeatherSheet.tsx), where the GM enters the roll by a tap on the table's row, or changes it.
//   * useWeatherNotice (the Player tab's notices box, row C1): the same prompt as a notice. Entering in either closes
//     both, for everyone (the log's live updates reload it).
// The entrant's Undo is in the toast (6 seconds); after that only the GM changes it (the sheet, logged as a correction).
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { calendarStartOf, dateOnClock, monthsOf, startIndex } from '../modules/expedition/clock.ts';
import { FALLBACK_MODES, modeById, readExploration, type Mode } from '../modules/expedition/modes.ts';
import { campaignUnits, loadScene } from '../modules/expedition/play.ts';
import { weatherNow, type WeatherNow } from '../modules/expedition/procedure.ts';
import {
  budgetNameOf,
  correctWeather,
  enterWeather,
  loadWeather,
  loadWeatherDie,
  loadWeatherPeople,
  weatherRolledByOf,
  weatherTagLines,
  weatherTagParts,
  type WeatherRoll,
  type WeatherRolledBy,
} from '../modules/expedition/weatherPlay.ts';
import { DieGlyph, RollRow, dieOf } from '../ui/dice.tsx';
import { StackedButton, StepSymbol } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { choicesInPlay, loadCampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';
import './WeatherCard.css';

export type WeatherView =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'waiting' | 'unset' | 'due' | 'in';
      campaignId: string;
      expeditionId: string;
      now: WeatherNow;
      rolledBy: WeatherRolledBy;
      /** The live weather (when it's in). */
      weather: WeatherRoll | null;
      /** Each tag in plain words. */
      lines: string[];
      /** Each tag as its label and its words (the Weather sheet's labelled lines, T6). */
      parts: { label: string; words: string[] }[];
      /** What to roll ("d8"), when the table names it. */
      die: string | null;
      /** Who entered it, and who changed it since (names). */
      enteredBy: string | null;
      /** The one who entered it is the campaign's GM (the Weather sheet says "Rolled by the GM."). */
      enteredByGm: boolean;
      changedBy: string | null;
    };

/** What the weather is now for this person, kept fresh by the log's live updates. */
export function useWeather(db: Db, user: CurrentUser, campaignId: string, version = 0): { view: WeatherView; reload: () => void } {
  const logVersion = useLogVersion();
  const [view, setView] = useState<WeatherView>({ kind: 'loading' });
  const [own, setOwn] = useState(0);
  useEffect(() => {
    let current = true;
    void readWeatherView(db, user, campaignId).then((found) => current && setView(found));
    return () => {
      current = false;
    };
  }, [db, user, campaignId, logVersion, version, own]);
  return { view, reload: () => setOwn((n) => n + 1) };
}

async function readWeatherView(db: Db, user: CurrentUser, campaignId: string): Promise<WeatherView> {
  try {
    const [scene, settings, setting] = await Promise.all([loadScene(db, campaignId), loadCampaignSettings(db, campaignId), loadCampaignSetting(db, user.id, campaignId)]);
    if (!scene || settings === null || setting === null) return { kind: 'error' };
    const { clock, expedition } = scene;
    if (!expedition || !clock) return { kind: 'none' };
    const rulesSets = setting.rulesSets;
    const units = campaignUnits(settings, rulesSets);
    const exploration = readExploration(rulesSets);
    const mode: Mode = modeById(exploration.modes, expedition.mode) ?? modeById(FALLBACK_MODES, expedition.mode) ?? FALLBACK_MODES[0]!;
    const choices = choicesInPlay(setting);
    const months = monthsOf(setting.calendar);
    const start = startIndex(months, calendarStartOf(settings.calendarStart) ?? calendarStartOf(setting.calendar?.defaultStart));
    const date = start ? dateOnClock(months, start, clock.seconds, 0, units) : null;
    const now = weatherNow({ rules: exploration, mode, units, startedAt: expedition.startedAt, now: clock.seconds, situation: { choices, season: date?.season ?? null } });
    if (!now) return { kind: 'none' };
    const rolledBy = weatherRolledByOf(settings);
    const weather = await loadWeather(db, expedition.id, now.period);
    if (weather === undefined) return { kind: 'error' };
    const base = { campaignId, expeditionId: expedition.id, now, rolledBy, weather, lines: [] as string[], parts: [] as { label: string; words: string[] }[], die: null as string | null, enteredBy: null as string | null, enteredByGm: false, changedBy: null as string | null };
    if (weather) {
      const people = await loadWeatherPeople(db, campaignId);
      return {
        ...base,
        kind: 'in',
        lines: weatherTagLines(weather.tags, now.tags, budgetNameOf(mode.movement)),
        parts: weatherTagParts(weather.tags, now.tags, budgetNameOf(mode.movement)),
        enteredBy: weather.enteredBy ? (people.get(weather.enteredBy)?.name ?? 'Someone') : null,
        enteredByGm: !!weather.enteredBy && !!people.get(weather.enteredBy)?.gm,
        changedBy: weather.correctedBy ? (people.get(weather.correctedBy)?.name ?? 'The GM') : null,
      };
    }
    if (now.waitingForSeason) return { ...base, kind: 'waiting' };
    if (!now.tableId) return { ...base, kind: 'unset' };
    const die = isGm(user, campaignId) ? null : await loadWeatherDie(db, campaignId, now.tableId);
    return { ...base, kind: 'due', die };
  } catch {
    return { kind: 'error' };
  }
}

/** Whether this person may enter the roll (the app's copy of the database's rule). */
export function mayEnter(user: CurrentUser, view: Extract<WeatherView, { now: WeatherNow }>): boolean {
  return registry.can(user, enterWeather.name, { campaignId: view.campaignId, rolledBy: view.rolledBy });
}

/**
 * Enter and Undo, shared by the card and the urgent strip. Undo is the entrant's own, from the toast; the database
 * refuses it once the toast has gone.
 */
export function useWeatherActions(db: Db, user: CurrentUser, onChanged: () => void) {
  const show = useToast();
  const busy = useRef(false);

  async function undo(campaignId: string, type: string) {
    const eventId = await latestChange(db, campaignId, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  }

  async function enter(view: Extract<WeatherView, { now: WeatherNow }>, tableId: string, roll: string): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    const result = await runCommand(registry, db, user, enterWeather, {
      campaignId: view.campaignId,
      expeditionId: view.expeditionId,
      period: view.now.period,
      startsAt: view.now.startsAt,
      tableId,
      roll,
      rolledBy: view.rolledBy,
    });
    busy.current = false;
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    show({ text: `Today's weather: ${result.value.result}`, onUndo: () => void undo(view.campaignId, enterWeather.name) });
    return true;
  }

  async function correct(view: Extract<WeatherView, { now: WeatherNow }>, tableId: string, roll: string): Promise<boolean> {
    if (busy.current || !view.weather) return false;
    busy.current = true;
    const result = await runCommand(registry, db, user, correctWeather, { campaignId: view.campaignId, weather: view.weather, tableId, roll });
    busy.current = false;
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    show({ text: `Changed today's weather to ${result.value.result}`, onUndo: () => void undo(view.campaignId, correctWeather.name) });
    return true;
  }

  return { enter, correct };
}

/** The roll a player types: what the dice showed (a number, or "3/7" for a die read in two parts). */
export function RollForm({
  label,
  die = null,
  onEnter,
  stacked = false,
  inNotice = false,
  typed: heldTyped,
  onTyped,
}: {
  label: string;
  die?: string | null;
  onEnter: (roll: string) => Promise<boolean>;
  stacked?: boolean;
  /** The typed roll, when held above (the notices box keeps it while a turned tablet moves the box, row C1). */
  typed?: string | undefined;
  onTyped?: ((typed: string) => void) | undefined;
  /** In the notices sheet (row C1): the notice's line says what to roll, so the box keeps the words as its name alone, and Enter roll is the sheet's one accent. */
  inNotice?: boolean;
}) {
  const id = useId();
  const [ownTyped, setOwnTyped] = useState('');
  const typed = heldTyped ?? ownTyped;
  const setTyped = onTyped ?? setOwnTyped;
  const [problem, setProblem] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const said = typed.trim();
    if (!said) return setProblem('Type what the dice showed, like 4.');
    if (!/^\d{1,4}(\s*\/\s*\d{1,4})?$/.test(said)) return setProblem('Type a whole number, like 4.');
    setProblem(null);
    if (await onEnter(said)) setTyped('');
  }
  return (
    <form className="weather__form" onSubmit={(event) => void submit(event)}>
      {stacked ? (
        // The Weather sheet's (T6): a plain line with the die, "Roll d8.", over the box; the box keeps its full name.
        <RollRow die={die ? dieOf(die) : null}>{die ? `Roll ${die}.` : 'Roll the dice.'}</RollRow>
      ) : inNotice ? null : (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="weather__entry">
        <input id={id} aria-label={stacked || inNotice ? label : undefined} className="field__input field__input--short" type="text" inputMode="numeric" autoComplete="off" maxLength={9} value={typed} onChange={(e) => setTyped(e.target.value)} />
        {stacked ? (
          // The Weather sheet's (T6): the stacked Enter with its tick, the sheet's one accent.
          <StackedButton icon="confirmed" label="Enter" variant="primary" submit />
        ) : (
          <button type="submit" className={inNotice ? 'button-primary' : 'button-secondary'}>
            Enter roll
          </button>
        )}
      </div>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

/** "Roll d8 for the weather", or without a die named, "Roll for the weather". */
export const rollWords = (die: string | null) => (die ? `Roll ${die} for the weather` : 'Roll for the weather');

/**
 * The players' weather card on Scene: the roll while it's due (Enter roll when "Weather rolled by" is Players), then the
 * result and its effects. The GM's weather is the Weather fact and its sheet (S10, `WeatherSheet`); the players' card
 * gives way to their own Weather fact with their top (S15).
 */
export function WeatherCard({
  db,
  user,
  view,
  onChanged,
  folded,
  onFold,
}: {
  db: Db;
  user: CurrentUser;
  view: WeatherView;
  onChanged: () => void;
  /** The result folded into the icon beside the date. */
  folded: boolean;
  onFold: () => void;
}) {
  const { enter } = useWeatherActions(db, user, onChanged);
  if (view.kind === 'none' || view.kind === 'loading') return null;
  if (view.kind === 'error') {
    return (
      <section className="weather" aria-label="Weather">
        <p className="weather__quiet" role="alert">
          Couldn't load today's weather. Check your connection.
        </p>
      </section>
    );
  }

  if (view.kind === 'in' && view.weather) {
    if (folded) return null;
    return (
      <section className="weather weather--in" aria-label="Today's weather">
        <button type="button" className="weather__fold" aria-label="Fold today's weather into the icon by the date" onClick={onFold}>
          <StepSymbol symbol="weather" label="Weather" />
          <span className="weather__words">
            <span className="weather__title">{`Today's weather: ${view.weather.result}`}</span>
            {view.lines.length > 0 && (
              <span className="weather__lines">
                {view.lines.map((line) => (
                  <span key={line} className="weather__line">
                    {line}
                  </span>
                ))}
              </span>
            )}
            <span className="weather__quiet">
              {[view.enteredBy ? `Entered by ${view.enteredBy}` : null, view.changedBy ? `changed by ${view.changedBy}` : null].filter(Boolean).join(', ')}
            </span>
          </span>
        </button>
      </section>
    );
  }

  // The mode has weather but no table for it: nothing for a player to roll (the GM's sheet says so).
  if (view.kind === 'unset') return null;

  if (view.kind === 'waiting') {
    return (
      <section className="weather" aria-label="Weather">
        <p className="weather__title">
          <StepSymbol symbol="weather" label="Weather" small /> Weather
        </p>
        <p className="weather__quiet">Waiting for the GM to set the season</p>
      </section>
    );
  }

  // Due.
  return (
    <section className="weather weather--due" aria-label="Weather">
      <p className="weather__title">
        <StepSymbol symbol="weather" label="Weather" small /> Weather due
      </p>
      {mayEnter(user, view) ? (
        <RollForm label={rollWords(view.die)} onEnter={(roll) => enter(view, view.now.tableId!, roll)} />
      ) : (
        <p className="weather__quiet">The GM rolls today's weather.</p>
      )}
    </section>
  );
}

/**
 * Folding (S2-1; the automatic fold dropped at the M5 gate, R3 audit 15): weather that comes in while this screen is
 * watching (it was due, or another weather was showing) opens at once and stays open until tapped, which folds it
 * away; the Weather fact in the players' top says it and opens its sheet (S15; the icon by the date went with the old
 * head). Weather already in when the screen opened starts folded.
 */
export function useWeatherFold(view: WeatherView): { folded: boolean; fold: () => void; open: () => void } {
  const id = view.kind === 'in' && view.weather ? `${view.weather.id}:${view.weather.version}` : null;
  const watching = view.kind === 'due' || view.kind === 'waiting' || view.kind === 'unset';
  const [state, setState] = useState<{ id: string | null; folded: boolean; watched: boolean }>({ id: null, folded: true, watched: false });
  if (watching && !state.watched) setState({ id: null, folded: true, watched: true });
  else if (!watching && state.id !== id) setState({ id, folded: id === null || !(state.watched || state.id !== null), watched: state.watched || id !== null });
  return {
    folded: state.id === id ? state.folded : true,
    fold: () => setState((s) => ({ ...s, folded: true })),
    open: () => setState((s) => ({ ...s, folded: false })),
  };
}

/**
 * The same prompt as a notice in the Player tab's notices box (row C1, tfn-2; page M1, frame M1e): due, with the box
 * for what the dice showed and Enter roll inside the notice (Francis, 2026-11-20), or the season not set yet. Null
 * otherwise, and always for the GM. Entering here closes the card on Scene too, for everyone.
 */
/** The weather roll typed in the notices box, for the weather due when it was typed (`due`). */
export type HeldRoll = { due: string; text: string };

export function useWeatherNotice(
  db: Db,
  user: CurrentUser,
  campaignId: string,
  /** Held above the box (row C1), so a turned tablet keeps a half-typed roll; one typed for an earlier weather is dropped. */
  held?: { roll: HeldRoll | null; onRoll: (roll: HeldRoll) => void },
): { key: string; title: ReactNode; action?: ReactNode; act?: boolean } | null {
  const { view, reload } = useWeather(db, user, campaignId);
  const { enter } = useWeatherActions(db, user, reload);
  if (view.kind === 'waiting' && !isGm(user, view.campaignId)) return { key: 'weather', title: 'Weather: no season set yet.' };
  if (view.kind !== 'due' || isGm(user, view.campaignId) || !mayEnter(user, view)) return null;
  const die = view.die ? dieOf(view.die) : null;
  const label = view.die ? `Weather due: roll ${view.die}` : 'Weather due: enter the roll';
  const due = `${view.expeditionId}:${view.now.startsAt}`;
  return {
    key: 'weather',
    act: true,
    title: view.die ? (
      <>
        Weather due: roll {die && <DieGlyph die={die} size={20} />}
        {view.die}
      </>
    ) : (
      label
    ),
    action: (
      <RollForm
        label={label}
        inNotice
        onEnter={(roll) => enter(view, view.now.tableId!, roll)}
        typed={held ? (held.roll?.due === due ? held.roll.text : '') : undefined}
        onTyped={held ? (text) => held.onRoll({ due, text }) : undefined}
      />
    ),
  };
}
