// What the weapon skills step needs from the campaign's setting (M5b-0b): the class's proficiency (only while its
// option is on), the weapons it offers and the restricted ones, and how many picks the level allows. Null: no step.
import { weaponDamageRule, type DamageRule } from '../modules/characters/weaponDamage.ts';
import { allowedPicks, proficiencyFor, weaponChoices, type Proficiency } from '../modules/characters/weaponSkills.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { choicesInPlay, type CampaignSetting } from './campaignSetting.ts';

/** The campaign's choice for each optional rule (its default when not chosen), as the ruleKey groups resolve it. */
export const campaignChoices = (setting: CampaignSetting): Record<string, string> => choicesInPlay(setting);

export interface WeaponSetup {
  proficiency: Proficiency;
  groups: { name: string; items: ResolvedEntry[] }[];
  restricted: ResolvedEntry[];
  allowed: number;
  /** A rule that sets every weapon's die (of-8), for the weapons' lines; null when the setting has none. */
  damage: DamageRule | null;
}

export function weaponSetup(setting: CampaignSetting | null, classRef: string | null, level: number): WeaponSetup | null {
  if (!setting || !classRef) return null;
  const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === classRef);
  if (!klass) return null;
  const proficiency = proficiencyFor(setting.rulesSets, klass.data, campaignChoices(setting));
  if (!proficiency) return null;
  // Only the weapons in play: one an option switches off (optionOff) isn't offered (of-3).
  const { groups, restricted } = weaponChoices(entriesInPlay(setting.items), klass.data, (id) => setting.itemCategories.get(id));
  // A class that may use no weapon has no step.
  if (groups.length === 0) return null;
  return { proficiency, groups: groups as WeaponSetup['groups'], restricted: restricted as ResolvedEntry[], allowed: allowedPicks(proficiency, level), damage: weaponDamageRule(setting.rulesSets, setting.all, campaignChoices(setting)) };
}
