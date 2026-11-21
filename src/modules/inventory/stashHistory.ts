// Who put each thing in the party stash and when, and the stash's last thing in and last thing out (row K14 of
// docs/plans/dec-6-the-whole-pack-tab.md; ruling pk-4, docs/design/rulings/pack-rework-rulings-2026-11-11.md). Read
// from the log the reader already reads; nothing new is stored and no migration is needed. The screen that shows it is
// K11, later.
//
// What counts is a change to an inventory line's carrier, as the log keeps it (log_change: an update keeps only the
// columns that changed, an insert or a delete the whole row):
//   in    a line's carrier becomes the stash (`location_id` set to the stash's id, after `actor_id` held it):
//         inventory.move, whole or part, Put in, the GM's send once K16b exists; or a line made straight on the stash
//         (inventory.add). The part of a stack split off on the stash to be taken away is not an "in".
//   out   a line's carrier stops being the stash: a take by Give to…, or the GM's move; or a thing that left play
//         straight from the stash (dropped, used up, given away outside the party: the line deleted, or counted down by
//         inventory.remove or item.use), with who did it (the lead's answer 3, 2026-11-14). It has no row.
// An undone event, and the undo itself, count for nothing. Coin is in its own table (purses) and counts toward nothing here. "When" is the campaign's day from the
// clock's own changes in the same log (campaign_clocks' `seconds`), else the event's date.
import { readClock, type TimeUnits } from '../expedition/clock.ts';
import { allRows } from '../library/allRows.ts';
import type { Db } from '../../core/supabase.ts';
import type { LogEvent } from '../../core/events.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Who did it: the GM ("Your GM"), or a character, by id (null when the log can't say whose hands it was in). */
export type StashWho = { gm: true } | { gm: false; characterId: string | null };

/** When: the campaign's day where the clock's changes say it, else the event's date; and whether that is today. */
export interface StashWhen {
  /** The campaign's day (from 1), or null when the campaign's clock never moved in what the reader can see. */
  day: number | null;
  /** The event's date (ISO), the fallback. */
  date: string;
  /** The same campaign day as now (or, without one, the same date). */
  today: boolean;
}

/** One move into or out of the stash. */
export interface StashMove {
  lineId: string;
  direction: 'in' | 'out';
  who: StashWho;
  when: StashWhen;
  /**
   * How many moved, when the log says: a part split off a stack, or what left play (a deleted line's count, or how many
   * were counted down); null for a whole line moved (its count is the line's).
   */
  qty: number | null;
  /** The thing's name, when the log carries it (a line made or removed keeps its whole row); else null. */
  name: string | null;
  /** True when the thing left play from the stash (dropped, used up, given away outside the party) rather than taken. */
  leftPlay: boolean;
  seq: number;
}

export interface StashHistory {
  /** Each line in the stash now, by id: its latest put-in (who and when). A line with none in the log is absent. */
  rows: Map<string, StashMove>;
  /** The stash's last thing in and last thing out, each with who and when; null when the log has none. */
  lastIn: StashMove | null;
  lastOut: StashMove | null;
}

/** What the model needs besides the events. */
export interface StashContext {
  stashId: string;
  /** The lines in the stash now (their ids). */
  lineIds: readonly string[];
  /** The campaign's GMs (their user ids): their moves read "Your GM". */
  gmUserIds: ReadonlySet<string>;
  /** The clock now (seconds) and its units; null without a clock (dates then). */
  clock: { seconds: number; units: TimeUnits } | null;
  /** Now (ISO), for "today" by date. */
  now: string;
}

const carrierOf = (row: Record<string, unknown> | null) => ({ actorId: text(row?.actor_id), locationId: text(row?.location_id) });

/**
 * The stash's history from the log events the reader may read (any order). Only `inventory_lines` changes are moves;
 * `campaign_clocks` changes give the day. Undone events and the undos count for nothing.
 */
export function stashHistory(events: readonly LogEvent[], ctx: StashContext): StashHistory {
  const undone = new Set(events.flatMap((e) => (e.revertsEventId ? [e.revertsEventId] : [])));
  const counted = events.filter((e) => !e.revertsEventId && !undone.has(e.id)).sort((a, b) => a.seq - b.seq);
  const clocks = events.filter((e) => e.targetTable === 'campaign_clocks' && (isRecord(e.after) || isRecord(e.before))).sort((a, b) => a.seq - b.seq);
  const lines = counted.filter((e) => e.targetTable === 'inventory_lines' && e.targetId);
  const whenOf = (e: LogEvent): StashWhen => whenAt(e, clocks, ctx);
  const whoOf = (e: LogEvent, characterId: string | null): StashWho => (e.actorUserId && ctx.gmUserIds.has(e.actorUserId) ? { gm: true } : { gm: false, characterId });

  const moves: StashMove[] = [];
  for (const e of lines) {
    const lineId = e.targetId!;
    // A line's carrier before and after: an update keeps only what changed, so an unchanged carrier is absent.
    const changed = isRecord(e.after) && ('actor_id' in e.after || 'location_id' in e.after);
    const made = e.before === null && isRecord(e.after);
    const removed = isRecord(e.before) && e.after === null;
    if (removed) {
      // Left play (dropped, used up, given away outside the party): the log keeps the whole row. From the stash, it's
      // the stash's last out, with who did it (a player's character the log can't name: none, as for a line made there).
      if (carrierOf(e.before).locationId === ctx.stashId) {
        const qty = typeof e.before!.qty === 'number' ? e.before!.qty : null;
        moves.push({ lineId, direction: 'out', who: whoOf(e, null), when: whenOf(e), qty, name: text(e.before!.name), seq: e.seq, leftPlay: true });
      }
      continue;
    }
    // Part of a stack on the stash used up or dropped (counted down, the line stays): that many left play.
    const countedDown = (e.type === 'inventory.remove' || e.type === 'item.use') && isRecord(e.before) && isRecord(e.after) && !changed;
    if (countedDown && typeof e.before!.qty === 'number' && typeof e.after!.qty === 'number' && e.after!.qty < e.before!.qty && carrierNow(lineId, e.seq, lines) === ctx.stashId) {
      moves.push({ lineId, direction: 'out', who: whoOf(e, null), when: whenOf(e), qty: e.before!.qty - e.after!.qty, name: null, seq: e.seq, leftPlay: true });
      continue;
    }
    const before = carrierOf(e.before);
    const after = carrierOf(e.after);
    const intoStash = (made || changed) && after.locationId === ctx.stashId && (made || before.locationId !== ctx.stashId);
    const outOfStash = !made && changed && before.locationId === ctx.stashId && after.locationId !== ctx.stashId;
    if (intoStash) {
      // The part of a stack split off on the stash to be taken away or given away (made, then moved off or removed at
      // once) isn't an "in".
      if (made && splitTakenAway(e, lines)) continue;
      // A part split off elsewhere and handed to the stash: its count is the made row's.
      const madeRow = made ? e.after : lines.find((m) => m.targetId === lineId && m.before === null && m.seq < e.seq)?.after;
      const qty = !made && madeRow && splitBefore(e, lines) && typeof madeRow.qty === 'number' ? madeRow.qty : null;
      moves.push({ lineId, direction: 'in', who: whoOf(e, made ? null : before.actorId), when: whenOf(e), qty, name: text(madeRow?.name), seq: e.seq, leftPlay: false });
    } else if (outOfStash) {
      const madeRow = lines.find((m) => m.targetId === lineId && m.before === null && m.seq < e.seq && splitTakenAway(m, lines))?.after;
      moves.push({ lineId, direction: 'out', who: whoOf(e, after.actorId), when: whenOf(e), qty: madeRow && typeof madeRow.qty === 'number' ? madeRow.qty : null, name: text(madeRow?.name), seq: e.seq, leftPlay: false });
    }
  }

  const rows = new Map<string, StashMove>();
  for (const id of ctx.lineIds) {
    const latest = moves.filter((m) => m.lineId === id && m.direction === 'in').at(-1);
    if (latest) rows.set(id, latest);
  }
  return { rows, lastIn: moves.filter((m) => m.direction === 'in').at(-1) ?? null, lastOut: moves.filter((m) => m.direction === 'out').at(-1) ?? null };
}

const movesCarrier = (e: LogEvent) => isRecord(e.after) && ('actor_id' in e.after || 'location_id' in e.after);

/**
 * The line made by `made` leaves its carrier at once: moved off (a split to be handed on) or removed (a part given away
 * outside the party) in the same request, or moved off by the very next event.
 */
function splitTakenAway(made: LogEvent, lines: readonly LogEvent[]): boolean {
  const later = lines.filter((e) => e.targetId === made.targetId && e.seq > made.seq);
  const leaves = (e: LogEvent) => movesCarrier(e) || (isRecord(e.before) && e.after === null);
  if (made.requestId !== null && later.some((e) => e.requestId === made.requestId && leaves(e))) return true;
  const next = later[0];
  return !!next && movesCarrier(next) && next.seq === made.seq + 1;
}

/** Where the line was (its `location_id`) just before event `seq`: the latest carrier the log gives it, from its making or its moves. */
function carrierNow(lineId: string, seq: number, lines: readonly LogEvent[]): string | null {
  const known = lines.filter((e) => e.targetId === lineId && e.seq < seq && isRecord(e.after) && (e.before === null || movesCarrier(e))).at(-1);
  return known ? text(known.after!.location_id) : null;
}

/** Whether a move of a line follows its making as a split (same request, or the very next event). */
function splitBefore(move: LogEvent, lines: readonly LogEvent[]): boolean {
  const made = lines.find((e) => e.targetId === move.targetId && e.before === null && e.seq < move.seq);
  return !!made && ((made.requestId !== null && made.requestId === move.requestId) || move.seq === made.seq + 1);
}

/** The clock's seconds when an event happened: the latest clock change before it, else the first one after it (its before), else now. */
function secondsAt(e: LogEvent, clocks: readonly LogEvent[], now: number): number | null {
  const prior = [...clocks].reverse().find((c) => c.seq < e.seq && isRecord(c.after) && typeof c.after.seconds === 'number');
  if (prior) return prior.after!.seconds as number;
  const later = clocks.find((c) => c.seq > e.seq && isRecord(c.before) && typeof c.before.seconds === 'number');
  if (later) return later.before!.seconds as number;
  return clocks.length === 0 ? now : null;
}

/** The same day on the reader's own calendar (local time, not UTC's), so an event near midnight reads as they lived it. */
const sameLocalDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

function whenAt(e: LogEvent, clocks: readonly LogEvent[], ctx: StashContext): StashWhen {
  const sameDate = sameLocalDay(e.createdAt, ctx.now);
  if (!ctx.clock) return { day: null, date: e.createdAt, today: sameDate };
  const seconds = secondsAt(e, clocks, ctx.clock.seconds);
  if (seconds === null) return { day: null, date: e.createdAt, today: sameDate };
  const day = readClock(seconds, ctx.clock.units).day;
  return { day, date: e.createdAt, today: day === readClock(ctx.clock.seconds, ctx.clock.units).day };
}

/** "Your GM", or the character's name (null when the log can't say whose hands it was in). */
export function whoWords(who: StashWho, names: ReadonlyMap<string, string>): string | null {
  if (who.gm) return 'Your GM';
  return who.characterId ? (names.get(who.characterId) ?? null) : null;
}

/**
 * "today", "day 2" (the Pack page's words, mockup pack/08); without a campaign day, the date in one form on every
 * device, the day then the month ("6 Nov", as the sheet's dates: `SheetParts`), on the reader's own calendar.
 */
export function whenWords(when: StashWhen): string {
  if (when.today) return 'today';
  if (when.day !== null) return `day ${when.day}`;
  return new Date(when.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const EVENT_COLUMNS = 'id, seq, type, level, actor_user_id, target_table, target_id, before, after, fiat, reason, reverts_event_id, request_id, created_at';

/**
 * The stash's history as this person may read it: the log's own read (events, under its read rule) narrowed to the
 * inventory's and the clock's lines, and the campaign's GMs (members). No new read, no new right. Null on error.
 * The events come a page at a time (`allRows`: the database sends at most 1,000 rows a request), all of them, so the
 * newest moves are never cut off. It reads the whole history each time; narrowing it is for later (status file, Q4).
 */
export async function loadStashHistory(
  db: Db,
  campaignId: string,
  ctx: Omit<StashContext, 'gmUserIds'>,
): Promise<StashHistory | null> {
  const [events, members] = await Promise.all([
    allRows((from, to) =>
      db.from('events').select(EVENT_COLUMNS).eq('campaign_id', campaignId).in('target_table', ['inventory_lines', 'campaign_clocks']).order('seq', { ascending: true }).range(from, to),
    ),
    db.from('members').select('user_id, base_role').eq('campaign_id', campaignId),
  ]);
  if (!events || members.error) return null;
  const gmUserIds = new Set((members.data ?? []).flatMap((m) => (m.base_role === 'gm' && typeof m.user_id === 'string' ? [m.user_id] : [])));
  const read = events.map((row): LogEvent => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      seq: Number(r.seq),
      type: String(r.type),
      level: r.level === 'verbose' ? 'verbose' : 'simple',
      actorUserId: text(r.actor_user_id),
      targetTable: String(r.target_table),
      targetId: text(r.target_id),
      before: isRecord(r.before) ? r.before : null,
      after: isRecord(r.after) ? r.after : null,
      fiat: r.fiat === true,
      reason: text(r.reason),
      revertsEventId: text(r.reverts_event_id),
      requestId: text(r.request_id),
      createdAt: String(r.created_at),
    };
  });
  return stashHistory(read, { ...ctx, gmUserIds });
}
