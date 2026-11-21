// B15 of docs/plans/scene-point-to-point.md: a magic item's truth as a piece (p2p-29; page 30, HM3 and HM4, approved
// 2026-11-20; pg30-4). The GM taps the eye of a magic item's piece: the piece is shown to the group and the item,
// wherever it is held, carries its real name and what it does. Both in one request, so one Undo takes both back
// (pg30-4); a later hide is the piece's own hide and leaves the item as the players now know it.
// The database's side: supabase/migrations/20261120210000_p2p_b15_item_truth.sql (public.show_item_truth writes the
// piece's show and a pointer to the piece on each line; public.item_truths is what a reader learns of an item).
// A split party (b15f-6, Francis 2026-11-20: "No, group A only"): the eye names the item only on lines held in the
// group being shown the piece, or by someone an earlier show during a split was shown to (by character, never by group
// number: the third fix's review, finding 3); the database enforces it, and this side passes only those lines, so the
// toast names only their holders.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult } from '../../core/commands.ts';
import type { LogEvent } from '../../core/events.ts';
import type { GroupOf } from '../../core/partyGroups.ts';
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
 * While the party is split (b15f-6): who holds each line now, which group each character and hireling is in, the group
 * being shown the piece now, and whom earlier shows made during a split reached. Null (or left out) when the party is
 * one group: then nothing is held back.
 */
export interface SplitRule {
  /** Each line still there, and who holds it: a character's or hireling's id, or null for the party stash. */
  holders: ReadonlyMap<string, string | null>;
  /** Which group each character and hireling is in. */
  groupOf: GroupOf;
  /** The group being shown the piece now. */
  group: number;
  /**
   * The characters and hirelings a show of the piece made during a split (not undone) was shown to: each show's
   * `shown_to`. A show made while the party was one group names no one here.
   */
  shownTo: ReadonlySet<string>;
}

/**
 * The lines a hoard's thing went to (B15: "wherever it is held"), read from the GM's log: each send at this place that
 * names the row (`entry`'s thing row) and wasn't undone. A send's things are made in the order of its thing rows
 * (public.give_find makes one new line per thing, in order), so the row's line is the made line at the row's place among
 * the send's thing rows. A line moved since keeps its id. Only the GM reads the send's rows (rp-4), so for anyone else
 * this is empty. Without `split`, lines since dropped are still listed: the database names only lines that are there.
 * With `split` (the party split, b15f-6), only the lines held by a character or hireling in `group` or in `shownTo`: not
 * a line held in another group, not the party stash (no group holds it), not a line no longer there.
 */
export function heldLinesOf(events: readonly LogEvent[], placeId: string, entry: number, split: SplitRule | null = null): string[] {
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
  return split ? out.filter((line) => inShownGroup(split, line)) : out;
}

/** Whether a line is held by a character or hireling of the group being shown the piece, or one shown it before (b15f-6). */
function inShownGroup(split: SplitRule, line: string): boolean {
  const holder = split.holders.get(line);
  if (!holder) return false;
  return split.groupOf.get(holder) === split.group || split.shownTo.has(holder);
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
 * Who holds each of these lines now (the eye's toast, HM3; the split party's rule, b15f-6): the character's or
 * hireling's id, or null for the party stash; a line no longer there is left out. Null if it couldn't be read.
 */
export async function loadHolders(db: Db, lines: readonly string[]): Promise<Map<string, string | null> | null> {
  if (lines.length === 0) return new Map();
  const found = await db.from('inventory_lines').select('id, actor_id').in('id', [...lines]);
  if (found.error) return null;
  return new Map((found.data as { id: string; actor_id: string | null }[]).map((l) => [l.id, l.actor_id]));
}

/**
 * Whether the party is split (b15f-6): more than one group among the characters and hirelings in play (approved and
 * active), as the database counts it (private.party_split). Pure.
 */
export function partySplit(groupOf: GroupOf, inPlay: ReadonlySet<string>): boolean {
  return new Set([...groupOf].flatMap(([actor, group]) => (inPlay.has(actor) ? [group] : []))).size > 1;
}

/**
 * The split party's rule for a magic item's eye shown to `group` (b15f-6): null when the party is one group; the
 * holders, the groups, `group`, and whom the piece's earlier shows during a split reached otherwise. Undefined if something couldn't be read (the eye then
 * does nothing and says so).
 */
export async function loadSplitRule(
  db: Db,
  campaignId: string,
  pieceId: string,
  group: number,
  holders: ReadonlyMap<string, string | null>,
): Promise<SplitRule | null | undefined> {
  const [members, inPlay, shows] = await Promise.all([
    db.from('party_group_members').select('actor_id, group_number').eq('campaign_id', campaignId),
    db.from('actors').select('id').eq('campaign_id', campaignId).eq('approval', 'approved').eq('status', 'active'),
    db.from('piece_shows').select('shown_to').eq('piece_id', pieceId).eq('undone', false),
  ]);
  if (members.error || inPlay.error || shows.error) return undefined;
  const groupOf: GroupOf = new Map(members.data.map((m) => [String(m.actor_id), Number(m.group_number)]));
  if (!partySplit(groupOf, new Set(inPlay.data.map((a) => String(a.id))))) return null;
  const shownTo = new Set(shows.data.flatMap((s) => (Array.isArray(s.shown_to) ? s.shown_to.map(String) : [])));
  return { holders, groupOf, group, shownTo };
}
