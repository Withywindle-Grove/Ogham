// Undo: puts back what a logged change replaced, as a new event linked to it (nothing is erased). The database
// does it in one step (undo_request in supabase/migrations/…_m2_undo.sql), checking that the person made the
// change or is the GM, that nothing changed since, and that it wasn't already undone. Making and deleting
// things can't be undone, except a drop (ruled 2026-10-25): its log keeps a copy, and undo puts the item back; and
// moving part of a stack (ruled 2026-10-26): undo merges the split-off part back. A give the receiver has used some
// of brings back what's left, and says how much was used (5b, ruled 2026-10-26). A thing that joined a same-name stack
// (Q2, sw-4) comes back off it the same way, the stack never going below what it had; a whole line a move merged in
// is made again (sw-9).
import { defineCommand, failed, isGm, isMember, notAllowed, ok, type CommandResult } from './commands.ts';
import type { Db } from './supabase.ts';

/**
 * The deletions that can be undone (ruled 2026-10-25): Drop, Empty… → Drop all, Give to → Other…, and the GM
 * declining a one-off; and (M5 step 7, ruled M5-9) a light used up as the clock moves (any of the clock's moves, and
 * the burnout line itself, which is part of that move) or the last fuel item a Refill used. The database keeps the
 * same list (public.undoable_deletions; a test checks they match).
 */
export const UNDOABLE_DELETIONS: readonly string[] = [
  'inventory.remove',
  // Use one up from At hand (Design on #552): the last one leaves play; Undo puts it back.
  'item.use',
  'inventory.empty',
  'inventory.giveAway',
  'inventory.decline',
  'time.advance',
  'time.advanceBy',
  'time.set',
  'time.start',
  'time.downtime',
  'light.burnOut',
  'light.refill',
  // The GM's answer to a request may move the clock (a Describe… with a cost in turns; M5 step 12).
  'request.answer',
  // M5b step 6e: a sale accepted takes the item out of the pack in the same request.
  'request.reply',
  // A draft's race or class changed from the review (M5b step 0c follow-up C, cf-7): the kit, shop and trait gear
  // leaves the pack (the money refunded on the record); Undo puts it back with the row.
  'creation.redo',
  // M5b step 4 (camp): firewood, ingredients and food used up; Undo puts the line back.
  'camp.fuel',
  'camp.cook',
  'camp.eat',
  // December step 4 (Move on): the move's clock burns lights out as Advance by… does; Undo puts the line back.
  'place.moveOn',
];

/**
 * The move whose split-off part Undo merges back (part of a stack given inside the party or put somewhere; ruled
 * 2026-10-26, a named exception to hard rule 4). The database names the same command in private.undo_body.
 */
export const UNDOABLE_SPLIT = 'inventory.move';

/**
 * The actions whose made record undo marks undone instead of removing it (M5 step 5; hard rule 4): starting a
 * session or an expedition, making a reminder or recording a check (M5 step 6), checking again (M5 small fixes),
 * entering the weather (M5b), or adding a status (+ Status, and Push on's rest condition; M5 step 9); moving a group
 * to a place, a split or a Join up (which can give a group its place), or sending a message (M5 step 11; M5b g4); a request
 * sent or asked (M5 step 12); the shows a return visit brings back (M5b g2b, place.backAt: Undo hides them all).
 * The database keeps the same list (public.undoable_makings; a test checks they match).
 */
export const UNDOABLE_MAKINGS: readonly string[] = [
  'session.start', 'expedition.start', 'reminder.add', 'check.record', 'check.again', 'check.now', 'weather.enter', 'status.add', 'rest.pushOn',
  'place.set', 'party.chooseGroup', 'party.joinUp', 'message.send', 'request.send', 'request.ask', 'place.addPiece', 'place.showPiece',
  'place.backAt', 'tables.pin', 'tables.readByHand', 'encounter.queue',
  // M5b step 1 follow-up (ruled B): setting a place's picture makes its picture piece (Undo marks it undone).
  'place.setPicture',
  // M5b g6 (B5): Next turn's applied rest marks the pack's condition on those who pushed on.
  'time.advance', 'time.advanceBy',
  // M5b step 1: a day's first travel row, a move's or forced march's arrival (its place row), and a Lost mark.
  'travel.dayStart', 'travel.move', 'travel.forceMarch', 'travel.lost.set',
  // M5b step 4: a camp and what's done in it (marked undone; a camp with steps done, or eaten portions, refuse).
  'camp.open', 'camp.fuel', 'camp.cook', 'camp.talk', 'camp.eat',
  // M5b step 4, part 2: the watch order and the sleep results (20261103170000 lists them too).
  'camp.watches', 'camp.sleep',
  // M5b step 6c follow-up (review finding 2, ruled B): showing the first place in town shows the town too (its
  // description piece's show row, in the same request).
  'town.showPlace',
  // M5b step 6e: a lodging from the town's list picked (its request row, answered at once).
  'town.stay',
  // M8b slice 0: a place picked from a pack (the place, its notes and its unshown pieces, in one request).
  'place.fromPack',
  // The full sheet revised (B6): a sheet change asked for (Undo marks the request undone).
  'sheet.requestChange',
  // December step 4 (Move on): the visit, the move's record and the shows a return visit brings back.
  'place.moveOn',
  // December dec-7 piece 3: the GM's first switch on a place's rule (its eye, or the stand-in check's toggle) makes
  // its row (Undo marks it undone; a later switch is an update and goes back the usual way).
  'placeRule.eye', 'placeRule.inForce',
  // The players' place card (P4, p4s-2): the GM's first share of a Knowledge section makes its row (Undo marks it
  // undone; sharing again or taking it back is an update and goes back the usual way).
  'placeKnowledge.eye',
  // Calls to adventure (dec-12 piece B): a hook sent to a character or the party (Undo marks the send undone).
  'hook.send',
  // A rumour (dec-12 piece E): a row's words given to a character or the party (Undo marks the give undone).
  'rumour.give',
  // A piece of a place in town shown (W4c, ge-1): its first show on a visit makes the store's row (Undo marks it undone).
  'town.showPiece',
  // A shop's stock (W12): a first answer for a thing that day makes its row (Undo marks it undone; it reads as its default).
  'stock.set',
];

/**
 * Whether a log line's changes can be undone: nothing made in it and nothing deleted, except in one of those,
 * where a line made and removed at once (part of a stack given away) is fine, and a move's split-off part; and a
 * session or an expedition started (marked undone, never removed).
 */
export const mayUndo = (type: string, events: readonly { before: unknown; after: unknown; targetId?: string | null }[]) => {
  const deletion = UNDOABLE_DELETIONS.includes(type);
  const removed = new Set(events.filter((e) => e.after === null).map((e) => e.targetId));
  const made = UNDOABLE_SPLIT === type || UNDOABLE_MAKINGS.includes(type);
  // A whole line a move merged into a same-name stack (Q2, sw-9): Undo makes it again, with what's left of it.
  const merged = type === UNDOABLE_SPLIT && events.some((e) => isJoin(type, e));
  return events.every((e) => (e.before !== null || made || (deletion && removed.has(e.targetId))) && (e.after !== null || deletion || merged));
};

/** A join's change (Q2): an add's or a move's raise of a same-name stack's count. */
export function isJoin(type: string, event: { before: unknown; after: unknown }): boolean {
  const count = (row: unknown) => (row && typeof row === 'object' && typeof (row as { qty?: unknown }).qty === 'number' ? (row as { qty: number }).qty : null);
  const was = count(event.before);
  const now = count(event.after);
  return (type === 'inventory.add' || type === UNDOABLE_SPLIT) && was !== null && now !== null && now > was;
}

/**
 * The newest change of a kind this person made in the campaign ("inventory.remove"): what a toast's Undo undoes
 * (B23, ruled 2026-10-25; the same Undo as the log, with the same rules). Null when there's none to find.
 */
export async function latestChange(db: Db, campaignId: string, type: string, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from('events')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('type', type)
    .eq('actor_user_id', userId)
    .order('seq', { ascending: false })
    .limit(1);
  return error || !data?.[0] ? null : (data[0] as { id: string }).id;
}

/** What came back when a give was undone after some of it was used (5b): `left` of `of`, held by `by`. */
export interface CameBack {
  left: number;
  of: number;
  name: string;
  by: string;
}

/** "12 of 17 Reed arrows came back · Ash used 5"; null when all of it came back (nothing to say). */
export function cameBackText(back: CameBack | null, words?: string): string | null {
  if (!back || back.left >= back.of) return null;
  return `${back.left} of ${back.of} ${words ?? back.name} came back, ${back.by || 'Someone'} used ${back.of - back.left}`;
}

const asCameBack = (data: unknown): CameBack | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return typeof d.left === 'number' && typeof d.of === 'number'
    ? { left: d.left, of: d.of, name: typeof d.name === 'string' ? d.name : '', by: typeof d.by === 'string' ? d.by : '' }
    : null;
};

export const undoChange = defineCommand({
  name: 'event.undo',
  target: (input: { campaignId: string; eventId: string; authorUserId: string | null }) => ({
    campaignId: input.campaignId,
    authorUserId: input.authorUserId,
  }),
  allowed: (user, target) =>
    isMember(user, target.campaignId) && (isGm(user, target.campaignId) || target.authorUserId === user.id),
  run: async (db, _user, input): Promise<CommandResult<CameBack | null>> => {
    const { data, error } = await db.rpc('undo_request_said', { event_id: input.eventId });
    if (!error) return ok(asCameBack(data));
    if (error.code !== '42501') return failed(error.message);
    // Refusals from the database's checks arrive as permission errors. One has its own words (gp-9, the lead,
    // 2026-11-14): a give whose Undo would hand the character back to a player who has left the campaign.
    const left = await leftPlayerOf(db, input.campaignId, input.eventId);
    return left ? failed(`${left.player} has left the campaign, so ${left.name} can't go back to them.`) : notAllowed();
  },
});

/**
 * When the change being undone is a give (character.reassign) from a player who is no longer a player of the
 * campaign, their name and the character's; otherwise null. Reads only the give's own log line and the members.
 */
async function leftPlayerOf(db: Db, campaignId: string, eventId: string): Promise<{ player: string; name: string } | null> {
  const { data: picked } = await db.from('events').select('request_id, type').eq('id', eventId).maybeSingle();
  if (!picked || picked.type !== 'character.reassign' || !picked.request_id) return null;
  const { data: lines } = await db
    .from('events')
    .select('before, target_id')
    .eq('request_id', picked.request_id)
    .eq('type', 'character.reassign')
    .eq('target_table', 'actors');
  const line = (lines ?? [])[0];
  // The line keeps only what changed: the owner it would go back to, or none (the GM's own).
  const before = (line?.before ?? null) as { owner_user_id?: string | null } | null;
  if (!line || !before?.owner_user_id) return null;
  const { data: still } = await db
    .from('members')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', before.owner_user_id)
    .eq('base_role', 'player')
    .maybeSingle();
  if (still) return null;
  const { data: profile } = await db.from('profiles').select('display_name').eq('id', before.owner_user_id).maybeSingle();
  const { data: character } = await db.from('actors').select('name').eq('id', line.target_id ?? '').maybeSingle();
  return { player: profile?.display_name || 'That player', name: character?.name || 'This character' };
}
