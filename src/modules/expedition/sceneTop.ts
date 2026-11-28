// The Scene's top as words (plan docs/plans/dec-9-the-whole-scene.md rows S1, S4 and S9; page 16 of the December
// mockups, approved 2026-11-14, st-1 to st-8). Pure: the band's session line, heading and date line (S1), the session's
// three states (S9: none, paused, running; st-2), and the four facts with their due states (S4: Weather, Light, Rest,
// Encounter check; st-1, st-5, mc-39b). A fact the setting has no rule for is absent (null). Also the town's top (S5:
// `showsTownTop`, the part of the day) and the Depart sheet's starting mode (S5 and fno-1: `departModeOf`,
// `departSheetModeOf`, `partyInSettlement`, which reads the places the screen already loaded), and the Depart sheet of
// p2p-5 (B7: its Locations grouped under their Area, `departLocationGroups`; the method a place fills in,
// `placeMethodOf`, `departMethodOf`). Nothing here is the GM's
// alone: what goes in is what the screen already holds, so the players' top (S15) can use the same words.
import { possessive } from '../../core/nameWords.ts';
import type { SetIconName } from '../../ui/iconSet.ts';
import { isPartOfDay, type Amount } from './clock.ts';
import { POINT_TO_POINT_ID, type Chance, type Mode } from './modes.ts';
import { isSettlement, type Place } from './placePlay.ts';
import { checkChanceWords, checkWhenWords, ruleBlocks, type ChainEntry, type RuleBlock } from './placeRules.ts';
import { ancestorsOf, byMapNumber, childrenOf, isLocation, packsWithPlaces, rootsOf, type PackPlace } from './placeTree.ts';

/** The session's state (S9): never played, played before with none running (paused), or running. */
export type SessionState = 'none' | 'paused' | 'running';

export function sessionStateOf(scene: { session: unknown; played?: boolean }): SessionState {
  if (scene.session) return 'running';
  return scene.played ? 'paused' : 'none';
}

/** The line above the heading: "Session 1. Saltwick Island."; with no session yet, the campaign's name (st-2). */
export function sessionLine(input: { state: SessionState; campaignName: string; sessionNumber: number | null; region: string | null }): string {
  if (input.state === 'none') return input.campaignName;
  const parts = [input.sessionNumber !== null ? `Session ${input.sessionNumber}.` : null, input.region ? `${input.region}.` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : input.campaignName;
}

/**
 * The heading (st-1, st-2): the place and the mode's own count ("The Drowned Harbour, turn 14") while a session runs;
 * the place alone while paused; "No session yet" before the first. Without a named place the mode's name stands in.
 * Between expeditions (`modeName` null) the strip's own words (`fallback`) stay: the town's and downtime's top is S5's.
 */
export function bandHeading(input: { state: SessionState; place: string | null; modeName: string | null; step: string | null; fallback: string }): string {
  if (input.state === 'none') return 'No session yet';
  if (input.modeName === null) return input.fallback;
  const base = input.place?.trim() || input.modeName;
  return input.state === 'running' && input.step ? `${base}, ${input.step}` : base;
}

/** The nearest region the place sits in, by the pack's own type ("region"); null where it isn't known. */
export function regionOfChain(chain: readonly Pick<ChainEntry, 'name' | 'data'>[] | null): string | null {
  const found = (chain ?? []).find((e) => typeof e.data.type === 'string' && e.data.type.trim().toLowerCase() === 'region');
  return found?.name.trim() || null;
}

/** The date in the date line (frame TB): "14 Reedmonth, spring"; an extra day after its month; "Day 14" with no calendar start. */
export function dateWords(input: {
  date: { day: number | null; month: string; extraDay: { id: string; name: string } | null } | null;
  season: string | null;
  dayNumber: number;
}): string {
  const { date } = input;
  if (!date) return `Day ${input.dayNumber}`;
  const day = date.extraDay ? `${date.extraDay.name}, after ${date.month}` : `${date.day} ${date.month}`;
  return input.season ? `${day}, ${input.season}` : day;
}

/** The season's icon before the date (frame TB, st-8), from the season's own name; none where the app can't place it. */
export function seasonIconOf(season: string | null): SetIconName | null {
  const name = (season ?? '').toLowerCase();
  if (/spring/.test(name)) return 'sprout';
  if (/summer/.test(name)) return 'sunflower';
  if (/autumn|\bfall\b/.test(name)) return 'maple-leaf';
  if (/winter/.test(name)) return 'snowflake-1';
  return null;
}

/**
 * What is left of the light (frame TB), from the setting's daylight: whole hours to sunset, dusk inside the last two,
 * "Night." from sunset to sunrise. Null without a daylight rule (the part is absent). Numbers are numerals.
 */
export function lightLeftWords(daylight: { sunrise: number; sunset: number } | null, minuteOfDay: number): string | null {
  if (!daylight) return null;
  if (minuteOfDay < daylight.sunrise || minuteOfDay >= daylight.sunset) return 'Night.';
  const hours = Math.floor((daylight.sunset - minuteOfDay) / 60);
  if (hours >= 2) return `${hours} hours of light left.`;
  return hours === 1 ? 'Dusk in 1 hour.' : 'Dusk within the hour.';
}

// The facts (S4) ------------------------------------------------------------------------------------------------------

/** A fact's state: quiet; due (the warm edge and ground); dark (a Light fact in the dark: the cool glow, st-5). */
export type FactState = 'quiet' | 'due' | 'dark';

export interface Fact {
  id: 'weather' | 'light' | 'rest' | 'check' | 'part';
  label: string;
  /** One line, never wrapped. */
  value: string;
  /** The small line under it, or none. */
  sub: string | null;
  state: FactState;
  /** The warning sign before the value (no light). */
  warn: boolean;
  /** The die named in the small line ("d6"), drawn as its glyph (ds-3). */
  die: string | null;
  /** What the tap does, said after the fact in its accessible name ("Advance by…"); absent where it opens the fact's own rule. */
  tap?: string;
}

const fact = (f: Pick<Fact, 'id' | 'label' | 'value'> & Partial<Fact>): Fact => ({ sub: null, state: 'quiet', warn: false, die: null, ...f });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sentence = (words: string) => (/[.!?]$/.test(words) ? words : `${words}.`);

/** Weather (st-1): "To roll" while due, with the table's name; today's weather and its first effect once in. */
export function weatherFact(view: { kind: 'due' | 'in' | 'none'; result?: string | null; line?: string | null; table?: string | null }): Fact | null {
  if (view.kind === 'none') return null;
  if (view.kind === 'due') return fact({ id: 'weather', label: 'Weather', value: 'To roll', sub: view.table ? sentence(view.table) : null, state: 'due' });
  return fact({ id: 'weather', label: 'Weather', value: view.result?.trim() || 'Rolled', sub: view.line ? sentence(view.line) : null });
}

export interface LightGroup {
  group: number;
  /** "Group 1". */
  name: string;
  dark: boolean;
  /** The lights lit in the group, with the steps each has left (null: it never runs out). */
  lights: { name: string; stepsLeft: number | null }[];
}

/** The light that runs out first (one that never runs out comes last). */
function soonest(lights: LightGroup['lights']) {
  return [...lights].sort((a, b) => (a.stepsLeft ?? Infinity) - (b.stepsLeft ?? Infinity))[0] ?? null;
}

/**
 * Light (st-1, st-5, T7): the light that runs out first and its time; "No light" in the dark, with the warning sign.
 * A split party: the value names the group that needs the GM and the small line the others, or counts the groups lit.
 * Null with nothing lit and nobody in the dark (a day mode in daylight: nothing to state).
 */
export function lightFact(input: { groups: readonly LightGroup[]; stepWord: string }): Fact | null {
  const { groups, stepWord } = input;
  const left = (n: number | null) => (n === null ? null : plural(n, stepWord));
  const [only] = groups;
  if (groups.length === 1 && only) {
    const g = only;
    if (g.dark) return fact({ id: 'light', label: 'Light', value: 'No light', state: 'dark', warn: true });
    const light = soonest(g.lights);
    if (!light) return null;
    const time = left(light.stepsLeft);
    return fact({ id: 'light', label: 'Light', value: light.name, sub: time ? `${time} left.` : null });
  }
  const dark = groups.filter((g) => g.dark);
  const lit = groups.filter((g) => !g.dark && g.lights.length > 0);
  const litLine = (g: LightGroup, withName: boolean) => {
    const light = soonest(g.lights)!;
    const time = left(light.stepsLeft);
    return `${g.name}: ${[withName ? light.name : null, time].filter(Boolean).join(', ') || light.name}.`;
  };
  if (dark.length > 0) {
    return fact({
      id: 'light',
      label: 'Light',
      value: dark.length === 1 ? `${dark[0]!.name} dark` : `${dark.length} groups dark`,
      sub: lit.map((g) => litLine(g, true)).join(' ') || null,
      state: 'dark',
      warn: true,
    });
  }
  if (lit.length === 0) return null;
  return fact({ id: 'light', label: 'Light', value: plural(lit.length, 'group') + ' lit', sub: lit.map((g) => litLine(g, false)).join(' ') });
}

export interface RestGroup {
  group: number;
  name: string;
  /** Due, called or forced: the GM answers it. */
  open: boolean;
  stepsLeft: number;
}

/** The rest rule's small line: its length in its period ("1 turn in 6."), else its period ("Every 6 days."). */
export function restEveryWords(rest: { every: Amount; length: Amount | null } | null): string | null {
  if (!rest) return null;
  const unit = (a: Amount) => a.unit.trim().toLowerCase().replace(/s$/, '');
  if (rest.length && unit(rest.length) === unit(rest.every)) return `${plural(rest.length.value, unit(rest.length))} in ${rest.every.value}.`;
  return `Every ${plural(rest.every.value, unit(rest.every))}.`;
}

/**
 * Rest (st-1, T7): the count to the next rest, "Rest due" when it falls due ("Rest day" in a day mode). A split
 * party: the group whose rest is due, else the one whose rest comes first, with the others on the small line.
 * Null without a rest rule (no groups given).
 */
export function restFact(input: { groups: readonly RestGroup[]; ruleWords: string | null; stepWord: string; day: boolean; pushedOn?: boolean }): Fact | null {
  const { groups, stepWord } = input;
  if (groups.length === 0) return null;
  const dueWord = input.day ? 'Rest day' : 'Rest due';
  const [only] = groups;
  if (groups.length === 1 && only) {
    const g = only;
    // A player who pushed on owes a rest until a later one applies to them (B5's "Rest due, you pushed on"; S15).
    if (!g.open && input.pushedOn) return fact({ id: 'rest', label: 'Rest', value: dueWord, sub: 'You pushed on.', state: 'due' });
    return g.open
      ? fact({ id: 'rest', label: 'Rest', value: dueWord, sub: input.ruleWords, state: 'due' })
      : fact({ id: 'rest', label: 'Rest', value: `In ${plural(g.stepsLeft, stepWord)}`, sub: input.ruleWords });
  }
  const open = groups.filter((g) => g.open);
  if (open.length > 0) {
    const rest = groups.filter((g) => !g.open);
    return fact({
      id: 'rest',
      label: 'Rest',
      value: open.length === 1 ? `${open[0]!.name} due` : `${open.length} groups due`,
      sub: rest.map((g) => `${g.name}: in ${plural(g.stepsLeft, stepWord)}.`).join(' ') || null,
      state: 'due',
    });
  }
  const sorted = [...groups].sort((a, b) => a.stepsLeft - b.stepsLeft || a.group - b.group);
  const first = sorted[0]!;
  const others = sorted.slice(1);
  const tie = others.some((g) => g.stepsLeft === first.stepsLeft);
  const sub = tie
    ? sorted.map((g) => `${g.name}: in ${plural(g.stepsLeft, stepWord)}.`).join(' ')
    : `${first.name} first. ${others.map((g) => `${g.name}: in ${plural(g.stepsLeft, stepWord)}.`).join(' ')}`;
  return fact({ id: 'rest', label: 'Rest', value: `In ${plural(first.stepsLeft, stepWord)}`, sub });
}

/**
 * Encounter check (st-1, mc-39b): when it is rolled, on one line, and its chance with its die; named by the check's
 * own name, else "Encounter check". It has no due state (page 16: it stands as it is; checking now is a band button).
 */
export function checkFact(input: { name: string | null; eachMove: boolean; every: Amount | null; chance: Chance | null; fallbackUnit: string }): Fact {
  return fact({
    id: 'check',
    label: input.name?.trim() || 'Encounter check',
    value: checkWhenWords({ eachMove: input.eachMove, every: input.every }, input.fallbackUnit),
    sub: checkChanceWords(input.chance),
    die: input.chance?.die?.trim().toLowerCase() || null,
  });
}

/**
 * Encounter check at a place whose "none" is in force (G-27, dg-3; dg-17 finding 1): "None here", "Its own rule.". No
 * die (nothing is rolled) and no place name (a long one would be cut at 375 px).
 */
export function noneCheckFact(): Fact {
  return fact({ id: 'check', label: 'Encounter check', value: 'None here', sub: 'Its own rule.' });
}

/** A player's pop-up on that tile (G-27 piece B): the GM's words, "None here. <place>'s own rule.", by the name they know. */
export function noneSheetLines(placeName: string): FactLine[] {
  return [{ label: 'None here.', words: `${possessive(placeName)} own rule.` }];
}

// A player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8, approved 2026-11-14, ap-10) ----------------

/** One labelled line of a fact's pop-up (PL8): the label with its full stop, then its words (a chance's die drawn by `DiceWords`). */
export interface FactLine {
  label: string;
  words: string;
}

/** A group in the dark (PL8; the GM's Light pop-up too): what it means and what to do, after "No light.". */
export const NO_LIGHT_WORDS = 'Nobody in the group has a light lit, so they are in darkness. Light one from a pack.';

/**
 * Light (PL8): each lit light and the time it has left ("Ash's torch. 4 turns left."); a group in the dark "No light."
 * in today's words; a group with nothing lit "Nothing lit.". Each group named where the player has more than one.
 */
export function lightSheetLines(groups: readonly LightGroup[], stepWord: string): FactLine[] {
  const named = (g: LightGroup, label: string) => `${groups.length > 1 ? `${g.name}: ` : ''}${label}.`;
  return groups.flatMap((g) => {
    if (g.dark) return [{ label: named(g, 'No light'), words: NO_LIGHT_WORDS }];
    if (g.lights.length === 0) return [{ label: named(g, 'Nothing lit'), words: '' }];
    return g.lights.map((l) => ({ label: named(g, l.name), words: l.stepsLeft === null ? '' : `${plural(l.stepsLeft, stepWord)} left.` }));
  });
}

/** Rest (PL8): "Next." and the fact's whole value, with its small line where that says more than the rule ("You pushed on."). */
export function restSheetLines(fact: Fact, ruleWords: string | null): FactLine[] {
  return [{ label: 'Next.', words: [sentence(fact.value), fact.sub && fact.sub !== ruleWords ? fact.sub : null].filter(Boolean).join(' ') }];
}

/** The Encounter check (PL8): "When." and "Chance."; no chance line where the check has none. */
export function checkSheetLines(fact: Fact): FactLine[] {
  return [{ label: 'When.', words: sentence(fact.value) }, ...(fact.sub ? [{ label: 'Chance.', words: sentence(fact.sub) }] : [])];
}

/** A rule in the pack's words, then its page as the setting's (as Activities say it); nothing when the pack gives no words. */
export function settingRule(words: readonly (string | null)[], source?: string): RuleBlock[] {
  const blocks = words.flatMap((w) => ruleBlocks(w));
  return blocks.length > 0 && source ? [...blocks, { kind: 'source', text: `From your setting: ${source}` }] : blocks;
}

/**
 * The words of the setting's encounter check a player may read (PL8): the note of the procedure step that runs it, only
 * while the rules set opens its procedures to players (`playerReadable`, as the procedure list does). The check's own
 * note and its table stay the GM's (rp-2, mc-39b); a place's own check has none here (its read sends when and chance only).
 */
export function checkRule(mode: Pick<Mode, 'procedure'>, checkId: string, playerReadable: boolean): RuleBlock[] {
  const step = playerReadable ? mode.procedure.find((s) => s.kind === 'check' && s.checkId === checkId) : undefined;
  return step ? settingRule([step.note], step.source) : [];
}

// The town's and downtime's top (S5; page 16, T4 and T5; st-1, st-8, mc-69) ------------------------------------------

type SceneMode = { expedition: unknown; campaignMode: 'adventure' | 'downtime' };

/**
 * Whether the Scene shows the town's top (T4): no expedition open, the campaign in adventure time (dt-2: End
 * expedition leaves the party in town; End downtime comes back to it). The one place this is decided: a ruling that
 * the town's top also shows while an expedition is open at a settlement changes this function only.
 */
export function showsTownTop(scene: SceneMode): boolean {
  return !scene.expedition && scene.campaignMode === 'adventure';
}

/** Downtime's top (T5): no expedition open, the campaign in downtime. A placeholder until downtime's own design (dw-1). */
export function showsDowntimeTop(scene: SceneMode): boolean {
  return !scene.expedition && scene.campaignMode === 'downtime';
}

/**
 * The town's step button (ic-5, Francis): "Advance time", whatever the step's length. Its own words: the mode's
 * advance words (`advanceLabel`) stay for the Due line's title, the band heading's fallback and the log line.
 */
export const TOWN_STEP_LABEL = 'Advance time';

/** The band's button that opens the Depart sheet, in town and in downtime (ic-5; was "Start expedition"). */
export const DEPART_LABEL = 'Depart';

/** What a tap on the part of the day does (the lead, 2026-11-15): it opens Advance by…. */
export const PART_FACT_TAP = 'Advance by…';

type Part = 'morning' | 'afternoon' | 'night';
const PART_WORDS: Record<Part, string> = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };

/** The part of the day as the town's date line says it ("Morning."), in the light's place (mc-69: no light in town). */
export function partOfDayWords(part: Part): string {
  return `${PART_WORDS[part]}.`;
}

/** The part of the day fact (T4): "Morning", with "Afternoon comes next." under it; the tap opens Advance by…. */
export function partOfDayFact(part: Part, next: Part, options: { advance?: boolean } = {}): Fact {
  // The GM's tile opens Advance by… and says so; a player's opens its own words to read (S15: players don't move the clock).
  const advance = options.advance ?? true;
  return fact({ id: 'part', label: 'Part of the day', value: PART_WORDS[part], sub: `${PART_WORDS[next]} comes next.`, ...(advance ? { tap: PART_FACT_TAP } : {}) });
}

/**
 * The town's current mode: the GM's pick, else the newest expedition's mode (dt-2), else the setting's first. The Depart
 * sheet's own start adds fno-1's town way on top (`departSheetModeOf`).
 */
export function departModeOf<M extends { id: string }>(modes: readonly M[], picked: string | null, last: string | null): M | undefined {
  return modes.find((m) => m.id === picked) ?? modes.find((m) => m.id === last) ?? modes[0];
}

/** The town way of exploring (07 Settlements): the setting's first mode whose step is a part of the day. */
function townWayOf<M extends { id: string; step: { unit: string } }>(modes: readonly M[]): M | undefined {
  return modes.find((m) => isPartOfDay(m.step.unit));
}

/**
 * The mode the Depart sheet starts on (fno-1, Francis, "A", 2026-11-15, design/rulings/dec-morning-2026-11-15.md): the
 * GM's pick on the sheet; else the town way when no expedition has ever been started (`last` null) or the party is in a
 * settlement; else today's rule (the newest expedition's mode, else the first). A setting with no town way keeps
 * today's rule. The town's own current mode is unchanged (`departModeOf`).
 */
export function departSheetModeOf<M extends { id: string; step: { unit: string } }>(
  modes: readonly M[],
  input: { picked: string | null; last: string | null; inSettlement: boolean },
): M | undefined {
  const picked = modes.find((m) => m.id === input.picked);
  if (picked) return picked;
  const town = input.last === null || input.inSettlement ? townWayOf(modes) : undefined;
  return town ?? departModeOf(modes, null, input.last);
}

/**
 * The party is in a settlement between expeditions (fno-1): every group stands at a place that is a settlement (the
 * pack's mark, or Safe or Hostile; `isSettlement`). A group with no place, or no groups, is not. Read from the newest
 * expedition's last places (`loadLastPlaces`), the town screen's own read.
 */
export function partyInSettlement(groups: readonly { place: Pick<Place, 'settlement' | 'safety'> | null }[]): boolean {
  return groups.length > 0 && groups.every((g) => isSettlement(g.place));
}

/**
 * The method a picked place gives the Depart sheet (p2p-5, p2p-6; page 24, DP1, approved 2026-11-18): a Location
 * (`isLocation`: the pack's `area` that isn't a hex) is travelled point to point, along its routes' ways; any other
 * place gives none, and the sheet keeps today's start for it (`departMethodOf`). A stand-in rule: the rulings say
 * "filled in from the place" and draw The Anchorage as Point to point, without saying how other places read.
 */
export function placeMethodOf(place: Pick<PackPlace, 'type' | 'hex'> | null | undefined): string | null {
  return place && isLocation(place) ? POINT_TO_POINT_ID : null;
}

/**
 * The method the Depart sheet shows (p2p-5; page 24, DP1): the pick, which the picked place fills in
 * (`placeMethodOf`) and the GM's tap sets, shown as soon as it is made (before Where? too: the review of #1037);
 * with no pick, unset (null) until a place is picked, then today's start (`departSheetModeOf`: fno-1's town way, else
 * the newest expedition's mode, else the first).
 */
export function departMethodOf<M extends { id: string; step: { unit: string } }>(
  methods: readonly M[],
  input: { picked: string | null; placed: boolean; last: string | null; inSettlement: boolean },
): M | null {
  const picked = methods.find((m) => m.id === input.picked);
  if (picked) return picked;
  if (!input.placed) return null;
  return departSheetModeOf(methods, input) ?? null;
}

/** One group of the Depart sheet's Where? (page 24, DP1): its Area's name over its Locations. */
export interface LocationGroup {
  /** "<packId>:<entryId>" of the Area, or "pack:<packId>" where a Location has no place above it. */
  key: string;
  /** The Area's name (the heading), else the nearest place above, else the pack's name. */
  name: string;
  locations: PackPlace[];
}

/** The heading a Location is grouped under: its Area (the nearest `site` above it), else the nearest place above it. */
function areaOf(places: readonly PackPlace[], place: PackPlace): PackPlace | null {
  const above = ancestorsOf(places, place);
  return above.find((p) => p.type === 'site') ?? above[0] ?? null;
}

/** The Area's name under a picked Location's name on the Depart sheet (DP1: "The Anchorage", then "The Drowned Harbour"). */
export function departAreaName(places: readonly PackPlace[], place: PackPlace): string | null {
  return isLocation(place) ? (areaOf(places, place)?.name ?? null) : null;
}

/**
 * The Locations the Depart sheet's Where? lists (p2p-2, p2p-5; page 24, DP1): only Locations, each group headed by its
 * Area's name, never an Area or a Region as a row. Groups follow each pack's own tree, depth first, in the packs'
 * order, so a Location under another Location stays in its Area's group; a group's rows are in the Locations' order
 * (`byMapNumber`, Q1: no map number first, then by number). Empty where no attached pack gives a
 * Location (the sheet then offers today's picker, the plan's ⚑ 6).
 */
export function departLocationGroups(places: readonly PackPlace[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  const seen = new Set<PackPlace>();
  const walk = (list: readonly PackPlace[]) => {
    for (const place of list) {
      // A loop in a pack's tree ends the walk there.
      if (seen.has(place)) continue;
      seen.add(place);
      if (isLocation(place)) {
        const area = areaOf(places, place);
        const key = groupKeyOf(place, area);
        const group = groups.get(key) ?? { key, name: area?.name ?? place.packName, locations: [] };
        group.locations.push(place);
        groups.set(key, group);
      }
      walk(childrenOf(places, place));
    }
  };
  for (const pack of packsWithPlaces(places)) walk(rootsOf(places, pack.packId));
  // Within a group, the Locations' own order (Q1): a Location under another one joins its Area's group in that order too.
  return [...groups.values()].map((group) => ({ ...group, locations: byMapNumber(group.locations, (p) => p.key) }));
}

/** A group's key (`LocationGroup.key`): its Area's, else the pack's. */
function groupKeyOf(place: PackPlace, area: PackPlace | null): string {
  return area ? `${area.packId}:${area.entryId}` : `pack:${place.packId}`;
}

/**
 * The words at a row's right in the Depart list (sf-2; page 44, DP3 B): the place's Area (the nearest `site` above
 * it), else the nearest place above it, else its pack's name.
 */
export function departAreaOf(places: readonly PackPlace[], place: PackPlace): string {
  return areaOf(places, place)?.name ?? place.packName;
}

/**
 * The group of the Depart list that starts open (sf-2, ⚑ 10 ruled 2026-11-26: "The Area last played"): the Area of
 * the place already ticked (`picked`), where a group lists it (the review of #124: reopened, the tick shows); else the
 * Area of the newest of the campaign's places (`recent`, newest first) that a pack's Location or Area gives, where it
 * heads a group; else the first group; null with no group. The others start folded.
 */
export function departOpenGroup(groups: readonly LocationGroup[], places: readonly PackPlace[], recent: readonly Pick<Place, 'pack'>[], picked: PackPlace | null = null): string | null {
  const keys = new Set(groups.map((g) => g.key));
  // A Location opens its Area's group; an Area stood at before (from before p2p-2) opens its own.
  const keyOf = (at: PackPlace) => (isLocation(at) ? groupKeyOf(at, areaOf(places, at)) : `${at.packId}:${at.entryId}`);
  if (picked && isLocation(picked) && keys.has(keyOf(picked))) return keyOf(picked);
  for (const visit of recent) {
    const at = visit.pack ? places.find((p) => p.packId === visit.pack!.packId && p.entryId === visit.pack!.entryId) : undefined;
    if (!at) continue;
    const key = keyOf(at);
    if (keys.has(key)) return key;
  }
  return groups[0]?.key ?? null;
}
