// The patron's part of a character, worked out from the campaign's setting (December 1a; plans/dec-1-creation.md 1a):
// the patron its creation record names, the highest spell level it casts now (from the class's spells a day), and so
// the garb its pack is given free and the marks its sheet shows. One place, so the Gear step, the sheet and the
// Player screen agree.
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { garbItemIds, garbWordsById, patronKept, patronOf, topSpellLevel, type ClassListOf, type Patron } from '../modules/characters/patrons.ts';
import { slotsOf } from '../modules/characters/playState.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import { settingFills } from './fromSetting.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The patron a creation record names, as the campaign's setting has it now; null without one, when no attached pack
 * has it any more, or while its option is off (pt-9: hidden everywhere, kept on the record, back when switched on).
 */
export function patronInSetting(setting: Pick<CampaignSetting, 'all'>, creation: unknown): Patron | null {
  return patronOf(
    creation,
    setting.all.filter((e) => e.kind === 'patron'),
  );
}

/**
 * A creation record as the screens show it (pt-9, hide and keep, 2026-11-12): while the patron it names is switched off
 * by its option, without the patron and without the patron's special approval; the record itself is never changed.
 * Unchanged otherwise (a patron in play, none, or one whose pack is no longer attached: that one is still named).
 */
export function creationShown(setting: Pick<CampaignSetting, 'all'> | null, creation: unknown): unknown {
  if (!setting || !isRecord(creation) || !patronKept(creation, setting.all.filter((e) => e.kind === 'patron'))) return creation;
  const shown: Record<string, unknown> = { ...creation };
  delete shown.patron;
  const left = (Array.isArray(creation.specialApprovals) ? creation.specialApprovals : []).filter((s) => !(isRecord(s) && s.step === 'patron'));
  if (left.length > 0) shown.specialApprovals = left;
  else delete shown.specialApprovals;
  return shown;
}

/**
 * The holy garb a character's patron gives free at this level (every tier reached): the patron and the item ids; null
 * without a patron. While the patron's option is off (`kept`): its id and no items, so the Gear step gives nothing
 * more and takes nothing back (pt-9: garb already held stays in the pack).
 */
export function patronGarbFor(
  setting: CampaignSetting,
  creation: unknown,
  who: { level: number; classRef: string | null; raceRef: string | null },
  fieldDefs: readonly FieldDefinition[],
): { id: string; name: string; itemIds: string[]; words: Map<string, string>; kept?: true } | null {
  const patron = patronInSetting(setting, creation);
  if (!patron) {
    const hidden = patronKept(creation, setting.all.filter((e) => e.kind === 'patron'));
    return hidden ? { id: hidden.id, name: hidden.name, itemIds: [], words: new Map(), kept: true } : null;
  }
  const record = isRecord(creation) ? creation : {};
  const scores = Object.fromEntries(Object.entries(isRecord(record.scores) ? record.scores : {}).filter((pair): pair is [string, number] => typeof pair[1] === 'number'));
  const { filled } = settingFills(setting, { level: who.level, scores, classRef: who.classRef, raceRef: who.raceRef }, fieldDefs);
  const spellLevel = topSpellLevel(slotsOf(filled));
  return { id: patron.id, name: patron.name, itemIds: garbItemIds(patron, spellLevel), words: garbWordsById(patron, spellLevel) };
}

/** The spell list each attached class casts from (its `spellcasting.listId`), for the lead's ruling B: swaps reach the classes on the list `extends` names. */
export function classListOf(setting: Pick<CampaignSetting, 'all'>): ClassListOf {
  return (classId) => {
    const casting = setting.all.find((e) => e.kind === 'class' && e.packEntryId === classId)?.data.spellcasting;
    return isRecord(casting) && typeof casting.listId === 'string' && casting.listId.trim() ? casting.listId.trim() : undefined;
  };
}

/** The patron's garb already put in the pack, as the creation record keeps it (`patronGarb: { patron, lines }`); null when none was. */
export function patronGarbGiven(record: unknown): { patron: string; lines: { id: string; qty: number }[]; items: string[] } | null {
  const saved = isRecord(record) && isRecord(record.patronGarb) ? record.patronGarb : null;
  if (!saved || typeof saved.patron !== 'string') return null;
  const lines = (Array.isArray(saved.lines) ? saved.lines : []).flatMap((l) => (isRecord(l) && typeof l.id === 'string' && Number.isInteger(l.qty) ? [{ id: l.id, qty: l.qty as number }] : []));
  // `items`: the item ids given so far, so one this device couldn't read is given when it can (never one twice).
  return { patron: saved.patron, lines, items: Array.isArray(saved.items) ? saved.items.filter((id): id is string => typeof id === 'string') : [] };
}
