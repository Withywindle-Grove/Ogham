// K16b: the GM sends a find (docs/plans/dec-6-the-whole-pack-tab.md, row K16; ruling pk-12, 2026-11-14, Francis: "When
// you send a find from a hoard, one action adds the things and the coin together, and your Undo takes both back in one
// step"; pk-1, pk-2, pu-9). The command and its Undo run the database's functions
// (supabase/migrations/20261115090000_dec_6_k16b_send_find.sql): public.give_find writes the whole send in one request,
// every line `find.give` with an ids-only reason (K28's shape, read by src/core/events.ts): the party's lines name who
// it went to, and one GM-only line also the place and the hoard rows (rp-4). public.undo_find takes it all back, once,
// while nothing it made has changed since, with the knowledge of an item it taught (uf-2). No screen: the sheets are K16c.
import { defineCommand, fromError, isGm, isMember, ok, failed, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { LogEvent } from '../../core/events.ts';
import type { Coins, HoardRow } from './hoard.ts';

/** One thing to send: an item of the setting rules by its library entry, or a one-off by its words. */
export type FindThing = { libraryEntryId: string; qty: number } | { name: string; qty: number };

/** A hoard row's key in the log ("2:thing", "0:coin"): where it sits in the place's treasure list, and which row. */
export const rowKey = (row: Pick<HoardRow, 'entry' | 'kind'>): string => `${row.entry}:${row.kind}`;

/**
 * What the chosen rows send: each thing row a thing (a known item by its library entry, from `libraryIds`, the pack's
 * item id to the campaign's library entry id; else a one-off by its words, never dropped), every coin row's coins added
 * together (a row read under pk-11 sends the coin it is read as, its `coins`), and the rows' keys for the log.
 */
export function sendOf(rows: readonly HoardRow[], libraryIds: ReadonlyMap<string, string>): { things: FindThing[]; coins: Coins; rows: string[] } {
  const things: FindThing[] = [];
  const coins: Coins = {};
  for (const row of rows) {
    if (row.kind === 'thing') {
      const entry = row.itemId ? libraryIds.get(row.itemId) : undefined;
      things.push(entry ? { libraryEntryId: entry, qty: 1 } : { name: row.text, qty: 1 });
    } else {
      for (const [key, n] of Object.entries(row.coins)) coins[key] = (coins[key] ?? 0) + n;
    }
  }
  return { things, coins, rows: rows.map(rowKey) };
}

/** The send: to a character (`to`, its id) or, with `to` null, the party stash. */
export interface GiveFindInput {
  campaignId: string;
  to: string | null;
  placeId: string;
  things: FindThing[];
  coins: Coins;
  rows: string[];
}

/** find.give: the GM sends things and coin, in one request. Answers the send's first log line (for its Undo). */
export const giveFind = defineCommand({
  name: 'find.give',
  target: (input: GiveFindInput) => ({ campaignId: input.campaignId }),
  allowed: (user, target: { campaignId: string }) => isMember(user, target.campaignId) && isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('give_find', {
      campaign: input.campaignId,
      to_actor: input.to as string,
      place: input.placeId,
      things: input.things as unknown as Json,
      coins: input.coins as unknown as Json,
      rows: input.rows as unknown as Json,
    });
    if (error) return fromError(error);
    return typeof data === 'string' ? ok(data) : failed("Couldn't send it. Try again.");
  },
});

/** find.undo: the GM's Undo of a send, whole (things and coin back in one step), while nothing it made has changed. */
export const undoFind = defineCommand({
  name: 'find.undo',
  target: (input: { campaignId: string; eventId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target: { campaignId: string }) => isMember(user, target.campaignId) && isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const { error } = await db.rpc('undo_find', { event_id: input.eventId });
    return error ? fromError(error) : ok(null);
  },
});

export const FIND_COMMANDS = [giveFind, undoFind] as const;

/** The reason's find, when this line carries one. */
function findOf(event: LogEvent): { to: string | null; placeId: string | null; rows: string[] } | null {
  if (!event.reason?.startsWith('{')) return null;
  try {
    const find = (JSON.parse(event.reason) as { find?: Record<string, unknown> }).find;
    if (!find || typeof find !== 'object') return null;
    return {
      to: typeof find.to === 'string' ? find.to : null,
      placeId: typeof find.placeId === 'string' ? find.placeId : null,
      rows: Array.isArray(find.rows) ? find.rows.filter((r): r is string => typeof r === 'string') : [],
    };
  } catch {
    return null;
  }
}

/**
 * "Sent to <Name>" (PK5), read from the log, never stored on the piece: for this place, each hoard row (by `rowKey`)
 * a send named, to whom (`to` null: the party stash) and by which line. The latest send of a row wins; a send that was
 * undone (any of its lines reversed) and another place's send mark nothing.
 */
export function sentRows(events: readonly LogEvent[], placeId: string): Map<string, { to: string | null; eventId: string }> {
  const reverted = new Set(events.map((e) => e.revertsEventId).filter((id): id is string => !!id));
  const sends = new Map<string, LogEvent[]>();
  for (const e of events) {
    if (e.type !== 'find.give' || e.revertsEventId) continue;
    const key = e.requestId ?? e.id;
    sends.set(key, [...(sends.get(key) ?? []), e]);
  }
  const out = new Map<string, { to: string | null; eventId: string }>();
  const ordered = [...sends.values()].map((lines) => [...lines].sort((a, b) => a.seq - b.seq)).sort((a, b) => a[0]!.seq - b[0]!.seq);
  for (const lines of ordered) {
    if (lines.some((e) => reverted.has(e.id))) continue;
    // The place and the rows are on the send's GM-only line (rp-4): the GM reads them; a player's lines name neither.
    const find = lines.map(findOf).find((f) => f !== null && f.placeId !== null);
    if (!find || find.placeId !== placeId) continue;
    for (const row of find.rows) out.set(row, { to: find.to, eventId: lines[0]!.id });
  }
  return out;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The coin a find put in a purse (K21, PK3), from the find's log lines this reader may read: the `find.give` line on
 * `purses`, each coin's amount after less before, where it grew. Only the purse's readers (the receiver's player and the
 * GM, or every member for the party stash; pu-9) get that line, so anyone else gets null: no amount ever reaches them
 * from here. A line undone, or one that undoes, counts for nothing. Null when the reader holds no such line.
 */
export function findCoinOf(events: readonly LogEvent[]): Coins | null {
  const undone = new Set(events.flatMap((e) => (e.revertsEventId ? [e.revertsEventId] : [])));
  const lines = events.filter((e) => e.type === 'find.give' && e.targetTable === 'purses' && !e.revertsEventId && !undone.has(e.id));
  if (lines.length === 0) return null;
  const coins: Coins = {};
  for (const line of lines) {
    const before = isRecord(line.before) && isRecord(line.before.coins) ? line.before.coins : {};
    const after = isRecord(line.after) && isRecord(line.after.coins) ? line.after.coins : {};
    for (const [key, now] of Object.entries(after)) {
      const was = typeof before[key] === 'number' ? (before[key] as number) : 0;
      if (typeof now === 'number' && Number.isInteger(now) && Number.isInteger(was) && now > was) coins[key] = (coins[key] ?? 0) + (now - was);
    }
  }
  return coins;
}
