// What the travel card needs around the groups (M5b step 1; docs/05 "Movement"): the day-by-day mode under way with
// its travel budget (wildPack.ts), today's weather tags (the rolled weather's, A11), each group's travel row and Lost
// (travelPlay.ts, as the reader may read them), each group's travellers with their speeds (the slowest sets the
// pace: the load tier's movement, as the database keeps it in carrier_loads), and which day of the expedition it
// is. Null when the expedition isn't under way in a day-by-day mode with a budget. Pure but for the loads.
import { TRAVEL_PLACE_WORDS } from '../core/travelWords.ts';
import type { Json } from '../core/database.types.ts';
import type { Db } from '../core/supabase.ts';
import { calendarStartOf, dateOnClock, elapsedSteps, monthsOf, startIndex } from '../modules/expedition/clock.ts';
import { FALLBACK_MODES, modeById, readExploration, type ExplorationRules, type Mode, type Terrain } from '../modules/expedition/modes.ts';
import type { Marcher } from '../modules/expedition/marchingPlay.ts';
import { campaignUnits, type SceneState, type TravelDayStart } from '../modules/expedition/play.ts';
import type { TimeUnits } from '../modules/expedition/clock.ts';
import type { Choices } from '../modules/library/options.ts';
import { stepSeconds, weatherNow } from '../modules/expedition/procedure.ts';
import { dayBudget, remaining, unitFor, weatherTagsFor, type Traveller, type WeatherTags } from '../modules/expedition/travel.ts';
import { gettingLostOf, loadLoadTiers, loadLost, loadTravelGroups, type GettingLost, type GroupLost, type TravelGroup } from '../modules/expedition/travelPlay.ts';
import { loadWeather } from '../modules/expedition/weatherPlay.ts';
import { loadClockNow } from '../modules/expedition/lightPlay.ts';
import type { Travel } from '../modules/expedition/wildPack.ts';
import type { GroupOf } from '../core/partyGroups.ts';
import { choicesInPlay, type CampaignSetting } from './campaignSetting.ts';
import { speedOf, type EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { actorLoad } from '../modules/inventory/packView.ts';
import { encumbranceModeOf, type EncumbranceMode } from '../core/campaignSettings.ts';
import { loadTownSwitches } from '../modules/expedition/townPlay.ts';
import { SWITCHES_OFF, type TownSwitches } from '../modules/expedition/townSwitches.ts';
import type { PartyMember } from '../modules/expedition/partyModifiers.ts';
import { partyMemberOf } from './partyMembers.ts';

export interface TravelView {
  expeditionId: string;
  mode: Mode;
  rules: ExplorationRules;
  travel: Travel;
  /** The expedition's day the clock is in (0 its first). */
  day: number;
  /** What the day is counted from (the expedition's start and the mode's step), to read it again before a day starts. */
  dayCount?: { startedAt: number; step: number | null };
  /** Today's weather tags (ids), and the mode's tags by id. */
  weatherTags: string[];
  tags: WeatherTags;
  rows: Map<number, TravelGroup>;
  lost: Map<number, GroupLost>;
  /** Each group's travellers (its characters and hirelings in play) with their speeds. */
  travellers: Map<number, Traveller[]>;
  gettingLost: GettingLost;
  /** The campaign's time units, today's season (null until known) and the optional rules in play (activities, M5b step 3). */
  units: TimeUnits;
  season: string | null;
  choices: Choices;
  /** The GM's town switches (sw-1 … sw-4), for a Move…'s alsoWhen checks with onlyWhen. */
  switches: TownSwitches;
  /** Each group's members with their classes and skills, for the modifiers keyed to the party (ex-2, ga-3). */
  party?: Map<number, PartyMember[]>;
}

/** The terrain of a mode by id (null when the pack has none of that id). */
export const terrainOf = (mode: Pick<Mode, 'terrain'>, id: string | null | undefined): Terrain | null => (id ? (mode.terrain.find((t) => t.id === id) ?? null) : null);

/**
 * A traveller's speed from the load line the database keeps for them (carrier_loads.tier): in coin and slot modes the
 * tier's label, read as the first whole number in that tier's movement; in armour mode the line is "Move " and the
 * armour row's movement (private.load_tier_words), read as its first whole number, the same number `speedOf` gives
 * for that load (m5b-engine-reconcile §2.6). Null when the campaign tracks no load, the tier has no movement, or the
 * line has no number ("Over the limit"): the budget then asks the GM.
 */
export function speedFromTier(rules: EncumbranceRules, mode: EncumbranceMode, tier: string | null): number | null {
  if (tier === null) return null;
  if (mode === 'armour') {
    const moved = /^Move\s.*?(\d+)/.exec(tier);
    return moved ? Number(moved[1]) : null;
  }
  const tiers = mode === 'coin' ? rules.coin?.tiers : mode === 'slot' ? rules.slot?.tiers : undefined;
  const found = tiers?.find((t) => t.label === tier)?.movement?.match(/\d+/);
  return found ? Number(found[0]) : null;
}

/**
 * With slot bands (ga-1) the database's tier line doesn't know the two bands, so each speed is worked out here from
 * what the device may read, through the one speed function (`speedOf`): the GM's device reads every pack, a
 * player's only their own characters' (others' packs are hidden), the rest stay unknown. Null: not banded.
 */
export function bandSpeedsOf(
  lines: readonly InventoryLine[] | null,
  rules: EncumbranceRules,
  marchers: readonly Pick<Marcher, 'id' | 'ownerUserId'>[],
  viewer?: { userId: string; gm: boolean },
): Map<string, number | null> | null {
  if (!rules.slot?.bands) return null;
  const speeds = new Map<string, number | null>();
  for (const m of marchers) {
    const readable = !viewer || viewer.gm || m.ownerUserId === viewer.userId;
    speeds.set(m.id, lines && readable ? speedOf(actorLoad(lines, m.id, rules, 'slot')) : null);
  }
  return speeds;
}

async function bandSpeeds(db: Db, campaignId: string, rules: EncumbranceRules, marchers: readonly Marcher[], viewer?: { userId: string; gm: boolean }) {
  if (!rules.slot?.bands) return null;
  return bandSpeedsOf((await loadInventory(db, campaignId))?.lines ?? null, rules, marchers, viewer);
}

/** The expedition's day (0 its first) the clock is in at `seconds`. */
export function travelDayAt(seconds: number, startedAt: number, step: number | null | undefined): number {
  return step && step > 0 ? Math.max(0, elapsedSteps(seconds, startedAt, step) - 1) : 0;
}

/**
 * The expedition's day the clock is in now, read again from the database just before a day starts (review of #617):
 * the view reads the clock and the travel rows in separate reads, so right after another device's Undo it can hold
 * the old clock with the new rows. Null when it couldn't be read or the view doesn't say how days count.
 */
export async function travelDayNow(db: Db, campaignId: string, view: Pick<TravelView, 'dayCount'>): Promise<number | null> {
  if (!view.dayCount) return null;
  const seconds = await loadClockNow(db, campaignId);
  return seconds === null ? null : travelDayAt(seconds, view.dayCount.startedAt, view.dayCount.step);
}

export async function loadTravelView(
  db: Db,
  campaignId: string,
  scene: SceneState,
  setting: CampaignSetting,
  settings: Record<string, Json | undefined>,
  members: GroupOf,
  marchers: readonly Marcher[],
  viewer?: { userId: string; gm: boolean },
): Promise<TravelView | null> {
  const { expedition, clock } = scene;
  if (!expedition || !clock) return null;
  const rulesSets = setting.rulesSets;
  const exploration = readExploration(rulesSets);
  const mode = modeById(exploration.modes, expedition.mode) ?? modeById(FALLBACK_MODES, expedition.mode) ?? null;
  if (!mode || mode.pace !== 'day' || !mode.wild.travel) return null;
  const units = campaignUnits(settings, rulesSets);
  const step = stepSeconds(mode, units);
  // elapsedSteps counts from 1 ("day 1"); the rows count from 0.
  const day = travelDayAt(clock.seconds, expedition.startedAt, step);
  const months = monthsOf(setting.calendar);
  const start = startIndex(months, calendarStartOf(settings.calendarStart) ?? calendarStartOf(setting.calendar?.defaultStart));
  const date = start ? dateOnClock(months, start, clock.seconds, 0, units) : null;
  const now = weatherNow({ rules: exploration, mode, units, startedAt: expedition.startedAt, now: clock.seconds, situation: { choices: choicesInPlay(setting), season: date?.season ?? null } });
  const ids = marchers.map((m) => m.id);
  const [rows, lost, weather, loads, switches] = await Promise.all([
    loadTravelGroups(db, campaignId, expedition.id),
    loadLost(db, campaignId, expedition.id),
    now ? loadWeather(db, expedition.id, now.period) : Promise.resolve(null),
    loadLoadTiers(db, ids),
    loadTownSwitches(db, campaignId),
  ]);
  if (!rows || !lost || weather === undefined) return null;
  const tierOf = loads;
  const encumbranceMode = encumbranceModeOf(settings);
  const banded = encumbranceMode === 'slot' ? await bandSpeeds(db, campaignId, setting.encumbrance, marchers, viewer) : null;
  const travellers = new Map<number, Traveller[]>();
  const party = new Map<number, PartyMember[]>();
  for (const m of marchers) {
    if (m.archived) continue;
    const group = members.get(m.id) ?? 1;
    const list = travellers.get(group) ?? [];
    list.push({ id: m.id, name: m.name, ownerUserId: m.ownerUserId, speed: banded ? (banded.get(m.id) ?? null) : speedFromTier(setting.encumbrance, encumbranceMode, tierOf.get(m.id) ?? null) });
    travellers.set(group, list);
    party.set(group, [...(party.get(group) ?? []), partyMemberOf(setting, m)]);
  }
  return {
    expeditionId: expedition.id,
    mode,
    rules: exploration,
    travel: mode.wild.travel,
    day,
    dayCount: { startedAt: expedition.startedAt, step },
    weatherTags: weather?.tags ?? [],
    tags: weatherTagsFor(mode, exploration),
    rows,
    lost,
    travellers,
    gettingLost: gettingLostOf(settings),
    units,
    season: date?.season ?? null,
    choices: choicesInPlay(setting),
    switches: switches ?? SWITCHES_OFF,
    party,
  };
}

/**
 * A group's budget for the day the view is in, as a day starts with it (no forced march yet): the travellers' speeds,
 * the pace and the GM's number kept from the day before, and the day's weather. One sum for the two places a day
 * starts: with the clock's move (the strip, below) and the travel card's own start (a first day, and the fallback).
 */
export function dayStartFor(view: Pick<TravelView, 'travel' | 'tags' | 'weatherTags' | 'rows' | 'travellers' | 'day'>, group: number): TravelDayStart {
  const row = view.rows.get(group) ?? null;
  const pace = row?.pace ?? 'foot';
  const gmPerDay = row?.gmPerDay ?? null;
  const total = dayBudget(view.travel, view.tags, { travellers: view.travellers.get(group) ?? [], pace, weatherTags: view.weatherTags, forced: 0, gmPerDay }).total;
  return { group, day: view.day, total, pace, gmPerDay };
}

/**
 * The travel days a move of the clock starts (fix F86/F87): one for each group whose row is on an earlier day than
 * the view's (the view read at the time the move reaches). A group with no row yet (its first day) isn't listed: the
 * travel card makes it, and Undo of a move never takes a first day back (review of #617).
 */
export function travelDayStarts(view: Pick<TravelView, 'travel' | 'tags' | 'weatherTags' | 'rows' | 'travellers' | 'day'>): TravelDayStart[] {
  return [...view.rows.values()].filter((row) => row.day < view.day).map((row) => dayStartFor(view, row.group)).sort((a, b) => a.group - b.group);
}

/**
 * What a started day says in its toast: "Day 3, Leagues 12, 2 unused leagues lost, the party arrived at Black Mere"
 * (or "… 4 more owed for Black Mere"). `before` is the row as the day before left it, `after` as the day starts.
 */
export function dayStartWords(travel: Pick<Travel, 'name' | 'unit'>, who: string, day: number, before: TravelGroup, after: TravelGroup): string {
  const unused = remaining(before);
  const parts = [`Day ${day + 1}, ${travel.name} ${after.total}`];
  if (unused > 0) parts.push(`${unused} unused ${unitFor(unused, travel.unit)} lost`);
  // fm-1: a place not yet shown to the players has no name for them (TRAVEL_PLACE_WORDS says so plainly).
  if (before.pending && !after.pending) parts.push(`${who} ${TRAVEL_PLACE_WORDS.arrived(before.pending.placeName || null)}`);
  else if (after.pending) parts.push(TRAVEL_PLACE_WORDS.owed(after.pending.owed, after.pending.placeName || null));
  return parts.join(', ');
}
