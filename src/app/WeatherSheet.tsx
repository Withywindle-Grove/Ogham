// The Weather sheet (S10; plan docs/plans/dec-9-the-whole-scene.md, row S10; rulings st-3 and wr-1,
// docs/design/rulings/dec-scene-whole-2026-11-14.md; page 16, frame T6). Built on S10's logic (weatherSheet.ts, #802).
//   * Today's weather with each effect in plain words, and who entered it (and who changed it since).
//   * The GM's roll is entered on the weather table itself, in the book's table style (`BookTapTable`): "Roll d8, then
//     tap the row." A tap enters the row's roll (`rowRoll`, through today's `enterWeather`); once the
//     weather is in, a tap on another row changes it, logged as a correction (today's Change…). Several tables (the
//     season not known yet) are picked first, as today.
//   * A player who rolls enters the number and never sees the table (wr-1): the player's sheet has the die alone (the
//     view's `die`, from `weather_die`), and is never handed the GM's tables (`tables` is the GM's only). The way is
//     #802's `weatherEntryWay`; a tap's entry is its `entryForRow`.
//   * The effects in plain words are the view's lines, read by `weatherTagLines` with the mode's budget name (the
//     reader `weatherEffects` wraps; the view already holds them).
//   * The table is the shared Tapped table (`BookTapTable`) inside the book's type (`BookType`), so its rows are
//     banded and ruled as creation's (dec-10 E, pictures creation/final 20-E1, 20-E2), the Roll row above its bar as
//     there (`FirstSpellsStep`'s `RolledTable`).
// Opened by the Weather fact and by "Weather: to roll" in Waiting for you (the GM's); the players' Weather fact comes
// with their top (S15), until then they enter on today's card.
import { useState } from 'react';
import { isGm, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { ReadTable } from '../modules/expedition/tables.ts';
import { currentRollFor, entryForRow, weatherEntryWay, weatherTableRows } from '../modules/expedition/weatherSheet.ts';
import { RollRow, dieOf } from '../ui/dice.tsx';
import { BookTapTable, BookType } from '../ui/creation.tsx';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { ButtonRow, StackedButton } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { mayEnter, RollForm, rollWords, useWeatherActions, type WeatherView } from './WeatherCard.tsx';

type LiveView = Extract<WeatherView, { campaignId: string }>;

/**
 * Who rolled today's weather, in T6's words (the lead, 2026-11-15): "Rolled by the GM." when the GM entered it, "Rolled
 * by Sam." when a player did. One case keeps today's "Entered by Priya.": the players roll it and the GM entered it,
 * where the GM may have typed in a player's roll, so "Rolled by the GM" could be untrue. A change since: "Changed by
 * Priya."
 */
/** A label or a sentence ending in a full stop, as T6's labelled lines read ("Wet."); one already ended is left. */
export const withStop = (text: string): string => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

export function rolledWords(view: Pick<LiveView, 'enteredBy' | 'enteredByGm' | 'changedBy' | 'rolledBy'>): string {
  const who = !view.enteredBy ? null : view.enteredByGm ? (view.rolledBy === 'players' ? `Entered by ${view.enteredBy}.` : 'Rolled by the GM.') : `Rolled by ${view.enteredBy}.`;
  return [who, view.changedBy ? `Changed by ${view.changedBy}.` : null].filter(Boolean).join(' ');
}

export function WeatherSheet({
  db,
  user,
  view,
  tables,
  over,
  onChanged,
  onClose,
  onWhichSeason,
  preview = false,
}: {
  db: Db;
  user: CurrentUser;
  view: WeatherView;
  /** The GM's readable tables, by id. Never handed for a player, whose sheet never asks for one (wr-1). */
  tables?: ReadonlyMap<string, ReadTable>;
  /** The line over the title (the date, as the band says it). */
  over?: string;
  onChanged: () => void;
  onClose: () => void;
  /** The GM's "Which season?" while the season isn't known. */
  onWhichSeason?: () => void;
  /** Drawn in place, for the component gallery. */
  preview?: boolean;
}) {
  const { enter, correct } = useWeatherActions(db, user, onChanged);
  const show = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const live = view.kind === 'waiting' || view.kind === 'unset' || view.kind === 'due' || view.kind === 'in' ? view : null;
  const way = weatherEntryWay(live ? isGm(user, live.campaignId) : false);

  const body = (() => {
    if (view.kind === 'loading') return <p className="weather__quiet">Loading today's weather…</p>;
    if (view.kind === 'error') {
      return (
        <p className="weather__quiet" role="alert">
          Couldn't load today's weather. Check your connection.
        </p>
      );
    }
    if (!live) return <p className="weather__quiet">No weather to roll now.</p>;
    const now = live.kind === 'in' && live.weather ? (
      // T6's labelled lines (the book's labelled line, `.book-line` and `.book-label`): the weather's own name first, then
      // each effect as its name, a full stop, then the pack's words ("Wet. A fire needs dry tinder.").
      <div className="weather-sheet__now">
        <p className="book-line">
          <span className="book-label">{withStop(live.weather.result)}</span>
        </p>
        {live.parts.map((part) => (
          <p key={part.label} className="book-line">
            <span className="book-label">{withStop(part.label)}</span> {part.words.map(withStop).join(' ')}
          </p>
        ))}
        <p className="weather__quiet">{rolledWords(live)}</p>
      </div>
    ) : null;
    return (
      <>
        {now}
        {way === 'table' ? gmEntry(live) : playerEntry(live)}
      </>
    );
  })();

  /** The GM's: the table in the book's style, the roll entered by a tap on its row (st-3). */
  function gmEntry(live: LiveView) {
    if (live.kind === 'unset') return <p className="weather__quiet">Weather is due, but the setting rules name no weather table for it.</p>;
    const ids = [...new Set([live.weather?.tableId, live.now.tableId, ...live.now.tableChoices].filter((id): id is string => !!id))];
    const readable = ids.flatMap((id) => tables?.get(id) ?? []);
    const missing = ids.filter((id) => !tables?.has(id));
    const table = readable.find((t) => t.id === picked) ?? readable[0];
    const changing = live.kind === 'in' && !!live.weather;
    return (
      <div className="weather-sheet__entry">
        {changing ? (
          <>
            <span className="label">Change today's weather</span>
            <p className="weather__quiet">Logged as a correction.</p>
          </>
        ) : (
          <span className="label">Today's roll</span>
        )}
        {live.kind === 'due' && live.rolledBy === 'players' && <p className="weather__quiet">The players roll it; you can enter it instead.</p>}
        {live.kind === 'waiting' && (
          <>
            <p className="weather__quiet">No season yet: say which season it is, or pick the weather table for today.</p>
            {onWhichSeason && (
              <div className="top-sheet__actions">
                <StackedButton icon="calendar" label="Which season?" onClick={onWhichSeason} />
              </div>
            )}
          </>
        )}
        {!table ? (
          <p className="weather__quiet">{`The weather table (${missing.join(', ') || 'none'}) isn't in your setting rules. Read it from your book.`}</p>
        ) : (
          <>
            {readable.length > 1 && <ButtonRow label="Which table" options={readable.map((t) => ({ value: t.id, label: t.name }))} value={table.id} onChange={setPicked} />}
            <RollRow die={table.die ? dieOf(table.die) : null}>{table.die ? `Roll ${table.die}, then tap the row.` : 'Roll, then tap the row.'}</RollRow>
            <BookType>
              <BookTapTable
                title={table.name}
                die={table.die ?? ''}
                column="Weather"
                label={table.name}
                rows={weatherTableRows(table, currentRollFor(live.weather, table.id)).map((row, index) => ({
                  key: String(index),
                  range: row.label,
                  name: row.words,
                  picked: row.current,
                  onPick: () => void pick(live, table, index, row.current, changing),
                }))}
              />
            </BookType>
          </>
        )}
      </div>
    );
  }

  async function pick(live: LiveView, table: ReadTable, index: number, current: boolean, changing: boolean) {
    if (current) return show({ text: "That's today's weather already." });
    const entry = entryForRow({ campaignId: live.campaignId, expeditionId: live.expeditionId, period: live.now.period, startsAt: live.now.startsAt, tableId: table.id, rolledBy: live.rolledBy }, table, index);
    if (!entry) return show({ text: 'No roll lands on this row as the table is written. Tap the row your roll falls in.', error: true });
    const done = changing ? await correct(live, entry.tableId, entry.roll) : await enter(live, entry.tableId, entry.roll);
    if (done) onClose();
  }

  /** A player's: the number alone; the table is never shown (wr-1). */
  function playerEntry(live: LiveView) {
    if (live.kind === 'waiting') return <p className="weather__quiet">Waiting for the GM to set the season</p>;
    if (live.kind !== 'due') return null;
    if (!mayEnter(user, live)) return <p className="weather__quiet">The GM rolls today's weather.</p>;
    return (
      <div className="weather-sheet__entry">
        <span className="label">Today's roll: yours</span>
        <RollForm
          label={rollWords(live.die)}
          die={live.die}
          stacked
          onEnter={async (roll) => {
            const done = await enter(live, live.now.tableId!, roll);
            if (done) onClose();
            return done;
          }}
        />
      </div>
    );
  }

  return (
    <SheetScope.Provider value>
      <Dialog label="Weather" over={over} onClose={onClose} preview={preview}>
        <div className="top-sheet weather-sheet">{body}</div>
      </Dialog>
    </SheetScope.Provider>
  );
}
