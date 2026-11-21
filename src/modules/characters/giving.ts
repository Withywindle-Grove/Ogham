// Giving a character to a player (page 13 of the December mockups, approved 2026-11-13 with gp-5): the sheet's rows,
// the toast's words, and the line "From your GM, today" on a player's character that was given to them. The command
// is character.reassign (commands.ts).
import type { Db } from '../../core/supabase.ts';

/** A player of the campaign as the sheet lists them: their name and the character they have in play, if any. */
export interface GiveCandidate {
  userId: string;
  name: string;
  /** The character they play now; null for "no character yet". */
  plays: string | null;
}

/** The character being given: whose it is now. */
export interface GivenCharacter {
  name: string;
  ownerType: 'user' | 'party' | 'gm';
  ownerUserId: string | null;
}

export interface GiveSheet {
  /** "Sam has Wren now." when a player has it (the line with the tick, never a row). */
  hasLine: string | null;
  /** "You, the GM" first, when a player has it (gp-5). */
  gmRow: boolean;
  rows: { userId: string; name: string; summary: string }[];
}

/** What the sheet shows for a character: the owner's line, the GM's row, and every other player. */
export function giveSheet(character: GivenCharacter, players: readonly GiveCandidate[]): GiveSheet {
  const owner = character.ownerType === 'user' ? players.find((p) => p.userId === character.ownerUserId) : undefined;
  return {
    hasLine: owner ? `${owner.name} has ${character.name} now.` : null,
    gmRow: character.ownerType === 'user',
    rows: players
      .filter((p) => !(character.ownerType === 'user' && p.userId === character.ownerUserId))
      .map((p) => ({ userId: p.userId, name: p.name, summary: p.plays ? `plays ${p.plays}` : 'no character yet' })),
  };
}

/** The toast: "Ash given to Sam." or, back to the GM, "Wren is yours again." */
export const givenWords = (character: string, to: string | null) => (to === null ? `${character} is yours again.` : `${character} given to ${to}.`);

/** Refused because the player isn't in the campaign any more (frame G5): said plainly, nothing changed. */
export const notGivenWords = (character: string, to: string) => `${character} wasn't given: ${to} is no longer in this campaign. Nothing changed.`;

/**
 * This give's own hand-over line, found by the give's request id, for the toast's Undo: never another give of the
 * same character, even one made in another tab within the toast's seconds.
 */
export async function giveEventId(db: Db, campaignId: string, actorId: string, requestId: string): Promise<string | null> {
  const { data, error } = await db
    .from('events')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('type', 'character.reassign')
    .eq('target_table', 'actors')
    .eq('target_id', actorId)
    .eq('request_id', requestId)
    .order('seq', { ascending: true })
    .limit(1);
  return error || !data?.[0] ? null : (data[0] as { id: string }).id;
}

/** Whether this person is still a player of the campaign; null when it can't be read. */
export async function stillAPlayer(db: Db, campaignId: string, userId: string): Promise<boolean | null> {
  const { data, error } = await db.from('members').select('user_id').eq('campaign_id', campaignId).eq('user_id', userId).eq('base_role', 'player');
  return error || !data ? null : data.length > 0;
}

/**
 * When each of these characters was given to this player, by its newest hand-over line that was not undone, if that
 * line gave it to them (frame G4: "From your GM, today"). A character never given is left out.
 */
export async function givenToMe(db: Db, userId: string, actorIds: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (actorIds.length === 0) return found;
  const { data, error } = await db
    .from('events')
    .select('id, target_id, after, created_at, seq, reverts_event_id')
    .eq('type', 'character.reassign')
    .eq('target_table', 'actors')
    .in('target_id', [...actorIds])
    .order('seq', { ascending: false });
  if (error || !data) return found;
  const rows = data as { id: string; target_id: string; after: Record<string, unknown> | null; created_at: string; reverts_event_id: string | null }[];
  // A give that was undone doesn't count: its Undo line points back at it.
  const reverted = rows.length > 0 ? await db.from('events').select('reverts_event_id').in('reverts_event_id', rows.map((r) => r.id)) : null;
  const undone = new Set(((reverted?.data ?? []) as { reverts_event_id: string }[]).map((e) => e.reverts_event_id));
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.reverts_event_id || undone.has(row.id) || seen.has(row.target_id)) continue;
    seen.add(row.target_id);
    if (row.after?.owner_user_id === userId) found.set(row.target_id, row.created_at);
  }
  return found;
}

/** "From your GM, today", or "From your GM, 12 Nov" on another day. */
export function fromGmWords(givenAt: string, now: Date = new Date()): string {
  const at = new Date(givenAt);
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  return `From your GM, ${sameDay ? 'today' : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}
