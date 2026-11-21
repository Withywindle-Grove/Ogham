// Character commands: create, edit, approve or reject, resubmit, assign to a company.
// Permission rules mirror the database's access rules (supabase/migrations, docs/03-roles-permissions.md).
import {
  defineCommand,
  failed,
  fromWrite,
  isGm,
  isMember,
  type BaseRole,
  type CommandResult,
  type CurrentUser,
} from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { cleanFieldValues, loadFieldDefinitions, type FieldValues } from './fields.ts';
import { removeAssetFile } from '../../core/files.ts';
import { ALLOWED_PREFIX } from '../../core/events.ts';
import { cleanDetails, DETAILS_KEY, detailsEmpty, type CharacterDetails } from './kindredTables.ts';

export const ACTOR_KINDS = ['pc', 'hireling', 'animal', 'vehicle', 'npc', 'monster'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/** What players may create: their characters and companions. NPCs and monsters are the GM's. */
export const PLAYER_KINDS: readonly ActorKind[] = ['pc', 'hireling', 'animal', 'vehicle'];

/** 'draft': a guided character not sent to the GM yet (ruled 2026-10-26); the GM doesn't see it. */
export type Approval = 'draft' | 'pending' | 'approved' | 'rejected';

/** The parts of a character the permission rules look at. */
export interface CharacterRef {
  id: string;
  campaignId: string;
  ownerType: 'user' | 'party' | 'gm';
  ownerUserId: string | null;
  approval: Approval;
  /** Removed from the campaign but kept (status "archived"); only the GM can restore or delete it. */
  archived: boolean;
}

export function toCharacterRef(row: {
  id: string;
  campaign_id: string;
  owner_type: string;
  owner_user_id: string | null;
  approval: string;
  status: string;
}): CharacterRef {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ownerType: row.owner_type as CharacterRef['ownerType'],
    ownerUserId: row.owner_user_id,
    approval: row.approval as Approval,
    archived: row.status === 'archived',
  };
}

const REF_COLUMNS = 'id, campaign_id, owner_type, owner_user_id, approval, status';

/** The GM using a player's own power on that player's character: a GM ruling (fiat), logged with its seal. */
export function gmRuling(user: CurrentUser, character: CharacterRef): boolean {
  return character.ownerType === 'user' && character.ownerUserId !== user.id && isGm(user, character.campaignId);
}

export function isOwner(user: CurrentUser, character: CharacterRef): boolean {
  return character.ownerType === 'user' && character.ownerUserId === user.id && isMember(user, character.campaignId);
}

async function refResult(
  write: PromiseLike<{ data: Parameters<typeof toCharacterRef>[0][] | null; error: Parameters<typeof fromWrite>[0]['error'] }>,
): Promise<CommandResult<CharacterRef>> {
  const result = fromWrite(await write);
  return result.ok ? { ok: true, value: toCharacterRef(result.value) } : result;
}

const isWholeAtLeastOne = (value: number) => Number.isInteger(value) && value >= 1;

const asRecord = (value: unknown): Record<string, Json> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json>) : {};

/**
 * Players' characters start pending and belong to them; the GM's are approved and GM-owned.
 * The player chooses the starting level (default 1), then HP max for it (optional); current HP starts equal to it.
 */
export const createCharacter = defineCommand({
  name: 'character.create',
  target: (input: {
    campaignId: string;
    kind: ActorKind;
    name: string;
    level?: number;
    hpMax?: number;
    backstory?: string;
    /** Values for the campaign's character fields, by key. */
    fields?: FieldValues;
    /** From guided creation (M4b): the class (one in R1 screens) and race picked from the setting rules. */
    classRef?: string;
    raceRef?: string | null;
    /**
     * The class's experience to start with (cs-13): above level 1, the minimum its class needs for the level
     * (startingXp.ts); absent, 0. Kept on the class's entry, beside its level.
     */
    xp?: number;
    /** How it was made: the method and the scores as rolled (ruled 2026-10-25), for the GM's review. */
    creation?: { method: string | null; rolled: Record<string, number>; scores?: Record<string, number> };
    /** Fields the setting filled that the player changed by hand. */
    editedFields?: string[];
    /** Saved as a draft the GM doesn't see, sent later from the review (guided creation, ruled 2026-10-26). */
    draft?: boolean;
  }) => ({
    campaignId: input.campaignId,
    kind: input.kind,
  }),
  allowed: (user, target) =>
    isGm(user, target.campaignId) || (isMember(user, target.campaignId) && PLAYER_KINDS.includes(target.kind)),
  run: async (db, user, input) => {
    if (!input.name.trim()) return failed<CharacterRef>('Give your character a name.');
    if (input.level !== undefined && !isWholeAtLeastOne(input.level)) {
      return failed<CharacterRef>('Level must be a whole number of at least 1.');
    }
    if (input.hpMax !== undefined && !isWholeAtLeastOne(input.hpMax)) {
      return failed<CharacterRef>('HP max must be a whole number of at least 1.');
    }
    if (input.xp !== undefined && !(Number.isInteger(input.xp) && input.xp >= 0)) {
      return failed<CharacterRef>('Experience must be a whole number of at least 0.');
    }
    let fields: FieldValues = {};
    if (input.fields && Object.keys(input.fields).length > 0) {
      const checked = await checkFields(db, input.campaignId, input.fields);
      if (!checked.ok) return failed<CharacterRef>(checked.message);
      fields = checked.values;
    }
    const gm = isGm(user, input.campaignId);
    return refResult(
      db
        .from('actors')
        .insert({
          campaign_id: input.campaignId,
          kind: input.kind,
          name: input.name.trim(),
          owner_type: gm ? 'gm' : 'user',
          owner_user_id: gm ? null : user.id,
          approval: gm ? 'approved' : input.draft ? 'draft' : 'pending',
          level: input.level ?? 1,
          hp_max: input.hpMax ?? null,
          hp_current: input.hpMax ?? null,
          backstory: input.backstory?.trim() ?? '',
          fields,
          classes: input.classRef ? [{ classRef: input.classRef, level: input.level ?? 1, xp: input.xp ?? 0 }] : [],
          race_ref: input.raceRef ?? null,
          creation: input.creation ?? {},
          edited_fields: input.editedFields ?? [],
        })
        .select(REF_COLUMNS),
    );
  },
});

export interface CharacterChanges {
  /** How it was made (guided creation): the starting gear adds what was spent, once (ruled 2026-10-25). */
  creation?: Record<string, unknown>;
  name?: string;
  /** Players may change it while the character is waiting or sent back; once approved, only the GM. */
  level?: number;
  hpCurrent?: number | null;
  hpMax?: number | null;
  backstory?: string;
  notes?: string;
  /** The values for every visible field (an empty or missing one is cleared); hidden fields' values are kept. */
  fields?: FieldValues;
  /**
   * One field's value, the others left as they are on the character (the sheet's Edit saves one detail at a time,
   * plan m5b-sheet-revised B5); '' or false clears it.
   */
  field?: {
    key: string;
    value: string | boolean;
    /**
     * The hand-edit mark (mv-2): `true` marks the field in `edited_fields` as typed by hand (an emptied value takes
     * the mark off), `false` takes it off (Undo of an edit that set it); left out, the marks stay as they are.
     */
    mark?: boolean;
  };
  /**
   * The details from the kindred's tables (cs-1: detail rows, age, height, weight, growth), kept on the fields under
   * `_details` (no campaign field uses it); the owner changes them any time, as a field. Replaces what was there.
   */
  details?: CharacterDetails;
  editedFields?: string[];
  /** Weapon skills (M5b-0b): the owner freely before approval, then only adding; the GM always (the database checks). */
  weaponSkills?: { itemId: string; specialised?: true }[];
  /**
   * Expertise points (G-208, ex-2; expertise.ts): `{ "<class skill code>": <points ≥ 1> }`, the whole set, a skill with
   * no points left out. The owner freely before approval, then only adding; the GM always (the database checks).
   */
  expertise?: Record<string, number>;
}

async function checkFields(db: Db, campaignId: string, values: FieldValues) {
  const definitions = await loadFieldDefinitions(db, campaignId);
  if (!definitions) return { ok: false as const, message: "Couldn't check the campaign's fields. Try again." };
  return cleanFieldValues(definitions, values);
}

/**
 * Whether a change touches the rules set's own figures (Design, 2026-11-08 on #567): Max HP, the level, or one of the
 * pack's scores (`scoreKeys`, the fields that hold them, when the caller knows them). Once a character is approved only
 * the GM changes them; a player asks (sheet.requestChange). A full field set is checked by the database, which knows
 * what changed (private.guard_rules_figures).
 */
export function touchesRulesFigures(changes: CharacterChanges, scoreKeys: readonly string[] = []): boolean {
  if (changes.hpMax !== undefined || changes.level !== undefined) return true;
  if (changes.field && scoreKeys.includes(changes.field.key)) return true;
  return !!changes.fields && Object.keys(changes.fields).some((k) => scoreKeys.includes(k));
}

/**
 * What's wrong with expertise points as saved (actors.expertise), in the database's own limits
 * (20261120100000_g208_expertise.sql): at most 40 skills, each under a code of 1 to 40 characters, with a whole number
 * of points from 1 to 99. Null when they're well formed.
 */
function expertiseProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'Each skill takes a whole number of points, from 1 to 99.';
  const entries = Object.entries(value);
  if (entries.length > 40 || entries.some(([code]) => code.trim() === '' || code.length > 40)) return "Each skill's points are kept under a short skill code.";
  if (!entries.every(([, points]) => typeof points === 'number' && isWholeAtLeastOne(points) && points <= 99)) return 'Each skill takes a whole number of points, from 1 to 99.';
  return null;
}

export const editCharacter = defineCommand({
  name: 'character.edit',
  target: (input: { character: CharacterRef; changes: CharacterChanges; scoreKeys?: readonly string[] }) => ({
    ...input.character,
    rulesFigures: touchesRulesFigures(input.changes, input.scoreKeys),
  }),
  allowed: (user, character: CharacterRef & { rulesFigures: boolean }) =>
    isGm(user, character.campaignId) || (isOwner(user, character) && !(character.approval === 'approved' && character.rulesFigures)),
  fiat: gmRuling,
  run: async (db, _user, input) => {
    const { changes } = input;
    for (const hp of [changes.hpCurrent, changes.hpMax]) {
      if (hp !== undefined && hp !== null && !Number.isInteger(hp)) {
        return failed<CharacterRef>('HP must be a whole number.');
      }
    }
    if (changes.level !== undefined && !isWholeAtLeastOne(changes.level)) {
      return failed<CharacterRef>('Level must be a whole number of at least 1.');
    }
    const expertiseWrong = changes.expertise === undefined ? null : expertiseProblem(changes.expertise);
    if (expertiseWrong) return failed<CharacterRef>(expertiseWrong);
    let fields: Json | undefined;
    let markedFields: string[] | undefined;
    if (changes.fields !== undefined) {
      const definitions = await loadFieldDefinitions(db, input.character.campaignId);
      if (!definitions) return failed<CharacterRef>("Couldn't check the campaign's fields. Try again.");
      const checked = cleanFieldValues(definitions, changes.fields);
      if (!checked.ok) return failed<CharacterRef>(checked.message);
      const current = await db.from('actors').select('fields').eq('id', input.character.id).maybeSingle();
      if (current.error) return failed<CharacterRef>(current.error.message);
      // Keep values of hidden fields (and anything else not on the form); replace the visible ones.
      const visible = new Set(definitions.filter((f) => !f.hidden).map((f) => f.key));
      const kept = Object.entries(asRecord(current.data?.fields)).filter(([key]) => !visible.has(key));
      fields = { ...Object.fromEntries(kept), ...checked.values } as Json;
    }
    if (changes.field !== undefined) {
      // One field onto the fields as just worked out, else as saved: every other key stays as it is.
      const definitions = await loadFieldDefinitions(db, input.character.campaignId);
      if (!definitions) return failed<CharacterRef>("Couldn't check the campaign's fields. Try again.");
      const checked = cleanFieldValues(definitions, { [changes.field.key]: changes.field.value });
      if (!checked.ok) return failed<CharacterRef>(checked.message);
      let base = fields;
      if (base === undefined) {
        const current = await db.from('actors').select('fields').eq('id', input.character.id).maybeSingle();
        if (current.error) return failed<CharacterRef>(current.error.message);
        base = asRecord(current.data?.fields) as Json;
      }
      const next = { ...asRecord(base) };
      delete next[changes.field.key];
      const value = checked.values[changes.field.key];
      fields = (value === undefined ? next : { ...next, [changes.field.key]: value }) as Json;
      if (changes.field.mark !== undefined && changes.editedFields === undefined) {
        const current = await db.from('actors').select('edited_fields').eq('id', input.character.id).maybeSingle();
        if (current.error) return failed<CharacterRef>(current.error.message);
        const key = changes.field.key;
        const was = (current.data?.edited_fields ?? []).filter((k) => k !== key);
        markedFields = changes.field.mark && value !== undefined ? [...was, key] : was;
      }
    }
    if (changes.details !== undefined) {
      // Onto the fields as just worked out, else as saved: every other key stays.
      let base = fields;
      if (base === undefined) {
        const current = await db.from('actors').select('fields').eq('id', input.character.id).maybeSingle();
        if (current.error) return failed<CharacterRef>(current.error.message);
        base = asRecord(current.data?.fields);
      }
      const details = cleanDetails(changes.details);
      const rest = { ...asRecord(base) };
      delete rest[DETAILS_KEY];
      fields = (detailsEmpty(details) ? rest : { ...rest, [DETAILS_KEY]: details }) as unknown as Json;
    }
    const patch: {
      name?: string;
      level?: number;
      hp_current?: number | null;
      hp_max?: number | null;
      backstory?: string;
      notes?: string;
      fields?: Json;
      edited_fields?: string[];
      creation?: Json;
      weapon_skills?: Json;
      expertise?: Json;
    } = {};
    if (changes.creation !== undefined) patch.creation = changes.creation as Json;
    if (changes.name !== undefined) patch.name = changes.name.trim();
    if (changes.level !== undefined) patch.level = changes.level;
    if (changes.hpCurrent !== undefined) patch.hp_current = changes.hpCurrent;
    if (changes.hpMax !== undefined) patch.hp_max = changes.hpMax;
    if (changes.backstory !== undefined) patch.backstory = changes.backstory;
    if (changes.notes !== undefined) patch.notes = changes.notes;
    if (fields !== undefined) patch.fields = fields;
    if (changes.editedFields !== undefined) patch.edited_fields = changes.editedFields;
    else if (markedFields !== undefined) patch.edited_fields = markedFields;
    if (changes.weaponSkills !== undefined) patch.weapon_skills = changes.weaponSkills as unknown as Json;
    if (changes.expertise !== undefined) patch.expertise = changes.expertise as Json;
    return refResult(db.from('actors').update(patch).eq('id', input.character.id).select(REF_COLUMNS));
  },
});

export type Review =
  /** `allowed`: the exceptions the GM allowed on the card (final drafts D), named in the log line through the review note. */
  | { character: CharacterRef; decision: 'approved'; hpMax?: number; allowed?: string[] }
  /** `sections`: the review sections the GM ticked as needing work (B18, ruled 2026-10-25). */
  | { character: CharacterRef; decision: 'rejected'; note?: string; sections?: string[] }
  /** "Ask for a different level" (ruled 2026-10-25): sent back at that level, HP to be entered again. */
  | { character: CharacterRef; decision: 'level'; level: number; note?: string; sections?: string[] };

/** "Croak and Starting coin 190": the exceptions an approval allowed, in words. */
const allowedWords = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`);

const ticked = (sections: string[] | undefined) => [...new Set((sections ?? []).map((s) => s.trim()).filter((s) => s && s.length <= 20))].slice(0, 12);

/**
 * The GM approves a character at the level the player chose (and may fill in an empty HP max),
 * or sends it back with a note. A player's first approved character becomes their active one (the database does this).
 */
export const reviewCharacter = defineCommand({
  name: 'character.review',
  target: (input: Review) => input.character,
  allowed: (user, character) => isGm(user, character.campaignId),
  run: (db, _user, input) => {
    if (input.decision === 'level') {
      if (!isWholeAtLeastOne(input.level)) return Promise.resolve(failed<CharacterRef>('Level must be a whole number of at least 1.'));
      const asked = `Your GM asks for level ${input.level}.${input.note?.trim() ? ` ${input.note.trim()}` : ''}`;
      return refResult(
        db
          .from('actors')
          .update({ approval: 'rejected', level: input.level, review_note: asked.slice(0, 1000), review_sections: ticked(input.sections), hp_max: null, hp_current: null })
          .eq('id', input.character.id)
          .select(REF_COLUMNS),
      );
    }
    if (input.decision === 'rejected') {
      return refResult(
        db
          .from('actors')
          .update({ approval: 'rejected', review_note: input.note?.trim() ?? '', review_sections: ticked(input.sections) })
          .eq('id', input.character.id)
          .select(REF_COLUMNS),
      );
    }
    if (input.hpMax !== undefined && !isWholeAtLeastOne(input.hpMax)) {
      return Promise.resolve(failed<CharacterRef>('HP max must be a whole number of at least 1.'));
    }
    const patch: { approval: 'approved'; review_sections: string[]; hp_max?: number; hp_current?: number; review_note?: string } = { approval: 'approved', review_sections: [] };
    const allowed = (input.allowed ?? []).map((a) => a.trim()).filter(Boolean);
    if (allowed.length > 0) patch.review_note = `${ALLOWED_PREFIX}${allowedWords(allowed)}`.slice(0, 1000);
    if (input.hpMax !== undefined) {
      patch.hp_max = input.hpMax;
      patch.hp_current = input.hpMax;
    }
    return refResult(db.from('actors').update(patch).eq('id', input.character.id).select(REF_COLUMNS));
  },
});

/** A player sends a rejected character back to the GM. */
export const resubmitCharacter = defineCommand({
  name: 'character.resubmit',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) => isOwner(user, character) && character.approval === 'rejected',
  run: (db, _user, input) =>
    refResult(db.from('actors').update({ approval: 'pending' }).eq('id', input.character.id).select(REF_COLUMNS)),
});

/**
 * A player sends their draft to the GM, from the review (ruled 2026-10-26). It waits for approval, or joins at once
 * when the campaign says so (the database decides, by the same rules as a new character).
 */
export const sendCharacter = defineCommand({
  name: 'character.send',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) => isOwner(user, character) && character.approval === 'draft',
  run: (db, _user, input) =>
    refResult(db.from('actors').update({ approval: 'pending' }).eq('id', input.character.id).select(REF_COLUMNS)),
});

export const assignCompany = defineCommand({
  name: 'character.assignCompany',
  target: (input: { character: CharacterRef; companyId: string | null }) => input.character,
  // Any current character, approved or not; an archived one keeps its company.
  allowed: (user, character) => !character.archived && isGm(user, character.campaignId),
  run: (db, _user, input) =>
    refResult(db.from('actors').update({ company_id: input.companyId }).eq('id', input.character.id).select(REF_COLUMNS)),
});

/**
 * Removing a character, split by whether it ever entered play (hard rule 4, with documented exceptions):
 * - never approved (waiting or sent back): its owner or the GM deletes it for good;
 * - approved: its owner or the GM archives it (kept, hidden, not active); only the GM restores it.
 *   Its owner or the GM can then delete the archived character permanently (revisit once the event log exists).
 */
export const deleteCharacter = defineCommand({
  name: 'character.delete',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) =>
    (character.approval !== 'approved' || character.archived) &&
    (isGm(user, character.campaignId) || isOwner(user, character)),
  run: async (db, _user, input) => {
    const before = await db.from('actors').select('portrait_asset_id').eq('id', input.character.id).maybeSingle();
    const result = await refResult(db.from('actors').delete().eq('id', input.character.id).select(REF_COLUMNS));
    // A deleted character's picture goes too (best effort; a picture the GM uploaded is only removable by the GM).
    const portrait = before.data?.portrait_asset_id;
    if (result.ok && portrait) await removeAssetFile(db, input.character.campaignId, portrait);
    return result;
  },
});

export const archiveCharacter = defineCommand({
  name: 'character.archive',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) =>
    character.approval === 'approved' &&
    !character.archived &&
    (isGm(user, character.campaignId) || isOwner(user, character)),
  run: (db, _user, input) =>
    refResult(db.from('actors').update({ status: 'archived' }).eq('id', input.character.id).select(REF_COLUMNS)),
});

export const restoreCharacter = defineCommand({
  name: 'character.restore',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) => character.archived && isGm(user, character.campaignId),
  run: (db, _user, input) =>
    refResult(db.from('actors').update({ status: 'active' }).eq('id', input.character.id).select(REF_COLUMNS)),
});

/**
 * Who a character is given to (gp-1, gp-5): a member of its campaign with the player's role (their user id and their
 * role there, as the GM's Players page reads them; `role` null when they are not a member), or the GM himself
 * (`userId` null): it is the GM's own again.
 */
export interface GiveTo {
  userId: string | null;
  role: BaseRole | null;
}

/**
 * Whether a character may go to this person: a player of its campaign, or the GM when a player has it; never to whoever
 * has it now. A party-owned character (a party hireling) is never given: the database lets a give set only 'user' or
 * 'gm' as the new owner type, so Undo of it (which hands the owner type back) would be refused.
 */
export function mayGiveTo(character: CharacterRef, to: GiveTo): boolean {
  if (character.ownerType === 'party') return false;
  if (to.userId === null) return character.ownerType === 'user';
  if (to.role !== 'player') return false;
  return !(character.ownerType === 'user' && character.ownerUserId === to.userId);
}

/**
 * The GM gives a character to a player, or takes it back (plan dec-give-a-character-to-a-player, gp-1 to gp-6). At
 * once, with Undo (the log's own, which moves the owner only, gp-6). The character stays approved; the database makes
 * it the player's in play when they have none, and takes it out of play for whoever had it
 * (supabase/migrations/20261114120000_dec_give_character_reassign.sql).
 */
export const reassignCharacter = defineCommand({
  name: 'character.reassign',
  target: (input: { character: CharacterRef; to: GiveTo }) => ({ ...input.character, to: input.to }),
  allowed: (user, target: CharacterRef & { to: GiveTo }) =>
    isGm(user, target.campaignId) && target.approval === 'approved' && !target.archived && mayGiveTo(target, target.to),
  run: (db, _user, input) =>
    refResult(
      db
        .from('actors')
        .update(
          input.to.userId === null
            ? { owner_type: 'gm', owner_user_id: null }
            : { owner_type: 'user', owner_user_id: input.to.userId },
        )
        .eq('id', input.character.id)
        .select(REF_COLUMNS),
    ),
});
