// What the GM's Campaign screen reads: waiting invites and the players with their characters.
import type { Db } from './supabase.ts';
import { loadAlignments, withAlignment } from './alignments.ts';

import type { Approval } from './myCharacters.ts';

export interface WaitingInvite {
  id: string;
  code: string;
  /** The GM's optional "Who's it for?" note (stored in the invite's email field). */
  note: string | null;
  expiresAt: string;
}

export interface PlayerCharacter {
  id: string;
  campaignId: string;
  ownerType: 'user';
  ownerUserId: string;
  name: string;
  approval: Approval;
  active: boolean;
  /** Removed from the campaign but kept; the GM can restore or delete it. */
  archived: boolean;
  level: number;
  hpMax: number | null;
  backstory: string;
  /** Values for the campaign's character fields, by key. */
  fields: unknown;
  portraitAssetId: string | null;
  companyId: string | null;
  /** From guided creation (M4b): the class (one in R1 screens), the race, and how it was made. */
  classRef: string | null;
  raceRef: string | null;
  creation: unknown;
  /** Filled fields the player changed by hand (marked on the review card, A6). */
  editedFields: string[];
  /** The sections ticked when it was last sent back (B18): still marked when it comes back. */
  reviewSections: string[];
  /** The weapon skill picks as saved (actors.weapon_skills): the GM's review lists a typed one (PR G). */
  weaponSkills?: unknown;
}

export interface Player {
  userId: string;
  name: string;
  joinedAt: string;
  characters: PlayerCharacter[];
}

/** Pending, unexpired invites, newest first. Players get an empty list (the GM alone can read invites). */
export async function loadWaitingInvites(db: Db, campaignId: string): Promise<WaitingInvite[] | null> {
  const { data, error } = await db
    .from('invites')
    .select('id, code, email, expires_at, created_at')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());
  if (error) return null;
  return [...data]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => ({ id: row.id, code: row.code, note: row.email, expiresAt: row.expires_at }));
}

/** The campaign's players (not the GM), sorted by name, each with their own characters. */
export async function loadPlayers(db: Db, campaignId: string): Promise<Player[] | null> {
  const [members, actors] = await Promise.all([
    db
      .from('members')
      .select('user_id, active_actor_id, joined_at, profiles!members_user_id_fkey(display_name)')
      .eq('campaign_id', campaignId)
      .eq('base_role', 'player'),
    db
      .from('actors')
      .select('id, campaign_id, name, approval, status, owner_user_id, level, hp_max, backstory, fields, portrait_asset_id, company_id, created_at, classes, race_ref, creation, edited_fields, review_sections, weapon_skills')
      .eq('campaign_id', campaignId)
      .eq('kind', 'pc')
      .eq('owner_type', 'user'),
  ]);
  if (members.error || actors.error) return null;

  const alignments = await loadAlignments(db, actors.data.map((a) => a.id));
  const byAge = [...actors.data].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return members.data
    .map((member) => ({
      userId: member.user_id,
      name: member.profiles?.display_name ?? 'Unknown player',
      joinedAt: member.joined_at,
      characters: byAge
        .filter((actor) => actor.owner_user_id === member.user_id)
        .map((actor) => ({
          id: actor.id,
          campaignId: actor.campaign_id,
          ownerType: 'user' as const,
          ownerUserId: member.user_id,
          name: actor.name,
          approval: actor.approval as Approval,
          active: actor.id === member.active_actor_id,
          archived: actor.status === 'archived',
          level: actor.level,
          hpMax: actor.hp_max,
          backstory: actor.backstory,
          fields: withAlignment(actor.fields, alignments.get(actor.id)),
          portraitAssetId: actor.portrait_asset_id,
          companyId: actor.company_id,
          classRef: firstClassRef(actor.classes),
          raceRef: actor.race_ref,
          creation: actor.creation,
          editedFields: actor.edited_fields ?? [],
          reviewSections: actor.review_sections ?? [],
          weaponSkills: actor.weapon_skills ?? [],
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** The first class's id in a character's class list ([{classRef, level, xp}]); R1 screens show one. */
function firstClassRef(classes: unknown): string | null {
  const first = Array.isArray(classes) ? (classes[0] as { classRef?: unknown } | undefined) : undefined;
  return typeof first?.classRef === 'string' ? first.classRef : null;
}

/** One character as the GM sees it: "Wren (active)", "Hollis (waiting for approval)", "Sly Cob (sent back)". */
export function characterLabel(character: Pick<PlayerCharacter, 'name' | 'approval' | 'active'>): string {
  if (character.approval === 'pending') return `${character.name} (waiting for approval)`;
  if (character.approval === 'rejected') return `${character.name} (sent back)`;
  return character.active ? `${character.name} (active)` : character.name;
}

/** A character that is the GM's own (made by the GM, or taken back; the kind creation makes, a player character). */
export type GmCharacter = Omit<PlayerCharacter, 'ownerType' | 'ownerUserId'> & { ownerType: 'gm'; ownerUserId: null };

/**
 * The GM's own characters still in the campaign, oldest first (plan dec-give-a-character-to-a-player, the lead's
 * ruling of 2026-11-14): listed on the Players page after the players' rows, each with "Give to a player…".
 */
export async function loadGmCharacters(db: Db, campaignId: string): Promise<GmCharacter[] | null> {
  const { data, error } = await db
    .from('actors')
    .select('id, campaign_id, name, approval, status, level, hp_max, backstory, fields, portrait_asset_id, company_id, created_at, classes, race_ref, creation, edited_fields, review_sections, weapon_skills')
    .eq('campaign_id', campaignId)
    .eq('kind', 'pc')
    .eq('owner_type', 'gm');
  if (error) return null;
  const alignments = await loadAlignments(db, data.map((a) => a.id));
  return [...data]
    .filter((actor) => actor.status !== 'archived')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((actor) => ({
      id: actor.id,
      campaignId: actor.campaign_id,
      ownerType: 'gm' as const,
      ownerUserId: null,
      name: actor.name,
      approval: actor.approval as Approval,
      active: false,
      archived: false,
      level: actor.level,
      hpMax: actor.hp_max,
      backstory: actor.backstory,
      fields: withAlignment(actor.fields, alignments.get(actor.id)),
      portraitAssetId: actor.portrait_asset_id,
      companyId: actor.company_id,
      classRef: firstClassRef(actor.classes),
      raceRef: actor.race_ref,
      creation: actor.creation,
      editedFields: actor.edited_fields ?? [],
      reviewSections: actor.review_sections ?? [],
      weaponSkills: actor.weapon_skills ?? [],
    }));
}

/**
 * The characters with a spell prepared, by id (character_play.prepared): with the class's casting, what gives a
 * character a Magic tab (`hasSpells`), so the Players row offers Magic only to them (tfg-2, pg32-1). Empty if unread.
 */
export async function loadPreparedIds(db: Db, campaignId: string): Promise<ReadonlySet<string>> {
  const { data, error } = await db.from('character_play').select('actor_id, prepared').eq('campaign_id', campaignId);
  if (error || !data) return new Set();
  return new Set(data.filter((row) => Array.isArray(row.prepared) && row.prepared.length > 0).map((row) => row.actor_id));
}

/**
 * Whose a character on the Players page is now, for the GM's view of it (pg32-7): a player's (their name), the GM's
 * own (`player: null`), or gone from the campaign (removed to the archive, or deleted).
 */
export function whoseIs(characterId: string, players: readonly Player[], gmCharacters: readonly GmCharacter[]): { player: string | null } | 'gone' {
  const owner = players.find((p) => p.characters.some((c) => c.id === characterId && !c.archived));
  if (owner) return { player: owner.name };
  return gmCharacters.some((c) => c.id === characterId) ? { player: null } : 'gone';
}

/** "Wren (active) · Old Tobin (waiting for approval)", or "No character yet". Archived characters aren't listed. */
export function charactersLine(characters: PlayerCharacter[]): string {
  const shown = characters.filter((character) => !character.archived);
  if (shown.length === 0) return 'No character yet';
  return shown.map(characterLabel).join(', ');
}
