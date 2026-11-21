// Party groups as the campaign keeps them (M5 step 8; ruled 2026-10-30, DG14; docs/05 "Splitting the party";
// supabase/migrations/…_m5_party_groups.sql). Each character and hireling is in one group: group 1 is the party, a
// split adds more. Split the party: each player picks their own character's group in a pop-up, the GM can move
// anyone (a character's hirelings follow it). Join up: the GM, or any player while the groups are in the same place
// (M5 step 11: placePlay.ts; the database checks it). One clock for everyone. Every change is logged (Simple) and undoable;
// with one group left the database makes it the party again. src/core/partyGroups.ts is the pure part.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { GroupOf } from '../../core/partyGroups.ts';
import type { Db } from '../../core/supabase.ts';

/** Which group each character and hireling of the campaign is in, or null if it couldn't be loaded. */
export async function loadGroupMembers(db: Db, campaignId: string): Promise<GroupOf | null> {
  const { data, error } = await db.from('party_group_members').select('actor_id, group_number').eq('campaign_id', campaignId);
  if (error) return null;
  return new Map((data ?? []).map((m) => [String(m.actor_id), Number(m.group_number)]));
}

/** Who a group change is for: the character (its owner) and its campaign. */
export interface GroupTarget {
  id: string;
  campaignId: string;
  ownerUserId: string | null;
}

/** Split the party: the character's own player, or the GM (anyone). */
export const mayChooseGroup = (user: CurrentUser, character: GroupTarget): boolean =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/** Join up: the GM; a player while the two groups are in the same place (`together`, from loadMeeting in placePlay.ts). */
export const mayJoinUp = (user: CurrentUser, target: { campaignId: string; together: boolean }): boolean =>
  isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.together);

/** The group the change left the character in (or the group joined), by number. */
async function done(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, key: 'group_number' | 'number'): Promise<CommandResult<number>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return ok(typeof row?.[key] === 'number' ? row[key] : 1);
}

/** A character goes to a group (by number), or with null to a new one. */
export const chooseGroup = defineCommand({
  name: 'party.chooseGroup',
  log: 'simple',
  target: (input: { character: GroupTarget; group: number | null }) => input.character,
  allowed: mayChooseGroup,
  run: (db, _user, input) => done(db.rpc('choose_party_group', { actor: input.character.id, to_group: input.group ?? undefined }), 'group_number'),
});

/** Join up: everyone in one group joins another. */
export const joinUp = defineCommand({
  name: 'party.joinUp',
  log: 'simple',
  target: (input: { campaignId: string; together: boolean; from: number; into: number }) => ({ campaignId: input.campaignId, together: input.together }),
  allowed: mayJoinUp,
  run: (db, _user, input) => done(db.rpc('join_party_groups', { campaign: input.campaignId, from_group: input.from, into_group: input.into }), 'number'),
});

export const GROUP_COMMANDS = [chooseGroup, joinUp] as const;
