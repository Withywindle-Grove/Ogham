import type { MyCharacter } from '../../core/myCharacters.ts';
import { weaponBreakdown, weaponFigures, weaponRolls, NO_MAGIC, type Skill } from '../../modules/characters/play.ts';
import { proficiencyFor, weaponPenalty, weaponSkillsOf } from '../../modules/characters/weaponSkills.ts';
import type { ActorFacts } from '../../modules/expedition/activities.ts';
import type { CampaignSetting } from '../campaignSetting.ts';
import type { ModeFigureParts, WeaponBreakdown, WeaponLine, WeaponRolls } from '../CarrierItems.tsx';
import { characterFigures, scoresOf } from '../fromSetting.ts';
import { campaignChoices } from '../weaponSetup.ts';

/**
 * The Player screen's figures for At hand's weapons and for the activity buttons (moved out of PlayerScreen.tsx in
 * dec-13 C1, be-3, unchanged): a weapon's line, its parts and its rolls (C3, sq-4, as-1), and what the activity buttons
 * need to know of the character (M5b step 3).
 */
export function playerFigures({
  setting,
  character,
  figures,
  targetLabel,
  damageReason,
  skills,
  carried,
}: {
  setting: CampaignSetting | null;
  character: MyCharacter;
  figures: ReturnType<typeof characterFigures>;
  /** The attack figure's label (A4, bq3-13), the weapon line's target. */
  targetLabel: string;
  /** A rule that sets every weapon's die (of-8), named after the damage. */
  damageReason: string | null;
  skills: readonly Skill[];
  /** The pack items the character carries (M5b step 3: an activity's `requires.item`). */
  carried: Set<string>;
}): { weaponLine: WeaponLine; weaponParts: WeaponBreakdown; weaponRolls: WeaponRolls; actorFacts: ActorFacts } {
  // The character's weapon skill for a weapon at hand (as-4, as-7): specialised, the penalty for one that isn't their skill
  // or their class's weapon, or both; nothing while the setting's weapon proficiency is off. Read from the line's pack entry.
  const proficiency = setting && figures.klass ? proficiencyFor(setting.rulesSets, figures.klass, campaignChoices(setting)) : null;
  const picks = weaponSkillsOf(character.weaponSkills);
  const skillFor = (item: Record<string, unknown>, mode: ModeFigureParts | undefined) =>
    mode?.entryId && figures.klass ? weaponPenalty(picks, { packEntryId: mode.entryId, name: '', data: item }, figures.klass, proficiency, mode.classOk) : null;
  // At hand's weapon figure and its parts (C3, sq-4), on the Player screen's At hand and the Pack's alike, with a weapon
  // mode's own parts (ah-1: its to-hit, its die's source).
  const weaponLine: WeaponLine = (item, damageDelta, mode) =>
    weaponFigures(item, figures.filled, figures.klass, character.level, setting?.rulesSets ?? [], {
      ...(figures.acDirectionStated ? { direction: figures.acDirectionStated } : {}),
      targetLabel,
      damageReason,
      damageDelta: damageDelta ?? 0,
      attack: mode?.attack ?? null,
      magic: mode?.magic ?? NO_MAGIC,
      skill: skillFor(item, mode),
    });
  const weaponParts: WeaponBreakdown = (item, damageDelta, mode) =>
    weaponBreakdown(item, figures.filled, figures.klass, character.level, setting?.rulesSets ?? [], {
      ...(figures.acDirectionStated ? { direction: figures.acDirectionStated } : {}),
      damageReason,
      damageDelta: damageDelta ?? 0,
      klassName: figures.className,
      // The score's full name, as the Pack's figures read (Design on #569): "Missile, Nimbleness −1".
      shortName: (k) => figures.abilityName(k).long,
      attack: mode?.attack ?? null,
      damageSource: mode?.damageSource ?? null,
      magic: mode?.magic ?? NO_MAGIC,
      skill: skillFor(item, mode),
    });
  // The Attack sheet's rolls (as-1): the same parts, each with its own figure, the score named with its value.
  const scores = setting ? scoresOf(setting, character.fields, character.creation) : {};
  const weaponRollsOf: WeaponRolls = (item, damageDelta, mode) =>
    weaponRolls(item, figures.filled, figures.klass, character.level, setting?.rulesSets ?? [], {
      ...(figures.acDirectionStated ? { direction: figures.acDirectionStated } : {}),
      damageReason,
      damageDelta: damageDelta ?? 0,
      klassName: figures.className,
      longName: (k) => figures.abilityName(k).long,
      scoreOf: (k) => (typeof scores[k] === 'number' ? scores[k] : null),
      attack: mode?.attack ?? null,
      damageSource: mode?.damageSource ?? null,
      magic: mode?.magic ?? NO_MAGIC,
      skill: skillFor(item, mode),
    });
  // What the activity buttons need to know of this character (M5b step 3): their skills and the pack items they carry.
  const actorFacts: ActorFacts = {
    id: character.id,
    name: character.name,
    skills: new Set(skills.map((k) => k.code)),
    items: carried,
    skillShown: new Map(skills.map((k) => [k.code, { name: k.name, shown: k.shown, odds: k.odds, chance: k.chance }])),
    // Their class, for the modifiers keyed to the party (ex-2, ga-3).
    classId: character.classRef,
    className: figures.className,
  };
  return { weaponLine, weaponParts, weaponRolls: weaponRollsOf, actorFacts };
}
