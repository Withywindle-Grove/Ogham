// The signed-in player's own characters in one campaign, for their campaign page.
import type { Db } from './supabase.ts';
import { loadAlignments, withAlignment } from './alignments.ts';

export type Approval = 'draft' | 'pending' | 'approved' | 'rejected';

export interface MyCharacter {
  id: string;
  campaignId: string;
  ownerType: 'user' | 'party' | 'gm';
  ownerUserId: string | null;
  approval: Approval;
  name: string;
  level: number;
  hpCurrent: number | null;
  hpMax: number | null;
  backstory: string;
  /** The GM's note when they sent it back. */
  reviewNote: string;
  /** The review sections the GM ticked when sending it back (B18). */
  reviewSections: string[];
  active: boolean;
  /** Removed from the campaign but kept; only the GM can restore it. */
  archived: boolean;
  /** Values for the campaign's character fields, by key. */
  fields: unknown;
  portraitAssetId: string | null;
  companyId: string | null;
  /** From guided creation (M4b): the class (one in R1 screens), the race, how it was made, and fields edited by hand. */
  classRef: string | null;
  raceRef: string | null;
  creation: unknown;
  editedFields: string[];
  /** The spell book's spell ids (m5b-0c, cr-13) and the weapon skills picked, as stored: the creation review reads them. */
  spellBook: unknown;
  weaponSkills: unknown;
  /** The expertise points spent (G-208, actors.expertise): the Expertise step and the review read them. */
  expertise?: unknown;
}

/** Oldest first. Null if they couldn't be loaded. */
export async function loadMyCharacters(db: Db, campaignId: string, userId: string): Promise<MyCharacter[] | null> {
  const [actors, member] = await Promise.all([
    db
      .from('actors')
      .select('id, campaign_id, owner_type, owner_user_id, approval, status, name, level, hp_current, hp_max, backstory, review_note, review_sections, fields, portrait_asset_id, company_id, created_at, classes, race_ref, creation, edited_fields, spell_book, weapon_skills, expertise')
      .eq('campaign_id', campaignId)
      .eq('kind', 'pc')
      .eq('owner_user_id', userId),
    db.from('members').select('active_actor_id').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle(),
  ]);
  if (actors.error || member.error) return null;
  const alignments = await loadAlignments(db, actors.data.map((a) => a.id));
  return [...actors.data]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      ownerType: row.owner_type as MyCharacter['ownerType'],
      ownerUserId: row.owner_user_id,
      approval: row.approval as Approval,
      name: row.name,
      level: row.level,
      hpCurrent: row.hp_current,
      hpMax: row.hp_max,
      backstory: row.backstory,
      reviewNote: row.review_note,
      reviewSections: row.review_sections ?? [],
      active: row.id === member.data?.active_actor_id,
      archived: row.status === 'archived',
      fields: withAlignment(row.fields, alignments.get(row.id)),
      portraitAssetId: row.portrait_asset_id,
      companyId: row.company_id,
      classRef: Array.isArray(row.classes) && typeof (row.classes[0] as { classRef?: unknown } | undefined)?.classRef === 'string' ? ((row.classes[0] as { classRef: string }).classRef) : null,
      raceRef: row.race_ref,
      creation: row.creation,
      editedFields: row.edited_fields ?? [],
      spellBook: row.spell_book ?? [],
      weaponSkills: row.weapon_skills ?? [],
      expertise: row.expertise ?? {},
    }));
}

/** The id of the player's active character in the campaign; null with none, or if it couldn't be read. */
export async function loadActiveCharacterId(db: Db, campaignId: string, userId: string): Promise<string | null> {
  const member = await db.from('members').select('active_actor_id').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle();
  return member.error ? null : (member.data?.active_actor_id ?? null);
}

/**
 * Who sent this character back, and when (22-G5's author line): the GM's chosen name (null when they never chose one,
 * so the front of an email is never shown, nm-1) and the time of the newest send-back line in the log that was not
 * undone. Null with none, or if the log couldn't be read.
 */
export async function loadSentBackBy(db: Db, characterId: string): Promise<{ name: string | null; at: string } | null> {
  const { data, error } = await db
    .from('events')
    .select('id, actor_user_id, after, created_at, seq, reverts_event_id')
    .eq('type', 'character.review')
    .eq('target_table', 'actors')
    .eq('target_id', characterId)
    .order('seq', { ascending: false });
  if (error || !data) return null;
  const rows = data as { id: string; actor_user_id: string | null; after: Record<string, unknown> | null; created_at: string; reverts_event_id: string | null }[];
  const reverted = rows.length > 0 ? await db.from('events').select('reverts_event_id').in('reverts_event_id', rows.map((r) => r.id)) : null;
  const undone = new Set(((reverted?.data ?? []) as { reverts_event_id: string }[]).map((e) => e.reverts_event_id));
  const line = rows.find((r) => !r.reverts_event_id && !undone.has(r.id) && r.after?.approval === 'rejected');
  if (!line) return null;
  if (!line.actor_user_id) return { name: null, at: line.created_at };
  const profile = await db.from('profiles').select('display_name, named_at').eq('id', line.actor_user_id).maybeSingle();
  const named = !profile.error && profile.data && profile.data.named_at !== null ? profile.data.display_name.trim() : '';
  return { name: named || null, at: line.created_at };
}

/** Reads a typed HP max: blank means "not yet" (undefined); otherwise a whole number of at least 1, or null if it isn't one. */
export function parseHpMax(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 ? value : null;
}
