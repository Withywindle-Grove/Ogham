// creation.redo (M5b step 0c, follow-up C; ruled 2026-11-02, cf-7, design/rulings/m5b-0c-creation-followups-2026-11-02.md;
// docs/04 PC extras; docs/05 Guided creation, Review): Change › on Scores, Race or Class after the draft exists. The
// re-walk keeps every value; the command then writes the new choice onto the draft. A changed race or class clears
// the picks of the steps after it: on a class change the hit points (the old class's die; ruled B 2026-11-02, Who they are is walked
// again for the roll), the spell book, the kit and shop gear (its lines deleted and the money refunded on the record;
// the Given gear stays), the weapon skills, the expertise points (a class change, G-208), the trait lists' picks and the gear they granted, and the languages the
// old race or class gave (the player's own picks stay). Scores changed with the same race and class keep
// everything and only re-check the requirements (the special-approval flags are rewritten).
//
// One request: the row's change and the lines' deletions share its request id, so the log's Undo puts everything
// back at once (the command is on the undoable-deletions list, core/undo.ts and public.undoable_deletions).
// Who: the owner of a draft (not sent yet), or the GM on any unapproved character (04: before approval the owner
// changes class, race and scores only through this command). The database's actor guard allows these columns to
// their owner before approval; the spell-book and weapon-skills guards allow the owner while it isn't approved.
import { defineCommand, failed, fromError, isGm, notAllowed, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { gmRuling, isOwner, toCharacterRef, type CharacterRef } from './commands.ts';
import { cleanFieldValues, loadFieldDefinitions, type FieldValues } from './fields.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The choice the re-walk ends with (GuidedChoice, by ids). */
export interface RedoChoice {
  classRef: string;
  raceRef: string | null;
  method: string | null;
  rolled: Record<string, number>;
  scores: Record<string, number>;
  /** The picks whose requirement isn't met, for the GM's card (ruled 2026-11-02); none clears the flags. */
  specialApprovals?: { step: string; entryId: string; name: string; requirement: string }[];
  /** The scores left at the average, never touched (final drafts A5, slice B): "the average, not rolled". */
  scoresAverage?: string[];
  /**
   * The patron picked on the Patron step (pt-10, 2026-11-12: a guided step after Class), null for none; left out by a
   * caller that doesn't walk it, the record's patron is kept as it was.
   */
  patron?: { id: string; name: string } | null;
  /** The patron put off with Decide later: "patron" on the To finish list. Read only with `patron`. */
  patronLater?: boolean;
}

export interface RedoInput {
  character: CharacterRef;
  choice: RedoChoice;
  /** The level, when the new class caps it lower. */
  level?: number;
  /**
   * Values for the campaign's visible fields to write over the saved ones: the fields that hold the scores and the
   * race; after a race or class change also each trait list's field (cleared) and the languages (the new race's and
   * class's, with the player's own picks kept). The screen works them out from the setting; hidden fields are kept.
   */
  fields?: FieldValues;
}

export interface RedoOutcome {
  character: CharacterRef;
  /** Whether the race or class changed (the later steps were cleared and are walked again). */
  changed: boolean;
  /** Whether the class changed: the hit points went with its die, and Who they are is walked again for the roll. */
  classChanged: boolean;
  /** The creation record as saved now. */
  creation: Record<string, unknown>;
}

/** Whether a choice changes the race or class of a saved character. */
export const raceOrClassChanged = (saved: { classRef: string | null; raceRef: string | null }, choice: { classRef: string; raceRef: string | null }): boolean =>
  saved.classRef !== choice.classRef || (saved.raceRef ?? null) !== (choice.raceRef ?? null);

const lineIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((l) => (isRecord(l) && typeof l.id === 'string' ? [l.id] : [])) : [];

/**
 * Pure: the creation record after the choice, and the inventory lines that go with a race or class change — the kit
 * and shop purchases' lines (`bought[].lines`) and what the trait lists granted (`traitGear.<list>`), never the Given
 * gear (`givenGear`, cf-4). The money is refunded on the record (`spentBase` 0, `bought` empty); the money roll, its
 * coin and that it was recorded stay. The To finish list and the gear's "done" mark go too: those steps are walked again.
 */
export function redoRecord(creation: unknown, choice: RedoChoice, changed: boolean, raceChanged = false): { creation: Record<string, unknown>; lines: string[] } {
  const was = isRecord(creation) ? creation : {};
  const next: Record<string, unknown> = { ...was, method: choice.method, rolled: choice.rolled, scores: choice.scores };
  // The race's and class's approvals come from the choice; the alignment's (cs-3) is Who they are's, and a language's
  // (cs-6) the Languages step's, so they stay until that step is saved again.
  // A special kit (after-test A4, step "gear") stays while the gear does: a race or class change clears the gear, so it goes too.
  // A non-class weapon's (R3-5) is the Weapon skills step's, kept until that step is saved again.
  // A patron's (December 1a) is the Patron step's (pt-10), a guided step like the class: from the choice when it carries
  // the patron; else kept, with the record's `patron`, as it was.
  const patronHere = choice.patron !== undefined;
  const ownStep = (step: unknown) => step === 'alignment' || (!patronHere && step === 'patron') || step === 'languages' || step === 'weaponSkills' || (!changed && step === 'gear');
  const kept = (Array.isArray(was.specialApprovals) ? was.specialApprovals : []).filter((s) => isRecord(s) && ownStep(s.step));
  const special = [...(choice.specialApprovals ?? []).filter((s) => !ownStep(s.step)), ...kept];
  if (special.length > 0) next.specialApprovals = special;
  else delete next.specialApprovals;
  if (choice.scoresAverage?.length) next.scoresAverage = choice.scoresAverage;
  else delete next.scoresAverage;
  if (!changed) return { creation: withPatronOf(next, choice), lines: [] };
  const bought = Array.isArray(was.bought) ? was.bought : [];
  // The kindred's trinket (cs-1) goes with its kindred: a new kindred rolls on its own table at Gear.
  const trinket = raceChanged && isRecord(was.trinket) && typeof was.trinket.lineId === 'string' ? [was.trinket.lineId] : [];
  const lines = [
    ...bought.flatMap((p) => (isRecord(p) ? lineIds(p.lines) : [])),
    ...(isRecord(was.traitGear) ? Object.values(was.traitGear).flatMap(lineIds) : []),
    ...trinket,
  ];
  if (trinket.length > 0) delete next.trinket;
  next.bought = [];
  next.spentBase = 0;
  delete next.traitGear;
  // The trait fields are cleared with a race or class change, and the spells rolled under their picks (bq3-18) go too.
  delete next.traitSpells;
  delete next.toFinish;
  delete next.gearDone;
  return { creation: withPatronOf(next, choice), lines: [...new Set(lines)] };
}

/** The record with the choice's patron (pt-10): picked, none, or put off ("patron" on the To finish list); as it was without one. */
function withPatronOf(record: Record<string, unknown>, choice: RedoChoice): Record<string, unknown> {
  if (choice.patron === undefined) return record;
  const next = { ...record };
  delete next.patron;
  if (choice.patron) next.patron = { id: choice.patron.id, name: choice.patron.name };
  const listed = (Array.isArray(next.toFinish) ? next.toFinish : []).filter((step) => step !== 'patron');
  const toFinish = !choice.patron && choice.patronLater ? [...listed, 'patron'] : listed;
  if (toFinish.length > 0) next.toFinish = toFinish;
  else delete next.toFinish;
  return next;
}

const firstClass = (classes: unknown): { classRef: string | null; xp: number } => {
  const first = Array.isArray(classes) && isRecord(classes[0]) ? classes[0] : null;
  return { classRef: typeof first?.classRef === 'string' ? first.classRef : null, xp: typeof first?.xp === 'number' ? first.xp : 0 };
};

export const redoCreation = defineCommand({
  name: 'creation.redo',
  log: 'simple',
  target: (input: RedoInput) => input.character,
  allowed: (user, character) =>
    // 04: before approval (a draft, waiting, or sent back) the owner; the GM too, while it isn't approved (the refund is a creation's).
    !character.archived && character.approval !== 'approved' && (isGm(user, character.campaignId) || isOwner(user, character)),
  fiat: gmRuling,
  run: async (db, _user, input): Promise<CommandResult<RedoOutcome>> => {
    const { character, choice } = input;
    if (!choice.classRef.trim()) return failed('Pick a class.');
    if (input.level !== undefined && !(Number.isInteger(input.level) && input.level >= 1)) return failed('Level must be a whole number of at least 1.');
    const current = await db.from('actors').select('classes, race_ref, creation, fields, level').eq('id', character.id).maybeSingle();
    if (current.error) return fromError(current.error);
    // No row: the access rules hide it (someone else's draft), the same refusal as a write would get.
    if (!current.data) return notAllowed<RedoOutcome>();
    const saved = firstClass(current.data.classes);
    const changed = raceOrClassChanged({ classRef: saved.classRef, raceRef: current.data.race_ref }, choice);
    const record = redoRecord(current.data.creation, choice, changed, (current.data.race_ref ?? null) !== (choice.raceRef ?? null));
    let fields: Json | undefined;
    if (input.fields !== undefined) {
      const definitions = await loadFieldDefinitions(db, character.campaignId);
      if (!definitions) return failed("Couldn't check the campaign's fields. Try again.");
      const checked = cleanFieldValues(definitions, input.fields);
      if (!checked.ok) return failed(checked.message);
      // A field given as empty is cleared (a trait list's pick); the rest are kept as they were.
      const cleared = Object.entries(input.fields).filter(([, value]) => value === '' || value === undefined || value === null).map(([key]) => key);
      const kept = Object.entries(isRecord(current.data.fields) ? current.data.fields : {}).filter(([key]) => !cleared.includes(key));
      fields = { ...Object.fromEntries(kept), ...checked.values } as Json;
    }
    // The lines first: a refused deletion leaves the row as it was.
    if (record.lines.length > 0) {
      const gone = await db.from('inventory_lines').delete().in('id', record.lines).eq('actor_id', character.id).select('id');
      if (gone.error) return fromError(gone.error);
    }
    const level = input.level ?? current.data.level;
    const patch: { classes: Json; race_ref: string | null; creation: Json; level: number; fields?: Json; spell_book?: Json; weapon_skills?: Json; expertise?: Json; hp_max?: null; hp_current?: null } = {
      classes: [{ classRef: choice.classRef, level, xp: saved.xp }],
      race_ref: choice.raceRef,
      creation: record.creation as Json,
      level,
    };
    if (fields !== undefined) patch.fields = fields;
    const classChanged = saved.classRef !== choice.classRef;
    if (changed) {
      patch.spell_book = [];
      patch.weapon_skills = [];
    }
    // Ruled B (2026-11-02, amended: a class change only): the hit points were the old class's die; Who they are is
    // walked again for a new roll. A changed race alone keeps them.
    if (classChanged) {
      patch.hp_max = null;
      patch.hp_current = null;
      // The expertise points were spent on the old class's skills (G-208): a new class spends its own from nothing.
      patch.expertise = {};
    }
    const written = await db.from('actors').update(patch).eq('id', character.id).select('id, campaign_id, owner_type, owner_user_id, approval, status');
    if (written.error) return fromError(written.error);
    const row = written.data?.[0];
    if (!row) return failed("You don't have permission to do that.");
    return ok({ character: toCharacterRef(row), changed, classChanged, creation: record.creation });
  },
});
