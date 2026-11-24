// The call to adventure reaching a player (row P7 of docs/plans/dec-9-the-players-scene.md, dec-12 piece C; rulings
// p7-1 to p7-13, docs/design/rulings/p7-call-card-2026-11-24.md; page 40 and page 18's PL4b). A player reads the sends
// they may read (hook_sends' own read rule, ca-1: to the party, or to a character they played when it was sent) and
// their own seen marks (public.calls_seen, supabase/migrations/20261124120000_p7_calls_seen.sql), and nobody else's.
//   * hook.seen ("Got it"): the player's own mark on one send, their account's (p7-3); logged at verbose, never undone,
//     never changed (a repeat gives back the first time).
//   * The slot's calls (p7-9, p7-11 to p7-13): the unseen ones oldest first, one card at a time, "1 of 3" when there are
//     several (counting those not yet seen); each seen one a folded row under the card, newest fold first.
//   * A card's heading from the send's kind (p7-4), never from the name an older give still carries.
import { defineCommand, fromError, isGm, isMember, ok, failed, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';

/** A send as a player's card needs it. */
export interface CallSend {
  id: string;
  campaignId: string;
  /** A call to adventure, or a given rumour (dec-12 E). */
  kind: 'hook' | 'rumour';
  /** The character it was sent to, or null for the party. */
  actorId: string | null;
  /** That character's name as the reader may read it (their own character's); null for the party. */
  actorName: string | null;
  /** That character's player when it was sent (who reads it with the GM); null for the party. */
  playerUserId: string | null;
  body: string;
  pays: string;
  createdAt: string;
}

/** What hook.seen checks: the send's campaign, and whose it is. */
export interface CallSendRef {
  id: string;
  campaignId: string;
  actorId: string | null;
  playerUserId: string | null;
}

/** "A call to adventure, for the party" / "A rumour, for Wren" (p7-4; PL4b). */
export function callHeading(send: Pick<CallSend, 'kind' | 'actorId' | 'actorName'>): string {
  const what = send.kind === 'rumour' ? 'A rumour' : 'A call to adventure';
  const who = send.actorId === null ? 'the party' : send.actorName?.trim() || 'your character';
  return `${what}, for ${who}`;
}

/** What the slot shows: the one unseen card (oldest first), its count when there are several, and the folded rows. */
export interface CallsInSlot {
  card: CallSend | null;
  /** "1 of 3" with several unseen; null with one or none (p7-9, p7-12). */
  count: string | null;
  /** Each seen call, newest fold first (p7-11, p7-13). */
  folded: CallSend[];
}

const byTime = (a: string, b: string) => a.localeCompare(b);

/** The slot's calls from the sends a player reads and their own marks (send id to the time of their "Got it"). */
export function callsInSlot(sends: readonly CallSend[], seen: ReadonlyMap<string, string>): CallsInSlot {
  const unseen = sends.filter((s) => !seen.has(s.id)).sort((a, b) => byTime(a.createdAt, b.createdAt) || a.id.localeCompare(b.id));
  const folded = sends
    .filter((s) => seen.has(s.id))
    .sort((a, b) => byTime(seen.get(b.id)!, seen.get(a.id)!) || byTime(b.createdAt, a.createdAt));
  return { card: unseen[0] ?? null, count: unseen.length > 1 ? `1 of ${unseen.length}` : null, folded };
}

/** The input to hook.seen: the send. */
export interface MarkCallSeenInput {
  send: CallSendRef;
}

/**
 * Got it (hook.seen): a player marks a call or a rumour sent to them as seen, now (the server's time). Allowed for a
 * member who isn't the GM, on a send to the party or to a character they played when it was sent; the database refuses
 * the same, and an undone send too.
 */
export const markCallSeen = defineCommand({
  name: 'hook.seen',
  log: 'verbose',
  target: (input: MarkCallSeenInput) => input.send,
  allowed: (user: CurrentUser, send: CallSendRef) =>
    isMember(user, send.campaignId) && !isGm(user, send.campaignId) && (send.actorId === null || send.playerUserId === user.id),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('mark_call_seen', { send: input.send.id });
    if (error) return fromError(error);
    return typeof data === 'string' ? ok(data) : failed("Couldn't mark it seen. Try again.");
  },
});

/** A player's calls: the live sends they read, and their own marks. Null if they couldn't be read. */
export async function loadPlayerCalls(db: Db, campaignId: string, userId: string): Promise<{ sends: CallSend[]; seen: Map<string, string> } | null> {
  const [sends, marks] = await Promise.all([
    db.from('hook_sends').select('id, campaign_id, actor_id, player_user_id, body, pays, kind, created_at').eq('campaign_id', campaignId).eq('undone', false),
    db.from('calls_seen').select('send_id, seen_at').eq('campaign_id', campaignId).eq('player_user_id', userId),
  ]);
  if (sends.error || marks.error) return null;
  const actorIds = [...new Set(sends.data.map((s) => s.actor_id).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await db.from('actors').select('id, name').in('id', actorIds);
    if (actors.error) return null;
    for (const a of actors.data) names.set(a.id, a.name);
  }
  return {
    sends: sends.data.map((s) => ({
      id: s.id,
      campaignId: s.campaign_id,
      kind: s.kind === 'rumour' ? 'rumour' : 'hook',
      actorId: s.actor_id,
      actorName: s.actor_id ? (names.get(s.actor_id) ?? null) : null,
      playerUserId: s.player_user_id,
      body: s.body,
      pays: s.pays ?? '',
      createdAt: s.created_at,
    })),
    seen: new Map(marks.data.map((m) => [m.send_id, m.seen_at])),
  };
}

export const CALL_CARD_COMMANDS = [markCallSeen] as const;
