// A rumour table's truth, the GM's alone, and giving a rolled row (dec-12 piece E; ruled mc-65, tb-1; who reads a given
// row: rm-1, Francis's yes of 2026-11-14; pictures 03-04-rumours and 03-04b-who-hears-rumour on the branch
// design-december-mockups, approved 2026-11-12; migration supabase/migrations/20261114220000_dec_12e_rumours.sql).
//   * A rumours table is a library entry of kind `table` with the use `world.rumours` (or the older `"kind": "rumours"`).
//     Tables are the GM's: the read rule on library_entries never sends one to a player, so a row's `truth` and `note`
//     never reach a player's device (hard rule 5). A pack may not open a rumours table to players (`"gmOnly": false`):
//     the importer refuses it (packFile.ts) and pack:check says so (scripts/pack-format.mjs).
//   * rumour.give (logged, Undo marks it undone): the GM gives one row, named by its range, to a character in play or to
//     the party. The database copies the row's words only into hook_sends (kind 'rumour'), read as a sent call to
//     adventure is (ca-1 to ca-3). A second give of the row to the same hearer is refused in words.
// Pure but for the command.
import { defineCommand, fromError, isGm, ok, type CommandResult } from '../../core/commands.ts';
import { plainLinks } from './linkMarks.ts';

/** The truth of a rumour (07: "true", "false" or "partial"), as its cell says it; null when the row says none. */
export type Truth = 'True' | 'False' | 'Partly';

/** One row of a rumours table, as the GM's table shows it. */
export interface RumourRow {
  min: number;
  max: number;
  /** The die's numbers for it: "3", or "3–4". */
  range: string;
  /** The words the players hear (the row's `result`), with each link mark as its words. */
  words: string;
  /** The GM's alone. */
  truth: Truth | null;
}

/** A rumours table of an adventure. */
export interface RumourTable {
  packId: string;
  id: string;
  name: string;
  /** "d8"; null when the table names no die. */
  die: string | null;
  rows: RumourRow[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const usesOf = (value: unknown): string[] => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((u): u is string => typeof u === 'string') : []);

/** Whether a table entry's data is a rumours table (as private.is_rumours_table). */
export function isRumoursTable(data: Record<string, unknown>): boolean {
  return [...usesOf(data.uses), ...usesOf(data.use)].includes('world.rumours') || data.kind === 'rumours';
}

/** A row's truth in words: "true", "false", "partial" (or the plain true and false the importer converts). */
export function truthOf(value: unknown): Truth | null {
  if (value === true || value === 'true') return 'True';
  if (value === false || value === 'false') return 'False';
  if (value === 'partial') return 'Partly';
  return null;
}

/**
 * A rumours table read for the GM: its rows with a whole-number range and words, in the pack's order; null when it is
 * not a rumours table or has no such row. A row the database could not give (no range, no words) is left out.
 */
export function readRumourTable(packId: string, id: string, name: string, data: Record<string, unknown>): RumourTable | null {
  if (!isRumoursTable(data)) return null;
  const rows = (Array.isArray(data.rows) ? data.rows : []).filter(isRecord).flatMap((row): RumourRow[] => {
    const { min, max } = row;
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isInteger(min) || !Number.isInteger(max)) return [];
    const said = typeof row.result === 'string' ? row.result : typeof row.value === 'string' ? row.value : '';
    const words = plainLinks(said).trim();
    if (!words) return [];
    return [{ min, max, range: min === max ? String(min) : `${min}–${max}`, words, truth: truthOf(row.truth) }];
  });
  if (rows.length === 0) return null;
  const die = typeof data.die === 'string' && data.die.trim() ? data.die.trim() : typeof data.roll === 'string' && data.roll.trim() ? data.roll.trim() : null;
  return { packId, id, name: plainLinks(name).trim() || 'Rumours', die, rows };
}

/** The key a given row is kept under (hook_sends.hook_key): "<table id>#<min>-<max>". */
export const rumourKey = (tableId: string, row: Pick<RumourRow, 'min' | 'max'>) => `${tableId}#${row.min}-${row.max}`;

/** A live give of a rumour, as the GM's table reads it. */
export interface RumourGive {
  id: string;
  packId: string;
  /** The row's key, `rumourKey`. */
  key: string;
  actorId: string | null;
  clockSeconds: number;
  createdAt: string;
}

/** The gives of one row, oldest first. */
export function givesOf(gives: readonly RumourGive[], table: Pick<RumourTable, 'packId' | 'id'>, row: Pick<RumourRow, 'min' | 'max'>): RumourGive[] {
  const key = rumourKey(table.id, row);
  return gives.filter((g) => g.packId === table.packId && g.key === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** How many of a table's rows have been heard (given at least once). */
export function heardCount(table: RumourTable, gives: readonly RumourGive[]): number {
  return table.rows.filter((row) => givesOf(gives, table, row).length > 0).length;
}

/** The rumours' row in an adventure's list (frame 2b): "d8. 2 of 8 heard so far." */
export function heardWords(table: RumourTable, gives: readonly RumourGive[]): string {
  const heard = `${heardCount(table, gives)} of ${table.rows.length} heard so far.`;
  return table.die ? `${table.die}. ${heard}` : heard;
}

/** "Heard by the party, day 1." / "Heard by Wren, day 3." (frame 5): who heard a row, and when. */
export function heardLine(give: RumourGive, names: readonly { id: string; name: string }[], dayOf: ((seconds: number) => number) | null): string {
  const who = give.actorId === null ? 'the party' : (names.find((h) => h.id === give.actorId)?.name ?? 'a character');
  return `Heard by ${who}${dayOf ? `, day ${dayOf(give.clockSeconds)}` : ''}.`;
}

/** Whether the row has a live give to that hearer (a character's id, or null for the party). */
export function alreadyHeard(gives: readonly RumourGive[], table: Pick<RumourTable, 'packId' | 'id'>, row: Pick<RumourRow, 'min' | 'max'>, actorId: string | null): boolean {
  return givesOf(gives, table, row).some((g) => g.actorId === actorId);
}

/** How many rows show before "Show all" (frame 5: five, then "3 more rows. Show all 8"). */
export const RUMOURS_SHOWN = 5;

/** The input to rumour.give: the table and its row (by its range), and who hears it (null: the party). */
export interface GiveRumourInput {
  campaignId: string;
  packId: string;
  tableId: string;
  min: number;
  max: number;
  actorId: string | null;
}

/** What a give returns: the send's id (for its toast's Undo). */
export interface GivenRumour {
  id: string;
  key: string;
}

/** Who hears it? (rumour.give): the GM gives a rumour's words to a character or to the party. Logged; Undo marks it undone. */
export const giveRumour = defineCommand({
  name: 'rumour.give',
  log: 'simple',
  target: (input: GiveRumourInput) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<GivenRumour>> => {
    const { data, error } = await db.rpc('give_rumour', {
      campaign: input.campaignId,
      pack: input.packId,
      table_key: input.tableId,
      row_min: input.min,
      row_max: input.max,
      ...(input.actorId ? { to_actor: input.actorId } : {}),
    });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { id: string; hook_key: string } | null;
    return row ? ok({ id: row.id, key: row.hook_key }) : fromError({ message: "That wasn't sent. Try again." });
  },
});
