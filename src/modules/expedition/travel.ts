// The day's travel budget (rulings of 2026-10-30: S1–S5, D4, D8; 05 "Exploration modes", Movement; 07 movement
// kind `budget`). Points per day come from the slowest member's speed through the pack's `perDay` formula, or the
// pack's riding or cart speed, or the GM's number; today's weather tags change it; a forced march adds the pack's
// factor. Move… spends it: the route's cost, else the terrain's, with the check chances for where the party goes.
// A shortfall is never a block: the party arrives when the next day's points pay it, taken first next day. Unused
// points are lost at day's end, with the count. "Spend the day looking" uses what's left. Whole numbers only (hard
// rule 8). Nothing is written here; the commands that keep the day are M5b's. Pure.
import { TRAVEL_PLACE_WORDS } from '../../core/travelWords.ts';
import { CantRun, evaluate, ExpressionError, parseExpression } from '../library/expression.ts';
import { wholeDown } from '../library/fills.ts';
import { checkPrompt, type CheckContext, type CheckPrompt } from './checks.ts';
import { iconForCheck, triggeredPrompts, type Position } from './eventChecks.ts';
import type { ExplorationRules, Mode, Terrain, WeatherTag } from './modes.ts';
import type { Forced, Route, Travel } from './wildPack.ts';
import type { TownSwitches } from './townSwitches.ts';

/** How the party travels (S3). */
export type Pace = 'foot' | 'riding' | 'cart';

/** One traveller: their speed is their load tier's movement (the inventory module's `speedOf`); null: unknown. */
export interface Traveller {
  id: string;
  name: string;
  speed: number | null;
  /** Their player (a hireling's is its employer's); null: the GM's. Missing: not loaded. */
  ownerUserId?: string | null;
}

export interface BudgetLine {
  kind: 'base' | 'weather' | 'forced';
  /** "Slowest: Bog lurker (speed 20)", "Riding (speed 40)", "Weather: Mired", "Forced march". */
  label: string;
  amount: number;
}

export interface DayBudget {
  name: string;
  unit: string;
  pace: Pace;
  /** The base points before weather and forced march; null: the GM is asked (see `ask`). */
  perDay: number | null;
  /** Why the GM is asked for the number: no formula, no known speed, or no riding or cart speed in the pack. */
  ask: 'formula' | 'speed' | 'mounted' | 'vehicle' | null;
  /** On foot, the traveller who sets the pace. */
  slowest: Traveller | null;
  /** Today's points: base, weather and forced march, never below 0. */
  total: number;
  /** The breakdown shown when the number is tapped (S3). */
  lines: BudgetLine[];
}

export interface BudgetInput {
  travellers: readonly Traveller[];
  pace?: Pace;
  /** Today's weather tags. */
  weatherTags?: readonly string[];
  /** Forced marches applied today. */
  forced?: number;
  /** The GM's own base number (set by hand): it replaces the worked-out one. */
  gmPerDay?: number | null;
}

/** `perDay` worked out for a speed, rounded down and never below 0 (07; `wholeDown`, the one rounding helper); null when the formula can't be read or isn't a number. */
export function perDayFor(formula: string, speed: number): number | null {
  try {
    const value = evaluate(parseExpression(formula), { names: { speed } });
    return typeof value === 'number' && Number.isFinite(value) ? wholeDown(value) : null;
  } catch (error) {
    if (error instanceof ExpressionError || error instanceof CantRun) return null;
    throw error;
  }
}

/** What one forced march adds to a base (07 `forced.factor`, or the provisional whole `add`). */
export function forcedBonus(forced: Forced, base: number): number {
  if (forced.add !== null) return Math.max(0, forced.add);
  return forced.factor !== null ? Math.max(0, Math.floor(base * forced.factor + 1e-9) - base) : 0;
}

/** How many of today's forced marches count (`stack: "once"`: only the first). */
const forcedCounted = (forced: Forced, times: number) => (forced.stack === 'add' ? times : Math.min(times, 1));

/** The base points and where they come from. */
function base(travel: Travel, input: BudgetInput): Pick<DayBudget, 'perDay' | 'ask' | 'slowest'> & { label: string } {
  const pace = input.pace ?? 'foot';
  if (input.gmPerDay !== undefined && input.gmPerDay !== null) return { perDay: Math.max(0, input.gmPerDay), ask: null, slowest: null, label: 'Set by the GM' };
  if (pace !== 'foot') {
    const speed = pace === 'riding' ? travel.mounted : travel.vehicle;
    if (speed === null) return { perDay: null, ask: pace === 'riding' ? 'mounted' : 'vehicle', slowest: null, label: '' };
    const perDay = travel.perDay ? perDayFor(travel.perDay, speed) : null;
    return perDay === null ? { perDay: null, ask: 'formula', slowest: null, label: '' } : { perDay, ask: null, slowest: null, label: `${pace === 'riding' ? 'Riding' : 'Cart'} (speed ${speed})` };
  }
  const known = input.travellers.filter((t): t is Traveller & { speed: number } => t.speed !== null);
  if (!known.length) return { perDay: null, ask: 'speed', slowest: null, label: '' };
  const slowest = known.reduce((a, b) => (b.speed < a.speed ? b : a));
  const perDay = travel.perDay ? perDayFor(travel.perDay, slowest.speed) : null;
  if (perDay === null) return { perDay: null, ask: 'formula', slowest, label: '' };
  return { perDay, ask: null, slowest, label: `Slowest: ${slowest.name} (speed ${slowest.speed})` };
}

/** Weather tags by id: tags the pack gives no `budget` or `warn` simply change nothing. */
export type WeatherTags = Readonly<Record<string, WeatherTag>>;

/**
 * The weather tags that apply in a mode (07 `weather.tags`, read once by modes.ts `readWeather`): the mode's own
 * weather block, else the rules set's default for day-by-day modes, as the weather card uses (procedure.ts).
 */
export function weatherTagsFor(mode: Pick<Mode, 'weather' | 'pace'>, rules: Pick<ExplorationRules, 'weather'> | null): WeatherTags {
  return (mode.weather ?? (mode.pace === 'day' ? rules?.weather : null))?.tags ?? {};
}

/** Today's budget with its breakdown (S3). With no number to start from, the total is 0 and `ask` says why. */
export function dayBudget(travel: Travel, tags: WeatherTags, input: BudgetInput): DayBudget {
  const pace = input.pace ?? 'foot';
  const from = base(travel, input);
  const lines: BudgetLine[] = [];
  let total = 0;
  if (from.perDay !== null) {
    total = from.perDay;
    lines.push({ kind: 'base', label: from.label, amount: from.perDay });
    for (const id of input.weatherTags ?? []) {
      const tag = tags[id];
      if (!tag || !tag.budget) continue;
      total += tag.budget;
      lines.push({ kind: 'weather', label: `Weather: ${tag.name}`, amount: tag.budget });
    }
    const times = travel.forced ? forcedCounted(travel.forced, input.forced ?? 0) : 0;
    for (let i = 0; i < times; i++) {
      const add = forcedBonus(travel.forced!, from.perDay);
      total += add;
      lines.push({ kind: 'forced', label: 'Forced march', amount: add });
    }
  }
  return { name: travel.name, unit: travel.unit, pace, perDay: from.perDay, ask: from.ask, slowest: from.slowest, total: Math.max(0, total), lines };
}

/** The unit for a count: "point" for 1, "points" otherwise. */
export function unitFor(count: number, unit: string): string {
  return count === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit;
}

/** A place the party is on its way into, still owed points (S4). */
export interface Pending {
  placeName: string;
  /** The existing place the GM picked (its id), so the arrival sets the group's place (D10); null: a new place. */
  placeId: string | null;
  routeId: string | null;
  terrainId: string | null;
  owed: number;
}

/** The day as the budget card shows it. */
export interface TravelDay {
  total: number;
  spent: number;
  pending: Pending | null;
  /** Forced marches applied today. */
  forced: number;
}

export const remaining = (day: TravelDay) => Math.max(0, day.total - day.spent);

/**
 * Today's budget worked out again (the weather rolled, the pace changed, the GM set a number): what's spent stays
 * spent, and the card shows the new total. Feed `dayBudget` today's `forced` count so forced marches stay counted.
 */
export function withTotal(day: TravelDay, budget: Pick<DayBudget, 'total'>): TravelDay {
  return { ...day, total: budget.total };
}

/** The budget card's top line: "<name> 3 of 8" (S3), and the shortfall line when there is one (S4). */
export function budgetText(day: TravelDay, budget: Pick<DayBudget, 'name'>): { line: string; shortfall: string | null } {
  // A player's row names the place only once it has been shown to their group (fm-1): blank reads "the next place".
  return { line: `${budget.name} ${remaining(day)} of ${day.total}`, shortfall: day.pending ? TRAVEL_PLACE_WORDS.card(day.pending.owed, day.pending.placeName || null) : null };
}

/**
 * A new day (D20's morning): yesterday's shortfall is paid first. `arrived` names the place when it's paid in full;
 * otherwise the rest is still owed ("N more tomorrow" again). Never blocked.
 */
export function startDay(budget: Pick<DayBudget, 'total'>, carried: Pending | null): { day: TravelDay; arrived: Pending | null; paid: number } {
  const total = budget.total;
  if (!carried) return { day: { total, spent: 0, pending: null, forced: 0 }, arrived: null, paid: 0 };
  const paid = Math.min(carried.owed, total);
  const owed = carried.owed - paid;
  return { day: { total, spent: paid, pending: owed > 0 ? { ...carried, owed } : null, forced: 0 }, arrived: owed > 0 ? null : carried, paid };
}

/** The day's end: points not spent are lost (S3: "N unused points lost" in the log), and the shortfall carries over. */
export function endDay(day: TravelDay, unit: string): { unused: number; line: string | null; carried: Pending | null } {
  const unused = remaining(day);
  return { unused, line: unused > 0 ? `${unused} unused ${unitFor(unused, unit)} lost` : null, carried: day.pending };
}

/** Where a Move… goes (S1): a route, a terrain and an optional place name. */
export interface Move {
  routeId: string | null;
  terrainId: string | null;
  placeName?: string | null;
  /** An existing place the GM picked (M5 step 11's places): its id travels with the move. */
  placeId?: string | null;
  /** The GM's own cost (Other… or a correction): it replaces the route's and the terrain's. */
  gmCost?: number | null;
}

export interface MovePreview {
  /** "Bog (unnamed)" when no name is given (S1). */
  placeName: string;
  /** The existing place's id when the GM picked one; null: a new place (named or "(unnamed)"). */
  placeId: string | null;
  route: Route | null;
  terrain: Terrain | null;
  /** Null: no cost known, the GM sets it. */
  cost: number | null;
  costFrom: 'gm' | 'route' | 'terrain' | null;
  remainingBefore: number;
  /** What's left once paid (0 with a shortfall). */
  remainingAfter: number;
  /** Points still owed after today's are spent: the party arrives tomorrow (S4). */
  shortfall: number;
  /** "Entering Bog (unnamed) · 2 more tomorrow"; null when the party arrives today. */
  shortfallLine: string | null;
  /** The column the route suggests for an encounter table (S2). */
  column: string | null;
  /** The checks whose chance depends on where the party is, worked out for the destination. */
  checks: CheckPrompt[];
  /** Checks the move sets off (alsoWhen; D9). */
  triggered: (CheckPrompt & { reason: string })[];
  /** GM warnings, never blocks: weather (07 tag `warn`), a mount or cart where the terrain won't take it. */
  warnings: string[];
}

export interface MoveContext extends Omit<CheckContext, 'terrain' | 'routeType'> {
  /** Where the party is now (for alsoWhen). */
  from?: Position;
  pace?: Pace;
  /** The GM's town switches, for alsoWhen checks with onlyWhen (sw-1 … sw-4); missing: both off. */
  switches?: TownSwitches;
}

/** A place's name as the screens show it: its name, or "<Terrain> (unnamed)" (S1). */
export function placeLabel(name: string | null | undefined, terrain: Terrain | null): string {
  const given = name?.trim();
  return given ? given : `${terrain?.name ?? 'Somewhere'} (unnamed)`;
}

/** The checks whose chance follows the terrain or the route: those a Move… shows with their chances. */
function placeChecks(mode: Mode) {
  return mode.checks.filter((c) => c.byTerrain || c.modifiers.some((m) => m.kind === 'routeType'));
}

/** What a Move… costs and sets off (S1, S2, D9). Nothing changes until it's applied. */
export function previewMove(mode: Mode, rules: ExplorationRules | null, day: TravelDay, move: Move, ctx: MoveContext = {}): MovePreview {
  const travel = mode.wild.travel;
  const route = move.routeId ? (travel?.routes.find((r) => r.id === move.routeId) ?? null) : null;
  const terrain = move.terrainId ? (mode.terrain.find((t) => t.id === move.terrainId) ?? null) : null;
  const gm = move.gmCost !== undefined && move.gmCost !== null ? Math.max(0, move.gmCost) : null;
  const cost = gm ?? route?.cost ?? terrain?.cost ?? null;
  const costFrom = gm !== null ? 'gm' : (route?.cost ?? null) !== null ? 'route' : (terrain?.cost ?? null) !== null ? 'terrain' : null;
  const before = remaining(day);
  const shortfall = cost !== null ? Math.max(0, cost - before) : 0;
  const placeName = placeLabel(move.placeName, terrain);
  const { from, pace, switches, ...checkCtx } = ctx;
  const routeType = move.routeId;
  const checks = placeChecks(mode).map((c) => checkPrompt(c, iconForCheck(mode, c.id), rules, { ...checkCtx, terrain, routeType }));
  const to: Position = { routeId: move.routeId, terrainId: move.terrainId };
  const triggered = from ? triggeredPrompts(mode, rules, from, to, checkCtx, switches) : [];
  const warnings: string[] = [];
  for (const id of ctx.weatherTags ?? []) {
    const warn = weatherTagsFor(mode, rules)[id]?.warn;
    if (warn) warnings.push(warn);
  }
  if (terrain && pace === 'riding' && (terrain.mounts === 'none' || terrain.mounts === 'lead')) {
    warnings.push(terrain.mounts === 'none' ? `Mounts can't go into ${terrain.name}` : `Mounts must be led in ${terrain.name}`);
  }
  if (terrain && pace === 'cart' && terrain.vehicles === false) warnings.push(`Carts can't go into ${terrain.name}`);
  return {
    placeName,
    placeId: move.placeId ?? null,
    route,
    terrain,
    cost,
    costFrom,
    remainingBefore: before,
    remainingAfter: cost !== null ? Math.max(0, before - cost) : before,
    shortfall,
    shortfallLine: shortfall > 0 ? `Entering ${placeName}, ${shortfall} more tomorrow` : null,
    column: route?.column ?? null,
    checks,
    triggered,
    warnings,
  };
}

/**
 * Applies a Move… (its cost known: the preview's, or the GM's). A shortfall spends what's left and leaves the rest
 * owed; the party is "Entering" until it's paid. A move made while another is still owed replaces it (`replaced`,
 * confirmed 2026-10-30), and the log line says so: "Course changed · 2 owed for Bog (unnamed) dropped".
 */
export function applyMove(
  day: TravelDay,
  preview: Pick<MovePreview, 'placeName' | 'placeId' | 'route' | 'terrain'>,
  cost: number,
): { day: TravelDay; arrived: boolean; replaced: Pending | null; logLine: string | null } {
  const before = remaining(day);
  const pay = Math.min(before, Math.max(0, cost));
  const owed = Math.max(0, cost) - pay;
  const pending = owed > 0 ? { placeName: preview.placeName, placeId: preview.placeId, routeId: preview.route?.id ?? null, terrainId: preview.terrain?.id ?? null, owed } : null;
  const replaced = day.pending;
  return {
    day: { ...day, spent: day.spent + pay, pending },
    arrived: owed === 0,
    replaced,
    logLine: replaced ? TRAVEL_PLACE_WORDS.dropped(replaced.owed, replaced.placeName || null) : null,
  };
}

/** "Spend the day looking" (D8): uses up the day's remaining points; `used` is how many. */
export function spendTheDay(day: TravelDay): { day: TravelDay; used: number } {
  const used = remaining(day);
  return { day: { ...day, spent: day.spent + used }, used };
}

export interface ForcedMarch {
  day: TravelDay;
  /** Points it added (0 when the pack's `stack` is "once" and today already has one). */
  added: number;
  /** Of those, paid straight into what's owed (the shortfall line's button; D4). */
  paidOwed: number;
  /** The party arrives now (what was owed is paid). */
  arrived: Pending | null;
  /**
   * Rest falls due for the group that evening (ruled 2026-11-01, reconcile ⚑ 2), in camp's Sleep step (ruled
   * 2026-11-03, SC-4-3 A): the shared rest flow (g6, B5) opens once the group is in camp (restFlow.ts
   * forcedRestGroups). Always true for a forced march.
   */
  restDue: true;
  /** The pack's note on its effects (the ⓘ, one tap away). */
  note: string | null;
}

/**
 * A forced march (D4): the players' choice, applied at once. It adds the pack's points to today, pays any shortfall
 * first, and makes rest due that evening (`restDue`). Only this group's day changes: another group's shortfall is
 * never paid by it (ruled 2026-11-01, reconcile ⚑ 3). Null when the pack has no forced march.
 */
export function forceMarch(mode: Mode, day: TravelDay, budget: Pick<DayBudget, 'perDay'>): ForcedMarch | null {
  const forced = mode.wild.travel?.forced;
  if (!forced) return null;
  const counts = forced.stack === 'add' || day.forced === 0;
  const added = counts ? forcedBonus(forced, budget.perDay ?? 0) : 0;
  const owed = day.pending?.owed ?? 0;
  const paidOwed = Math.min(owed, added);
  const left = owed - paidOwed;
  const pending = day.pending && left > 0 ? { ...day.pending, owed: left } : null;
  return {
    day: { total: day.total + added, spent: day.spent + paidOwed, pending, forced: day.forced + 1 },
    added,
    paidOwed,
    arrived: day.pending && left === 0 && paidOwed > 0 ? day.pending : null,
    restDue: true,
    note: forced.note,
  };
}
