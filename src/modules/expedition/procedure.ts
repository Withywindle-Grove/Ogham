// What one main advance does (docs/05 "Expeditions, time and light", "Exploration modes", "Exploration
// follow-ups"; ruled 2026-10-29, D19 and afternoon ruling 1). Each mode has one main advance (Next turn, or the
// mode's own step) that always runs the procedure: its steps in order (notes as quiet lines, rolls and checks as
// prompts, camp and watches, what the app does by itself), the checks that fall due with their modifiers and what a
// hit rolls, the rest reminder, the GM's own reminders (merged, with counts), lights burning down, timed effects
// and status timers ending, the weather, the hour track (turn modes) and the activities usable now.
//   +N and Advance by… run the procedure once per step that passes and sum it up; Advance by… is a normal advance,
// never a correction. Set time… is the one correction: it jumps the clock, moves status timers and lights with it,
// and runs no step or check. Engine rulings of 2026-10-29: a check runs at most once per its `every` period (a later
// reference is the optional "Check again"); an encounter check that ran counts as the GM's own encounter-check
// reminder for that period; with weather's option off, weather and its steps are skipped. Everything here is plain
// data for the screens to show; nothing is written. Pure.
import type { Choices } from '../library/options.ts';
import { checkPrompt, isEncounterCheck, type CheckPrompt, type ExtraModifier } from './checks.ts';
import { toSeconds, unitName, type Amount, type TimeUnits } from './clock.ts';
import { endingOnJump, type Effect } from './effects.ts';
import { hourTrack, type Pip, type TrackEvent } from './hourTrack.ts';
import { burnOnJump, firstToRunOut, type Lit } from './light.ts';
import { campOf, isPointToPoint, optionOn, terrainOf, type Check, type ExplorationRules, type Icon, type Mode, type Step, type Weather } from './modes.ts';
import { dueOnJump, mergeDue, nextAfter, occurrences, type Due, type Schedule } from './schedule.ts';
import { tickTimer, type StatusTimer } from './statusTimer.ts';
import { runsNow, type TownSwitches } from './townSwitches.ts';
import { usableActivities, type Usable } from './activities.ts';
import type { PartyMember } from './partyModifiers.ts';

export interface Situation {
  /** The season (from the calendar, or set by the GM) and the special seasons switched on, by id. */
  season?: string | null;
  specialSeasons?: readonly string[];
  terrainId?: string | null;
  routeType?: string | null;
  region?: string | null;
  weatherTags?: readonly string[];
  tracks?: Readonly<Record<string, number>>;
  /**
   * Night (nc-3: from the setting's sunset to sunrise, else 22:00 to 06:00; the night stop always). Encounter check
   * (checkNow) reads it when given; the scheduled procedure's `onlyAt` reads it too, but the time strip feeds it only
   * to Encounter check (the procedure's schedule is unchanged, nc-1).
   */
  night?: boolean;
  /** The campaign's optional-rule choices (for onlyWithOption). */
  choices?: Choices;
  /** The GM's town switches (sw-1 … sw-4), for checks with onlyWhen; missing: both off. */
  switches?: TownSwitches;
  /** The party's abilities and the GM's "+ Modifier", by check. */
  extraModifiers?: readonly ExtraModifier[];
  /** Who is in play (their classes and skills), for the checks' modifiers keyed to the party (ex-2, ga-3). */
  party?: readonly PartyMember[];
  /** A location's own check: it stands in for the mode's encounter checks and the GM's encounter-check reminders. */
  locationCheck?: Check | null;
  /**
   * The location's check is rolled on each move (`when: "eachMove"`, pf-12; dec-7 piece 3): it still stands in for the
   * mode's encounter checks and the GM's encounter-check reminders, but the clock never raises it (a move does).
   */
  locationCheckOnMove?: boolean;
  /**
   * A location's "none" in force (G-27, dg-2): it stands in for the mode's encounter checks and sets the GM's
   * encounter-check reminders aside, but never comes due. Check now still rolls the mode's checks (the GM asked).
   */
  locationNone?: boolean;
  /** "Use my check here instead": the GM's reminders keep running and the location's check is set aside. */
  useMineHere?: boolean;
  /** The encounter table the GM picked for now: it beats the place's, the terrain's and the check's (engine ruling 3). */
  pickedTableId?: string | null;
  /** The current place's default encounter table. */
  placeTableId?: string | null;
}

export interface Expedition {
  rules: ExplorationRules;
  mode: Mode;
  units: TimeUnits;
  /** Where the campaign clock was when the expedition began (checks and rest count from here). */
  startedAt: number;
  /** Where the rest countdown starts (M5b g6, B5: the last rest applied); the expedition's start when absent. */
  restFrom?: number;
  now: number;
  lights?: readonly (Lit & { name: string })[];
  effects?: readonly Effect[];
  statuses?: readonly { id: string; name: string; timer: StatusTimer }[];
  /** The GM's own reminders and the pack's remind hooks, on the campaign clock. */
  reminders?: readonly Schedule[];
  situation?: Situation;
}

/**
 * `again`: the check already ran this period (engine ruling 6: at most once per its `every`), so this later
 * reference is the optional "Checked today · Check again" tap, not a prompt.
 */
export type Prompt =
  | ({ kind: 'check'; stepId: string | null; source: 'mode' | 'location'; count: number; again: boolean } & CheckPrompt)
  | { kind: 'roll'; stepId: string; name: string; icon: Icon; tableId: string | null; note: string | null; count: number }
  /**
   * `tableChoices`: no season is known and the table depends on it ("Not now" on "Which season?", ruled 2026-10-30),
   * so the GM picks one of the setting's weather tables; empty otherwise.
   */
  | { kind: 'weather'; stepId: string | null; tableId: string | null; season: string | null; count: number; tableChoices: string[] }
  | { kind: 'camp'; stepId: string; name: string; icon: Icon; steps: Step[]; checks: (CheckPrompt & { count: number; again: boolean })[]; quickOption: string | null; note: string | null; count: number }
  | { kind: 'watches'; stepId: string; name: string; icon: Icon; watchLength: Amount | null; note: string | null; count: number };

export interface QuietLine {
  stepId: string;
  name: string;
  icon: Icon;
  note: string | null;
  /** 'auto': done by the app (shown in the log); 'note': a quiet line under the time strip. */
  kind: 'note' | 'auto';
}

export interface RestDue {
  count: number;
  /** The pack's condition for Push on (exhaustion, say). */
  condition: string | null;
  length: Amount | null;
  note: string | null;
}

export interface Advance {
  from: number;
  to: number;
  /** Which of the mode's steps this was, from 1 since the expedition began ("turn 3"). */
  step: number;
  /** Prompts in procedure order, each merged with its count. */
  prompts: Prompt[];
  quiet: QuietLine[];
  rest: RestDue | null;
  /** The GM's reminders and remind hooks that fell due, merged with counts. */
  reminders: Due[];
  /** GM encounter-check reminders set aside while a location's own check runs. */
  suspended: string[];
  /**
   * GM encounter-check reminders that fell due when an encounter check (the mode's or a location's) also ran: that
   * check counts as theirs for the period, so they aren't prompted (engine ruling 8).
   */
  satisfied: string[];
  /** What the pack should say and doesn't (a terrain chance guessed from a step's symbol), once each. */
  warnings: string[];
  lights: { id: string; name: string; warned: boolean; outAt: number | null }[];
  effectsEnded: Effect[];
  statusesEnded: { id: string; name: string }[];
  /** Every status timer after the jump (feed these to the next advance). */
  statuses: { id: string; name: string; timer: StatusTimer }[];
  /** Turn modes: the hour's pips at the new time (the GM's view), and the events for anyone's view. */
  hourTrack: Pip[] | null;
  trackEvents: TrackEvent[];
  activities: Usable[];
  /** Always false here: only Set time… is a correction. */
  correction: false;
}

export interface Summary extends Omit<Advance, 'step'> {
  /** How many of the mode's steps ran. */
  steps: number;
  /** Each step's own advance, in order. */
  each: Advance[];
}

/**
 * Seconds in one of the mode's steps; null when its unit isn't known. Point to point's step is one unit of the ways
 * leaving the party's place (p2p-6): the mode is built with that unit (`pointToPoint`, modes.ts), so it reads here as
 * any mode's does.
 */
export function stepSeconds(mode: Mode, units: TimeUnits): number | null {
  const seconds = toSeconds(mode.step, units);
  return seconds && seconds > 0 ? seconds : null;
}

/** Times something set going at the start, every `interval`, falls due in (from, to]; every step when no interval. */
function dueCount(startedAt: number, interval: number | null, from: number, to: number): number {
  return interval && interval > 0 ? occurrences(startedAt, interval, from, to) : 0;
}

/** The mode's checks a procedure step or a camp step runs, by check id, with the symbol of the step that runs it. */
function stepIcons(mode: Mode, modes: readonly Mode[]): Map<string, Icon> {
  const icons = new Map<string, Icon>();
  for (const step of [...mode.procedure, ...(campOf(mode, modes)?.procedure ?? [])]) if (step.kind === 'check' && step.checkId && !icons.has(step.checkId)) icons.set(step.checkId, step.icon);
  return icons;
}

/**
 * The mode's weather block: its own, else the rules set's default for day-by-day modes; null when there's none.
 * Point to point takes the setting's day weather whatever its unit, rolled at that block's own pace, once a day
 * unless the setting says otherwise (ruled 2026-11-18, the point-to-point plan's flag 10).
 */
function weatherBlock(expedition: Pick<Expedition, 'mode' | 'rules'>): Weather | null {
  if (isPointToPoint(expedition.mode)) return expedition.rules.weather;
  return expedition.mode.weather ?? (expedition.mode.pace === 'day' ? expedition.rules.weather : null);
}

/** The weather that applies: the mode's own, else the rules set's default for day-by-day modes, when its option is on. */
export function weatherFor(expedition: Pick<Expedition, 'mode' | 'rules' | 'situation'>): Weather | null {
  const weather = weatherBlock(expedition);
  return weather && optionOn(weather.onlyWithOption, expedition.situation?.choices ?? {}) ? weather : null;
}

/**
 * The weather is switched off (engine ruling 4): there's a weather block and its onlyWithOption is off, so the block
 * and every weather step of the procedure are skipped entirely, with no prompt.
 */
export function weatherOff(expedition: Pick<Expedition, 'mode' | 'rules' | 'situation'>): boolean {
  return weatherBlock(expedition) !== null && weatherFor(expedition) === null;
}

/**
 * Whether the mode's step needs to know the season (ruled 2026-10-29: the first step that does asks "Which season?"):
 * its weather reads a table by season, a roll step has tables by season, or an activity depends on the season.
 */
export function needsSeason(expedition: Pick<Expedition, 'mode' | 'rules' | 'situation'>): boolean {
  const weather = weatherFor(expedition);
  if (weather && Object.keys(weather.tables).some((key) => key !== 'any')) return true;
  if (expedition.mode.procedure.some((step) => Object.keys(step.tableBySeason).length > 0)) return true;
  return expedition.mode.activities.some((a) => a.seasons.length > 0 || Object.keys(a.bySeason).length > 0);
}

/** The weather table for today: a special season's own (or the season it borrows), then the step's, then the season's. */
function weatherTable(expedition: Expedition, step: Step | null, weather: Weather | null): string | null {
  const sit = expedition.situation ?? {};
  const season = sit.season ?? null;
  for (const id of sit.specialSeasons ?? []) {
    const special = expedition.rules.specialSeasons.find((s) => s.id === id);
    if (!special) continue;
    if (special.weatherTableId) return special.weatherTableId;
    if (weather?.tables[special.id]) return weather.tables[special.id]!;
    if (special.weatherFrom) return step?.tableBySeason[special.weatherFrom] ?? weather?.tables[special.weatherFrom] ?? null;
  }
  return (season ? step?.tableBySeason[season] : undefined) ?? step?.tableId ?? (season ? weather?.tables[season] : undefined) ?? weather?.tables.any ?? null;
}

/**
 * The weather prompt. Without a season (Not now on "Which season?", ruled 2026-10-30) and no table for any season,
 * the GM picks one of the setting's weather tables (the step's by season, then the rules set's), each once.
 */
function weatherPrompt(expedition: Expedition, step: Step | null, weather: Weather | null, count: number): Extract<Prompt, { kind: 'weather' }> {
  const season = expedition.situation?.season ?? null;
  const tableId = weatherTable(expedition, step, weather);
  const tableChoices = tableId || season ? [] : [...new Set([...Object.values(step?.tableBySeason ?? {}), ...Object.values(weather?.tables ?? {})])];
  return { kind: 'weather', stepId: step?.id ?? null, tableId, season, count, tableChoices };
}

/**
 * Today's weather step (ruled 2026-10-30, A8–A12): which `rollEvery` step of the expedition the clock is in (0 the
 * first; the weather rolled for it lasts until the next), where it began, the table to roll and the season.
 * `waitingForSeason`: the table depends on the season and none is known yet, so players wait until the GM answers
 * "Which season?" or picks a table (one of `tableChoices`). Without a weather block, a mode's weather roll step
 * comes every step. Null when the mode has no weather, or its optional rule is off (engine ruling 4). Pure.
 */
export interface WeatherNow {
  period: number;
  startsAt: number;
  /** When the next weather is due. */
  endsAt: number;
  tableId: string | null;
  tableChoices: string[];
  season: string | null;
  waitingForSeason: boolean;
  /** The weather block's tags, by id (empty without one). */
  tags: Weather['tags'];
}

export function weatherNow(expedition: Expedition): WeatherNow | null {
  if (weatherOff(expedition)) return null;
  const weather = weatherFor(expedition);
  const step = expedition.mode.procedure.find((s) => s.kind === 'roll' && s.icon === 'weather') ?? null;
  if (!weather && !step) return null;
  const every = weather ? toSeconds(weather.rollEvery, expedition.units) : stepSeconds(expedition.mode, expedition.units);
  if (!every || every <= 0) return null;
  const period = Math.floor(Math.max(0, expedition.now - expedition.startedAt) / every);
  const startsAt = expedition.startedAt + period * every;
  const prompt = weatherPrompt(expedition, step, weather, 1);
  return {
    period,
    startsAt,
    endsAt: startsAt + every,
    tableId: prompt.tableId,
    tableChoices: prompt.tableChoices,
    season: prompt.season,
    waitingForSeason: prompt.tableId === null && prompt.tableChoices.length > 0,
    tags: { ...(expedition.rules.weather?.tags ?? {}), ...(weather?.tags ?? {}) },
  };
}

/**
 * The checks to run: the mode's, with a location's own check (or its "none", G-27) standing in for its encounter checks.
 * `byHand` is Check now: a "none" doesn't stand in for it (dg-2).
 */
function checksInPlay(expedition: Expedition, icons: Map<string, Icon>, byHand = false): { checks: { check: Check; icon: Icon; source: 'mode' | 'location' }[]; located: boolean } {
  const sit = expedition.situation ?? {};
  const located = (!!sit.locationCheck || (sit.locationNone === true && !byHand)) && !sit.useMineHere;
  // A check with onlyWithOption runs only while its optional rule is on (07; WA1), e.g. a pack's gutter check (DG6);
  // one with onlyWhen only while the GM's town switch is on (sw-1 … sw-4): off, no due mark and no prompt.
  const checks = expedition.mode.checks
    .filter((check) => optionOn(check.onlyWithOption ?? null, sit.choices ?? {}) && runsNow(check.onlyWhen, sit.switches))
    .map((check) => ({ check, icon: icons.get(check.id) ?? 'dot', source: 'mode' as const }))
    .filter(({ check, icon }) => !(located && isEncounterCheck(check, icon)));
  return { checks, located };
}

/** What a check's prompt reads from the situation: the terrain, route, weather, tracks, seasons and tables. */
function checkContext(expedition: Expedition) {
  const { mode, rules } = expedition;
  const sit = expedition.situation ?? {};
  return {
    terrain: terrainOf(mode, sit.terrainId),
    routeType: sit.routeType,
    region: sit.region,
    weatherTags: sit.weatherTags,
    tracks: sit.tracks,
    specialSeasons: rules.specialSeasons.filter((s) => (sit.specialSeasons ?? []).includes(s.id)),
    extra: sit.extraModifiers,
    party: sit.party,
    chanceDie: mode.chanceDie,
    pickedTableId: sit.pickedTableId,
    placeTableId: sit.placeTableId,
    choices: sit.choices,
  };
}

/** One step of the procedure, or a jump with no step of its own (`runProcedure` false: timers only). */
function run(expedition: Expedition, from: number, to: number, runProcedure: boolean): Advance {
  const { mode, rules, units, startedAt } = expedition;
  const sit = expedition.situation ?? {};
  const per = stepSeconds(mode, units) ?? 1;
  const ctx = checkContext(expedition);
  const terrain = ctx.terrain;
  const icons = stepIcons(mode, rules.modes);
  const { checks, located } = checksInPlay(expedition, icons);
  const steps = runProcedure ? 1 : 0;

  // `night`: the camp's night step always counts as night (nc-3, ruled 2026-11-11); elsewhere the situation's.
  const checkDue = (check: Check, night = !!sit.night) => {
    if (check.onlyAt === 'day' && night) return 0;
    if (check.onlyAt === 'night' && !night) return 0;
    const interval = check.every ? toSeconds(check.every, units) : null;
    return check.every ? dueCount(startedAt, interval, from, to) : steps;
  };
  // A check runs at most once per `every` period (engine ruling 6): one advance covers a period, so a later step
  // that references a check already run in this advance gives the optional "Check again" instead of a prompt.
  const ran = new Set<string>();
  let encounterRan = false;
  const runCheck = (check: Check, icon: Icon, source: 'mode' | 'location', night?: boolean) => {
    const count = checkDue(check, night);
    if (count === 0) return null;
    const key = `${source}/${check.id}`;
    const again = ran.has(key);
    ran.add(key);
    if (!again && (source === 'location' || isEncounterCheck(check, icon))) encounterRan = true;
    return { count, again, ...checkPrompt(check, icon, rules, ctx) };
  };
  const promptFor = (check: Check, icon: Icon, source: 'mode' | 'location', stepId: string | null): Prompt | null => {
    const found = runCheck(check, icon, source);
    return found ? { kind: 'check', stepId, source, ...found } : null;
  };

  const prompts: Prompt[] = [];
  const quiet: QuietLine[] = [];
  const skipWeather = weatherOff(expedition);
  const weather = weatherFor(expedition);
  const weatherEvery = weather ? toSeconds(weather.rollEvery, units) : null;
  const weatherCount = weather ? dueCount(startedAt, weatherEvery, from, to) : 0;
  let weatherPlaced = false;

  if (runProcedure) {
    const referenced = new Set(icons.keys());
    const loose = checks.filter(({ check }) => !referenced.has(check.id));
    // A location's own check with onlyWhen still stands in for the mode's encounter checks; it prompts only while its switch is on.
    const locationCheck = located && sit.locationCheck && !sit.locationCheckOnMove && runsNow(sit.locationCheck!.onlyWhen, sit.switches) ? { check: sit.locationCheck!, icon: 'encounter' as Icon, source: 'location' as const } : null;
    const push = (p: Prompt | null) => p && prompts.push(p);
    // Loose checks (no step runs them) at the start of a day-long step come first; the rest after the procedure.
    for (const c of loose.filter(({ check }) => check.when === 'start')) push(promptFor(c.check, c.icon, c.source, null));
    if (locationCheck) push(promptFor(locationCheck.check, locationCheck.icon, 'location', null));
    for (const step of mode.procedure) {
      if (step.kind === 'note' || step.kind === 'auto') quiet.push({ stepId: step.id, name: step.name, icon: step.icon, note: step.note, kind: step.kind });
      else if (step.kind === 'check') {
        const found = checks.find(({ check }) => check.id === step.checkId);
        if (found) push(promptFor(found.check, step.icon, 'mode', step.id));
      } else if (step.kind === 'roll') {
        if (step.icon === 'weather') {
          // The weather roll: when it falls due (once a day unless rollEvery says otherwise; every step without weather rules).
          // With the weather's option off, the step is skipped entirely (engine ruling 4).
          if (skipWeather) continue;
          const count = weather ? weatherCount : 1;
          weatherPlaced = true;
          if (count > 0) prompts.push(weatherPrompt(expedition, step, weather, count));
        } else {
          const tableId = (sit.season ? step.tableBySeason[sit.season] : undefined) ?? step.tableId;
          prompts.push({ kind: 'roll', stepId: step.id, name: step.name, icon: step.icon, tableId, note: step.note, count: 1 });
        }
      } else if (step.kind === 'watches') prompts.push({ kind: 'watches', stepId: step.id, name: step.name, icon: step.icon, watchLength: step.watchLength, note: step.note, count: 1 });
      else if (step.kind === 'camp') {
        const camp = campOf(mode, rules.modes);
        const campChecks = (camp?.procedure ?? []).flatMap((s) => {
          const found = s.kind === 'check' ? checks.find(({ check }) => check.id === s.checkId) : undefined;
          // The camp's checks are the night's (the night stop always counts as night, nc-3).
          const ranHere = found ? runCheck(found.check, s.icon, 'mode', true) : null;
          return ranHere ? [ranHere] : [];
        });
        prompts.push({ kind: 'camp', stepId: step.id, name: step.name, icon: step.icon, steps: camp?.procedure ?? [], checks: campChecks, quickOption: camp?.quickOption ?? null, note: camp?.note ?? step.note, count: 1 });
      }
    }
    for (const c of loose.filter(({ check }) => check.when !== 'start')) push(promptFor(c.check, c.icon, c.source, null));
    if (!weatherPlaced && weatherCount > 0) prompts.unshift(weatherPrompt(expedition, null, weather, weatherCount));
  }

  // The rest reminder, from the expedition's start.
  const restEvery = mode.rest ? toSeconds(mode.rest.every, units) : null;
  const restAnchor = expedition.restFrom ?? startedAt;
  const restCount = mode.rest ? dueCount(restAnchor, restEvery, from, to) : 0;
  const rest = mode.rest && restCount > 0 ? { count: restCount, condition: mode.rest.condition, length: mode.rest.length, note: mode.rest.note } : null;

  // The GM's reminders: a location's own check sets their encounter-check reminders aside; an encounter check that
  // ran this period (the mode's or the location's) counts as theirs, so the GM is never prompted twice.
  const all = expedition.reminders ?? [];
  const suspended = located ? all.filter((s) => s.encounterCheck).map((s) => s.id) : [];
  const due = dueOnJump(all.filter((s) => !suspended.includes(s.id)), from, to);
  const isSatisfied = (d: Due) => encounterRan && all.some((s) => s.id === d.id && s.encounterCheck);
  const satisfied = due.filter(isSatisfied).map((d) => d.id);
  const reminders = due.filter((d) => !isSatisfied(d));
  const warnings = [...new Set(prompts.flatMap((p) => (p.kind === 'check' ? p.warnings : p.kind === 'camp' ? p.checks.flatMap((c) => c.warnings) : [])))];

  const lights = burnOnJump(expedition.lights ?? [], from, to).map((l) => ({ ...l, name: expedition.lights!.find((x) => x.id === l.id)!.name }));
  const effectsEnded = endingOnJump(expedition.effects ?? [], from, to);
  const ticked = (expedition.statuses ?? []).map((s) => ({ s, t: tickTimer(s.timer, to - from) }));
  const statuses = ticked.map(({ s, t }) => ({ ...s, timer: t.timer }));
  const statusesEnded = ticked.filter(({ t }) => t.ended).map(({ s }) => ({ id: s.id, name: s.name }));

  // The hour track's events, from the new time: checks (the GM's), rest, effects ending, the first light out. A check,
  // rest or reminder due at the new time itself counts (B8: it's due on the turn now being played).
  const trackEvents: TrackEvent[] = [];
  // The next time it falls due after the new time, and the new time itself when it fell due just now.
  const dueTimes = (anchor: number, interval: number) => [...(nextAfter(anchor, interval, to - 1) === to ? [to] : []), nextAfter(anchor, interval, to)];
  if (mode.pace === 'turn') {
    for (const { check, icon } of checks) {
      const interval = check.every ? toSeconds(check.every, units) : per;
      if (interval) for (const at of dueTimes(startedAt, interval)) trackEvents.push({ at, symbol: icon, label: check.name, public: false });
    }
    if (mode.rest && restEvery) for (const at of dueTimes(restAnchor, restEvery)) trackEvents.push({ at, symbol: 'rest', label: 'rest', public: true });
    for (const e of expedition.effects ?? []) if (e.endsAt !== null && e.endsAt > to) trackEvents.push({ at: e.endsAt, symbol: 'star', label: e.name, public: !e.hidden });
    const first = firstToRunOut(expedition.lights ?? [], to);
    if (first) trackEvents.push({ at: first.at, symbol: 'light', label: expedition.lights!.find((l) => l.id === first.id)!.name, public: true });
    for (const r of all.filter((s) => !suspended.includes(s.id))) for (const at of dueTimes(r.anchor, r.interval)) trackEvents.push({ at, symbol: r.encounterCheck ? 'encounter' : 'note', label: r.name, public: r.public === true });
  }

  return {
    from,
    to,
    step: Math.floor(Math.max(0, to - startedAt) / per),
    prompts,
    quiet,
    rest,
    reminders,
    suspended,
    satisfied,
    warnings,
    lights,
    effectsEnded,
    statusesEnded,
    statuses,
    hourTrack: mode.pace === 'turn' ? hourTrack(to, units, trackEvents, 'gm') : null,
    trackEvents,
    activities: usableActivities(mode, units, { terrain, season: sit.season, specialSeasons: sit.specialSeasons, choices: sit.choices }),
    correction: false,
  };
}

/**
 * The hour track at the clock's time now (turn modes; null otherwise), for this viewer: the GM sees every event,
 * players only the public ones (X-1). Nothing runs; it's what the track shows between advances.
 */
export function hourTrackNow(expedition: Expedition, viewer: 'gm' | 'player'): Pip[] | null {
  if (expedition.mode.pace !== 'turn' || !stepSeconds(expedition.mode, expedition.units) || !expedition.units.hour || !expedition.units.turn) return null;
  const { trackEvents } = run(expedition, expedition.now, expedition.now, false);
  return hourTrack(expedition.now, expedition.units, trackEvents, viewer);
}

/**
 * The encounter check in force (S4's fact; rg-4): a location's own check standing in for the mode's, else the mode's
 * first encounter check in play now; null with none. Whether it runs at this hour isn't asked: the fact states the
 * check, not this hour's roll.
 */
export function encounterCheckOf(expedition: Expedition): { check: Check; eachMove: boolean; source: 'mode' | 'location' } | null {
  const sit = expedition.situation ?? {};
  const { checks, located } = checksInPlay(expedition, stepIcons(expedition.mode, expedition.rules.modes));
  // A "none" in force (G-27): no check that comes due.
  if (located) return sit.locationCheck ? { check: sit.locationCheck, eachMove: sit.locationCheckOnMove === true, source: 'location' } : null;
  const found = checks.find(({ check, icon }) => isEncounterCheck(check, icon));
  return found ? { check: found.check, eachMove: false, source: 'mode' } : null;
}

/**
 * Check now (ruled 2026-10-30, DG3; nc-1, 2026-11-11: it respects the hour): an ad-hoc wandering check at any time. The wandering checks in play now (a
 * location's own check standing in for the mode's), each once, as prompts with their modifiers and what a hit rolls;
 * with none, the GM's own encounter-check reminders. Nothing moves and nothing is scheduled: the regular schedule
 * carries on. Empty when there's no wandering check at all.
 */
export function checkNow(expedition: Expedition): Pick<Advance, 'prompts' | 'reminders' | 'rest' | 'to'> {
  const sit = expedition.situation ?? {};
  // nc-1 (ruled 2026-11-11, changing DG3): at night only the night's checks and those with no time limit; by day only
  // the day's and those with none. Without `night` (not known), every check, as before.
  const atThisHour = (check: Check) => sit.night === undefined || check.onlyAt === null || check.onlyAt === (sit.night ? 'night' : 'day');
  const ctx = checkContext(expedition);
  const { checks, located } = checksInPlay(expedition, stepIcons(expedition.mode, expedition.rules.modes), true);
  const wandering: { check: Check; icon: Icon; source: 'mode' | 'location' }[] = located
    ? runsNow(sit.locationCheck!.onlyWhen, sit.switches) && atThisHour(sit.locationCheck!) ? [{ check: sit.locationCheck!, icon: 'encounter', source: 'location' }] : []
    : checks.filter(({ check, icon }) => isEncounterCheck(check, icon) && atThisHour(check));
  const prompts: Prompt[] = wandering.map(({ check, icon, source }) => ({ kind: 'check', stepId: null, source, count: 1, again: false, ...checkPrompt(check, icon, expedition.rules, ctx) }));
  const reminders: Due[] = prompts.length
    ? []
    : (expedition.reminders ?? [])
        .filter((s) => s.kind === 'check' && s.encounterCheck)
        .map((s) => ({ id: s.id, name: s.name, kind: s.kind, group: s.group ?? 'gm', count: 1, nextAt: nextAfter(s.anchor, s.interval, expedition.now) }));
  return { prompts, reminders, rest: null, to: expedition.now };
}

/** The mode's one main advance (Next turn, or its own step): the procedure runs once. Null when the step can't be read. */
export function nextStep(expedition: Expedition): Advance | null {
  const per = stepSeconds(expedition.mode, expedition.units);
  return per ? run(expedition, expedition.now, expedition.now + per, true) : null;
}

const promptKey = (p: Prompt) => `${p.kind}/${p.stepId ?? ''}/${p.kind === 'check' ? p.checkId : ''}`;

/** Many advances summed up: prompts and reminders merged with their counts, everything else in order. */
function summarise(expedition: Expedition, each: Advance[], to: number, steps: number): Summary {
  const prompts: Prompt[] = [];
  for (const a of each) {
    for (const p of a.prompts) {
      const there = prompts.find((q) => promptKey(q) === promptKey(p));
      if (there) {
        there.count += p.count;
        if (there.kind === 'camp' && p.kind === 'camp') for (const c of p.checks) {
          const same = there.checks.find((x) => x.checkId === c.checkId);
          if (same) same.count += c.count;
          else there.checks.push({ ...c });
        }
      } else prompts.push(p.kind === 'camp' ? { ...p, checks: p.checks.map((c) => ({ ...c })) } : { ...p });
    }
  }
  const quiet: QuietLine[] = [];
  for (const a of each) for (const q of a.quiet) if (!quiet.some((x) => x.stepId === q.stepId)) quiet.push(q);
  const restCount = each.reduce((sum, a) => sum + (a.rest?.count ?? 0), 0);
  const firstRest = each.find((a) => a.rest)?.rest;
  const last = each[each.length - 1];
  return {
    from: expedition.now,
    to,
    steps,
    each,
    prompts,
    quiet,
    rest: firstRest ? { ...firstRest, count: restCount } : null,
    reminders: each.reduce<Due[]>((card, a) => mergeDue(card, a.reminders), []),
    suspended: last?.suspended ?? [],
    satisfied: [...new Set(each.flatMap((a) => a.satisfied))],
    warnings: [...new Set(each.flatMap((a) => a.warnings))],
    lights: each.flatMap((a) => a.lights),
    effectsEnded: each.flatMap((a) => a.effectsEnded),
    statusesEnded: each.flatMap((a) => a.statusesEnded),
    statuses: last?.statuses ?? [...(expedition.statuses ?? [])],
    hourTrack: last?.hourTrack ?? null,
    trackEvents: last?.trackEvents ?? [],
    activities: last?.activities ?? [],
    correction: false,
  };
}

/** Runs the advance for each piece, feeding each one's status timers into the next. */
function chain(expedition: Expedition, pieces: { seconds: number; procedure: boolean }[]): Summary {
  const each: Advance[] = [];
  let now = expedition.now;
  let statuses = expedition.statuses;
  for (const piece of pieces) {
    const a = run({ ...expedition, now, statuses }, now, now + piece.seconds, piece.procedure);
    each.push(a);
    now = a.to;
    statuses = a.statuses;
  }
  return summarise(expedition, each, now, pieces.filter((p) => p.procedure).length);
}

/** Long-press +N: the main advance N times, summed up. Null when N isn't a whole number from 1 or the step can't be read. */
export function nextSteps(expedition: Expedition, n: number): Summary | null {
  const per = stepSeconds(expedition.mode, expedition.units);
  if (!per || !Number.isInteger(n) || n < 1) return null;
  return chain(expedition, Array.from({ length: n }, () => ({ seconds: per, procedure: true })));
}

/**
 * Advance by… (an amount and a unit, for odd amounts like "40 minutes"): the procedure runs for each whole step
 * that passes; what's left over moves the timers only (lights, effects, statuses, reminders). Not a correction.
 * Null when the amount can't be read or is 0.
 */
export function advanceBy(expedition: Expedition, amount: Amount): Summary | null {
  const per = stepSeconds(expedition.mode, expedition.units);
  const total = toSeconds({ value: amount.value, unit: unitName(amount.unit, expedition.units) }, expedition.units);
  if (!per || !total) return null;
  const whole = Math.floor(total / per);
  const left = total - whole * per;
  const pieces = Array.from({ length: whole }, () => ({ seconds: per, procedure: true }));
  if (left > 0) pieces.push({ seconds: left, procedure: false });
  return chain(expedition, pieces);
}

export interface Correction {
  from: number;
  to: number;
  /** Logged as a correction; nothing in the procedure runs, no checks, no reminders, no prompts. */
  correction: true;
  /** Every status timer after the jump, moved by the same amount as the clock (feed these to the next advance). */
  statuses: { id: string; name: string; timer: StatusTimer }[];
  /** The status timers as they were, so Undo puts them back. */
  statusesBefore: { id: string; name: string; timer: StatusTimer }[];
  /**
   * What ran out during a forward jump: lights, timed effects and status timers. They end quietly, with one log
   * line ("Ran out with the clock: …"), never a prompt.
   */
  ranOut: { kind: 'light' | 'effect' | 'status'; id: string; name: string }[];
}

/** A status timer moved by `seconds` (back when negative: time comes back, up to its full length). */
function shiftTimer(timer: StatusTimer, seconds: number): StatusTimer {
  if (timer.remaining === null) return timer;
  if (seconds >= 0) return tickTimer(timer, seconds).timer;
  const back = timer.remaining - seconds;
  return { ...timer, remaining: timer.total !== null ? Math.min(timer.total, back) : back };
}

/**
 * Set time… (genuine corrections only; engine ruling 5): the clock jumps, forwards or back, and no step or check
 * runs. Status timers and lights move with the clock by the same amount (lights burn from when they were lit, so
 * they follow by themselves); lights, timed effects and status timers that run out end quietly, listed in `ranOut`
 * for one log line. It can be undone (undoSetTime). Null for a time before 0.
 */
export function setTime(expedition: Pick<Expedition, 'now' | 'lights' | 'effects' | 'statuses'>, to: number): Correction | null {
  if (!Number.isInteger(to) || to < 0) return null;
  const from = expedition.now;
  const before = [...(expedition.statuses ?? [])];
  const statuses = before.map((s) => ({ ...s, timer: shiftTimer(s.timer, to - from) }));
  const ranOut: Correction['ranOut'] = [];
  if (to > from) {
    for (const l of burnOnJump(expedition.lights ?? [], from, to)) if (l.outAt !== null) ranOut.push({ kind: 'light', id: l.id, name: expedition.lights!.find((x) => x.id === l.id)!.name });
    for (const e of endingOnJump(expedition.effects ?? [], from, to)) ranOut.push({ kind: 'effect', id: e.id, name: e.name });
    for (const s of before) if (tickTimer(s.timer, to - from).ended) ranOut.push({ kind: 'status', id: s.id, name: s.name });
  }
  return { from, to, correction: true, statuses, statusesBefore: before, ranOut };
}

/** Undo for Set time…: the clock goes back to where it was and the status timers to what they were; nothing runs out. */
export function undoSetTime(correction: Correction): Correction {
  return { from: correction.to, to: correction.from, correction: true, statuses: correction.statusesBefore, statusesBefore: correction.statuses, ranOut: [] };
}

/** The quiet log line for what ran out during Set time…; null when nothing did. */
export function ranOutLine(correction: Pick<Correction, 'ranOut'>): string | null {
  return correction.ranOut.length ? `Ran out with the clock: ${correction.ranOut.map((r) => r.name).join(', ')}.` : null;
}
