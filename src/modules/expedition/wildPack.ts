// The M5b wilderness pack shapes (rulings of 2026-10-30: Session 1 and dry run 3, S1–S4, D4, D8, D9, D14, D15,
// D19). Names 07 fixes: movement's `name`, `unit`, `perDay`, `forced.factor`, `mounted`, `vehicle`; `weather.tags`
// with `budget` and `warn`; checks' `alsoWhen`. Names the design chat confirmed on 2026-10-30 (approved by Francis):
// `movement.routes`, `forced.add` and `forced.stack`, all four `alsoWhen` keys, `camp.sleep` (difficulties with
// `result`; bedding "none" | { any } | { all }; beddingItems [{ id, shares? }]), an item's `food`, and activities'
// `yields`; `camp.cooking` is final (ruled 2026-11-01, engine reconcile ⚑ 1). Weather tags are read once, by
// modes.ts `readWeather`. Every shape lives in this file, so a rename is one edit here. Reading is forgiving like modes.ts:
// a shape that can't be read is left out, never a failure. Pure.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : []);
/** One id or a list of ids. */
const idList = (value: unknown): string[] => (text(value) ? [value as string] : strings(value));
const noteOf = (data: Record<string, unknown>) => text(data.note) ?? text(data.notes);

/**
 * A route the party can follow (S2): Wild, Road, Track, a river downstream… Confirmed: `movement.routes`
 * `[{ id, name, cost?, column?, note? }]`. `cost` (a whole number) is what one Move… along it costs, in place of
 * the terrain's cost; without it the terrain's cost applies. `column` names the encounter table column the route
 * suggests (road or wild). The route's id is also what checks' `routeType` modifiers and `alsoWhen` match.
 */
export interface Route {
  id: string;
  name: string;
  cost: number | null;
  column: string | null;
  note: string | null;
}

/**
 * Forced march (D4). Either `factor` (07: the base is multiplied and rounded down) or `add` (whole points); `stack`
 * "once" (a second forced march the same day adds nothing) or "add" (each one adds again), default "once".
 */
export interface Forced {
  factor: number | null;
  add: number | null;
  stack: 'once' | 'add';
  note: string | null;
}

/** The day's travel budget as the mode's `movement` (kind `budget`) writes it (07), with its routes. */
export interface Travel {
  /** The pack's name for the budget ("Leagues"); "Travel" when it gives none. */
  name: string;
  /** `points` or `miles` (07); points by default. */
  unit: string;
  /** A formula of `speed` (07); null: the GM sets the budget by hand. */
  perDay: string | null;
  /** Speeds that replace the party's speed when it rides or has a cart (07); null: the GM is asked. */
  mounted: number | null;
  vehicle: number | null;
  forced: Forced | null;
  routes: Route[];
  note: string | null;
}

/**
 * Event-triggered checks (D9): `checks[].alsoWhen`, one object or a list, with the keys `leaveRoute`, `enterRoute`,
 * `enterTerrain` and `leaveTerrain`. Each key is one trigger; any one matching prompts the check.
 */
export interface Trigger {
  event: 'leaveRoute' | 'enterRoute' | 'enterTerrain' | 'leaveTerrain';
  id: string;
}

/** What a sleep difficulty leads to (07 `camp.sleep`, confirmed 2026-10-30): a good or bad rest with no roll, or the check. */
export type SleepResult = 'good' | 'check' | 'bad';
const SLEEP_RESULTS: readonly SleepResult[] = ['good', 'check', 'bad'];

/** A sleep difficulty (D19): `camp.sleep.difficulties` `[{ id, name, result, add? }]`. */
export interface SleepDifficulty {
  id: string;
  name: string;
  /** "good" or "bad": no roll (the pack's onGoodRest / onBadRest follow); "check": the sleep check. Unreadable: "check". */
  result: SleepResult;
  /** Added to the sleep check (a whole number; may be negative). */
  add: number;
}

/**
 * A row's bedding condition: `"none"` (no bedding item covers the character), `{ any: [ids] }` (one of them does)
 * or `{ all: [ids] }` (every one of them does).
 */
export type BeddingCondition = 'none' | { any: string[] } | { all: string[] };

/**
 * One row of the pack's sleep table as conditions (D19): `camp.sleep.rows` `[{ season?, fire?, bedding?,
 * difficulty }]`: `season` one id or a list; `fire` true or false; `bedding` a BeddingCondition. A missing
 * condition matches anything. Rows are tried in order; the first that matches wins.
 */
export interface SleepRow {
  seasons: string[];
  fire: boolean | null;
  bedding: BeddingCondition | null;
  difficulty: string;
}

/** An item that counts as bedding; one can cover `shares` characters (a tent covers two). Default 1. */
export interface BeddingItem {
  id: string;
  shares: number;
}

/**
 * Sleep from facts (D19): `camp.sleep` `{ difficulties, rows, beddingItems, modifiers?, checkAbility?, note? }`;
 * `modifiers` `[{ when: "<fact>", add, note? }]` for camp facts such as campfire talk.
 */
export interface SleepRules {
  difficulties: SleepDifficulty[];
  rows: SleepRow[];
  /** The items that count as bedding. */
  beddingItems: BeddingItem[];
  modifiers: { when: string; add: number; note: string | null }[];
  checkAbility: string | null;
  note: string | null;
}

/**
 * Cooking (D15; final, ruled 2026-11-01): `camp.cooking` `{ ingredients?, portions, bonus?, note? }`: `portions` is a whole
 * number or dice per ingredient cooked; `bonus` effects in the `onGoodRest` shape (`[{ "heal": 1 }]`) that come
 * with eating a portion; `ingredients` the item ids that can be cooked (empty: the GM's judgement).
 */
export interface Cooking {
  ingredients: string[];
  portions: number | string;
  bonus: Record<string, unknown>[];
  note: string | null;
}

/** Food (D14): an item's `food`. Portions made by cooking are `cooked`. */
export type FoodKind = 'cooked' | 'fresh' | 'preserved';

/**
 * What a forage or hunt result gives: `yields` `{ item, dice }` (whole items, a bundle each) or `{ item, units }`
 * (single pieces of a bundled item: a day's food from a week's rations; G-108 with G-92's `units`). An activity's
 * `bySeason` dice override the count either way.
 */
export interface Yields {
  item: string;
  /** How many, as dice or a number ("1d3", "3"). */
  dice: string;
  /** The count is of single pieces (`units`), not whole items or bundles. */
  units: boolean;
}

/** The wilderness parts of one mode. */
export interface WildRules {
  travel: Travel | null;
  sleep: SleepRules | null;
  cooking: Cooking | null;
}

export const NO_WILD: WildRules = { travel: null, sleep: null, cooking: null };

function readRoute(data: Record<string, unknown>): Route | null {
  const id = text(data.id);
  if (!id) return null;
  const cost = int(data.cost);
  return { id, name: text(data.name) ?? id, cost: cost !== null && cost >= 0 ? cost : null, column: text(data.column), note: noteOf(data) };
}

function readForced(value: unknown): Forced | null {
  if (!isRecord(value)) return null;
  const factor = typeof value.factor === 'number' && Number.isFinite(value.factor) && value.factor > 0 ? value.factor : null;
  const add = int(value.add);
  if (factor === null && add === null) return null;
  return { factor, add, stack: value.stack === 'add' ? 'add' : 'once', note: noteOf(value) };
}

const positive = (value: unknown) => {
  const n = int(value);
  return n !== null && n > 0 ? n : null;
};

/** The mode's travel budget, when its movement is a day-by-day budget (07: `kind: "budget"`). */
export function readTravel(movement: unknown): Travel | null {
  if (!isRecord(movement) || movement.kind !== 'budget') return null;
  return {
    name: text(movement.name) ?? 'Travel',
    unit: text(movement.unit) ?? 'points',
    perDay: text(movement.perDay),
    mounted: positive(movement.mounted),
    vehicle: positive(movement.vehicle),
    forced: readForced(movement.forced),
    routes: records(movement.routes).flatMap((r) => readRoute(r) ?? []),
    note: noteOf(movement),
  };
}

const TRIGGER_KEYS: readonly Trigger['event'][] = ['leaveRoute', 'enterRoute', 'enterTerrain', 'leaveTerrain'];

/** A check's `alsoWhen`: one object or a list; unknown keys are left out. */
export function readTriggers(value: unknown): Trigger[] {
  const list = Array.isArray(value) ? records(value) : isRecord(value) ? [value] : [];
  return list.flatMap((t) => TRIGGER_KEYS.flatMap((event) => (text(t[event]) ? [{ event, id: t[event] as string }] : [])));
}

/** A row's bedding: null when the row doesn't say; undefined when it says something unreadable (the row is left out). */
function readBedding(value: unknown): BeddingCondition | null | undefined {
  if (value === undefined) return null;
  if (value === 'none') return 'none';
  if (isRecord(value) && strings(value.any).length) return { any: strings(value.any) };
  if (isRecord(value) && strings(value.all).length) return { all: strings(value.all) };
  return undefined;
}

export function readSleep(value: unknown): SleepRules | null {
  if (!isRecord(value)) return null;
  const difficulties = records(value.difficulties).flatMap((d) => {
    const id = text(d.id);
    const result = SLEEP_RESULTS.find((r) => r === d.result) ?? 'check';
    return id ? [{ id, name: text(d.name) ?? id, result, add: int(d.add) ?? 0 }] : [];
  });
  const known = new Set(difficulties.map((d) => d.id));
  const rows = records(value.rows).flatMap((r): SleepRow[] => {
    const difficulty = text(r.difficulty);
    if (!difficulty || !known.has(difficulty)) return [];
    const bedding = readBedding(r.bedding);
    if (bedding === undefined) return [];
    return [{ seasons: idList(r.season ?? r.seasons), fire: typeof r.fire === 'boolean' ? r.fire : null, bedding, difficulty }];
  });
  if (!difficulties.length) return null;
  return {
    difficulties,
    rows,
    beddingItems: records(value.beddingItems).flatMap((b) => (text(b.id) ? [{ id: b.id as string, shares: positive(b.shares) ?? 1 }] : [])),
    modifiers: records(value.modifiers).flatMap((m) => (text(m.when) && int(m.add) !== null ? [{ when: m.when as string, add: m.add as number, note: noteOf(m) }] : [])),
    checkAbility: text(value.checkAbility),
    note: noteOf(value),
  };
}

export function readCooking(value: unknown): Cooking | null {
  if (!isRecord(value)) return null;
  const portions = int(value.portions) !== null && (value.portions as number) > 0 ? (value.portions as number) : text(value.portions);
  if (portions === null) return null;
  return { ingredients: idList(value.ingredients), portions, bonus: records(value.bonus), note: noteOf(value) };
}

/** The wilderness parts of a mode as the pack writes it (its `movement` and `camp`). */
export function readWild(mode: Record<string, unknown>): WildRules {
  const camp = isRecord(mode.camp) ? mode.camp : {};
  return { travel: readTravel(mode.movement), sleep: readSleep(camp.sleep), cooking: readCooking(camp.cooking) };
}

/** An item's food kind (D14); null when it isn't food. */
export function foodKindOf(item: Record<string, unknown>): FoodKind | null {
  return item.food === 'cooked' || item.food === 'fresh' || item.food === 'preserved' ? item.food : null;
}

/** An activity's `yields` (07, planned 2026-10-30); null when it gives no item. */
export function readYields(value: unknown): Yields | null {
  if (!isRecord(value) || !text(value.item)) return null;
  const item = value.item as string;
  const units = typeof value.units === 'number' && Number.isInteger(value.units) && value.units >= 1 ? String(value.units) : text(value.units);
  if (units) return { item, dice: units.trim(), units: true };
  return text(value.dice) ? { item, dice: value.dice as string, units: false } : null;
}
