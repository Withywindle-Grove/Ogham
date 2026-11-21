// B15 of docs/plans/scene-point-to-point.md: a magic item's truth as a piece (p2p-29; page 30, HM3 and HM4, approved
// 2026-11-20; pg30-4). The GM taps the eye of a magic item's piece: the piece is shown to the group and the item,
// wherever it is held, carries its real name and what it does. Both in one request, so one Undo takes both back
// (pg30-4); a later hide is the piece's own hide and leaves the item as the players now know it.
// The database's side: supabase/migrations/20261120210000_p2p_b15_item_truth.sql (public.show_item_truth writes the
// piece's show and a pointer to the piece on each line; public.item_truths is what a reader learns of an item).
// A name revealed is revealed to everyone (Francis, 2026-11-21, replacing b15f-6): the eye names the item on every
// line it went to, whoever holds it and whichever group they are in.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult } from '../../core/commands.ts';
import type { LogEvent } from '../../core/events.ts';
import type { Db } from '../../core/supabase.ts';
import { rowKey } from './findSend.ts';
import type { HoardRow } from './hoard.ts';

/** place.showItemTruth: show the magic item's piece to the group's visit, and name the item on these lines. */
export const showItemTruth = defineCommand({
  name: 'place.showItemTruth',
  target: (input: { campaignId: string; row: { id: string }; piece: { id: string }; lines: readonly string[] }) => ({ campaignId: input.campaignId }),
  allowed: (user, target: { campaignId: string }) => isMember(user, target.campaignId) && isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const { data, error } = await db.rpc('show_item_truth', { visit: input.row.id, piece: input.piece.id, lines: [...input.lines] });
    if (error) return fromError(error);
    return ok(typeof data === 'number' ? data : 0);
  },
});

export const ITEM_TRUTH_COMMANDS = [showItemTruth] as const;

/**
 * The lines a hoard's thing went to (B15: "wherever it is held"), read from the GM's log: each send at this place that
 * names the row (`entry`'s thing row) and wasn't undone. A send's things are made in the order of its thing rows
 * (public.give_find makes one new line per thing, in order), so the row's line is the made line at the row's place among
 * the send's thing rows. A line moved since keeps its id. Only the GM reads the send's rows (rp-4), so for anyone else
 * this is empty. Lines since dropped are still listed: the database names only lines that are there.
 */
export function heldLinesOf(events: readonly LogEvent[], placeId: string, entry: number): string[] {
  const wanted = rowKey({ entry, kind: 'thing' } as Pick<HoardRow, 'entry' | 'kind'>);
  const reverted = new Set(events.flatMap((e) => (e.revertsEventId ? [e.revertsEventId] : [])));
  const byRequest = new Map<string, LogEvent[]>();
  for (const e of events) {
    if (e.type !== 'find.give' || e.revertsEventId || !e.requestId) continue;
    byRequest.set(e.requestId, [...(byRequest.get(e.requestId) ?? []), e]);
  }
  const out: string[] = [];
  for (const lines of byRequest.values()) {
    if (lines.some((e) => reverted.has(e.id))) continue;
    const find = lines.map(findRows).find((f) => f !== null && f.placeId === placeId);
    if (!find) continue;
    const things = find.rows.filter((r) => r.endsWith(':thing'));
    const at = things.indexOf(wanted);
    if (at < 0) continue;
    const made = lines.filter((e) => e.targetTable === 'inventory_lines' && e.before === null && e.targetId).sort((a, b) => a.seq - b.seq);
    const line = made[at]?.targetId;
    if (line) out.push(line);
  }
  return out;
}

/** The place and rows a send's GM-only line carries (its reason), or null for any other line. */
function findRows(event: LogEvent): { placeId: string; rows: string[] } | null {
  if (!event.reason?.startsWith('{')) return null;
  try {
    const find = (JSON.parse(event.reason) as { find?: Record<string, unknown> }).find;
    if (!find || typeof find.placeId !== 'string') return null;
    return { placeId: find.placeId, rows: Array.isArray(find.rows) ? find.rows.filter((r): r is string => typeof r === 'string') : [] };
  } catch {
    return null;
  }
}

/**
 * Which of these pieces are revealed (a thing sent after the reveal arrives named, the local review of #10): shown to
 * some group by a show not undone, hidden since or not. The GM's read (players read no piece_shows of other groups).
 * Null if it couldn't be read.
 */
export async function loadRevealed(db: Db, pieces: readonly string[]): Promise<Set<string> | null> {
  if (pieces.length === 0) return new Set();
  const found = await db.from('piece_shows').select('piece_id').in('piece_id', [...pieces]).eq('undone', false);
  if (found.error) return null;
  return new Set((found.data as { piece_id: string }[]).map((s) => s.piece_id));
}

/**
 * Who holds each of these lines now (the eye's toast, HM3): the character's or hireling's id, or null for the party
 * stash; a line no longer there is left out. Null if it couldn't be read.
 */
export async function loadHolders(db: Db, lines: readonly string[]): Promise<Map<string, string | null> | null> {
  if (lines.length === 0) return new Map();
  const found = await db.from('inventory_lines').select('id, actor_id').in('id', [...lines]);
  if (found.error) return null;
  return new Map((found.data as { id: string; actor_id: string | null }[]).map((l) => [l.id, l.actor_id]));
}
