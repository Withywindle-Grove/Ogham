// Activities usable here and now (docs/05 "Activities", X-2; 07 "Exploration", Activities, G-07): in any mode
// (turn modes in M5, day modes in M5b). Shown only when usable: `onlyIn` lists modes, `onlyOnTerrain` terrains,
// `seasons` seasons, and `option` an optional rule (G-40; the older `onlyWithOption` is its alias). The cost is
// worked out in the mode's terms (steps of a turn mode as clock time, a budget, or the terrain's own number); the
// result and table follow the terrain and the season. Who may act (`requires`) is the caller's, character by character. Pure.
import type { Choices } from '../library/options.ts';
import { bestSkill, type SkillChance } from '../library/skillChance.ts';
import { toSeconds, type Amount, type TimeUnits } from './clock.ts';
import { optionOn, type Activity, type Chance, type Mode, type Terrain } from './modes.ts';
import { bestChance, facesWords, partyReach, type PartyMember } from './partyModifiers.ts';
import { piecesOf } from '../characters/startingGear.ts';
import type { Yields } from './wildPack.ts';

export interface ActivityContext {
  terrain?: Terrain | null;
  season?: string | null;
  /** Special seasons switched on, by id. */
  specialSeasons?: readonly string[];
  choices?: Choices;
}

export type CostNow =
  /** Clock time it takes (steps of a turn mode, or a time). */
  | { kind: 'time'; seconds: number }
  /** Off today's travel budget: a number, or all of it. */
  | { kind: 'budget'; amount: number | 'all' }
  /** No cost given, or the terrain doesn't say: the GM sets it. */
  | { kind: 'gm' };

export interface Usable {
  activity: Activity;
  cost: CostNow;
  /** The result after the season and special season (special wins). */
  result: string | null;
  /** The table rolled on success, by terrain when the activity says. */
  tableId: string | null;
  /** The item a result gives and how many (07 `yields`; `units`: single pieces, G-108); the season's `bySeason` dice replace its dice. */
  yields: Yields | null;
}

/** Dice or a whole number as packs write them ("1d3", "2d4 + 1", "3"); anything else is text. */
const DICE = /^\s*(\d+\s*|\d*d\d+(\s*[+-]\s*\d+)?)\s*$/i;

/** Whether an activity can be offered in this mode, here, now. */
export function usableHere(activity: Activity, mode: Mode, ctx: ActivityContext): boolean {
  if (activity.onlyIn.length && !activity.onlyIn.includes(mode.id)) return false;
  if (activity.onlyOnTerrain.length && !(ctx.terrain && activity.onlyOnTerrain.includes(ctx.terrain.id))) return false;
  if (activity.seasons.length && !(ctx.season && activity.seasons.includes(ctx.season))) return false;
  return optionOn(activity.onlyWithOption, ctx.choices ?? {});
}

function costNow(activity: Activity, mode: Mode, units: TimeUnits, terrain: Terrain | null): CostNow {
  const cost = activity.cost;
  if (!cost) return { kind: 'gm' };
  if ('steps' in cost) {
    const seconds = toSeconds({ value: cost.steps * mode.step.value, unit: mode.step.unit } satisfies Amount, units);
    return seconds === null ? { kind: 'gm' } : { kind: 'time', seconds };
  }
  if ('budget' in cost) return { kind: 'budget', amount: cost.budget };
  if ('time' in cost) {
    const seconds = toSeconds(cost.time, units);
    return seconds === null ? { kind: 'gm' } : { kind: 'time', seconds };
  }
  const value = terrain ? (terrain as unknown as Record<string, unknown>)[cost.fromTerrain] : undefined;
  return typeof value === 'number' && Number.isInteger(value) ? { kind: 'budget', amount: value } : { kind: 'gm' };
}

/** The mode's activities usable here and now, in the pack's order. ("Other…" is the mode's `other`, always last.) */
export function usableActivities(mode: Mode, units: TimeUnits, ctx: ActivityContext = {}): Usable[] {
  const terrain = ctx.terrain ?? null;
  const special = ctx.specialSeasons ?? [];
  return mode.activities
    .filter((a) => usableHere(a, mode, ctx))
    .map((activity) => {
      const bySpecial = special.map((id) => activity.bySpecialSeason[id]).find((r) => r !== undefined);
      const bySeason = ctx.season ? activity.bySeason[ctx.season] : undefined;
      return {
        activity,
        cost: costNow(activity, mode, units, terrain),
        result: bySpecial ?? bySeason ?? activity.result,
        tableId: (terrain ? activity.tableByTerrain[terrain.id] : undefined) ?? activity.tableId,
        yields: activity.yields ? { ...activity.yields, dice: bySeason !== undefined && DICE.test(bySeason) ? bySeason.trim() : activity.yields.dice } : null,
      };
    });
}

// --- Running an activity (M5b step 3, build order 1; docs/05 "Activities", S4-8, D3) ---------------------------------
// Who may act, what it costs today, how to roll (with each modifier and where it comes from), whose roll counts and
// who finds the yield. Dice stay at the table: the app shows the instructions and takes the numbers entered.

/** What the app knows about a character who might act: their skills (codes) and the pack items they carry (ids). */
export interface ActorFacts {
  id: string;
  name: string;
  skills: ReadonlySet<string>;
  items: ReadonlySet<string>;
  /** A skill's value in the pack's style, when known ("2-in-6"), by code. */
  skillShown?: ReadonlyMap<string, { name: string; shown: string; odds: string | null; chance?: SkillChance | null }>;
  /** Their class (pack id and name), for modifiers keyed to the party (ex-2, ga-3). */
  classId?: string | null;
  className?: string | null;
}

/** An actor as a party member (their class, and their skills' names), for the party modifiers. */
export const memberOf = (actor: ActorFacts): PartyMember => ({
  id: actor.id,
  name: actor.name,
  classId: actor.classId ?? null,
  className: actor.className ?? null,
  skills: new Map([...actor.skills].map((code) => [code, actor.skillShown?.get(code)?.name ?? code])),
});

/** `requires` (07): a character without the skill or the item isn't offered. */
export const mayAct = (activity: Pick<Activity, 'requires'>, actor: ActorFacts): boolean =>
  (!activity.requires.skill || actor.skills.has(activity.requires.skill)) && (!activity.requires.item || actor.items.has(activity.requires.item));

/** The characters who may act, in the order given. */
export const actorsFor = (activity: Pick<Activity, 'requires'>, actors: readonly ActorFacts[]): ActorFacts[] => actors.filter((a) => mayAct(activity, a));

/** How many may act at once: one, the pack's cap for several (all of them without one), or the whole party. */
export function actorCap(activity: Pick<Activity, 'who' | 'maxActors'>, count: number): number {
  if (activity.who === 'one') return Math.min(1, count);
  if (activity.who === 'party') return count;
  return activity.maxActors !== null && activity.maxActors > 0 ? Math.min(activity.maxActors, count) : count;
}

/**
 * Whether someone may be named as acting or finding (ac-1, ruled 2026-11-11): in an activity one character does, a
 * player names only their own characters and hirelings (a hireling carries its player); the GM names anyone; an
 * activity several or the party do is open to the group. The database's apply_activity holds the same rule.
 */
export const mayName = (activity: Pick<Activity, 'who'>, gm: boolean, userId: string, ownerUserId: string | null | undefined): boolean =>
  gm || activity.who !== 'one' || (!!ownerUserId && ownerUserId === userId);

/** What comes off today's budget: a number, or all that's left; time and the GM's cost take none. */
export function spendOf(cost: CostNow, left: number): number {
  if (cost.kind !== 'budget') return 0;
  return cost.amount === 'all' ? Math.max(0, left) : Math.max(0, cost.amount);
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Seconds as the cost line says them ("2 hours", "30 minutes", "1 day"). */
export function timeWords(seconds: number): string {
  const day = 86400;
  const hour = 3600;
  if (seconds > 0 && seconds % day === 0) return `${seconds / day} ${plural(seconds / day, 'day', 'days')}`;
  if (seconds > 0 && seconds % hour === 0) return `${seconds / hour} ${plural(seconds / hour, 'hour', 'hours')}`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${plural(minutes, 'minute', 'minutes')}`;
}

/**
 * The cost line (S4-8): "3 travel points", "All of today's travel points (5)", "2 hours", "The GM sets the cost".
 * `budgetName` is the pack's name for the budget ("Travel points"), `unit` its unit word for one and many.
 */
export function costLine(cost: CostNow, left: number, budgetName: string, unit: { one: string; many: string }): string {
  if (cost.kind === 'time') return cost.seconds === 0 ? 'No time' : timeWords(cost.seconds);
  if (cost.kind === 'gm') return 'The GM sets the cost';
  if (cost.amount === 'all') return `All of today's ${budgetName.toLowerCase()} (${left})`;
  return `${cost.amount} ${plural(cost.amount, unit.one, unit.many)}`;
}

export interface ActivityModifierLine {
  label: string;
  add: number;
  /** Where it comes from (S4-8, A13): the pack's rules, or the party's abilities (`modify` hooks). */
  source: 'rules' | 'party';
  /** When it counts, in the pack's words ("fullDay"), or null: always. */
  when: string | null;
  /** Keyed to the party (ex-2, ga-3): the label names who has what ("a Reed Witch in the party"). */
  trait?: boolean;
  /** It sets the faces (ga-3) instead of adding. */
  sets?: Chance | null;
  /** A self modifier's character: it counts for their roll only. */
  actor?: { id: string; name: string } | null;
}

/**
 * A modifier line in words (S4-8): "+1 a whole day at it · the rules", "+1 · a Reed Witch in the party",
 * "Succeeds on 1–3 for Ash · a Mire Stalker".
 */
export function activityModifierWords(m: ActivityModifierLine): string {
  if (m.trait) {
    const who = m.actor ? ` for ${m.actor.name}` : '';
    return m.sets ? `Succeeds on ${facesWords(m.sets.on)}${who}, ${m.label}` : `${signed(m.add)}${who}, ${m.label}`;
  }
  return `${signed(m.add)} ${m.label}${m.when && whenWords(m.when) !== m.label ? ` (when ${whenWords(m.when)})` : ''}, ${m.source === 'party' ? 'the party' : 'the rules'}`;
}

/** Who is in the group and where they are, for an activity's modifiers keyed to the party (ex-2, ga-3). */
export interface PlanContext {
  /** The group's members (the actor's own facts replace their entry). */
  members?: readonly PartyMember[];
  terrain?: Terrain | null;
}

/** "+1", "−2". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** The words for a modifier's `when` ("fullDay" is the only one 07 names; any other is the pack's condition id). */
export const whenWords = (when: string | null) => (when === null || when === '' ? null : when === 'fullDay' ? 'a whole day at it' : when);

export interface RollPlan {
  /** What to roll, for this character: "Roll Hear noise (2-in-6) · Succeeds on 5 or 6 · 2 in 6", "Roll a WIS check". */
  instructions: string | null;
  modifiers: ActivityModifierLine[];
  /** Whether a higher roll is better (skills in-6 and N+) or a lower one (percent, ability checks, rolled under). */
  better: 'high' | 'low';
  /** The chance a party modifier set (ga-3: the most faces of several wins); null: the skill or check as usual. */
  sets: Chance | null;
}

/**
 * How one character rolls for an activity (05 Activities: the instructions with the modifiers and their sources).
 * `party` are the modifiers the party's abilities give (`modify` hooks), each with its label.
 */
export function rollPlan(
  activity: Pick<Activity, 'chance' | 'modifiers'>,
  actor: ActorFacts | null,
  party: readonly { label: string; add: number }[] = [],
  ctx: PlanContext = {},
): RollPlan {
  // The actor as this device knows them (their own skills and class) stands in for their entry in the group's list.
  const members = (ctx.members ?? []).filter((m) => m.id !== actor?.id);
  if (actor) members.unshift(memberOf(actor));
  const modifiers: ActivityModifierLine[] = [];
  const sets: { chance: Chance; line: ActivityModifierLine }[] = [];
  for (const m of activity.modifiers) {
    if (!m.party) {
      modifiers.push({ label: m.note ?? whenWords(m.when) ?? 'The pack', add: m.add, source: 'rules', when: m.when || null });
      continue;
    }
    // Keyed to the party (ex-2, ga-3): only when it applies here; a self modifier is its character's only.
    const reach = partyReach(m.party, members, ctx.terrain);
    if (!reach) continue;
    const base = { add: m.chance ? 0 : m.add, source: 'rules' as const, when: m.when || null, trait: true, sets: m.chance ?? null };
    if (reach.scope === 'party') {
      const line = { ...base, label: reach.label, actor: null };
      if (m.chance) sets.push({ chance: m.chance, line });
      else modifiers.push(line);
    } else for (const { member, label } of reach.members) modifiers.push({ ...base, label, actor: { id: member.id, name: member.name } });
  }
  modifiers.push(...party.map((p) => ({ label: p.label, add: p.add, source: 'party' as const, when: null })));
  const set = bestChance(sets, 'more');
  if (set) modifiers.unshift(set.line);
  const chance = activity.chance;
  if (set) {
    const die = set.chance.die ?? null;
    const better = set.chance.on.includes(1) ? 'low' : 'high';
    return { instructions: `Roll ${die ?? 'the die'}, succeeds on ${facesWords(set.chance.on)}`, modifiers, better, sets: set.chance };
  }
  if (!chance) return { instructions: null, modifiers, better: 'high', sets: null };
  if ('skill' in chance) {
    const { code, had } = countedSkill(chance.skill, actor);
    // None of a list known (the GM's request has no actor): the list as it stands.
    if (code === null) return { instructions: `Roll ${betterOf(typeof chance.skill === 'string' ? [chance.skill] : chance.skill)}`, modifiers, better: 'high', sets: null };
    const known = actor?.skillShown?.get(code);
    const name = known?.name ?? code;
    const parts = [`Roll ${name}${known && known.shown !== '—' ? ` (${known.shown})` : ''}`];
    if (known?.odds) parts.push(known.odds);
    if (had.length > 1) parts.push(`${betterOf(had.map((c) => actor?.skillShown?.get(c)?.name ?? c))} counts`);
    const better = known && /%$/.test(known.shown) ? 'low' : 'high';
    return { instructions: parts.join(', '), modifiers, better, sets: null };
  }
  return { instructions: `Roll a ${chance.abilityCheck} check`, modifiers, better: 'low', sets: null };
}

/** "Hark", "the better of Hark and Keen ear", "the best of Hark, Keen ear and Reed sense". */
const betterOf = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? '') : `the ${names.length === 2 ? 'better' : 'best'} of ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Of an activity's skill, or its list of skills (ex-3, ruled 2026-11-03), the one that counts for this character:
 * of those they have, the highest chance of success (skillChance.ts, the same rule as a skill's `fill.best` on the
 * sheet, ga-4); on a tie, or when no chance can be told, the first listed. `had` lists those they have, in the
 * pack's order. With one skill it is that skill, had or not (as before); with a list and none had, null.
 */
export function countedSkill(skill: string | readonly string[], actor: ActorFacts | null): { code: string | null; had: string[] } {
  if (typeof skill === 'string') return { code: skill, had: actor?.skills.has(skill) ? [skill] : [] };
  const had = skill.filter((code) => actor?.skills.has(code) || actor?.skillShown?.has(code));
  if (had.length === 0) return { code: null, had };
  return { code: bestSkill(had, (code) => actor?.skillShown?.get(code)?.chance ?? null) ?? had[0]!, had };
}

export interface EnteredRoll {
  actorId: string;
  roll: number;
}

/** `bestOf` (07): of several rolls the best counts (the highest, or the lowest where lower is better). Null: none. */
export function bestRoll(rolls: readonly EnteredRoll[], better: 'high' | 'low'): EnteredRoll | null {
  let best: EnteredRoll | null = null;
  for (const r of rolls) {
    if (!Number.isInteger(r.roll)) continue;
    if (!best || (better === 'high' ? r.roll > best.roll : r.roll < best.roll)) best = r;
  }
  return best;
}

/**
 * Who finds the yield (D3: "the finder's pack"): the one who acted; with several and `bestOf`, the best roll's;
 * otherwise the first to act. Null when no one acts.
 */
export function finderOf(activity: Pick<Activity, 'bestOf'>, actors: readonly string[], rolls: readonly EnteredRoll[], better: 'high' | 'low'): string | null {
  if (actors.length === 0) return null;
  if (activity.bestOf) {
    const best = bestRoll(rolls.filter((r) => actors.includes(r.actorId)), better);
    if (best) return best.actorId;
  }
  return actors[0]!;
}

/** The yield's toast words (05 Activities): "3 Firewood bundles → Tam's pack". */
export const yieldLine = (qty: number, itemName: string, finder: string) => `${qty} ${itemName} → ${finder}'s pack`;

/**
 * How many single pieces a yield puts in the finder's pack (G-108): a count of `units` as it is, a count of whole
 * items times the item's bundle; the same rule as a kit line's (G-92, `piecesOf`).
 */
export const yieldPieces = (yields: Pick<Yields, 'item' | 'units'>, count: number, bundle: number): number =>
  piecesOf(yields.units ? { itemId: yields.item, qty: 1, units: count } : { itemId: yields.item, qty: count }, bundle);

/**
 * What a yield counts, in words: the item's name for whole items; for `units`, the item's single piece (its
 * `unitName`) with the item it comes from ("Ration day (Rations, 1 week)"), or "single <item>" without one.
 */
export const yieldCounted = (yields: Pick<Yields, 'units'>, itemName: string, unitName?: string | null): string =>
  !yields.units ? itemName : unitName?.trim() ? `${unitName.trim()} (${itemName})` : `single ${itemName}`;
