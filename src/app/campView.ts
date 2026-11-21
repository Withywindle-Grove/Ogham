// What the camp card needs from the setting (M5b step 4; docs/05 Camp; 07 `camp`, `lightTypes`, items' `food`): the
// mode's camp (following sameAs) with its steps in order, the campfire's light type (its name, its firewood item and
// how long one bundle burns), whether quick camping is on, the pack's hunger text; and for the night (part 2) the
// watch length and the night's length (the pack's daylight), which classes cast, and the pack's conditions (a bad
// rest's). Pure.
import { unitName, type TimeUnits } from '../modules/expedition/clock.ts';
import { campSteps, nightOf, TALK_FACT, type CampStep } from '../modules/expedition/camp.ts';
import { daylightOf, daylightOn } from '../modules/expedition/daylight.ts';
import { readLightType } from '../modules/expedition/light.ts';
import { campOf, optionOn, type Camp, type Mode } from '../modules/expedition/modes.ts';
import { conditionsOf, type Condition } from '../modules/expedition/statusPlay.ts';
import { foodKindOf } from '../modules/expedition/wildPack.ts';
import type { Choices } from '../modules/library/options.ts';
import type { CampaignSetting } from './campaignSetting.ts';

export interface CampFireType {
  typeId: string;
  name: string;
  /** The firewood item's id (the light type's fuelItemId); null: the pack names none, so no firewood can go on. */
  fuelItem: string | null;
  /** How long one bundle burns, in seconds; null: the pack's duration can't be read (the GM enters nothing). */
  secondsEach: number | null;
}

export interface CampInfo {
  camp: Camp;
  steps: CampStep[];
  fire: CampFireType | null;
  /** Quick camping (07 `camp.quick.option`) is on in this campaign. */
  quick: boolean;
  /** The pack's hunger rule as text (07, reference-only `hunger`); null without one, or when it's the GM's and this isn't. */
  hunger: string | null;
  /** The setting's food item ids (items with `food`). */
  foodItems: Set<string>;
  /** The night (D18): one watch's length in minutes, the night's length in minutes and the watches it takes (null: the pack doesn't say). */
  night: { watchMinutes: number | null; minutes: number | null; watches: number | null; startsAt?: number | null; dayMinutes?: number };
  /** The class ids that cast (their entry has `spellcasting`): the watches warn about them (D18). */
  casterClasses: Set<string>;
  /** The pack's conditions (a bad rest's `onBadRest`). */
  conditions: Condition[];
  /** Today's season id (the sleep rows'), when known. */
  season: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function hungerOf(rulesSets: readonly Record<string, unknown>[], gm: boolean): string | null {
  for (const rules of [...rulesSets].reverse()) {
    const hunger = rules.hunger;
    if (typeof hunger === 'string' && hunger.trim()) return hunger;
    if (isRecord(hunger)) {
      if (hunger.gmOnly === true && !gm) return null;
      for (const key of ['note', 'notes', 'text', 'summary']) if (typeof hunger[key] === 'string' && (hunger[key] as string).trim()) return hunger[key] as string;
    }
  }
  return null;
}

export function campInfo(input: { setting: CampaignSetting; mode: Mode; modes: readonly Mode[]; units: TimeUnits; choices: Choices; gm: boolean; season?: string | null }): CampInfo | null {
  const camp = campOf(input.mode, input.modes);
  if (!camp) return null;
  const foodItems = new Set(input.setting.items.filter((e) => foodKindOf(e.data) !== null).map((e) => e.packEntryId));
  const talk = input.mode.activities.some((a) => a.id === TALK_FACT);
  const steps = campSteps(camp, { choices: input.choices, food: foodItems.size > 0, talk });
  let fire: CampFireType | null = null;
  if (camp.fire) {
    const entry = input.setting.all.find((e) => e.kind === 'lightType' && e.packEntryId === camp.fire!.lightTypeId);
    const type = entry ? readLightType(entry.data, input.units) : null;
    const data = entry?.data ?? {};
    const fuelItem = typeof data.fuelItemId === 'string' ? data.fuelItemId : typeof data.fuel === 'string' ? data.fuel : null;
    fire = { typeId: camp.fire.lightTypeId, name: type?.name || 'Campfire', fuelItem, secondsEach: type?.seconds ?? null };
  }
  const length = steps.find((s) => s.part === 'watches')?.step?.watchLength ?? null;
  const unitSeconds = length ? input.units[unitName(length.unit, input.units)] : undefined;
  const watchMinutes = length && unitSeconds ? Math.round((length.value * unitSeconds) / 60) : null;
  const season = input.season ?? null;
  const daylight = daylightOn(daylightOf(input.setting.rulesSets), { season });
  const dayMinutes = input.units.day ? Math.round(input.units.day / 60) : 1440;
  // The 1st watch starts at sunset (the night is the day less its daylight, nightOf): the boxes' times of night (fl-3).
  const night = { watchMinutes, ...nightOf(daylight, watchMinutes, dayMinutes), startsAt: daylight?.sunset ?? null, dayMinutes };
  const casterClasses = new Set(input.setting.all.filter((e) => e.kind === 'class' && isRecord(e.data.spellcasting)).map((e) => e.packEntryId));
  return {
    camp,
    steps,
    fire,
    quick: optionOn(camp.quickOption, input.choices) && camp.quickOption !== null,
    hunger: hungerOf(input.setting.rulesSets, input.gm),
    foodItems,
    night,
    casterClasses,
    conditions: conditionsOf(input.setting.all),
    season,
  };
}
