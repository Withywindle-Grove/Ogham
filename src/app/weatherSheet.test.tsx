// @vitest-environment jsdom
// The Weather sheet (S10; st-3, wr-1; page 16, T6), drawn on its own. Invented fixtures only: the "Fen sky" table.
//   The GM's sheet draws the weather table in the book's table style with "Roll d8, then tap the row."; every row is a
//   tap, and the sheet has no accent (sa-1: its one action is a row).
//   Once the weather is in, the sheet says it with each effect in plain words and who entered it, and marks its row.
//   A player's sheet takes a number: the table is never drawn, even if a table were handed to it, and the sheet asks
//   the database for nothing until the roll is entered; its Enter is its one accent.
//   A player who doesn't roll it reads who does; while the season is unknown, a player waits.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { WeatherNow } from '../modules/expedition/procedure.ts';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import type { WeatherRoll } from '../modules/expedition/weatherPlay.ts';
import type { WeatherView } from './WeatherCard.tsx';
import { rolledWords, WeatherSheet } from './WeatherSheet.tsx';

afterEach(cleanup);

const FEN_SKY = {
  id: 'fen-sky',
  name: 'Fen sky',
  die: 'd8',
  rows: [
    { roll: '1-2', result: 'Clear', tags: [] },
    { roll: '3–5', result: 'Drizzle', tags: ['wet'] },
    { roll: '6', result: 'Fog', tags: ['fog'] },
    { roll: '7+', result: 'Squall', tags: ['wet', 'mired'] },
  ],
};
const fenSky = (): ReadTable => readTable('fen-sky', 'Fen sky', FEN_SKY)!;
const tables = () => new Map([['fen-sky', fenSky()]]);

const gm: CurrentUser = { id: 'gm', roles: { c: 'gm' } };
const player: CurrentUser = { id: 'sam', roles: { c: 'player' } };

/** A database that fails the test if anything asks it for anything. */
const untouched = new Proxy({}, { get: (_t, key) => (key === 'then' ? undefined : () => { throw new Error(`The sheet read the database (${String(key)})`); }) }) as unknown as Db;

const now: WeatherNow = { period: 0, startsAt: 0, endsAt: 86400, tableId: 'fen-sky', tableChoices: [], season: 'spring', waitingForSeason: false, tags: {} };
const view = (kind: 'due' | 'in' | 'waiting', extra: Partial<Extract<WeatherView, { campaignId: string }>> = {}): WeatherView => ({
  kind,
  campaignId: 'c',
  expeditionId: 'x',
  now,
  rolledBy: 'players',
  weather: null,
  lines: [],
  parts: [],
  die: 'd8',
  enteredBy: null,
  enteredByGm: false,
  changedBy: null,
  ...extra,
});

function sheet(user: CurrentUser, shown: WeatherView, handed = tables()) {
  render(<WeatherSheet db={untouched} user={user} view={shown} tables={handed} over="14 Reedmonth, spring" onChanged={() => {}} onClose={() => {}} />);
  return within(screen.getByRole('dialog', { name: /Weather$/ }));
}

describe('the Weather sheet (S10)', () => {
  // Purpose (st-3): the GM's roll is entered on the table itself, in the book's style, "Roll d8, then tap the row.";
  // each row is a tap, and the sheet has no accent of its own (sa-1).
  it("the GM gets the table in the book's style, every row a tap, and no accent", () => {
    const s = sheet(gm, view('due'));
    expect(s.getByText('Roll d8, then tap the row.')).toBeTruthy();
    const rows = within(s.getByRole('group', { name: 'Fen sky' })).getAllByRole('radio');
    expect(rows).toHaveLength(4);
    FEN_SKY.rows.forEach((row, i) => expect(rows[i]!.textContent).toContain(row.result));
    expect(document.querySelectorAll('.button-primary')).toHaveLength(0);
    expect(s.getByText('The players roll it; you can enter it instead.')).toBeTruthy();
  });

  // Purpose (T6): once the weather is in, the sheet says it in plain words, as T6's labelled lines (the weather's name,
  // then each effect: its name and a full stop, then the pack's words), with who rolled it, and its row is marked; a
  // change is logged as a correction.
  it('once in, the sheet says the weather and its effects in plain words, who entered it, and marks its row', () => {
    const weather = { id: 'w', tableId: 'fen-sky', roll: '4', result: 'Drizzle', tags: ['wet'], version: 1 } as unknown as WeatherRoll;
    const s = sheet(gm, view('in', { weather, lines: ['Wet, A fire needs dry tinder'], parts: [{ label: 'Wet', words: ['A fire needs dry tinder'] }], enteredBy: 'Sam' }));
    const lines = [...document.querySelectorAll('.weather-sheet__now .book-line')].map((l) => [l.querySelector('.book-label')?.textContent, l.textContent]);
    expect(lines).toEqual([
      ['Drizzle.', 'Drizzle.'],
      ['Wet.', 'Wet. A fire needs dry tinder.'],
    ]);
    expect(s.getByText('Rolled by Sam.')).toBeTruthy();
    expect(s.getByText('Logged as a correction.')).toBeTruthy();
    expect(s.getByRole('radio', { name: /Drizzle/, checked: true })).toBeTruthy();
    expect(s.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  // Purpose (wr-1, hidden means hidden): a player's sheet takes the roll as a number and never draws the weather table,
  // even if one were handed to it; it reads nothing from the database to draw; its Enter is its one accent.
  it("a player's sheet is a number box: no table, no rows, no read, and Enter its one accent", () => {
    const s = sheet(player, view('due'));
    expect(s.getByLabelText('Roll d8 for the weather')).toBeTruthy();
    // T6's plain line with the die over the box, "Roll d8.", not a small-capitals field label.
    expect(s.getByText('Roll d8.')).toBeTruthy();
    expect(s.queryByText('Roll d8 for the weather')).toBeNull();
    expect(s.queryByRole('radio')).toBeNull();
    expect(s.queryByText('Fen sky')).toBeNull();
    for (const row of FEN_SKY.rows) expect(s.queryByText(row.result)).toBeNull();
    expect(s.queryByText(/tap the row/)).toBeNull();
    const accents = document.querySelectorAll('.button-primary');
    expect(accents).toHaveLength(1);
    expect(accents[0]!.textContent).toBe('Enter');
  });

  // Purpose: a player who doesn't roll it reads who does; while the season is unknown, the player waits.
  it('a player who does not roll it reads who does, and waits while the season is unknown', () => {
    expect(sheet(player, view('due', { rolledBy: 'gm' }), new Map()).getByText("The GM rolls today's weather.")).toBeTruthy();
    cleanup();
    expect(sheet(player, view('waiting'), new Map()).getByText('Waiting for the GM to set the season')).toBeTruthy();
  });

  // Purpose (T6's words, the lead 2026-11-15): "Rolled by the GM." when the GM entered it, "Rolled by Sam." when a
  // player did; "Entered by Priya." only where the players roll it and the GM entered it (it may be a player's roll);
  // a change since says who changed it.
  it('says who rolled it in T6 words, keeping "Entered by" for the GM typing in the players\' roll', () => {
    const who = { enteredBy: 'Priya', enteredByGm: true, changedBy: null };
    expect(rolledWords({ ...who, rolledBy: 'gm' })).toBe('Rolled by the GM.');
    expect(rolledWords({ ...who, rolledBy: 'players' })).toBe('Entered by Priya.');
    expect(rolledWords({ enteredBy: 'Sam', enteredByGm: false, changedBy: 'Priya', rolledBy: 'players' })).toBe('Rolled by Sam. Changed by Priya.');
    expect(rolledWords({ enteredBy: null, enteredByGm: false, changedBy: null, rolledBy: 'gm' })).toBe('');
  });
});
