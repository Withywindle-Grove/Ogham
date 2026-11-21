// "New until Got it" (K20 of docs/plans/dec-6-the-whole-pack-tab.md; ruling pk-13, 2026-11-14, Francis: "A player marks
// their new finds as seen. That is one mark the player writes on their own character, readable only by that player and
// you."; narrowed by the lead to the player's own approved character). The mark is a time the server sets
// (public.mark_finds_seen, supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql), kept in a table of its own that
// only the character's player and the GM read. Logged at the verbose level, like a message's read time, and not undone.
// No screen here: the New tag and the card's place are later rows.
import { defineCommand, fromError, isGm, isMember, ok, failed, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { CharacterRef } from './commands.ts';

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
    return typeof data === 'string' ? ok(data) : failed("Couldn't mark them seen. Try again.");
  },
});

export const FINDS_SEEN_COMMANDS = [markFindsSeen] as const;

/** A thing a character holds, as far as "New" needs: its line and when it reached the character. */
export interface Find {
  id: string;
  /** When the line was made (its `created_at`, ISO). */
  createdAt: string;
}

/**
 * Which finds are New: with no mark, all of them; with a mark, those that reached the character after it. A find at
 * the very time of the mark was seen. A time that can't be read counts as New, so nothing found is missed.
 */
export function newFinds<T extends Find>(finds: readonly T[], seenAt: string | null): T[] {
  if (seenAt === null) return [...finds];
  const seen = Date.parse(seenAt);
  if (Number.isNaN(seen)) return [...finds];
  return finds.filter((find) => {
    const at = Date.parse(find.createdAt);
    return Number.isNaN(at) || at > seen;
  });
}

/** The character's mark, as its player or the GM reads it; null when there is none (or it can't be read). */
export async function loadFindsSeen(db: Db,characterId: string): Promise<string | null> {
  const { data, error } = await db.from('finds_seen').select('seen_at').eq('actor_id', characterId).maybeSingle();
  if (error || !data) return null;
  return typeof data.seen_at === 'string' ? data.seen_at : null;
}
