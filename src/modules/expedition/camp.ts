// Camp (M5b step 4; ruled 2026-10-30, D5, D13–D17, WA1; docs/05 "Exploration modes", Camp; docs/07 `camp`). The
// pure part: the camp's steps in the pack's order, the campfire on the light engine, the pot of portions, and who
// has eaten. campPlay.ts keeps the rows and the commands; nothing here writes.
//
// The order (D13): set up → fire, cooking, campfire talk → eat → watches → night check → sleep. The pack's
// `camp.procedure` gives the order and names the steps; a step is read as one of those parts by its kind (watches,
// check) or its id (fire, cooking, talk, eat, sleep, setup); anything else is a note line. A part the camp defines
// elsewhere but the procedure doesn't list (`camp.fire`, `camp.cooking`, campfire talk named by a sleep modifier, eating
// whenever there's food) is put in D13's place. Steps whose optional rule is off are left out (WA1).
import type { Choices } from '../library/options.ts';
import { lightNow, type Lit, type LightNow } from './light.ts';
import { optionOn, type Camp, type Icon, type Step } from './modes.ts';
import type { FoodKind } from './wildPack.ts';

export type CampPart = 'setup' | 'fire' | 'cooking' | 'talk' | 'eat' | 'watches' | 'night' | 'sleep' | 'note';

/** D13's order. Note lines keep their place in the pack's procedure. */
export const CAMP_ORDER: readonly CampPart[] = ['setup', 'fire', 'cooking', 'talk', 'eat', 'watches', 'night', 'sleep'];

/** The fact a sleep modifier names for campfire talk (07 `camp.sleep.modifiers[].when`). */
export const TALK_FACT = 'campfire-talk';

const IDS: Partial<Record<CampPart, readonly string[]>> = {
  setup: ['setup', 'set-up', 'pitch'],
  fire: ['fire', 'campfire'],
  cooking: ['cooking', 'cook'],
  talk: ['talk', 'campfire-talk', 'entertaining'],
  eat: ['eat', 'eating', 'meal'],
  sleep: ['sleep'],
};

export interface CampStep {
  id: string;
  name: string;
  part: CampPart;
  icon: Icon;
  note: string | null;
  /** The pack's step; null for a part the app put in (fire, cooking, talk or eat the procedure doesn't list). */
  step: Step | null;
}

/** What part of camp a pack's step is. */
export function partOf(step: Step): CampPart {
  if (step.kind === 'watches') return 'watches';
  if (step.kind === 'check') return 'night';
  const id = step.id.toLowerCase();
  for (const part of CAMP_ORDER) if (IDS[part]?.includes(id)) return part;
  if (step.kind === 'roll' && step.icon === 'rest') return 'sleep';
  return 'note';
}

const ADDED: Record<'fire' | 'cooking' | 'talk' | 'eat', { name: string; icon: Icon }> = {
  fire: { name: 'Campfire', icon: 'camp' },
  cooking: { name: 'Cooking', icon: 'camp' },
  talk: { name: 'Campfire talk', icon: 'camp' },
  eat: { name: 'Eat', icon: 'camp' },
};

/**
 * The camp's steps in order. `food`: the setting has food items (eating is offered without a cooking rule too);
 * `talk`: the pack names campfire talk (an activity or a sleep modifier for it).
 */
export function campSteps(camp: Camp, options: { choices: Choices; food?: boolean; talk?: boolean }): CampStep[] {
  const steps: CampStep[] = camp.procedure
    .filter((s) => optionOn(s.onlyWithOption ?? null, options.choices))
    .map((s) => ({ id: s.id, name: s.name, part: partOf(s), icon: s.icon, note: s.note, step: s }));
  const talk = options.talk || (camp.sleep?.modifiers.some((m) => m.when === TALK_FACT) ?? false);
  const wanted: ('fire' | 'cooking' | 'talk' | 'eat')[] = [];
  if (camp.fire) wanted.push('fire');
  if (camp.cooking) wanted.push('cooking');
  if (talk) wanted.push('talk');
  if (camp.cooking || options.food) wanted.push('eat');
  for (const part of wanted) {
    if (steps.some((s) => s.part === part)) continue;
    const rank = CAMP_ORDER.indexOf(part);
    const at = steps.findIndex((s) => s.part !== 'note' && CAMP_ORDER.indexOf(s.part) > rank);
    const added: CampStep = { id: part, ...ADDED[part], part, note: part === 'fire' ? (camp.fire?.note ?? null) : part === 'cooking' ? (camp.cooking?.note ?? null) : null, step: null };
    if (at < 0) steps.push(added);
    else steps.splice(at, 0, added);
  }
  return steps;
}

// The camp's record (as campPlay.ts loads it) ---------------------------------------------------------------------------

export type CampEntryKind = 'fuel' | 'cook' | 'talk' | 'meal' | 'watches' | 'sleep';

export interface CampEntry {
  id: string;
  campId: string;
  kind: CampEntryKind;
  actorId: string;
  qty: number;
  seconds: number;
  /** The campaign clock when it was done. */
  at: number;
  lineId: string | null;
  foodName: string | null;
  foodKind: FoodKind | null;
  fromPot: boolean;
  outcome: 'worked' | 'failed' | 'good' | 'bad' | null;
  /** cook: the ingredients used; sleep: the difficulty set and the roll entered. */
  detail: { name: string; qty: number; difficulty?: string | null; roll?: string | null }[];
  /** watches: the order, each watch the characters on it. */
  watches?: string[][];
  createdBy: string | null;
  createdAt: string;
}

/** The campfire now (D16): lit from the first bundle; a fire that went out starts again from the next bundle. */
export interface CampFireNow {
  lit: Lit | null;
  now: LightNow | null;
  /** Burning now. */
  burning: boolean;
  /** Bundles put on in all. */
  bundles: number;
}

export function campFire(entries: readonly CampEntry[], now: number): CampFireNow {
  const fuel = entries.filter((e) => e.kind === 'fuel').sort((a, b) => a.at - b.at);
  let litAt: number | null = null;
  let seconds = 0;
  for (const e of fuel) {
    if (litAt === null || litAt + seconds <= e.at) {
      litAt = e.at;
      seconds = e.seconds;
    } else seconds += e.seconds;
  }
  const lit: Lit | null = litAt === null ? null : { id: 'campfire', litAt, seconds, warnSeconds: null };
  const state = lit ? lightNow(lit, now) : null;
  return { lit, now: state, burning: !!state && !state.out, bundles: fuel.reduce((sum, e) => sum + e.qty, 0) };
}

/** Portions cooked into the pot, and how many are left (D15). */
export function potOf(entries: readonly CampEntry[]): { made: number; left: number } {
  const made = entries.filter((e) => e.kind === 'cook').reduce((sum, e) => sum + e.qty, 0);
  const eaten = entries.filter((e) => e.kind === 'meal' && e.fromPot).length;
  return { made, left: Math.max(0, made - eaten) };
}

/** Who ate, by character id. */
export const mealsOf = (entries: readonly CampEntry[]): Map<string, CampEntry> => new Map(entries.filter((e) => e.kind === 'meal').map((e) => [e.actorId, e]));

/** The last word on campfire talk (D17): worked, failed, or not yet. */
export function talkOf(entries: readonly CampEntry[]): CampEntry | null {
  const talks = entries.filter((e) => e.kind === 'talk');
  return talks[talks.length - 1] ?? null;
}

/** The camp facts the sleep check reads (D19's flags): campfire talk that worked. */
export const campFlags = (entries: readonly CampEntry[]): string[] => (talkOf(entries)?.outcome === 'worked' ? [TALK_FACT] : []);

/** "Ate a portion", "Ate Dried eel (preserved)". */
export function mealWords(meal: CampEntry): string {
  if (meal.fromPot) return 'Ate a portion';
  return `Ate ${meal.foodName ?? 'something'}${meal.foodKind ? ` (${meal.foodKind})` : ''}`;
}

// The night (part 2: D18–D20) ---------------------------------------------------------------------------------------------

/** The watch order now (D18): the newest one set, each watch the characters on it; empty until set. */
export function watchesOf(entries: readonly CampEntry[]): string[][] {
  const set = entries.filter((e) => e.kind === 'watches');
  return set[set.length - 1]?.watches ?? [];
}

/** Each watch holds 1–3 characters (D18). */
export const WATCH_MAX = 3;

/**
 * The night's length and how many watches it takes (D18): the night is the day less its daylight (the pack's daylight
 * table, by month or season; daylight.ts), in minutes; a watch is the watches step's `watchLength`. Null pieces when
 * the pack doesn't say.
 */
export function nightOf(daylight: { sunrise: number; sunset: number } | null, watchMinutes: number | null, dayMinutes = 1440): { minutes: number | null; watches: number | null } {
  const minutes = daylight && daylight.sunset > daylight.sunrise ? dayMinutes - (daylight.sunset - daylight.sunrise) : null;
  return { minutes, watches: minutes !== null && watchMinutes && watchMinutes > 0 ? Math.max(1, Math.ceil(minutes / watchMinutes)) : null };
}

/** A character's watch, counted from 1 (null: not on watch). */
export const watchNumberOf = (watches: readonly (readonly string[])[], id: string): number | null => {
  const at = watches.findIndex((w) => w.includes(id));
  return at < 0 ? null : at + 1;
};

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** Moves a character to a watch (1-based; a new watch past the last), or off watch (null); empty watches close up. */
export function putOnWatch(watches: readonly (readonly string[])[], id: string, to: number | null): string[][] | 'full' {
  const without = watches.map((w) => w.filter((x) => x !== id));
  if (to !== null) {
    const at = to - 1;
    while (without.length <= at) without.push([]);
    if (without[at]!.length >= WATCH_MAX) return 'full';
    without[at]!.push(id);
  }
  return without.filter((w) => w.length > 0);
}

/**
 * Split evenly (fl-3, 2026-11-03): fills `count` watches in marching order (`order`, front to back), the first watches
 * taking one more when they don't split evenly (5 over 4: 2, 1, 1, 1), each at most WATCH_MAX; with fewer characters
 * than watches, one each from the 1st. Casters are kept off the last watch where it can: its places go to the last
 * non-casters in the order, and everyone else keeps the order on the earlier watches. Anyone past the watches' room
 * stays off watch. Every watch it returns holds 1–3 (the database's rule).
 */
export function splitEvenly(order: readonly string[], count: number, casters: ReadonlySet<string>): string[][] {
  const watches = Math.min(Math.max(0, Math.floor(count)), order.length);
  if (watches === 0) return [];
  const on = order.slice(0, watches * WATCH_MAX);
  const base = Math.floor(on.length / watches);
  const extra = on.length % watches;
  const sizes = Array.from({ length: watches }, (_, i) => base + (i < extra ? 1 : 0));
  const lastSize = sizes[watches - 1]!;
  // The last watch: the last non-casters in the order (as many as there are), then casters for any places left.
  const others = on.filter((id) => !casters.has(id));
  const last = others.slice(Math.max(0, others.length - lastSize));
  for (let i = on.length - 1; last.length < lastSize && i >= 0; i--) if (!last.includes(on[i]!)) last.unshift(on[i]!);
  const rest = on.filter((id) => !last.includes(id));
  const out: string[][] = [];
  let at = 0;
  for (const size of sizes.slice(0, -1)) {
    out.push(rest.slice(at, at + size));
    at += size;
  }
  out.push(on.filter((id) => last.includes(id)));
  return out;
}

/**
 * "How many watches tonight?" (bq3-4 C, 2026-11-04), asked when the pack doesn't give the night's length: only counts
 * the group can fill, so no watch is empty (at most one watch per character) and none holds more than WATCH_MAX
 * (enough watches for everyone). No characters: 0 and 0.
 */
export function watchCountRange(characters: number): { min: number; max: number } {
  const n = Math.max(0, Math.floor(characters));
  return { min: Math.ceil(n / WATCH_MAX), max: n };
}

/** The characters not on any watch, in the order given. */
export const offWatch = (ids: readonly string[], watches: readonly (readonly string[])[]): string[] => ids.filter((id) => !watches.some((w) => w.includes(id)));

/**
 * How many boxes the Watches step shows (fl-3): the night's watches when the pack gives them (or more, if more are set);
 * otherwise those set and one empty to add to. Never more than there are characters, and at least one.
 */
export function watchBoxCount(nightWatches: number | null, set: number, characters: number): number {
  const wanted = nightWatches ?? set + 1;
  return Math.max(1, set, Math.min(wanted, Math.max(characters, set)));
}

/** "18:00": a minute of the day (wrapping past midnight). */
export function clockWords(minute: number, dayMinutes = 1440): string {
  const m = ((Math.round(minute) % dayMinutes) + dayMinutes) % dayMinutes;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** A watch's time of night (fl-3), from sunset and the watch's length: "20:00–22:00"; null when the pack doesn't give both. */
export function watchTimeWords(n: number, startsAt: number | null, watchMinutes: number | null, dayMinutes = 1440): string | null {
  if (startsAt === null || !watchMinutes) return null;
  const from = startsAt + (n - 1) * watchMinutes;
  return `${clockWords(from, dayMinutes)}–${clockWords(from + watchMinutes, dayMinutes)}`;
}

/** One character's sleep as recorded (D19): the GM's difficulty (a change), the roll entered, how they slept. */
export interface SleepRecord {
  difficulty: string | null;
  roll: string | null;
  outcome: 'good' | 'bad' | null;
}

export function sleepRecords(entries: readonly CampEntry[]): Map<string, SleepRecord> {
  const out = new Map<string, SleepRecord>();
  for (const e of entries.filter((x) => x.kind === 'sleep')) {
    const was = out.get(e.actorId) ?? { difficulty: null, roll: null, outcome: null };
    const said = e.detail[0];
    out.set(e.actorId, {
      difficulty: said?.difficulty ?? was.difficulty,
      roll: e.outcome ? (said?.roll ?? null) : was.roll,
      outcome: e.outcome === 'good' || e.outcome === 'bad' ? e.outcome : was.outcome,
    });
  }
  return out;
}

/** The camp's lines for the morning summary (D20): the fire, who didn't eat, how the night went. */
export function morningLines(input: { entries: readonly CampEntry[]; now: number; names: (id: string) => string; members: readonly string[]; eating: boolean; sleeping: boolean }): string[] {
  const { entries, names } = input;
  const lines: string[] = [];
  const fire = campFire(entries, input.now);
  if (fire.lit) lines.push(`fire out, ${fire.bundles} ${fire.bundles === 1 ? 'bundle' : 'bundles'} used`);
  if (input.eating) {
    const meals = mealsOf(entries);
    const hungry = input.members.filter((id) => !meals.has(id));
    if (hungry.length) lines.push(`didn't eat: ${hungry.map(names).join(', ')}`);
  }
  if (input.sleeping) {
    const sleep = sleepRecords(entries);
    const good = input.members.filter((id) => sleep.get(id)?.outcome === 'good');
    const bad = input.members.filter((id) => sleep.get(id)?.outcome === 'bad');
    if (good.length) lines.push(`slept well: ${good.map(names).join(', ')}`);
    if (bad.length) lines.push(`slept badly: ${bad.map(names).join(', ')}`);
  }
  return lines;
}
