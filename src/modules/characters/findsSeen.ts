// "New until Got it" (K20 of docs/plans/dec-6-the-whole-pack-tab.md; ruling pk-13, 2026-11-14, Francis: "A player marks
// their new finds as seen. That is one mark the player writes on their own character, readable only by that player and
// you."; narrowed by the lead to the player's own approved character). The mark is a time the server sets
// (public.mark_finds_seen, supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql), kept in a table of its own that
// only the character's player and the GM read. Logged at the verbose level, like a message's read time, and not undone.
// What is New is read from the log since the mark (K20a; p45-21, p45-22, p45-25: `findsSince`), not from a row's age.
// No screen here: the New tag and the card's place are later rows.
import { defineCommand, fromError, isGm, isMember, ok, failed, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { LogEvent } from '../../core/events.ts';
import type { Db } from '../../core/supabase.ts';
import { toCharacterRef, type CharacterRef } from './commands.ts';

/**
 * Got it: the character's own player marks its finds as seen, now (the server's time). Allowed only for the
 * character's player, on an approved character in play, never the GM (even on a character the GM owns); the database
 * refuses the same.
 */
export const markFindsSeen = defineCommand({
  name: 'character.seenFinds',
  log: 'verbose',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user: CurrentUser, character: CharacterRef) =>
    isMember(user, character.campaignId) &&
    !isGm(user, character.campaignId) &&
    character.ownerType === 'user' &&
    character.ownerUserId === user.id &&
    character.approval === 'approved' &&
    !character.archived,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('mark_finds_seen', { character: input.character.id });
    if (error) return fromError(error);
    return typeof data === 'string' ? ok(data) : failed("Couldn't mark these as seen.");
  },
});

export const FINDS_SEEN_COMMANDS = [markFindsSeen] as const;

/** Who put it there: the GM, another character (its id), or a character the device can no longer tell (ruling "A"). */
export type FindWho = { kind: 'gm' } | { kind: 'character'; characterId: string } | { kind: 'unknown' };

/** An Undo of the arrival since the mark (p45-25): by the GM, or by someone else (the giver's own Undo). */
export interface TakenBack {
  byGm: boolean;
  at: string;
}

/** A thing that arrived: one entry a row (two finds onto one stack are one, ⚑ F9's lean). */
export interface ThingFind {
  kind: 'thing';
  /** The row it now is; null when it was taken back and is gone. */
  lineId: string | null;
  /** As the player sees the row (an unidentified thing's face, p45-8); a row gone: the log's last copy of it. */
  name: string;
  /** How many arrived, added together (never more than the row holds now). */
  arrived: number;
  /** The stack's count now, where it holds more than arrived (it joined a stack she carried, p45-22); else null. */
  now: number | null;
  /** The newest arrival's giver and time. */
  who: FindWho;
  at: string;
  takenBack: TakenBack | null;
}

/** Coin that arrived: all of it one entry, coin by coin added together; a taken-back arrival its own entry. */
export interface CoinFind {
  kind: 'coin';
  purseId: string;
  coins: Record<string, number>;
  who: FindWho;
  at: string;
  takenBack: TakenBack | null;
}

export type FindEntry = ThingFind | CoinFind;

/** An inventory line as the device holds it (`InventoryLine` passes as it is). */
export interface FindLine {
  id: string;
  actorId: string | null;
  name: string;
  qty: number;
  libraryEntryId?: string | null;
}

export interface FindsSource {
  character: { id: string; ownerUserId: string | null; purseId: string | null };
  gmUserIds: ReadonlySet<string>;
  /** Every log line this device was sent for the campaign since the mark (all of them with no mark). */
  events: readonly LogEvent[];
  /** Every inventory line the device holds, hers and others' (a part-stack gift's giver is its source line's carrier). */
  lines: readonly FindLine[];
  seenAt: string | null;
}

type Row = Record<string, unknown>;
type Arrival =
  | { kind: 'thing'; ids: string[]; lineId: string; arrived: number; joined?: true; who: FindWho; at: string; seq: number }
  | { kind: 'coin'; ids: string[]; coins: Record<string, number>; who: FindWho; at: string; seq: number };

const row = (r: Row | null) => r ?? {};
const qtyOf = (r: Row | null) => (typeof r?.qty === 'number' ? r.qty : null);
function coinsAdded(e: LogEvent): Record<string, number> {
  const was = (row(e.before).coins ?? {}) as Record<string, number>;
  const now = (row(e.after).coins ?? {}) as Record<string, number>;
  const added: Record<string, number> = {};
  for (const key of Object.keys(now)) if (Number(now[key]) > Number(was[key] ?? 0)) added[key] = Number(now[key]) - Number(was[key] ?? 0);
  return added;
}

/**
 * What is new for one character since its mark, read from the log (K20a; p45-21, p45-22, p45-25, p45-28): each thing
 * or coin another person put in its pack or purse by the four roads (the GM's send, a gift from another character, the
 * GM's "Give coin…", the GM's Add item). Its own player's acts never count, nor the GM's other moves (an
 * `inventory.move`, `purse.give` or `purse.take` by the GM), nor any Undo. Newest first. A thing given away or dropped
 * since leaves; one put in a container stays. An arrival undone since stays, marked taken back.
 */
export function findsSince(source: FindsSource): FindEntry[] {
  const { character, gmUserIds, lines } = source;
  const me = character.id;
  const seen = source.seenAt === null ? NaN : Date.parse(source.seenAt);
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  const byRequest = new Map<string, LogEvent[]>();
  for (const e of [...source.events].sort((a, b) => a.seq - b.seq)) {
    const key = e.requestId ?? e.id;
    byRequest.set(key, [...(byRequest.get(key) ?? []), e]);
  }
  const undoOf = new Map<string, LogEvent>();
  const mergedInto = new Map<string, string>();
  const goneCopy = new Map<string, Row>();
  // When each line was moved onto her from elsewhere, or went (merged into a stack) from someone else: a join made
  // before then was onto someone else's stack.
  const movedOn = new Map<string, number>();
  for (const e of source.events) {
    if (e.revertsEventId) undoOf.set(e.revertsEventId, e);
    const onto = e.after === null || row(e.after).actor_id === me;
    if (e.targetTable === 'inventory_lines' && e.targetId && e.before && onto && row(e.before).actor_id !== me) movedOn.set(e.targetId, Math.max(e.seq, movedOn.get(e.targetId) ?? -Infinity));
  }
  for (const group of byRequest.values()) {
    const items = group.filter((e) => e.targetTable === 'inventory_lines' && e.targetId);
    const raised = items.find((e) => (qtyOf(e.after) ?? 0) > (qtyOf(e.before) ?? Infinity));
    for (const e of items) {
      if (e.after !== null || !e.before) continue;
      goneCopy.set(e.targetId!, e.before);
      // A whole line merged onto a same-name stack (Q2): the find lives on in that stack, if it is the same thing.
      // The raised line's log copy holds only its count, so it is matched as the device holds it.
      const onto = raised ? lineOf.get(raised.targetId!) : undefined;
      const same = onto && (e.before.name === onto.name || (e.before.library_entry_id != null && e.before.library_entry_id === onto.libraryEntryId));
      if (same && !e.revertsEventId) mergedInto.set(e.targetId!, raised!.targetId!);
    }
  }

  const arrivals: Arrival[] = [];
  for (const group of byRequest.values()) {
    const first = group[0]!;
    if (Date.parse(first.createdAt) <= seen) continue;
    const actor = first.actorUserId;
    if (actor === null || actor === character.ownerUserId || group.some((e) => e.revertsEventId)) continue;
    const gm = gmUserIds.has(actor);
    const base = { at: first.createdAt, seq: first.seq };
    for (const e of group) {
      const ids = [e.id];
      if (e.targetTable === 'purses' && character.purseId && e.targetId === character.purseId) {
        const coins = coinsAdded(e);
        if (Object.keys(coins).length === 0) continue;
        const giver = e.reason?.startsWith('with:') ? e.reason.slice(5) : null;
        if (gm && (e.type === 'find.give' || e.type === 'purse.add')) arrivals.push({ kind: 'coin', ids, coins, who: { kind: 'gm' }, ...base });
        else if (!gm && e.type === 'purse.give' && giver && giver !== 'stash') arrivals.push({ kind: 'coin', ids, coins, who: { kind: 'character', characterId: giver }, ...base });
        continue;
      }
      if (e.targetTable !== 'inventory_lines' || !e.targetId) continue;
      const lineId = e.targetId;
      const made = e.before === null && row(e.after).actor_id === me;
      const was = qtyOf(e.before);
      const now = qtyOf(e.after);
      const joined = was !== null && now !== null && now > was;
      if (gm && (e.type === 'find.give' || e.type === 'inventory.add')) {
        if (made) arrivals.push({ kind: 'thing', ids, lineId, arrived: Number(now ?? 1), who: { kind: 'gm' }, ...base });
        else if (joined && e.type === 'inventory.add') arrivals.push({ kind: 'thing', ids, lineId, arrived: now - was, joined: true, who: { kind: 'gm' }, ...base });
        continue;
      }
      if (gm || e.type !== 'inventory.move') continue;
      const from = row(e.before).actor_id;
      if (row(e.after).actor_id === me && e.before !== null && typeof from === 'string' && from !== me) {
        // Handed over: part of a stack is the line split off just before (its count), a whole line its count now.
        const split = group.find((m) => m.targetId === lineId && m.before === null);
        const arrived = qtyOf(split?.after ?? null) ?? lineOf.get(lineId)?.qty ?? 1;
        arrivals.push({ kind: 'thing', ids, lineId, arrived, who: { kind: 'character', characterId: from }, ...base });
      } else if (joined) {
        // Onto a stack: a whole line's copy names its giver; part of one names none, so its source line's carrier now
        // (ruling "A", as the log's sentence reads it). shortcut: wrong once the source line moves, until a line names it.
        const gone = group.find((m) => m.after === null && m.before);
        const countedOff = group.find((m) => m !== e && m.targetTable === 'inventory_lines' && (qtyOf(m.after) ?? Infinity) < (qtyOf(m.before) ?? 0));
        // The source line as the device holds it, or the log's last copy of it once gone.
        const source = countedOff ? (lineOf.get(countedOff.targetId ?? '') ?? (goneCopy.has(countedOff.targetId ?? '') ? { actorId: goneCopy.get(countedOff.targetId!)!.actor_id ?? null } : undefined)) : undefined;
        const giver = gone ? gone.before!.actor_id : source?.actorId;
        // From the stash (a gone copy, or a source line, with no carrier) it is a Take, not a gift.
        if ((gone || source) && typeof giver !== 'string') continue;
        const who: FindWho = typeof giver === 'string' && giver !== me ? { kind: 'character', characterId: giver } : { kind: 'unknown' };
        arrivals.push({ kind: 'thing', ids, lineId, arrived: now - was, joined: true, who, ...base });
      }
    }
  }

  const takenBackOf = (ids: string[]): TakenBack | null => {
    const undo = ids.map((id) => undoOf.get(id)).find(Boolean);
    return undo ? { byGm: undo.actorUserId !== null && gmUserIds.has(undo.actorUserId), at: undo.createdAt } : null;
  };
  const resolve = (id: string) => {
    let at = id;
    for (let hops = 0; mergedInto.has(at) && hops < 50; hops++) at = mergedInto.get(at)!;
    return at;
  };
  const entries: { entry: FindEntry; seq: number }[] = [];
  const things = new Map<string, { entry: ThingFind; seq: number }>();
  let coin: { entry: CoinFind; seq: number } | null = null;
  for (const a of arrivals.sort((x, y) => x.seq - y.seq)) {
    const takenBack = takenBackOf(a.ids);
    if (a.kind === 'coin') {
      if (takenBack) entries.push({ entry: { kind: 'coin', purseId: character.purseId!, coins: a.coins, who: a.who, at: a.at, takenBack }, seq: a.seq });
      else {
        const coins: Record<string, number> = { ...coin?.entry.coins };
        for (const [key, n] of Object.entries(a.coins)) coins[key] = (coins[key] ?? 0) + n;
        coin = { entry: { kind: 'coin', purseId: character.purseId!, coins, who: a.who, at: a.at, takenBack: null }, seq: a.seq };
      }
      continue;
    }
    const lineId = resolve(a.lineId);
    const line = lineOf.get(lineId);
    // A join's line holds only a count: it is hers only if the stack is on her now and was then (taken back or not).
    if (a.joined && (line?.actorId !== me || (movedOn.get(lineId) ?? -Infinity) > a.seq || (movedOn.get(a.lineId) ?? -Infinity) > a.seq)) continue;
    if (takenBack) {
      const name = line?.name ?? String((goneCopy.get(lineId) ?? goneCopy.get(a.lineId))?.name ?? '');
      entries.push({ entry: { kind: 'thing', lineId: line ? lineId : null, name, arrived: a.arrived, now: null, who: a.who, at: a.at, takenBack }, seq: a.seq });
      continue;
    }
    if (!line || line.actorId !== me) continue;
    const before = things.get(lineId);
    const arrived = Math.min((before?.entry.arrived ?? 0) + a.arrived, line.qty);
    things.set(lineId, { entry: { kind: 'thing', lineId, name: line.name, arrived, now: line.qty > arrived ? line.qty : null, who: a.who, at: a.at, takenBack: null }, seq: a.seq });
  }
  entries.push(...things.values(), ...(coin ? [coin] : []));
  return entries.sort((x, y) => y.seq - x.seq).map((e) => e.entry);
}

/**
 * The count on the Pack's icon (K19a; pk-5, p45-10): things, not units (a stack is one, all the coin is one), and a
 * find taken back is not counted. None is 0, so no badge is drawn; "99+" past 99 is the nav's own (`SectionNav`).
 */
export function findsCount(entries: readonly FindEntry[]): number {
  return entries.filter((e) => e.takenBack === null).length;
}

/** The character's mark, as its player or the GM reads it; null when there is none (or it can't be read). */
export async function loadFindsSeen(db: Db,characterId: string): Promise<string | null> {
  const { data, error } = await db.from('finds_seen').select('seen_at').eq('actor_id', characterId).maybeSingle();
  if (error || !data) return null;
  return typeof data.seen_at === 'string' ? data.seen_at : null;
}

/** What the device reads to say what is new for a character (K20b): everything `findsSince` takes but the lines. */
export interface FindsRead {
  character: CharacterRef;
  seenAt: string | null;
  /** The inventory's and the purses' log lines since the mark (both levels), oldest first. */
  events: LogEvent[];
  /** The clock's log lines since the mark, for the day an arrival came (`secondsAt`). */
  clocks: LogEvent[];
  gmUserIds: ReadonlySet<string>;
  purseId: string | null;
}

const FIND_EVENT_COLUMNS = 'id, seq, type, level, actor_user_id, target_table, target_id, before, after, fiat, reason, reverts_event_id, request_id, created_at';
/** The database sends at most 1,000 rows a request: the lines come a page at a time, so the newest are never cut off. */
const FIND_PAGE = 1000;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const textOf = (v: unknown) => (typeof v === 'string' ? v : null);

/**
 * K20b's read of what is new, for one character: the character, its mark, the log's own read of the inventory's,
 * purses' and clock's lines since the mark (under the log's read rule: a line another player may not read never comes),
 * the campaign's GMs and the character's purse. A purse's lines are asked for this character's own purse only (K21b's
 * hidden-data cell: another character's amounts are never asked for, the read rule aside). `may` is who the read is
 * for (`markFindsSeen.allowed`): when it says no, nothing past the character is read. Nothing new is read or allowed.
 * Null on error, or when `may` says no.
 */
export async function loadFindsRead(
  db: Db,
  campaignId: string,
  characterId: string,
  may: (character: CharacterRef) => boolean = () => true,
): Promise<FindsRead | null> {
  const actor = await db.from('actors').select('id, campaign_id, owner_type, owner_user_id, approval, status').eq('id', characterId).maybeSingle();
  if (actor.error || !actor.data) return null;
  const character = toCharacterRef(actor.data);
  if (!may(character)) return null;
  const seenAt = await loadFindsSeen(db, characterId);
  const [members, purse] = await Promise.all([
    db.from('members').select('user_id, base_role').eq('campaign_id', campaignId),
    db.from('purses').select('id').eq('campaign_id', campaignId).eq('actor_id', characterId).maybeSingle(),
  ]);
  if (members.error) return null;
  const purseId = purse.error ? null : textOf(purse.data?.id);
  // Two reads, a page at a time: the inventory's and the clock's lines, and the lines of this character's own purse.
  const pages = async (narrow: (query: ReturnType<typeof eventsSince>) => ReturnType<typeof eventsSince>): Promise<unknown[] | null> => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += FIND_PAGE) {
      const page = await narrow(eventsSince(db, campaignId, seenAt)).order('seq', { ascending: true }).range(from, from + FIND_PAGE - 1);
      if (page.error || !page.data) return null;
      rows.push(...page.data);
      if (page.data.length < FIND_PAGE) return rows;
    }
  };
  const [lines, coin] = await Promise.all([
    pages((q) => q.in('target_table', ['inventory_lines', 'campaign_clocks'])),
    purseId ? pages((q) => q.eq('target_table', 'purses').eq('target_id', purseId)) : Promise.resolve([]),
  ]);
  if (!lines || !coin) return null;
  const read = [...lines, ...coin].map((row): LogEvent => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      seq: Number(r.seq),
      type: String(r.type),
      level: r.level === 'verbose' ? 'verbose' : 'simple',
      actorUserId: textOf(r.actor_user_id),
      targetTable: String(r.target_table),
      targetId: textOf(r.target_id),
      before: isRecord(r.before) ? r.before : null,
      after: isRecord(r.after) ? r.after : null,
      fiat: r.fiat === true,
      reason: textOf(r.reason),
      revertsEventId: textOf(r.reverts_event_id),
      requestId: textOf(r.request_id),
      createdAt: String(r.created_at),
    };
  });
  read.sort((a, b) => a.seq - b.seq);
  return {
    character,
    seenAt,
    events: read.filter((e) => e.targetTable !== 'campaign_clocks'),
    clocks: read.filter((e) => e.targetTable === 'campaign_clocks'),
    gmUserIds: new Set((members.data ?? []).flatMap((m) => (m.base_role === 'gm' && typeof m.user_id === 'string' ? [m.user_id] : []))),
    purseId,
  };
}

/** The campaign's log lines since the mark (all of them with no mark), as K20b reads them. */
function eventsSince(db: Db, campaignId: string, seenAt: string | null) {
  const query = db.from('events').select(FIND_EVENT_COLUMNS).eq('campaign_id', campaignId);
  return seenAt ? query.gt('created_at', seenAt) : query;
}
