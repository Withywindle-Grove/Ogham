// Exploration modes as a rules set writes them (docs/07 "Exploration", the G-07 shapes ruled 2026-10-29; 05
// "Exploration modes"). Reading is forgiving: free text is `note` (`notes` read as an alias), unknown or replaced
// shapes are left out, and nothing a pack writes can make reading fail. With no attached pack defining modes the
// app offers two plain fallbacks, Dungeon (turn by turn) and Wilderness (day by day), with the clock, lights and
// reminders but no checks. Beside them, whatever the packs say, the app offers one method of its own, point to point
// (p2p-6, ruled 2026-11-18): `pointToPoint`, `methodsOf`, and `modeById` for an expedition started in it. Pure.
import { optionSpecOn, specText } from '../library/optionGate.ts';
import type { Choices } from '../library/options.ts';
import { isPartOfDay, type Amount } from './clock.ts';
import { NO_WILD, readCooking, readSleep, readTriggers, readWild, readYields, type Cooking, type SleepRules, type Trigger, type WildRules, type Yields } from './wildPack.ts';
import { onlyWhenOf, type OnlyWhen } from './townSwitches.ts';
import { readPartyCondition, readPartyModifier, type PartyCondition, type PartyModifier } from './partyModifiers.ts';

export const STEP_KINDS = ['note', 'roll', 'check', 'camp', 'watches', 'auto'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

/** The closed symbol list (ruled 2026-10-29: 19). Anything else shows the plain dot. */
export const ICONS = ['time', 'light', 'listen', 'door', 'search', 'rest', 'camp', 'travel', 'weather', 'encounter', 'star', 'note', 'watch', 'describe', 'course', 'lost', 'monster', 'forage', 'hunt'] as const;
export type Icon = (typeof ICONS)[number] | 'dot';

export interface Chance {
  /** The die named ("d6"); null when the pack gives only the faces (the GM's die at the table). */
  die: string | null;
  on: number[];
}

export interface Step {
  id: string;
  name: string;
  icon: Icon;
  kind: StepKind;
  note: string | null;
  /** roll: the table, or by season; neither means the GM types the result with the note as the prompt. */
  tableId: string | null;
  tableBySeason: Record<string, string>;
  /** check: the mode's check it runs. */
  checkId: string | null;
  /** watches: how long one watch is. */
  watchLength: Amount | null;
  /** A sleep roll's ability, and what a good or bad rest offers (one confirm, never automatic). */
  checkAbility: string | null;
  onGoodRest: Record<string, unknown>[];
  onBadRest: { condition: string }[];
  /** Only while this optional rule is on (07 `option`, WA1: any camp step may carry it); missing or null: always. */
  onlyWithOption?: string | null;
}

export type CheckModifier = (
  | { kind: 'weatherTag'; tag: string; add: number; note: string | null }
  | { kind: 'routeType'; route: string; never: boolean; chance: Chance | null; note: string | null }
  | { kind: 'track'; trackId: string; min: number | null; max: number | null; chance: Chance | null; add: number; note: string | null }
  /** Keyed to the party (ex-2, ga-3): `ifPartyHas`, `who: "self"` with `ifClass`, `onlyOnTerrain`; adds or sets the faces. */
  | ({ kind: 'party' } & PartyModifier)
) & {
  /**
   * Only while this optional rule is on (of-4, G-100: a weather effect's penalty on the lost check): `onlyWithOption`
   * or `option`, read by the shared reader; while off, the modifier doesn't apply. Absent: always.
   */
  onlyWithOption?: string | null;
};

export interface OnHit {
  tableId: string | null;
  /** The GM picks one (e.g. by depth). */
  tableChoices: string[];
  /** The GM picks a column of a shared table (e.g. road or wild), unless the terrain names one. */
  columns: string[];
  /** Then the region's table, through the rules set's wildEncounters. */
  regionTables: boolean;
  note: string | null;
}

export interface Check {
  id: string;
  name: string;
  /** How often it falls due; null means every step of the mode. */
  every: Amount | null;
  /** In a day-long step: at its start, middle (half the budget spent) or end; null: procedure order. */
  when: 'start' | 'middle' | 'end' | null;
  /** null with byTerrain false: always roll the table (the encounter-check shape's `chance: null`). */
  chance: Chance | null;
  byTerrain: boolean;
  /**
   * With byTerrain, which of the terrain's chances it uses (ruled 2026-10-29, engine ruling 1). Null: guessed from
   * the symbol of the step that runs it ("lost" uses lostChance, anything else wanderChance), with a warning.
   */
  terrainChance: TerrainChance | null;
  onlyAt: 'day' | 'night' | null;
  onHit: OnHit;
  modifiers: CheckModifier[];
  /** checks[].secret (default true; ruled 2026-10-29): players see a secret result only at Downtime, an open one at once. */
  secret: boolean;
  /** checks[].alsoWhen (ruled 2026-10-30, D9): a Move… that matches also prompts the check (eventChecks.ts). */
  alsoWhen: Trigger[];
  note: string | null;
  /**
   * Only while this optional rule is on (07, onlyWithOption; ruled 2026-10-30, WA1: any check may carry it), such as
   * a pack's gutter check for the party's lights (DG6). Missing or null: always.
   */
  onlyWithOption?: string | null;
  /**
   * checks[].onlyWhen (ruled 2026-11-03, sw-1 … sw-4): "outDay" runs only while the GM's Out and about today is on,
   * "activeNight" only while Active tonight is on (townSwitches.ts). Missing or null: always.
   */
  onlyWhen?: OnlyWhen | null;
}

/** The terrain's chances a byTerrain check can use. */
export type TerrainChance = 'lostChance' | 'wanderChance';

export interface TerrainClass {
  id: string;
  name: string;
  cost: number | null;
  searchCost: number | null;
  lostChance: number[] | null;
  wanderChance: number[] | null;
  mounts: 'ride' | 'lead' | 'none' | null;
  vehicles: boolean | null;
}

export interface Terrain extends TerrainClass {
  classId: string | null;
  encounterTableId: string | null;
  encounterColumn: string | null;
  note: string | null;
}

export interface ActivityModifier {
  /** When it counts, in the pack's words ("fullDay"); '' for a party modifier that names none. */
  when: string;
  add: number;
  note: string | null;
  /** Keyed to the party (ex-2, ga-3): who must have what, and where; missing or null: the pack's plain modifier. */
  party?: PartyCondition | null;
  /** It sets the chance's faces instead of adding (ga-3). */
  chance?: Chance | null;
}

export type ActivityCost = { steps: number } | { budget: number | 'all' } | { time: Amount } | { fromTerrain: string };

export interface Activity {
  id: string;
  name: string;
  icon: Icon;
  cost: ActivityCost | null;
  /** A skill, or a list of skills of which the character's best counts (ex-3); or an ability check. */
  chance: { skill: string | string[] } | { abilityCheck: string } | null;
  requires: { skill: string | null; item: string | null };
  who: 'one' | 'several' | 'party';
  maxActors: number | null;
  bestOf: boolean;
  secret: boolean;
  modifiers: ActivityModifier[];
  result: string | null;
  tableId: string | null;
  tableByTerrain: Record<string, string>;
  bySeason: Record<string, string>;
  bySpecialSeason: Record<string, string>;
  onlyIn: string[];
  onlyOnTerrain: string[];
  seasons: string[];
  onlyWithOption: string | null;
  /** What a result gives (07 `yields`, planned 2026-10-30): an item and how many. */
  yields: Yields | null;
  note: string | null;
}

export interface Rest {
  every: Amount;
  length: Amount | null;
  condition: string | null;
  note: string | null;
}

/** The campfire (07 `camp.fire`, D16): the light type it burns as; its `fuelItemId` is the firewood. */
export interface CampFire {
  lightTypeId: string;
  note: string | null;
}

export interface Camp {
  procedure: Step[];
  quickOption: string | null;
  note: string | null;
  /** Reuses another mode's camp; resolved by campOf. */
  sameAs: string | null;
  /** M5b step 4: the campfire, cooking and sleep of this camp (07 `camp.fire`, `camp.cooking`, `camp.sleep`); campOf follows sameAs. */
  fire?: CampFire | null;
  cooking?: Cooking | null;
  sleep?: SleepRules | null;
}

/**
 * One weather tag (07 `weather.tags`, ruled 2026-10-25 and 2026-10-30, D1, A11): its name, the pack's text for it
 * (`note`; a provisional `effect` is read as an alias), the change to today's travel budget, and the GM's movement
 * warning. Players read all of it; the app shows players the name, the text and the number.
 */
export interface WeatherTag {
  name: string;
  note: string | null;
  budget: number | null;
  warn: string | null;
}

export interface Weather {
  /** Keyed by season id, special season id or `any`: a table id. */
  tables: Record<string, string>;
  rollEvery: Amount;
  onlyWithOption: string | null;
  /** The tags a weather table's rows name, by tag id. */
  tags: Record<string, WeatherTag>;
}

export interface Mode {
  id: string;
  name: string;
  step: Amount;
  /** Turn by turn (the hour track) or day by day (the procedure strip; an hour-step mode is one of these). */
  pace: 'turn' | 'day';
  procedure: Step[];
  checks: Check[];
  rest: Rest | null;
  camp: Camp | null;
  terrain: Terrain[];
  activities: Activity[];
  /** The mode's own weather, overriding the rules set's. */
  weather: Weather | null;
  /** The die for terrain faces when a check names none ("d6"; ruled 2026-10-29, engine ruling 2); null: d6. */
  chanceDie: string | null;
  /** Show Other… on the activities row (default true). */
  other: boolean;
  movement: Record<string, unknown> | null;
  note: string | null;
  /** One of the app's plain fallbacks (no pack defines modes). */
  fallback: boolean;
  /** The wilderness parts (travel budget, routes, sleep, cooking; M5b; wildPack.ts). */
  wild: WildRules;
}

export interface SpecialSeason {
  id: string;
  name: string;
  weatherTableId: string | null;
  weatherFrom: string | null;
  encounterSwap: { chance: Chance; tableId: string } | null;
  effects: string | null;
}

/** What a rules set adds around its modes: seasons, weather, special seasons and the wild encounter tables. */
export interface ExplorationRules {
  modes: Mode[];
  /** True when the modes are the app's plain fallbacks. */
  fallback: boolean;
  playerReadable: boolean;
  seasons: { id: string; name: string }[];
  specialSeasons: SpecialSeason[];
  weather: Weather | null;
  wildEncounters: { typeTableId: string | null; regionalTables: Record<string, string>; aquaticTableId: string | null } | null;
  note: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : []);
const stringMap = (value: unknown): Record<string, string> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string')) : {};
/** Free text: `note`, with `notes` read as an alias (G-07). */
const noteOf = (data: Record<string, unknown>) => text(data.note) ?? text(data.notes);

export function amountOf(value: unknown): Amount | null {
  if (!isRecord(value)) return null;
  const n = int(value.value);
  return n !== null && n >= 0 && typeof value.unit === 'string' && value.unit ? { value: n, unit: value.unit } : null;
}

export function iconOf(value: unknown): Icon {
  return typeof value === 'string' && (ICONS as readonly string[]).includes(value) ? (value as Icon) : 'dot';
}

/** Faces only ([1, 2]) or { die, on }; null when it can't be read. */
export function chanceOf(value: unknown, die: string | null = null): Chance | null {
  const faces = (list: unknown) => (Array.isArray(list) && list.every((f) => int(f) !== null) ? (list as number[]) : null);
  if (Array.isArray(value)) {
    const on = faces(value);
    return on ? { die, on } : null;
  }
  if (!isRecord(value)) return null;
  const on = faces(value.on);
  return on ? { die: text(value.die) ?? die, on } : null;
}

function readStep(data: Record<string, unknown>, i: number): Step | null {
  const kind = typeof data.kind === 'string' && (STEP_KINDS as readonly string[]).includes(data.kind) ? (data.kind as StepKind) : null;
  if (!kind) return null;
  const id = text(data.id) ?? `step-${i + 1}`;
  return {
    id,
    name: text(data.name) ?? id,
    icon: iconOf(data.icon),
    kind,
    note: noteOf(data),
    tableId: text(data.tableId),
    tableBySeason: stringMap(data.tableBySeason),
    checkId: text(data.checkId),
    watchLength: amountOf(data.watchLength),
    checkAbility: text(data.checkAbility),
    onGoodRest: records(data.onGoodRest),
    onBadRest: records(data.onBadRest).flatMap((r) => (text(r.condition) ? [{ condition: r.condition as string }] : [])),
    onlyWithOption: optionSpecOf(data),
  };
}

const stepsOf = (value: unknown) => records(value).flatMap((s, i) => readStep(s, i) ?? []);

function readModifier(data: Record<string, unknown>): CheckModifier | null {
  const modifier = readModifierOnly(data);
  // of-4: a modifier may sit behind an option, as a check may (the shared reader's spec, `option` or `onlyWithOption`).
  const option = optionSpecOf(data);
  return modifier && option ? { ...modifier, onlyWithOption: option } : modifier;
}

function readModifierOnly(data: Record<string, unknown>): CheckModifier | null {
  const note = noteOf(data);
  if (readPartyCondition(data)) {
    const party = readPartyModifier(data, note);
    return party ? { kind: 'party', ...party } : null;
  }
  if (text(data.weatherTag)) return int(data.add) !== null ? { kind: 'weatherTag', tag: data.weatherTag as string, add: data.add as number, note } : null;
  if (text(data.routeType)) {
    const chance = chanceOf(data.chance);
    return data.never === true || chance ? { kind: 'routeType', route: data.routeType as string, never: data.never === true, chance, note } : null;
  }
  if (text(data.trackId)) {
    const chance = chanceOf(data.chance);
    const add = int(data.add) ?? 0;
    return chance || add ? { kind: 'track', trackId: data.trackId as string, min: int(data.min), max: int(data.max), chance, add, note } : null;
  }
  return null;
}

function readOnHit(check: Record<string, unknown>): OnHit {
  const hit = isRecord(check.onHit) ? check.onHit : {};
  return {
    // Inside modes onHit.tableId is preferred; the encounter-check shape's own tableId stays valid.
    tableId: text(hit.tableId) ?? text(check.tableId),
    tableChoices: strings(hit.tableChoices),
    // The older single `column` with two labels joined by a bar ("road|wild") reads as `columns` (ruled 2026-10-29).
    columns: hit.columns !== undefined ? strings(hit.columns) : text(hit.column) ? (hit.column as string).split('|').map((c) => c.trim()).filter(Boolean) : [],
    regionTables: hit.regionTables === true,
    note: noteOf(hit),
  };
}

export function readCheck(data: Record<string, unknown>, i = 0): Check | null {
  const id = text(data.id) ?? `check-${i + 1}`;
  const when = data.when === 'start' || data.when === 'middle' || data.when === 'end' ? data.when : null;
  const onlyAt = data.onlyAt === 'day' || data.onlyAt === 'night' ? data.onlyAt : null;
  return {
    id,
    name: text(data.name) ?? id,
    every: amountOf(data.every),
    when,
    chance: chanceOf(data.chance),
    byTerrain: data.byTerrain === true,
    terrainChance: data.terrainChance === 'lostChance' || data.terrainChance === 'wanderChance' ? data.terrainChance : null,
    onlyAt,
    onHit: readOnHit(data),
    modifiers: [...records(data.modifiers), ...records(data.byTrack)].flatMap((m) => readModifier(m) ?? []),
    secret: data.secret !== false,
    alsoWhen: readTriggers(data.alsoWhen),
    note: noteOf(data),
    onlyWithOption: optionSpecOf(data),
    onlyWhen: onlyWhenOf(data.onlyWhen),
  };
}

function readTerrainClass(data: Record<string, unknown>): TerrainClass {
  const id = text(data.id) ?? '';
  const faces = (value: unknown) => chanceOf(value)?.on ?? null;
  const mounts = data.mounts === 'ride' || data.mounts === 'lead' || data.mounts === 'none' ? data.mounts : null;
  return {
    id,
    name: text(data.name) ?? id,
    cost: int(data.cost),
    searchCost: int(data.searchCost),
    lostChance: faces(data.lostChance),
    wanderChance: faces(data.wanderChance),
    mounts,
    vehicles: typeof data.vehicles === 'boolean' ? data.vehicles : null,
  };
}

/** A terrain takes its class's numbers unless it gives its own (both shapes are valid; G-07). */
function readTerrain(data: Record<string, unknown>, classes: readonly TerrainClass[]): Terrain | null {
  if (!text(data.id)) return null;
  const own = readTerrainClass(data);
  const classId = text(data.class);
  const base = classes.find((c) => c.id === classId);
  const pick = <K extends keyof TerrainClass>(key: K): TerrainClass[K] => (own[key] ?? base?.[key] ?? null) as TerrainClass[K];
  return {
    id: own.id,
    name: own.name,
    cost: pick('cost'),
    searchCost: pick('searchCost'),
    lostChance: pick('lostChance'),
    wanderChance: pick('wanderChance'),
    mounts: pick('mounts'),
    vehicles: pick('vehicles'),
    classId,
    encounterTableId: text(data.encounterTableId),
    encounterColumn: text(data.encounterColumn),
    note: noteOf(data),
  };
}

function readCost(value: unknown): ActivityCost | null {
  if (!isRecord(value)) return null;
  if (int(value.steps) !== null && (value.steps as number) >= 0) return { steps: value.steps as number };
  if (value.budget === 'all') return { budget: 'all' };
  if (int(value.budget) !== null && (value.budget as number) >= 0) return { budget: value.budget as number };
  const time = amountOf(value.time);
  if (time) return { time };
  if (text(value.fromTerrain)) return { fromTerrain: value.fromTerrain as string };
  return null;
}

/** An activity's modifier: the pack's `{ when, add }`, or one keyed to the party (ex-2, ga-3) that adds or sets. */
function readActivityModifier(m: Record<string, unknown>): ActivityModifier | null {
  const party = readPartyModifier(m, noteOf(m));
  if (party) return { when: text(m.when) ?? '', add: party.add, note: party.note, party: party.when, chance: party.chance };
  if (readPartyCondition(m)) return null;
  return text(m.when) && int(m.add) !== null ? { when: m.when as string, add: m.add as number, note: noteOf(m) } : null;
}

function readActivity(data: Record<string, unknown>): Activity | null {
  const id = text(data.id);
  if (!id) return null;
  const chance = isRecord(data.chance) ? data.chance : {};
  const requires = isRecord(data.requires) ? data.requires : {};
  const who = data.who === 'several' || data.who === 'party' ? data.who : 'one';
  const max = int(data.maxActors);
  // A list of skills (ex-3): one id stays a plain skill.
  const skills = (Array.isArray(chance.skill) ? chance.skill : [chance.skill]).map(text).filter((s): s is string => s !== null);
  return {
    id,
    name: text(data.name) ?? id,
    icon: iconOf(data.icon),
    cost: readCost(data.cost),
    chance: skills.length > 0 ? { skill: skills.length === 1 ? skills[0]! : skills } : text(chance.abilityCheck) ? { abilityCheck: chance.abilityCheck as string } : null,
    requires: { skill: text(requires.skill), item: text(requires.item) },
    who,
    maxActors: max !== null && max > 0 ? max : null,
    bestOf: data.bestOf === true,
    secret: data.secret === true,
    modifiers: records(data.modifiers).flatMap((m) => readActivityModifier(m) ?? []),
    result: typeof data.result === 'string' ? data.result : int(data.result) !== null ? String(data.result) : null,
    tableId: text(data.tableId),
    tableByTerrain: stringMap(data.tableByTerrain),
    bySeason: stringMap(data.bySeason),
    bySpecialSeason: stringMap(data.bySpecialSeason),
    onlyIn: strings(data.onlyIn),
    onlyOnTerrain: strings(data.onlyOnTerrain),
    seasons: strings(data.seasons),
    onlyWithOption: optionSpecOf(data),
    yields: readYields(data.yields),
    note: noteOf(data),
  };
}

export function readWeather(value: unknown): Weather | null {
  if (!isRecord(value)) return null;
  const tables = stringMap(value.tables);
  const tags = isRecord(value.tags)
    ? Object.fromEntries(
        Object.entries(value.tags).flatMap(([id, tag]) =>
          isRecord(tag) ? [[id, { name: text(tag.name) ?? id, note: noteOf(tag) ?? text(tag.effect), budget: int(tag.budget), warn: text(tag.warn) }] as const] : [],
        ),
      )
    : {};
  return { tables, rollEvery: amountOf(value.rollEvery) ?? { value: 1, unit: 'day' }, onlyWithOption: optionSpecOf(value), tags };
}

function readRest(value: unknown): Rest | null {
  if (!isRecord(value)) return null;
  const every = amountOf(value.every);
  return every && every.value > 0 ? { every, length: amountOf(value.length), condition: text(value.condition), note: noteOf(value) } : null;
}

function readCamp(value: unknown): Camp | null {
  if (!isRecord(value)) return null;
  const quick = isRecord(value.quick) ? text(value.quick.option) : null;
  const fire = isRecord(value.fire) && text(value.fire.lightTypeId) ? { lightTypeId: value.fire.lightTypeId as string, note: noteOf(value.fire) } : null;
  return { procedure: stepsOf(value.procedure), quickOption: quick, note: noteOf(value), sameAs: text(value.sameAs), fire, cooking: readCooking(value.cooking), sleep: readSleep(value.sleep) };
}

const TURN_UNITS = ['turn', 'turns', 'round', 'rounds', 'minute', 'minutes'];

/**
 * The app's own mode ids start with this (p2p-6). A rules set's mode can't take one: `readMode` leaves it out, as it
 * does any mode it can't read, so nothing a pack writes can stand in for a method of the app's, and the app's method
 * never hides a mode a pack may write.
 */
export const APP_MODE_PREFIX = 'app:';

/** Point to point's id, as an expedition stores it (`expeditions.mode`; p2p-6). */
export const POINT_TO_POINT_ID = `${APP_MODE_PREFIX}point-to-point`;

/** Point to point's unit where the place gives none: the campaign's turn, the unit Move on counts every way in (pt-f2). */
export const POINT_TO_POINT_UNIT = 'turn';

const paceOf = (unit: string): Mode['pace'] => (TURN_UNITS.includes(unit.toLowerCase()) ? 'turn' : 'day');

export function readMode(data: Record<string, unknown>): Mode | null {
  const id = text(data.id);
  const step = amountOf(data.step);
  if (!id || !step || step.value <= 0) return null;
  if (id.trim().toLowerCase().startsWith(APP_MODE_PREFIX)) return null;
  const classes = records(data.terrainClasses).map(readTerrainClass).filter((c) => c.id);
  return {
    id,
    name: text(data.name) ?? id,
    step,
    pace: paceOf(step.unit),
    procedure: stepsOf(data.procedure),
    checks: records(data.checks).flatMap((c, i) => readCheck(c, i) ?? []),
    rest: readRest(data.rest),
    camp: readCamp(data.camp),
    terrain: records(data.terrain).flatMap((t) => readTerrain(t, classes) ?? []),
    activities: records(data.activities).flatMap((a) => readActivity(a) ?? []),
    weather: readWeather(data.weather),
    chanceDie: text(data.chanceDie) && /^d\d+$/i.test((data.chanceDie as string).trim()) ? (data.chanceDie as string).trim() : null,
    other: data.other !== false,
    movement: isRecord(data.movement) ? data.movement : null,
    note: noteOf(data),
    fallback: false,
    wild: readWild(data),
  };
}

/** The one step of a mode with no procedure of its own: the clock moves. */
const TIME_PASSES: Step = { id: 'time', name: 'Time passes', icon: 'time', kind: 'auto', note: null, tableId: null, tableBySeason: {}, checkId: null, watchLength: null, checkAbility: null, onGoodRest: [], onBadRest: [] };

const fallback = (id: string, name: string, unit: string, pace: Mode['pace']): Mode => ({
  id,
  name,
  step: { value: 1, unit },
  pace,
  procedure: [TIME_PASSES],
  checks: [],
  rest: null,
  camp: null,
  terrain: [],
  activities: [],
  weather: null,
  chanceDie: null,
  other: true,
  movement: null,
  note: null,
  fallback: true,
  wild: NO_WILD,
});

/** The plain fallbacks (05): the clock, lights and reminders, no checks, no rules of the app's own. */
export const FALLBACK_MODES: readonly Mode[] = [fallback('dungeon', 'Dungeon', 'turn', 'turn'), fallback('wilderness', 'Wilderness', 'day', 'day')];

function readSpecialSeason(data: Record<string, unknown>): SpecialSeason | null {
  const id = text(data.id);
  if (!id) return null;
  const swap = isRecord(data.encounterSwap) ? data.encounterSwap : null;
  const chance = swap ? chanceOf(swap.chance) : null;
  return {
    id,
    name: text(data.name) ?? id,
    weatherTableId: text(data.weatherTableId),
    weatherFrom: text(data.weatherFrom),
    encounterSwap: swap && chance && text(swap.tableId) ? { chance, tableId: swap.tableId as string } : null,
    effects: text(data.effects),
  };
}

/**
 * The exploration rules the campaign uses: the modes of one rules set (when two attached packs define modes, the
 * GM picks one pack's, all or nothing: `pick` is its index among the rules sets; by default the top pack that has
 * modes), with that rules set's seasons, weather and wild encounters. Without any, the plain fallbacks.
 */
export function readExploration(rulesSets: readonly Record<string, unknown>[], pick?: number): ExplorationRules {
  const withModes = rulesSets.map((r, i) => ({ r, i })).filter(({ r }) => isRecord(r.exploration) && records(r.exploration.modes).some((m) => readMode(m)));
  const chosen = withModes.find(({ i }) => i === pick) ?? withModes[withModes.length - 1];
  const rules = chosen?.r ?? rulesSets[rulesSets.length - 1] ?? {};
  const exploration = chosen && isRecord(chosen.r.exploration) ? chosen.r.exploration : {};
  const modes = records(exploration.modes).flatMap((m) => readMode(m) ?? []);
  const wild = isRecord(rules.wildEncounters) ? rules.wildEncounters : null;
  return {
    modes: modes.length ? modes : [...FALLBACK_MODES],
    fallback: modes.length === 0,
    playerReadable: exploration.playerReadable === true,
    seasons: records(rules.seasons).flatMap((s) => (text(s.id) ? [{ id: s.id as string, name: text(s.name) ?? (s.id as string) }] : [])),
    specialSeasons: records(rules.specialSeasons).flatMap((s) => readSpecialSeason(s) ?? []),
    weather: readWeather(rules.weather),
    wildEncounters: wild ? { typeTableId: text(wild.typeTableId), regionalTables: stringMap(wild.regionalTables), aquaticTableId: text(wild.aquaticTableId) } : null,
    note: noteOf(exploration),
  };
}

/**
 * The setting's mode whose rest and camp point to point keeps for a unit of time (p2p-6: "by the setting's rules for
 * that unit"): the first of the campaign's modes with that very unit, else the first of the same pace (turn by turn
 * or day by day); none where the setting has no such mode. A town way (a mode stepped by the part of the day, 07
 * Settlements) is never the one: its rest and camp are the town's, not the road's.
 */
function settingModeFor(modes: readonly Mode[], unit: string): Mode | undefined {
  const same = unit.toLowerCase();
  const settings = modes.filter((m) => !isPointToPoint(m) && !isPartOfDay(m.step.unit));
  return settings.find((m) => m.step.unit.toLowerCase() === same) ?? settings.find((m) => m.pace === paceOf(unit));
}

/** Point to point as built, by the campaign's modes and then by unit, so the same question gives the same mode. */
const pointToPointModes = new WeakMap<readonly Mode[], Map<string, Mode>>();

/**
 * Point to point (p2p-6, ruled 2026-11-18): a third exploration method, the app's own, beside the campaign's modes.
 * One step is one `unit` of time, the unit of the ways leaving the party's place (`stepUnitOfWays`, moveOnWays.ts); a
 * turn where none is given. It has no check of its own (the place's own check runs, `Situation.locationCheck`), no
 * terrain and no activities. Rest and camp are the setting's for that unit (`settingModeFor`); lights burn on the
 * clock as in any mode. Its strip is `procedureInForce`'s (p2p-7). It is not one of the plain fallbacks: what it
 * borrows is the setting's, so players read its procedure only where they may read the setting's.
 */
export function pointToPoint(modes: readonly Mode[], unit: string = POINT_TO_POINT_UNIT): Mode {
  const built = pointToPointModes.get(modes) ?? new Map<string, Mode>();
  pointToPointModes.set(modes, built);
  const known = built.get(unit);
  if (known) return known;
  const setting = settingModeFor(modes, unit);
  const mode: Mode = {
    id: POINT_TO_POINT_ID,
    name: 'Point to point',
    step: { value: 1, unit },
    pace: paceOf(unit),
    procedure: [TIME_PASSES],
    checks: [],
    rest: setting?.rest ?? null,
    camp: setting?.camp ?? null,
    terrain: [],
    activities: [],
    weather: null,
    chanceDie: null,
    other: true,
    movement: null,
    note: null,
    fallback: false,
    wild: NO_WILD,
  };
  built.set(unit, mode);
  return mode;
}

/** Whether a mode, or an expedition's stored mode id, is point to point. */
export function isPointToPoint(mode: Pick<Mode, 'id'> | string | null | undefined): boolean {
  return (typeof mode === 'string' ? mode : mode?.id) === POINT_TO_POINT_ID;
}

/**
 * The exploration methods a campaign offers (p2p-6): its modes as they are (a rules set's, or the plain fallbacks),
 * then point to point. For the Depart sheet's choice (B7); the modes themselves are unchanged.
 */
export function methodsOf(modes: readonly Mode[]): Mode[] {
  return [...modes.filter((m) => !isPointToPoint(m)), pointToPoint(modes)];
}

/**
 * A mode by id. The old expedition values keep working (S17-1): "dungeon" is the first turn-by-turn mode and
 * "wilderness" the first day-by-day one, of the campaign's own modes. Point to point's id reads as point to point
 * whatever the modes are (p2p-6), at a turn; for the unit of the party's place, call `pointToPoint` with it.
 */
export function modeById(modes: readonly Mode[], id: string): Mode | null {
  if (isPointToPoint(id)) return pointToPoint(modes);
  const own = (pace: Mode['pace']) => modes.find((m) => m.pace === pace && !isPointToPoint(m));
  return modes.find((m) => m.id === id) ?? (id === 'dungeon' ? own('turn') : id === 'wilderness' ? own('day') : undefined) ?? null;
}

/** A mode's camp, following `sameAs` to another mode's (once; a loop or a missing mode gives just the note). */
export function campOf(mode: Mode, modes: readonly Mode[]): Camp | null {
  if (!mode.camp) return null;
  if (!mode.camp.sameAs) return mode.camp;
  const other = modes.find((m) => m.id === mode.camp!.sameAs && m.id !== mode.id);
  const theirs = other?.camp && !other.camp.sameAs ? other.camp : null;
  return {
    procedure: theirs?.procedure ?? [],
    quickOption: theirs?.quickOption ?? null,
    note: mode.camp.note ?? theirs?.note ?? null,
    sameAs: mode.camp.sameAs,
    fire: theirs?.fire ?? null,
    cooking: theirs?.cooking ?? null,
    sleep: theirs?.sleep ?? null,
  };
}

/**
 * The optional rule an entry needs (07, G-40, ruled 2026-11-01): `option: "<option id>[=<choice id>]"` is the name,
 * and the older `onlyWithOption: "<option id>[:<choice id>]"` is read as its alias; `option` wins when both are
 * given; either may be a list of them (of-12). Returned in optionOn's "<option id>[:<choice id>]" form; null when the
 * entry needs none.
 */
export function optionSpecOf(data: Record<string, unknown>): string | null {
  // A list (of-12) reads as its specs comma-separated: on while any is.
  const option = specText(data.option);
  if (option) return option.replace(/=/g, ':');
  return specText(data.onlyWithOption) || null;
}

/** "<option id>[:<choice id>]": on when the campaign chose that choice (no choice id: the option's `on` choice). */
export function optionOn(spec: string | null, choices: Choices): boolean {
  return optionSpecOn(spec, choices);
}

/** A terrain of the mode by id; null when the mode doesn't know it. */
export function terrainOf(mode: Mode, terrainId: string | null | undefined): Terrain | null {
  return terrainId ? (mode.terrain.find((t) => t.id === terrainId) ?? null) : null;
}
