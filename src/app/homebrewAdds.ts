// Add to homebrew on the GM's review (M5b step 0c, follow-up C; cf-6, ruled 2026-11-02; docs/03, docs/06 The GM's
// review): what a player typed with Other… at creation (a language, a trait entry, a weapon skill: PR G), found on the character from the
// campaign's setting, and the one tap that puts it in the campaign's homebrew through `homebrew.save` (logged; the
// GM's alone). The words and the entry data are pure (`typedEntries.ts`); this ties them to the setting and the command.
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { classRace } from '../modules/characters/creation.ts';
import { settingLanguages } from '../modules/characters/creationGuide.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { languagesPlan } from '../modules/characters/languagesStep.ts';
import { layoutHints, traitListsOf, traitSteps } from '../modules/characters/traitLists.ts';
import { languageKnown, traitKnown, typedEntries, weaponKnown, withLanguage, withTraitEntry, withWeapon, type TypedEntry } from '../modules/characters/typedEntries.ts';
import { saveHomebrewEntry } from '../modules/library/homebrew.ts';
import { forgetCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';
import { campaignChoices } from './weaponSetup.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface TypedOn {
  classRef: string | null;
  raceRef: string | null;
  creation: unknown;
  fields: unknown;
  /** The picks as saved (actors.weapon_skills); a typed one is `{ itemId: <name>, other: true }`. */
  weaponSkills?: unknown;
}

/** The typed Other… entries on a character, as the setting reads it now (none without a class in the setting). */
export function typedOnCharacter(setting: CampaignSetting | null, character: TypedOn, fieldDefs: readonly FieldDefinition[]): TypedEntry[] {
  if (!setting) return [];
  const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classRef);
  if (!klass) return [];
  const races = setting.all.filter((e) => e.kind === 'race');
  const race = races.find((e) => e.packEntryId === character.raceRef) ?? null;
  const values = isRecord(character.fields) ? character.fields : {};
  const creation = isRecord(character.creation) ? character.creation : {};
  const scores = Object.fromEntries(Object.entries(isRecord(creation.scores) ? creation.scores : {}).filter((pair): pair is [string, number] => typeof pair[1] === 'number'));
  const languagesField = fieldDefs.find((def) => def.key.toLowerCase() === 'languages' && (def.type === 'text' || def.type === 'longtext')) ?? null;
  const alignmentField = fieldDefs.find((def) => def.key.toLowerCase() === 'alignment') ?? null;
  const alignment = alignmentField && typeof values[alignmentField.key] === 'string' ? String(values[alignmentField.key]) : null;
  const languagePlan = languagesField
    ? languagesPlan({ rulesSets: setting.rulesSets, race, klass, scores, alignment, fields: fieldDefs, legacy: settingLanguages(setting.all.filter((e) => e.kind === 'race' || e.kind === 'class'), fieldDefs.map((f) => f.label)) })
    : null;
  const raceId = race?.packEntryId ?? classRace(klass.data, races)?.packEntryId ?? null;
  const steps = traitSteps([...fieldDefs], traitListsOf(setting.all), { layout: layoutHints(setting.all), raceId, choices: campaignChoices(setting) });
  return typedEntries({ fields: character.fields, languagesField, languagePlan, traitSteps: steps, weaponSkills: character.weaponSkills }).filter((e) =>
    e.kind === 'language' ? !languageKnown(setting.rulesSets, e.name) : e.kind === 'weapon' ? !weaponKnown(setting.items, e.name) : !traitKnown(steps.find((s) => s.list.id === e.listId)!.list, e.name),
  );
}

/** One tap: the entry goes into the campaign's homebrew; the setting is read again next time it's asked for. */
export async function addTypedToHomebrew(db: Db, user: CurrentUser, setting: CampaignSetting, campaign: { id: string; name: string }, entry: TypedEntry): Promise<{ ok: true } | { ok: false; message: string }> {
  const input = { campaignId: campaign.id, campaignName: campaign.name };
  if (entry.kind === 'language') {
    const data = withLanguage(setting.rulesSets, entry.name);
    if (!data) return { ok: false, message: "This setting has no languages list to add to." };
    const saved = await runCommand(registry, db, user, saveHomebrewEntry, { ...input, kind: 'rulesSet', data });
    if (!saved.ok) return { ok: false, message: saved.message };
  } else if (entry.kind === 'weapon') {
    // The setting's items, every kind, so the new id clashes with none of them.
    const items = setting.all.filter((e) => e.kind === 'item');
    const saved = await runCommand(registry, db, user, saveHomebrewEntry, { ...input, kind: 'item', data: withWeapon(items, entry.name) });
    if (!saved.ok) return { ok: false, message: saved.message };
  } else {
    const raw = setting.all.find((e) => e.kind === 'traitList' && e.packEntryId === entry.listId);
    const list = traitListsOf(setting.all).find((l) => l.id === entry.listId);
    if (!raw || !list) return { ok: false, message: "That list isn't in this campaign's setting rules any more." };
    const saved = await runCommand(registry, db, user, saveHomebrewEntry, { ...input, kind: 'traitList', data: withTraitEntry(list, raw.data, entry.name, entry.note) });
    if (!saved.ok) return { ok: false, message: saved.message };
  }
  forgetCampaignSetting(campaign.id);
  return { ok: true };
}
