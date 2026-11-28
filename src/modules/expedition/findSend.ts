// K16b: the GM sends a find (docs/plans/dec-6-the-whole-pack-tab.md, row K16; ruling pk-12, 2026-11-14, Francis: "When
// you send a find from a hoard, one action adds the things and the coin together, and your Undo takes both back in one
// step"; pk-1, pk-2, pu-9). The command and its Undo run the database's functions
// (supabase/migrations/20261115090000_dec_6_k16b_send_find.sql): public.give_find writes the whole send in one request,
// every line `find.give` with an ids-only reason (K28's shape, read by src/core/events.ts): the party's lines name who
// it went to, and one GM-only line also the place and the hoard rows (rp-4). public.undo_find takes it all back, once,
// while nothing it made has changed since, with the knowledge of an item it taught (uf-2). No screen: the sheets are K16c.
import { defineCommand, fromError, isGm, isMember, ok, failed, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { loadTargetLog, type LogEvent } from '../../core/events.ts';
import type { Db } from '../../core/supabase.ts';
import type { Coins, HoardRow } from './hoard.ts';

/** One thing to send: an item of the setting rules by its library entry, or a one-off by its words. */
export type FindThing = { libraryEntryId: string; qty: number } | { name: string; qty: number };

/** A hoard row's key in the log ("2:thing", "0:coin"): where it sits in the place's treasure list, and which row. */
export const rowKey = (row: Pick<HoardRow, 'entry' | 'kind'>): string => `${row.entry}:${row.kind}`;

/** A pack id, as a held key may carry it (the database's check, 20261128160000_dec5_e_held_send.sql). */
const PACK_ID = /^[a-z0-9][a-z0-9_.-]{0,79}$/;

/**
 * A held thing's key in the log (dec5-gaps E, #189; dg-12): "held:<the person's pack id>:<the item's id>", the person
 * as a piece names her ("NPC: <id>") and the item's bare id (a `holds` line's `itemRef` loses its pack, as a shop's
 * stock line does). Pack ids, not row ids, so what she gave stays given after her pack is updated or imported again.
 * Null when either id isn't a pack id (the server would refuse the send).
 */
export function heldKey(personId: string, item: string): string | null {
  const at = item.indexOf(':');
  const bare = (at < 0 ? item : item.slice(at + 1)).trim();
  const person = personId.trim();
  return PACK_ID.test(person) && PACK_ID.test(bare) ? `held:${person}:${bare}` : null;
}

/** The person and the item a held key names; null for a hoard row's key or anything else. */
export function heldOfKey(key: string): { personId: string; itemId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'held' || !PACK_ID.test(parts[1]!) || !PACK_ID.test(parts[2]!)) return null;
  return { personId: parts[1]!, itemId: parts[2]! };
}

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
      // As many as the pack's qty (B15, p2p-28, b15f-1); a magic item goes under its plain words, never its real name.
      things.push(entry ? { libraryEntryId: entry, qty: row.qty } : { name: row.text, qty: row.qty });
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
  /**
   * B15 (page 30, HM3's pick): each thing whose magic item's piece is revealed (shown to some group, not undone) arrives
   * named, whichever group's card it is sent from (the local review of #10). `thing` is its place among `things`; the
   * new line is named (public.name_item_truth, which shows nothing) in the same request, so the send's own Undo still
   * takes everything back. Every such thing in the send, not only the first (the local review of #1101).
   */
  named?: readonly { piece: string; thing: number }[] | null;
}

/**
 * What a send answers: its first log line (for its Undo), and whether a thing meant to arrive named arrived plain
 * (`notNamed`: the send stands, with its Undo, and the GM's eye on the piece names it; the review of #1101).
 */
export interface GiveFindResult {
  eventId: string;
  notNamed: boolean;
}

/** The words for a send whose magic item arrived plain: no database message, only what to do (docs/06 words guide). */
export const NOT_NAMED_WORDS = "The magic item arrived under its plain name. Tap its eye again.";

/** find.give: the GM sends things and coin, in one request. Answers the send's first log line (for its Undo). */
export const giveFind = defineCommand({
  name: 'find.give',
  target: (input: GiveFindInput) => ({ campaignId: input.campaignId }),
  allowed: (user, target: { campaignId: string }) => isMember(user, target.campaignId) && isGm(user, target.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<GiveFindResult>> => {
    const { data, error } = await db.rpc('give_find', {
      campaign: input.campaignId,
      to_actor: input.to as string,
      place: input.placeId,
      things: input.things as unknown as Json,
      coins: input.coins as unknown as Json,
      rows: input.rows as unknown as Json,
    });
    if (error) return fromError(error);
    if (typeof data !== 'string') return failed("Couldn't send it. Try again.");
    const toName = input.named ?? [];
    if (toName.length === 0) return ok({ eventId: data, notNamed: false });
    let notNamed = !meta;
    if (meta) {
      // The send's own lines, in the order public.give_find made them (one per thing).
      const made = await db
        .from('events')
        .select('target_id, seq')
        .eq('campaign_id', input.campaignId)
        .eq('request_id', meta.requestId)
        .eq('target_table', 'inventory_lines')
        .is('before', null)
        .order('seq');
      const lines = made.error ? [] : (made.data as { target_id: string | null }[]);
      // The send stands either way, with its Undo (the reviews of #1101): a thing that couldn't be named arrives plain,
      // the toast says so, and the GM's eye on its piece names it.
      for (const one of toName) {
        const line = lines[one.thing]?.target_id;
        const named = line ? await db.rpc('name_item_truth', { piece: one.piece, lines: [line] }) : null;
        if (!named || named.error) notNamed = true;
      }
    }
    return ok({ eventId: data, notNamed });
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
export function sentRows(events: readonly LogEvent[], placeId: string): Map<string, { to: string | null; eventId: string; seq: number }> {
  const out = new Map<string, { to: string | null; eventId: string; seq: number }>();
  for (const send of liveSends(events)) {
    if (send.placeId !== placeId) continue;
    // A held thing's key is the person's, not this place's hoard (sentHeld reads those).
    for (const row of send.rows) if (!heldOfKey(row)) out.set(row, { to: send.to, eventId: send.eventId, seq: send.seq });
  }
  return out;
}

/**
 * The held things the GM's sends gave away (dec5-gaps E, #189; dg-12's technical pick: read from the log, no record
 * per person), by held key (`heldKey`), at every place: to whom (`to` null: the party stash), at which place, and by
 * which send (its first line, for Take it back, find.undo). The latest send of a key wins; a send that was undone
 * marks nothing. Only the GM's log has the keys (on the send's GM-only line), so a player's log gives none.
 */
export function sentHeld(events: readonly LogEvent[]): Map<string, { to: string | null; placeId: string; eventId: string; seq: number }> {
  const out = new Map<string, { to: string | null; placeId: string; eventId: string; seq: number }>();
  for (const send of liveSends(events)) {
    for (const row of send.rows) if (heldOfKey(row)) out.set(row, { to: send.to, placeId: send.placeId, eventId: send.eventId, seq: send.seq });
  }
  return out;
}

/** The sends the GM reads the place of, oldest first, leaving out any that was undone (any of its lines reversed). */
function liveSends(events: readonly LogEvent[]): { to: string | null; placeId: string; rows: string[]; eventId: string; seq: number }[] {
  const reverted = new Set(events.map((e) => e.revertsEventId).filter((id): id is string => !!id));
  const sends = new Map<string, LogEvent[]>();
  for (const e of events) {
    if (e.type !== 'find.give' || e.revertsEventId) continue;
    const key = e.requestId ?? e.id;
    sends.set(key, [...(sends.get(key) ?? []), e]);
  }
  const ordered = [...sends.values()].map((lines) => [...lines].sort((a, b) => a.seq - b.seq)).sort((a, b) => a[0]!.seq - b[0]!.seq);
  const out: { to: string | null; placeId: string; rows: string[]; eventId: string; seq: number }[] = [];
  for (const lines of ordered) {
    if (lines.some((e) => reverted.has(e.id))) continue;
    // The place and the rows are on the send's GM-only line (rp-4): the GM reads them; a player's lines name neither.
    const find = lines.map(findOf).find((f) => f !== null && f.placeId !== null);
    if (!find || find.placeId === null) continue;
    out.push({ to: find.to, placeId: find.placeId, rows: find.rows, eventId: lines[0]!.id, seq: lines[0]!.seq });
  }
  return out;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The campaign clock now and its changes in the log (sf-8, TR1: when a find was sent, "Sent to Wren, turn 3."): the
 * send stores no game time, so the clock at a send is read from the clock's own changes around it (`secondsAt`). Null
 * when either can't be read.
 */
export async function loadClockChanges(db: Db, campaignId: string): Promise<{ seconds: number; changes: LogEvent[] } | null> {
  const clock = await db.from('campaign_clocks').select('id, seconds').eq('campaign_id', campaignId).maybeSingle();
  if (clock.error || !clock.data) return null;
  const row = clock.data as { id: string; seconds: number };
  const log = await loadTargetLog(db, campaignId, 'campaign_clocks', row.id);
  if (!log) return null;
  const changes = log.flatMap((entry) => entry.events).filter((e) => e.targetTable === 'campaign_clocks' && e.targetId === row.id);
  return { seconds: Number(row.seconds), changes: [...new Map(changes.map((e) => [e.id, e])).values()].sort((a, b) => a.seq - b.seq) };
}

/**
 * The places sends were made at, by their row id (dec5-gaps F, #192: "Sent before: …, at 4. The Customs Shed."): each
 * place's name and the pack entry it was made from, for its map key. Places the reader can't read are left out.
 */
export async function loadSentPlaces(db: Db, ids: readonly string[]): Promise<Map<string, { name: string; packId: string | null; entryId: string | null }>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from('places').select('id, name, pack_id, pack_entry_id').in('id', [...ids]);
  if (error || !data) return new Map();
  return new Map((data as { id: string; name: string; pack_id: string | null; pack_entry_id: string | null }[]).map((p) => [p.id, { name: p.name, packId: p.pack_id, entryId: p.pack_entry_id }]));
}

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
