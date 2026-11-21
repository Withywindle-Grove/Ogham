// Encumbrance (M4 step 3; docs/07-content-packs.md "Encumbrance", ruled 2026-10-23). Plain functions, no
// database: what a carrier's load is in the campaign's mode, its tier, and whether it's over the max.
// Every number comes from the setting rules; the app has none of its own. Modes: none (not tracked),
// armour (only treasure counts; movement from the armour worn), coin (weights and tiers) and slot (slots per
// stack and tiers). Containers either only hold (what's in them still counts; the max stays put) or add what
// they hold to the max and to every tier; a bag with a fixed weight always weighs that, and its contents
// never count. A bag with `weightEmpty` and `weightFull` weighs by how full it is, and its contents never count
// either (eq-5); an item's `carryBonus` raises its wearer's limit while worn or held (eq-6).
import type { EncumbranceMode } from '../../core/campaignSettings.ts';

export interface Tier {
  label: string;
  /** The most this tier allows: coins in coin mode, slots in slot mode. */
  max: number;
  effect: string;
  movement?: string;
}

/** The setting rules' encumbrance, combined across the campaign's packs and read into plain shapes. */
export interface EncumbranceRules {
  mode: EncumbranceMode | null;
  armour: {
    maxLoadCoin: number | null;
    movement: { armour: string; withoutTreasure: string; withTreasure: string }[];
    /** Item armour types to movement rows (`leather` → `light`), from the pack (ruled 2026-10-23). */
    armourTypes: Record<string, string>;
  } | null;
  coin: { maxLoadCoin: number | null; tiers: Tier[]; overMax: string; miscGearCoin: number; miscGearCategories: string[] } | null;
  slot: { baseSlots: number | null; tiers: Tier[]; overMax: string; bands?: SlotBands | null } | null;
  treasureWeights: Record<string, number | null>;
  containers: 'add' | 'hold-only';
  /** Item categories that aren't carried (animals, tack, vehicles, boats): the Pack's "Other" section, outside the load (07, ruled 2026-10-24). */
  separateCategories: string[];
}

/**
 * Slot encumbrance in two bands (ga-1, ruled 2026-11-03; 07 "Slot bands"): what's equipped and what's stowed are
 * counted apart, each looked up in its own list, and the slower speed wins (`combine: "slowest"`, the only way).
 * Each band's tiers carry their `movement` from the pack's `speed`; a band entry needs no label. `names` are the
 * pack's words for the two (`encumbrance.labels`), else "Equipped" and "Stowed".
 */
export interface SlotBands {
  equipped: Tier[];
  stowed: Tier[];
  combine: 'slowest';
  names: { equipped: string; stowed: string };
}

export type BandId = 'equipped' | 'stowed';

/** One band's load: its count, its most, its tier and speed (null: over, or no number), and whether it's over. */
export interface BandLoad {
  id: BandId;
  name: string;
  load: number;
  capacity: number | null;
  tier: Tier | null;
  speed: number | null;
  over: boolean;
  /** Which of its tiers it's in (0 the first; null when over), and the band's list as the pack gives it. */
  step: number | null;
  tiers: Tier[];
  /** How much every one of its tiers is raised (containers that add room, carry bonuses; eq-6): `raisedTiers`. */
  added: number;
}

/** What the load needs to know about one inventory line. */
export interface LoadLine {
  id: string;
  name: string;
  category: string;
  qty: number;
  weightCoin: number | null;
  slots: number | null;
  stack: number;
  containerLineId: string | null;
  equipped: boolean;
  /** The item's container block, when it is one. */
  container: { capacityCoin?: number; capacitySlots?: number; fixedWeightCoin?: number; weightEmpty?: number; weightFull?: number } | null;
  /** How much the item raises its wearer's limit while worn or held, in the encumbrance unit (`carryBonus`, eq-6). */
  carryBonus?: number;
  /** Armour's type, as the pack names it (`leather`); for magic armour ("chosen"), the base type picked at hand-out. */
  armourType: string | null;
  /** How many units the weight is for (a bundle's), 1 for most items. */
  perUnits?: number;
  /** The item says it's treasure (`treasure: true`, 07; bq3-9), whatever its category. */
  treasure?: boolean;
}

/**
 * What counts as treasure (bq3-9, ruled 2026-11-04; 07 Encumbrance): a category the rules set's
 * `encumbrance.treasureWeights` names, or an item marked `treasure: true`. Never where an adventure places it.
 */
export function isTreasure(line: { category: string; treasure?: boolean; details?: Record<string, unknown> }, rules: Pick<EncumbranceRules, 'treasureWeights'>): boolean {
  return line.category in rules.treasureWeights || line.treasure === true || line.details?.treasure === true;
}

export type CarriedLoad =
  | { mode: 'none' }
  | {
      mode: 'coin' | 'slot';
      load: number;
      capacity: number | null;
      tier: Tier | null;
      over: boolean;
      overMax: string;
      /** Slot bands (ga-1): each band's load, and which one sets the speed (null: they agree, or none is known). */
      bands?: BandLoad[];
      setsSpeed?: BandId | null;
      /** What raised the limit (eq-6), for the load breakdown; only when something did. */
      bonuses?: CarryBonus[];
      /** How much every tier is raised (containers that add room, carry bonuses), one list only; only when above 0. */
      added?: number;
    }
  | {
      mode: 'armour';
      load: number;
      capacity: number | null;
      carriesTreasure: boolean;
      /** What the pack says on its own (treasure in the load), before the GM's switch (eq-3); absent means as carried. */
      treasureSuggested?: boolean;
      movement: string | null;
      over: boolean;
      overMax: string;
      bonuses?: CarryBonus[];
    };

/** One worn or held item that raises the limit (eq-6): its name and by how much, in the mode's unit. */
export interface CarryBonus {
  name: string;
  amount: number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const wholeOrNull = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const text = (value: unknown) => (typeof value === 'string' ? value : '');
/** A movement: text ("120 ft"), or a whole number some packs write (30, read as "30"; pack review area 2, 2026-11-03). */
const movementText = (value: unknown) => (wholeOrNull(value) !== null ? String(value) : text(value));

function merge(a: unknown, b: unknown): unknown {
  if (!isObject(a) || !isObject(b)) return b;
  const out: Record<string, unknown> = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = key in out ? merge(out[key], value) : value;
  return out;
}

function readTiers(value: unknown, maxKey: 'max' | 'maxSlots'): Tier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .flatMap((tier): Tier[] => {
      const max = wholeOrNull(tier[maxKey]);
      const label = text(tier.label);
      return max === null || label === '' ? [] : [{ label, max, effect: text(tier.effect), ...(movementText(tier.movement) ? { movement: movementText(tier.movement) } : {}) }];
    })
    .sort((a, b) => a.max - b.max);
}

/**
 * The encumbrance sections of the campaign's rules sets (already resolved for the optional rules chosen),
 * lowest priority first: each one higher in the stack fills in only what it says.
 */
export function combineEncumbrance(sections: unknown[]): EncumbranceRules {
  const raw = sections.reduce<unknown>((all, section) => (isObject(section) ? merge(all, section) : all), {}) as Record<string, unknown>;
  const mode = raw.mode === 'none' || raw.mode === 'armour' || raw.mode === 'coin' || raw.mode === 'slot' ? raw.mode : null;

  const armourRaw = isObject(raw.armour) ? raw.armour : null;
  const movement = Array.isArray(armourRaw?.movement)
    ? armourRaw.movement.filter(isObject).map((row) => ({ armour: text(row.armour), withoutTreasure: movementText(row.withoutTreasure), withTreasure: movementText(row.withTreasure) }))
    : [];
  const coinRaw = isObject(raw.coin) ? raw.coin : null;
  const slotRaw = isObject(raw.slot) ? raw.slot : null;

  const treasureWeights: Record<string, number | null> = {};
  if (isObject(raw.treasureWeights)) {
    for (const [category, weight] of Object.entries(raw.treasureWeights)) treasureWeights[category] = wholeOrNull(weight);
  }
  return {
    mode,
    armour: armourRaw
      ? {
          maxLoadCoin: wholeOrNull(armourRaw.maxLoadCoin),
          movement,
          armourTypes: isObject(armourRaw.armourTypes) ? Object.fromEntries(Object.entries(armourRaw.armourTypes).map(([type, row]) => [type, text(row)])) : {},
        }
      : null,
    coin: coinRaw
      ? {
          maxLoadCoin: wholeOrNull(coinRaw.maxLoadCoin),
          tiers: readTiers(coinRaw.tiers, 'max'),
          overMax: text(coinRaw.overMax),
          miscGearCoin: wholeOrNull(coinRaw.miscGearCoin) ?? 0,
          miscGearCategories: Array.isArray(coinRaw.miscGearCategories) ? coinRaw.miscGearCategories.map(String) : [],
        }
      : null,
    slot: slotRaw ? { baseSlots: wholeOrNull(slotRaw.baseSlots), tiers: readTiers(slotRaw.tiers, 'maxSlots'), overMax: text(slotRaw.overMax), bands: readBands(slotRaw, raw.labels) } : null,
    treasureWeights,
    containers: raw.containers === 'add' ? 'add' : 'hold-only',
    separateCategories: Array.isArray(raw.separateCategories) ? raw.separateCategories.filter((c): c is string => typeof c === 'string') : [],
  };
}

/** "Not tracked" always; armour, coin and slot only when the setting rules give that mode's data. */
export function modesOffered(rules: EncumbranceRules): EncumbranceMode[] {
  const modes: EncumbranceMode[] = ['none'];
  if (rules.armour && rules.armour.movement.length > 0) modes.push('armour');
  if (rules.coin && (rules.coin.tiers.length > 0 || rules.coin.maxLoadCoin !== null)) modes.push('coin');
  if (rules.slot && (rules.slot.tiers.length > 0 || rules.slot.bands)) modes.push('slot');
  return modes;
}

/** Whether a line sits inside the container `bagId`, at any depth. */
function isInside(l: LoadLine, bagId: string, byId: Map<string, LoadLine>): boolean {
  const seen = new Set<string>();
  for (let at = l.containerLineId ? byId.get(l.containerLineId) : undefined; at && !seen.has(at.id); at = at.containerLineId ? byId.get(at.containerLineId) : undefined) {
    seen.add(at.id);
    if (at.id === bagId) return true;
  }
  return false;
}

/** A bag that weighs by how full it is (eq-5): it gives both `weightEmpty` and `weightFull`. */
export const scalesByFill = (l: Pick<LoadLine, 'container'>) => l.container?.weightEmpty !== undefined && l.container?.weightFull !== undefined;

/** A bag whose contents never count: a fixed weight, or a weight by fill. */
const sealed = (l: LoadLine) => l.container?.fixedWeightCoin !== undefined || scalesByFill(l);

/** Lines whose weight counts: everything except what's inside a sealed bag (at any depth). */
function countedLines(lines: LoadLine[]): LoadLine[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const bags = lines.filter(sealed);
  return lines.filter((l) => !bags.some((bag) => isInside(l, bag.id, byId)));
}

/** A line's plain weight in the mode's unit: coins (a bundle's shared, rounded once) or slots per stack. */
const plainWeight = (l: LoadLine, unit: 'coin' | 'slot') =>
  unit === 'slot' ? (l.slots ?? 0) * Math.ceil(l.qty / Math.max(1, l.stack)) : Math.round(((l.weightCoin ?? 0) * l.qty) / Math.max(1, l.perUnits ?? 1));

/** How full a bag that weighs by fill is, and what it weighs (eq-5). */
export interface BagFill {
  /** What the bag weighs now, in the mode's unit. */
  weight: number;
  /** What it weighs full. */
  full: number;
  /** What's inside (plain weights, at any depth) over its capacity, 0 to 1; 1 when it gives no capacity. */
  fill: number;
}

/**
 * A bag's weight by fill (eq-5, ruled 2026-11-04): `weightEmpty` plus the share of `weightFull - weightEmpty`
 * that its contents fill of its capacity (in the mode's unit: `capacityCoin` or `capacitySlots`), rounded to a whole
 * number. Its contents' own weights are what fills it; they never count in the load. With no capacity it weighs
 * full (the safe side). Equal values always weigh that. Null for a bag that doesn't weigh by fill.
 * The database's tier line works it out the same way (private.load_lines_by_fill).
 */
export function bagFill(bag: LoadLine, lines: LoadLine[], unit: 'coin' | 'slot'): BagFill | null {
  if (!scalesByFill(bag)) return null;
  const empty = bag.container!.weightEmpty!;
  const full = bag.container!.weightFull!;
  const cap = (unit === 'slot' ? bag.container!.capacitySlots : bag.container!.capacityCoin) ?? 0;
  const qty = Math.max(1, bag.qty);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const contents = lines.filter((l) => l.id !== bag.id && isInside(l, bag.id, byId)).reduce((sum, l) => sum + plainWeight(l, unit), 0);
  if (cap <= 0 || empty === full) return { weight: qty * full, full: qty * full, fill: cap <= 0 ? 1 : Math.min(1, contents / (cap * qty)) };
  const used = Math.min(contents, cap * qty);
  return { weight: qty * empty + Math.round(((full - empty) * used) / cap), full: qty * full, fill: used / (cap * qty) };
}

/** How full, in words, for the Pack's row (eq-5): "empty", "a quarter full", "half full", ... "full". */
export function fillWords(fill: number): string {
  if (fill <= 0) return 'empty';
  if (fill >= 1) return 'full';
  if (fill < 0.125) return 'nearly empty';
  if (fill < 0.375) return 'a quarter full';
  if (fill < 0.625) return 'half full';
  if (fill < 0.875) return 'three quarters full';
  return 'nearly full';
}

/** What worn or held items raise the limit by (eq-6): each item once, by its `carryBonus`. */
export function carryBonuses(lines: LoadLine[]): CarryBonus[] {
  return lines.filter((l) => l.equipped && (l.carryBonus ?? 0) > 0).map((l) => ({ name: l.name, amount: l.carryBonus! }));
}

const withBonuses = (bonuses: CarryBonus[]) => (bonuses.length > 0 ? { bonuses } : {});
const bonusTotal = (bonuses: CarryBonus[]) => bonuses.reduce((sum, b) => sum + b.amount, 0);

/** What the carried containers add to the max and to every tier, when containers add capacity. */
function addedByContainers(lines: LoadLine[], rules: EncumbranceRules, key: 'capacityCoin' | 'capacitySlots'): number {
  if (rules.containers !== 'add') return 0;
  return lines.reduce((sum, l) => sum + (l.container && !sealed(l) ? (wholeOrNull(l.container[key]) ?? 0) * l.qty : 0), 0);
}

/**
 * The tiers as they stand for this carrier: every limit raised by what adds room (containers under `add`, carry
 * bonuses, eq-6). The one calculation the load's tier and the Burden pop-up's table both read.
 */
export function raisedTiers(tiers: Tier[], added: number): Tier[] {
  return tiers.map((tier) => ({ ...tier, max: tier.max + added }));
}

/** Raised by `added`, carried on the load only when something raised it. */
const withAdded = (added: number) => (added > 0 ? { added } : {});

function placeInTier(load: number, tiers: Tier[], added: number, hardMax: number | null) {
  const shifted = raisedTiers(tiers, added);
  const tier = shifted.find((t) => load <= t.max) ?? null;
  const over = hardMax !== null ? load > hardMax : tier === null && shifted.length > 0;
  return { tier: over ? null : tier, over };
}

const ARMOUR_ROWS = ['none', 'light', 'heavy'];

/** Which armour row applies: the heaviest equipped armour, through the pack's map; "none" when nothing maps. */
export function wornArmour(lines: LoadLine[], rules: EncumbranceRules): string {
  const types = rules.armour?.armourTypes ?? {};
  const rows = lines.filter((l) => l.equipped && l.armourType).map((l) => types[l.armourType!] ?? '');
  return rows.reduce((heaviest, row) => (ARMOUR_ROWS.indexOf(row) > ARMOUR_ROWS.indexOf(heaviest) ? row : heaviest), 'none');
}

/**
 * One carrier's load in the campaign's mode. In armour mode, the movement row follows the armour worn, and whether
 * treasure counts follows the GM's switch when set (`worn.carryingTreasure`, eq-3; treasureSwitch.ts), else the pack.
 */
export function carriedLoad(
  lines: LoadLine[],
  rules: EncumbranceRules,
  mode: EncumbranceMode,
  worn: { armour: string; carryingTreasure?: boolean | null } = { armour: wornArmour(lines, rules) },
): CarriedLoad {
  const counted = countedLines(lines);
  // Worn or held items that raise the limit (eq-6): the max and every tier, like a bag that adds room.
  const bonuses = carryBonuses(lines);

  if (mode === 'slot' && rules.slot?.bands) return bandedLoad(counted, lines, rules, rules.slot.bands, rules.slot.overMax, bonuses);
  if (mode === 'slot' && rules.slot) {
    const load = counted.reduce((sum, l) => sum + (bagFill(l, lines, 'slot')?.weight ?? plainWeight(l, 'slot')), 0);
    const added = addedByContainers(counted, rules, 'capacitySlots') + bonusTotal(bonuses);
    // The bar is full at the last tier's limit (baseSlots is kept for later modifiers; ruled 2026-10-23).
    const last = rules.slot.tiers.at(-1)?.max ?? null;
    const hardMax = last === null ? null : last + added;
    return { mode: 'slot', load, capacity: hardMax, ...placeInTier(load, rules.slot.tiers, added, hardMax), overMax: rules.slot.overMax, ...withBonuses(bonuses), ...withAdded(added) };
  }

  if (mode === 'coin' && rules.coin) {
    const coin = rules.coin;
    // A bundle's weight is shared by its units, rounded once to a whole number (hard rule 8).
    // A bag by fill weighs that (eq-5), before a fixed weight the pack may also give.
    const weightOf = (l: LoadLine) =>
      bagFill(l, lines, 'coin')?.weight ?? (l.container?.fixedWeightCoin !== undefined ? l.container.fixedWeightCoin * l.qty : plainWeight(l, 'coin'));
    const misc = counted.some((l) => l.weightCoin === null && !sealed(l) && coin.miscGearCategories.includes(l.category));
    const load = counted.reduce((sum, l) => sum + weightOf(l), 0) + (misc ? coin.miscGearCoin : 0);
    const added = addedByContainers(counted, rules, 'capacityCoin') + bonusTotal(bonuses);
    const hardMax = coin.maxLoadCoin === null ? null : coin.maxLoadCoin + added;
    return { mode: 'coin', load, capacity: hardMax, ...placeInTier(load, coin.tiers, added, hardMax), overMax: coin.overMax, ...withBonuses(bonuses), ...withAdded(added) };
  }

  if (mode === 'armour' && rules.armour) {
    const treasure = counted.filter((l) => isTreasure(l, rules));
    const load = treasure.reduce((sum, l) => sum + (l.weightCoin ?? rules.treasureWeights[l.category] ?? 0) * l.qty, 0);
    const treasureSuggested = treasure.length > 0;
    const carriesTreasure = worn.carryingTreasure ?? treasureSuggested;
    const row = rules.armour.movement.find((r) => r.armour === worn.armour) ?? null;
    const capacity = rules.armour.maxLoadCoin === null ? null : rules.armour.maxLoadCoin + bonusTotal(bonuses);
    return {
      mode: 'armour',
      load,
      capacity,
      carriesTreasure,
      treasureSuggested,
      movement: row ? (carriesTreasure ? row.withTreasure : row.withoutTreasure) : null,
      over: capacity !== null && load > capacity,
      overMax: '',
      ...withBonuses(bonuses),
    };
  }

  return { mode: 'none' };
}

/** An inventory line as the load sees it: its container block comes from the item's details. */
export function toLoadLine(line: {
  id: string;
  name: string;
  category: string;
  qty: number;
  weightCoin: number | null;
  slots: number | null;
  stack: number;
  containerLineId: string | null;
  equipped: boolean;
  details: Record<string, unknown>;
  perUnits?: number;
}): LoadLine {
  // The container block, plus a fixed weight written next to it instead of inside it (07 allows either).
  // A weight by fill (eq-5) is read the same way, inside the block or next to it.
  const beside = Object.fromEntries((['fixedWeightCoin', 'weightEmpty', 'weightFull'] as const).filter((key) => key in line.details).map((key) => [key, line.details[key]]));
  const block: Record<string, unknown> = { ...(isObject(line.details.container) ? line.details.container : {}), ...beside };
  const read = (['capacityCoin', 'capacitySlots', 'fixedWeightCoin', 'weightEmpty', 'weightFull'] as const).flatMap((key) => {
    const value = wholeOrNull(block[key]);
    return value === null ? [] : [[key, value] as const];
  });
  const container = read.length > 0 ? (Object.fromEntries(read) as LoadLine['container']) : null;
  const armourType = typeof line.details.armourType === 'string' && line.details.armourType !== 'chosen' ? line.details.armourType : null;
  return {
    armourType,
    id: line.id,
    name: line.name,
    category: line.category,
    qty: line.qty,
    weightCoin: line.weightCoin,
    slots: line.slots,
    stack: line.stack,
    containerLineId: line.containerLineId,
    equipped: line.equipped,
    container,
    perUnits: line.perUnits ?? 1,
    ...(line.details.treasure === true ? { treasure: true } : {}),
    ...((wholeOrNull(line.details.carryBonus) ?? 0) > 0 ? { carryBonus: wholeOrNull(line.details.carryBonus)! } : {}),
  };
}

/**
 * A carrier's speed as a whole number, for the day's travel budget (M5b; travel.ts `Traveller.speed`; plan
 * m5b-engine-reconcile §2.6): the first whole number in the load's movement text, which is the tier's `movement`
 * in coin and slot modes ("120 ft" → 120) or the armour row's in armour mode. Null when it can't be told (no
 * tracking, a tier with no movement, text with no number, or over the max): the budget then asks the GM.
 */
export function speedOf(load: CarriedLoad): number | null {
  const movement = load.mode === 'armour' ? load.movement : load.mode === 'none' || load.over ? null : (load.tier?.movement ?? null);
  const found = movement?.match(/\d+/);
  return found ? Number(found[0]) : null;
}

// ---- Slot bands (ga-1, sr-9). Kept in their own functions: one list (`tiers`) works as before.

/** A band's entries (`{ maxSlots, speed }`, a `label` optional): read into tiers, lowest first; bad ones dropped. */
function readBand(value: unknown): Tier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .flatMap((entry): Tier[] => {
      const max = wholeOrNull(entry.maxSlots);
      const movement = movementText(entry.speed) || movementText(entry.movement);
      return max === null ? [] : [{ label: text(entry.label), max, effect: text(entry.effect), ...(movement ? { movement } : {}) }];
    })
    .sort((a, b) => a.max - b.max);
}

/** `slot.bands` with both lists, or null (then `tiers` is the one list). `combine` may only be "slowest". */
function readBands(slot: Record<string, unknown>, labels: unknown): SlotBands | null {
  if (!isObject(slot.bands)) return null;
  const equipped = readBand(slot.bands.equipped);
  const stowed = readBand(slot.bands.stowed);
  if (equipped.length === 0 || stowed.length === 0) return null;
  const named = isObject(labels) ? labels : {};
  return { equipped, stowed, combine: 'slowest', names: { equipped: text(named.equipped).trim() || 'Equipped', stowed: text(named.stowed).trim() || 'Stowed' } };
}

const firstNumber = (movement: string | undefined) => {
  const found = movement?.match(/\d+/);
  return found ? Number(found[0]) : null;
};

/** One band looked up: its count against its own list; past the list's last limit is over. */
export function bandLoad(id: BandId, name: string, load: number, tiers: Tier[], added = 0): BandLoad {
  const last = tiers.at(-1)?.max ?? null;
  const capacity = last === null ? null : last + added;
  const { tier, over } = placeInTier(load, tiers, added, capacity);
  const step = tier ? tiers.findIndex((t) => t.max + added === tier.max) : null;
  return { id, name, load, capacity, tier, speed: over ? null : firstNumber(tier?.movement), over, step, tiers, added };
}

/**
 * The load with slot bands: what's equipped (worn or in hand) in the equipped band, everything else carried in the
 * stowed band (containers that add capacity, and carry bonuses (eq-6), add it there). The slower band's tier is the load's tier, named for
 * its band ("Stowed 12 / 16"), so the one speed function (`speedOf`) reads it as for one list; over in either is over.
 */
function bandedLoad(counted: LoadLine[], all: LoadLine[], rules: EncumbranceRules, bands: SlotBands, overMax: string, bonuses: CarryBonus[]): CarriedLoad {
  // A bag by fill weighs that (eq-5), as with one list.
  const sum = (lines: LoadLine[]) => lines.reduce((total, l) => total + (bagFill(l, all, 'slot')?.weight ?? plainWeight(l, 'slot')), 0);
  const equipped = bandLoad('equipped', bands.names.equipped, sum(counted.filter((l) => l.equipped)), bands.equipped);
  const stowed = bandLoad('stowed', bands.names.stowed, sum(counted.filter((l) => !l.equipped)), bands.stowed, addedByContainers(counted, rules, 'capacitySlots') + bonusTotal(bonuses));
  const list = [equipped, stowed];
  const over = list.some((b) => b.over);
  const known = list.filter((b) => b.speed !== null);
  const slowest = known.reduce<BandLoad | null>((a, b) => (a === null || b.speed! < a.speed! ? b : a), null);
  // Named only when the two differ: with the same speed, neither alone sets it.
  const setsSpeed = !over && slowest && known.length === 2 && equipped.speed !== stowed.speed ? slowest.id : null;
  const setter = slowest ?? stowed;
  const tier = over || !setter.tier ? null : { ...setter.tier, label: setter.tier.label || `${setter.name} ${setter.load} / ${setter.capacity}` };
  const capacity = equipped.capacity !== null && stowed.capacity !== null ? equipped.capacity + stowed.capacity : null;
  return { mode: 'slot', load: equipped.load + stowed.load, capacity, tier, over, overMax, bands: list, setsSpeed, ...withBonuses(bonuses) };
}

/**
 * The speed the load gives, with why in plain words, for the sheet's Movement (bq-5, sr-1: the same speed as travel,
 * `speedOf`): "Lightly burdened (your load)", "the armour worn, carrying treasure", or over the max with the
 * setting's words ("Cannot move"). Null when the campaign tracks no load (or the tier gives no speed): the sheet
 * then uses the character's own speed.
 */
export function loadSpeed(load: CarriedLoad): { speed: number | null; why: string; unit?: string } | null {
  if (load.mode === 'none') return null;
  if (load.over) return { speed: null, why: load.overMax || 'over the most you can carry' };
  const speed = speedOf(load);
  if (speed === null) return null;
  const unit = speedUnitOf(load);
  if (load.mode === 'armour') return { speed, why: load.carriesTreasure ? 'the armour worn, carrying treasure' : 'the armour worn', ...(unit ? { unit } : {}) };
  return { speed, why: load.tier ? `${load.tier.label} (your load)` : 'your load', ...(unit ? { unit } : {}) };
}

/**
 * The unit of the load's speed, in the pack's words: the one short word right after the first number in its movement
 * text ("125 ft" → "ft", "40 paces" → "paces", "125 ft / 41 ft" → "ft"). Empty when anything else follows the word
 * ("30 per round"), the word is long, or the figure has a comma or a point ("1,200 ft"), so the card never shows a
 * garbled unit. The Player screen's Movement card says the speed with it (dec-13 C10, frame P1).
 */
export function speedUnitOf(load: CarriedLoad): string {
  const movement = load.mode === 'armour' ? load.movement : load.mode === 'none' || load.over ? null : (load.tier?.movement ?? null);
  const found = movement?.match(/^\D*\d+\s*(\p{L}{1,12})\s*(?:$|[/(),;.])/u);
  return found?.[1] ?? '';
}
