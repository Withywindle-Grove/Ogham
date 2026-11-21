// The Weather sheet's logic (S10, logic half; rulings st-3 and wr-1, docs/design/rulings/dec-scene-whole-2026-11-14.md;
// plan docs/plans/dec-9-the-whole-scene.md, row S10; mockup page 16, frame T6). The sheet's drawing and wiring are a
// later row; this is what it reads.
//   * The GM enters the roll on the weather table itself, in the book's table style (st-3): roll, then tap the row.
//     A tap sends the row's lowest roll (a composite die's row: its key, "3/7") through the existing `enterWeather`,
//     so nothing about writing changes; the database reads the row from the roll as it does today.
//   * A player who rolls enters the number and never sees the table (wr-1): the player's sheet asks only for the die
//     (`weather_die`, which never returns the rows), never for the table.
//   * The effects in plain words are read from the same data the weather card reads (`weatherTagLines`), never made up.
import type { ReadTable, TableRow } from './tables.ts';
import { rowFor, rowLabel, rowText } from './tables.ts';
import type { WeatherTag } from './modes.ts';
import { weatherTagLines, type WeatherEntry, type WeatherRoll } from './weatherPlay.ts';

/**
 * The roll a tap on a row sends: its lowest roll ("3–4" sends "3", "8+" sends "8", a single number itself), or a
 * composite die's key ("3/7"). Null when no roll lands on this row as the database reads it: a row written "≤2"
 * (the database reads no "≤"), a lookup row with a label and no range, or a row an earlier row overlaps at its lowest.
 * A "≤2" row is left out by its lowest (the app reads it as the smallest integer, below nought); the label and overlap
 * cases by reading the roll back the way the database does (the first row that covers it), so a tap never enters
 * another row.
 */
export function rowRoll(table: ReadTable, index: number): string | null {
  const row = table.rows[index];
  if (!row) return null;
  const roll = row.key ?? (row.min !== null && row.min >= 0 ? String(row.min) : null);
  if (roll === null) return null;
  const read = rowFor(table, roll);
  return read.ok && read.index === index ? roll : null;
}

/** One row of the weather table as the GM's sheet draws it, in the book's table style. */
export interface WeatherTableRow {
  /** The row's range as the book prints it: "1–2", "7", "8+", "3/7". */
  label: string;
  /** The row's words: its result (or its cells), as every table screen reads a row. */
  words: string;
  /** What a tap on it sends to `enterWeather`; null when no roll lands on it (see `rowRoll`). */
  roll: string | null;
  /** The row the current roll falls in. */
  current: boolean;
}

/**
 * The weather table's rows for the GM's sheet, the row the current roll falls in marked. `currentRoll` is the stored
 * weather's roll for this table ("5", "3/7"); null or another table's: nothing is marked.
 */
export function weatherTableRows(table: ReadTable, currentRoll: string | null): WeatherTableRow[] {
  const read = currentRoll !== null && currentRoll.trim() ? rowFor(table, currentRoll) : null;
  const currentIndex = read && read.ok ? read.index : -1;
  return table.rows.map((row: TableRow, index) => ({
    label: rowLabel(row),
    words: rowText(table, row, null),
    roll: rowRoll(table, index),
    current: index === currentIndex,
  }));
}

/** The current roll for this sheet's table: the stored weather's roll when it is for this table, else null. */
export const currentRollFor = (weather: Pick<WeatherRoll, 'tableId' | 'roll'> | null, tableId: string): string | null =>
  weather && weather.tableId === tableId ? weather.roll : null;

/**
 * What a tap on a row enters: today's weather entry with that row's roll, for the existing `enterWeather` as it stands.
 * Null when no roll lands on the row (see `rowRoll`).
 */
export function entryForRow(base: Omit<WeatherEntry, 'roll'>, table: ReadTable, index: number): WeatherEntry | null {
  const roll = rowRoll(table, index);
  return roll === null ? null : { ...base, roll };
}

/** How the sheet takes the roll (st-3, wr-1): the GM taps the table's row; a player types the number. */
export type WeatherSheetEntryWay = 'table' | 'number';
export const weatherEntryWay = (gm: boolean): WeatherSheetEntryWay => (gm ? 'table' : 'number');

/** What the sheet needs to draw its entry: the table (the GM's), or only the die (a player's). */
export type WeatherSheetData =
  | { way: 'table'; table: ReadTable | null; rows: WeatherTableRow[] }
  | { way: 'number'; die: string | null };

/**
 * Loads what the sheet needs, by who is looking. The GM's: the weather table (`loadTable`, from what the GM's device
 * already reads) and its rows. A player's: only the die (`loadDie`, the `weather_die` call); `loadTable` is never
 * called, so the player's device never asks for the table (wr-1).
 */
export async function loadWeatherSheet(input: {
  gm: boolean;
  tableId: string;
  currentRoll: string | null;
  loadTable: (tableId: string) => Promise<ReadTable | null>;
  loadDie: (tableId: string) => Promise<string | null>;
}): Promise<WeatherSheetData> {
  if (weatherEntryWay(input.gm) === 'number') return { way: 'number', die: await input.loadDie(input.tableId) };
  const table = await input.loadTable(input.tableId);
  return { way: 'table', table, rows: table ? weatherTableRows(table, input.currentRoll) : [] };
}

/**
 * The effects in plain words, as the weather card says them (A11), from the same data: the stored weather's result and
 * its tags in plain words (`weatherTagLines`, the card's own reader). Null when no weather is in.
 */
export function weatherEffects(
  weather: Pick<WeatherRoll, 'result' | 'tags'> | null,
  known: Readonly<Record<string, WeatherTag>>,
  budgetName: string | null = null,
): { result: string; lines: string[] } | null {
  return weather ? { result: weather.result, lines: weatherTagLines(weather.tags, known, budgetName) } : null;
}
