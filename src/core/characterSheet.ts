// One character's full sheet, for its owner or the GM.
import type { Approval } from './myCharacters.ts';
import type { Db } from './supabase.ts';
import { loadAlignments, withAlignment } from './alignments.ts';

export interface SheetCharacter {
  id: string;
  campaignId: string;
  ownerType: 'user' | 'party' | 'gm';
  ownerUserId: string | null;
  approval: Approval;
  /** Removed from the campaign but kept. */
  archived: boolean;
  name: string;
  level: number;
  hpCurrent: number | null;
  hpMax: number | null;
  backstory: string;
  notes: string;
  /** Values for the campaign's character fields, by key. */
  fields: unknown;
  portraitAssetId: string | null;
  companyId: string | null;
  /** From the setting rules (M4b): the class (one in R1 screens) and race, and how it was made. */
  classRef: string | null;
  raceRef: string | null;
  creation: unknown;
  /** The weapons picked under the setting's weapon proficiency (M5b-0b). */
  weaponSkills: unknown;
  /** The expertise points spent (G-208, actors.expertise): the skills' figures, their pop-up's line and To finish read them. */
  expertise?: unknown;
  /** The first class's XP ([{classRef, level, xp}]), for the Level tile's caption (sr-1); null when not recorded. */
  xp?: number | null;
  /** The spell book's ids as saved (`spellBookOf` reads it), for the Magic section (sr-4). */
  spellBook?: unknown;
  /** The fields typed by hand over what the setting gives (mv-2: a speed counts as written only when marked here). */
  editedFields?: string[];
}

/** Null if the character can't be seen (or couldn't be loaded). */
export async function loadCharacterSheet(db: Db, characterId: string): Promise<SheetCharacter | null> {
  const { data, error } = await db
    .from('actors')
    .select(
      'id, campaign_id, owner_type, owner_user_id, approval, status, name, level, hp_current, hp_max, backstory, notes, fields, portrait_asset_id, company_id, classes, race_ref, creation, weapon_skills, expertise, spell_book, edited_fields',
    )
    .eq('id', characterId)
    .maybeSingle();
  if (error || !data) return null;
  const alignments = await loadAlignments(db, [data.id]);
  return {
    id: data.id,
    campaignId: data.campaign_id,
    ownerType: data.owner_type as SheetCharacter['ownerType'],
    ownerUserId: data.owner_user_id,
    approval: data.approval as Approval,
    archived: data.status === 'archived',
    name: data.name,
    level: data.level,
    hpCurrent: data.hp_current,
    hpMax: data.hp_max,
    backstory: data.backstory,
    notes: data.notes,
    fields: withAlignment(data.fields, alignments.get(data.id)),
    portraitAssetId: data.portrait_asset_id,
    companyId: data.company_id,
    classRef: firstClass(data.classes),
    raceRef: data.race_ref,
    creation: data.creation,
    weaponSkills: data.weapon_skills,
    expertise: data.expertise ?? {},
    xp: firstClassXp(data.classes),
    spellBook: data.spell_book,
    editedFields: data.edited_fields ?? [],
  };
}

/** The first class's id from a character's class list ([{classRef, level, xp}]); R1 screens show one. */
function firstClass(classes: unknown): string | null {
  const first = Array.isArray(classes) ? (classes[0] as { classRef?: unknown } | undefined) : undefined;
  return typeof first?.classRef === 'string' ? first.classRef : null;
}

/** The first class's XP, or null when it isn't a number. */
function firstClassXp(classes: unknown): number | null {
  const first = Array.isArray(classes) ? (classes[0] as { xp?: unknown } | undefined) : undefined;
  return typeof first?.xp === 'number' && Number.isFinite(first.xp) ? first.xp : null;
}

/** A character's creation record as saved now (for the To finish list, M5b step 0); null when it can't be read. */
export async function loadCreationRecord(db: Db, characterId: string): Promise<{ creation: unknown } | null> {
  const { data, error } = await db.from('actors').select('creation').eq('id', characterId).maybeSingle();
  return error || !data ? null : { creation: data.creation };
}

/** A character's expertise points as saved now (G-208; Decide later writes only a change); null when they can't be read. */
export async function loadSavedExpertise(db: Db, characterId: string): Promise<{ expertise: unknown } | null> {
  const { data, error } = await db.from('actors').select('expertise').eq('id', characterId).maybeSingle();
  return error || !data ? null : { expertise: data.expertise };
}
