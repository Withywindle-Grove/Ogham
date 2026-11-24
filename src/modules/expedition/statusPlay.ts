// Statuses and rest as the campaign keeps them (M5 step 9; docs/04 "Status"; docs/05 "Status symbols", "Rest"; docs/07
// conditions; ruled 2026-10-25, 2026-10-29 D27, 2026-10-30 DG5, WA3 and the answers after #170;
// supabase/migrations/…_m5_statuses.sql). A status sits on a character or a hireling: from the setting's conditions,
// typed by hand, or the pack's rest condition (Push on). It may stack ("×2"), step through ordered levels, and carry a
// timer on the campaign clock, stored in seconds and shown in its own unit. A secret timer is the GM's: its end lives
// in a table only the GM reads, so a player's device never gets it and shows the symbol without the fill. The GM or
// the character's owner adds and removes statuses (03); only the GM keeps a timer secret. Rest this turn (or Rest
// today) is the character's choice for the step under way; the GM's Next turn (Next day) applies it, and resting
// ends the rest condition Push on marked. The database ends timers and applies rests with the clock's move.
// statusTimer.ts beside this is the pure timer maths.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { inUnit, toSeconds, unitName, type Amount, type TimeUnits } from './clock.ts';
import type { Mode } from './modes.ts';
import { STATUS_TONES } from './statusLook.ts';
import { showTimer, type StatusTimer, type TimerShown } from './statusTimer.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const textOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** One of a status's ordered levels (07: `levels: [{ id, name, effects }]`, in order). */
export interface StatusLevel {
  id: string;
  name: string;
}

export type StatusSource = 'condition' | 'typed' | 'rest';

/** A status on a character, as stored. */
export interface CharacterStatus {
  id: string;
  campaignId: string;
  actorId: string;
  name: string;
  conditionId: string | null;
  icon: string | null;
  stacks: number;
  stacking: boolean;
  levels: StatusLevel[] | null;
  /** The level it's at, from 0 (null without levels). */
  level: number | null;
  source: StatusSource;
  note: string | null;
  /** On the campaign clock (seconds). */
  startedAt: number;
  /** When its timer ends (null: no timer, or a secret one this device doesn't hold). */
  endsAt: number | null;
  totalSeconds: number | null;
  unit: string | null;
  secret: boolean;
  /** M5b g6 (B6): it ends when a rest is applied to its character ("Until rest"). */
  untilRest?: boolean;
  endedAt: number | null;
  version: number;
}

/** A secret timer (the GM's only). */
export interface StatusSecret {
  id: string;
  endsAt: number;
  totalSeconds: number;
  unit: string | null;
}

function levelsOf(value: unknown): StatusLevel[] | null {
  if (!Array.isArray(value)) return null;
  const levels = value.flatMap((l) => (isRecord(l) && textOrNull(l.name) ? [{ id: textOrNull(l.id) ?? String(l.name), name: String(l.name).trim() }] : []));
  return levels.length > 0 ? levels : null;
}

export function toCharacterStatus(row: Record<string, unknown>): CharacterStatus {
  const source = row.source === 'condition' || row.source === 'rest' ? row.source : 'typed';
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    actorId: String(row.actor_id),
    name: typeof row.name === 'string' ? row.name : '',
    conditionId: textOrNull(row.condition_id),
    icon: textOrNull(row.icon),
    stacks: numOrNull(row.stacks) ?? 1,
    stacking: row.stacking === true,
    levels: levelsOf(row.levels),
    level: numOrNull(row.level),
    source,
    note: textOrNull(row.note),
    startedAt: numOrNull(row.started_at) ?? 0,
    endsAt: numOrNull(row.ends_at),
    totalSeconds: numOrNull(row.total_seconds),
    unit: textOrNull(row.unit),
    secret: row.secret === true,
    untilRest: row.until_rest === true,
    endedAt: numOrNull(row.ended_at),
    version: numOrNull(row.version) ?? 1,
  };
}

export function toStatusSecret(row: Record<string, unknown>): StatusSecret {
  return { id: String(row.id), endsAt: numOrNull(row.ends_at) ?? 0, totalSeconds: numOrNull(row.total_seconds) ?? 1, unit: textOrNull(row.unit) };
}

/** The statuses on now (not ended, not undone) that this person can see in the campaign, oldest first. Null on error. */
export async function loadStatuses(db: Db, campaignId: string): Promise<CharacterStatus[] | null> {
  const { data, error } = await db
    .from('character_statuses')
    .select('*')
    .eq('campaign_id', campaignId)
    .is('ended_at', null)
    .eq('undone', false)
    .order('created_at', { ascending: true });
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map(toCharacterStatus);
}

/** The campaign's secret timers, by status id: the GM's only (a player's device gets none). Null on error. */
export async function loadStatusSecrets(db: Db, campaignId: string): Promise<Map<string, StatusSecret> | null> {
  const { data, error } = await db.from('status_secrets').select('*').eq('campaign_id', campaignId);
  if (error) return null;
  return new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [String(r.id), toStatusSecret(r)]));
}

// Conditions from the setting rules (07 conditions) ----------------------------------------------------------------

/** A condition a status can come from. */
export interface Condition {
  id: string;
  name: string;
  icon: string | null;
  stacks: boolean;
  levels: StatusLevel[] | null;
  /** Its default length in rounds (`defaultRounds`), if any. */
  defaultRounds: number | null;
  /** Its brief effect (`notes` / `note`), shown under its name everywhere (M5 gate B6). */
  note: string | null;
  /** The family it belongs to (07 `conditions[].family`, G-46): the + Status pop-up groups kinds behind one row. */
  family?: string | null;
  /** Its ring's colour (07 `conditions[].tone`, R3-6, 2026-11-08): light, harm, boon or neutral; null when not given. */
  tone?: string | null;
}

/** A condition entry's data, read leniently; null without a name. */
export function readCondition(id: string, data: Record<string, unknown>): Condition | null {
  const name = textOrNull(data.name);
  if (!name) return null;
  const rounds = data.defaultRounds;
  return {
    id,
    name,
    icon: textOrNull(data.icon),
    stacks: data.stacks === true,
    levels: levelsOf(data.levels),
    defaultRounds: typeof rounds === 'number' && Number.isInteger(rounds) && rounds > 0 ? rounds : null,
    note: textOrNull(data.notes) ?? textOrNull(data.note),
    family: textOrNull(data.family)?.slice(0, 80) ?? null,
    tone: (STATUS_TONES as readonly unknown[]).includes(data.tone) ? String(data.tone) : null,
  };
}

/** The setting's conditions (stacked entries of kind "condition"), by name. */
export function conditionsOf(entries: readonly { kind: string; packEntryId: string; data: Record<string, unknown> }[]): Condition[] {
  return entries
    .filter((e) => e.kind === 'condition')
    .flatMap((e) => readCondition(e.packEntryId, e.data) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Conditions whose name (or family) holds the words typed (any order, any case); all of them for an empty search. */
export function searchConditions(conditions: readonly Condition[], typed: string): Condition[] {
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return conditions.filter((c) => words.every((w) => c.name.toLowerCase().includes(w) || (c.family?.toLowerCase().includes(w) ?? false)));
}

/** A row of the + Status pop-up: one condition, or a family of the pack's kinds behind one row (M5 gate B6). */
export type ConditionRow = { kind: 'condition'; condition: Condition } | { kind: 'family'; name: string; kinds: Condition[] };

/**
 * The + Status pop-up's rows (M5 gate B6; 07 `conditions[].family`). With nothing typed: conditions sharing a family
 * (two or more) sit behind one row named after it, the rest one row each, all by name. Families come only from the
 * pack's conditions: a pack without `family` gives a flat list. With words typed: the matching conditions, flat.
 */
export function conditionRows(conditions: readonly Condition[], typed = ''): ConditionRow[] {
  if (typed.trim()) return searchConditions(conditions, typed).map((condition) => ({ kind: 'condition', condition }));
  const families = new Map<string, Condition[]>();
  for (const c of conditions) {
    if (!c.family) continue;
    const key = c.family.toLowerCase();
    families.set(key, [...(families.get(key) ?? []), c]);
  }
  const rows: ConditionRow[] = [];
  const placed = new Set<string>();
  for (const c of conditions) {
    const kinds = c.family ? families.get(c.family.toLowerCase())! : null;
    if (!kinds || kinds.length < 2) rows.push({ kind: 'condition', condition: c });
    else if (!placed.has(c.family!.toLowerCase())) {
      placed.add(c.family!.toLowerCase());
      rows.push({ kind: 'family', name: kinds[0]!.family!, kinds });
    }
  }
  const nameOf = (r: ConditionRow) => (r.kind === 'family' ? r.name : r.condition.name);
  return rows.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }));
}

/** A status's brief effect, shown under its name everywhere (M5 gate B6): its condition's `notes`, else its own note. */
export function statusEffect(status: Pick<CharacterStatus, 'conditionId' | 'note'>, conditions: readonly Condition[]): string | null {
  const fromPack = status.conditionId ? (conditions.find((c) => c.id === status.conditionId)?.note ?? null) : null;
  return fromPack ?? status.note;
}

/**
 * The + Status pop-up's durations, on one row (M5 gate B6, C2): 1 turn and 1 hour when the campaign has those units,
 * Until rest, Until removed, Other… (any number of rounds, turns, hours or days). "This fight" waits for fights (M6).
 */
export type DurationChoice = 'turn' | 'hour' | 'rest' | 'removed' | 'other';
export function durationChoices(units: TimeUnits): { value: DurationChoice; label: string }[] {
  const have = timerUnits(units);
  return [
    ...(have.includes('turn') ? [{ value: 'turn' as const, label: '1 turn' }] : []),
    ...(have.includes('hour') ? [{ value: 'hour' as const, label: '1 hour' }] : []),
    { value: 'rest', label: 'Until rest' },
    { value: 'removed', label: 'Until removed' },
    { value: 'other', label: 'Other…' },
  ];
}

/**
 * A custom status kept in the campaign's homebrew (M5 gate B6): a condition entry with its name, what it does
 * (`notes`) and whether it stacks; its id unique among the setting's conditions.
 */
export function customCondition(conditions: readonly Pick<Condition, 'id'>[], name: string, whatItDoes: string, stacks: boolean): Record<string, unknown> {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'custom';
  const taken = new Set(conditions.map((c) => c.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return { id, name: name.trim(), ...(whatItDoes.trim() ? { notes: whatItDoes.trim() } : {}), ...(stacks ? { stacks: true } : {}) };
}

// What a status shows ------------------------------------------------------------------------------------------------

/** Its name as shown: the level it's at for a status with levels ("Reeling"), else its own name. */
export function shownName(status: Pick<CharacterStatus, 'name' | 'levels' | 'level'>): string {
  if (status.levels && status.levels.length > 0) return status.levels[Math.max(0, Math.min(status.levels.length - 1, status.level ?? 0))]!.name;
  return status.name;
}

/** The letter in its circle: the first letter of the name shown. */
export function symbolOf(status: Pick<CharacterStatus, 'name' | 'levels' | 'level'>): string {
  return (shownName(status).trim().charAt(0) || '•').toUpperCase();
}

/** Its timer as the engine reads it (time left from now), from the status or (the GM's device) its secret; null without. */
export function timerOf(status: CharacterStatus, secrets: ReadonlyMap<string, StatusSecret>, now: number): StatusTimer | null {
  const secret = status.secret ? secrets.get(status.id) : undefined;
  const endsAt = secret ? secret.endsAt : status.endsAt;
  const total = secret ? secret.totalSeconds : status.totalSeconds;
  const unit = secret ? secret.unit : status.unit;
  if (status.secret && !secret) return { remaining: null, total: null, unit: unit ?? 'turn', secret: true };
  if (endsAt === null) return null;
  return { remaining: Math.max(0, endsAt - now), total, unit: unit ?? 'turn', secret: status.secret };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What one viewer sees of a status's time, in words and for the ring. */
export interface StatusTime {
  shown: TimerShown | null;
  /** "3 turns left", "Time left is the GM's", or null without a timer. */
  words: string | null;
  /** How it ends: "Ends in 3 turns", "Lasts until removed"… */
  ends: string;
}

/** A status's time for the GM or a player: a player never sees a secret timer's time left (05; 2026-10-29). */
export function statusTime(status: CharacterStatus, secrets: ReadonlyMap<string, StatusSecret>, now: number, units: TimeUnits, viewer: 'gm' | 'player'): StatusTime {
  const timer = timerOf(status, secrets, now);
  const restEnds = status.source === 'rest' || status.untilRest ? 'Ends when they rest.' : null;
  if (!timer) return { shown: null, words: null, ends: restEnds ?? (status.levels ? 'Lasts until stepped down or removed.' : 'Lasts until removed.') };
  if (timer.remaining === null || (timer.secret && viewer === 'player')) {
    return { shown: { left: null, fillPercent: null, hiddenFromViewer: true }, words: "Time left is the GM's", ends: 'Ends when its time is up. Only the GM sees how long.' };
  }
  const shown = showTimer(timer, units, viewer);
  const left = shown.left ?? inUnit(timer.remaining, 'minute', units);
  const words = left ? `${plural(left.value, left.unit)} left` : null;
  return { shown, words: `${words ?? 'Ending'}${timer.secret ? ', hidden from players' : ''}`, ends: left && left.value > 0 ? `Ends in ${plural(left.value, left.unit)}.` : 'Ends with the next move of the clock.' };
}

/** Where it came from, in words. */
export function sourceWords(status: Pick<CharacterStatus, 'source'>): string {
  return status.source === 'condition' ? "From the setting's conditions" : status.source === 'rest' ? 'From pushing on without rest' : 'Typed by hand';
}

/** "Exhausted, 2 stacks" · "Blessed, 3 turns left" (06 words guide, Status label). */
export function statusLabel(status: CharacterStatus, time: StatusTime): string {
  return [shownName(status), status.stacks > 1 ? `${status.stacks} stacks` : '', time.words && !time.shown?.hiddenFromViewer ? time.words.replace(', hidden from players', '') : time.shown?.hiddenFromViewer ? 'active' : '']
    .filter(Boolean)
    .join(', ');
}

/** A timer's length from what the person entered ("3", "turn"), in seconds; null when it can't be read. */
export function timerSeconds(value: number, unit: string, units: TimeUnits): number | null {
  if (!Number.isInteger(value) || value < 1 || value > 9999) return null;
  const seconds = toSeconds({ value, unit } as Amount, units);
  return seconds && seconds > 0 ? seconds : null;
}

/** The units a timer can be set in, shortest first: rounds, turns, hours, days (those the campaign has). */
export function timerUnits(units: TimeUnits): string[] {
  return ['round', 'turn', 'hour', 'day'].filter((u) => units[unitName(u, units)] !== undefined);
}

/** "Blessed on Ash": a status named with its character, for the hour track and Set time…'s line. */
export function statusOnWords(status: Pick<CharacterStatus, 'name' | 'levels' | 'level'>, who: string): string {
  return `${shownName(status)} on ${who.trim() || 'someone'}`;
}

/** The timed statuses as the engine runs them (Set time…'s "ran out" line), named with their characters. */
export function engineStatuses(statuses: readonly CharacterStatus[], secrets: ReadonlyMap<string, StatusSecret>, now: number, nameOf: (actorId: string) => string) {
  return statuses.flatMap((s) => {
    const timer = timerOf(s, secrets, now);
    return timer && timer.remaining !== null ? [{ id: s.id, name: statusOnWords(s, nameOf(s.actorId)), timer }] : [];
  });
}

/** The timed statuses as hour-track events (docs/05 "The hour track": effects ending); a secret one is the GM's. */
export function statusEffects(statuses: readonly CharacterStatus[], secrets: ReadonlyMap<string, StatusSecret>, nameOf: (actorId: string) => string) {
  return statuses.flatMap((s) => {
    const endsAt = s.secret ? (secrets.get(s.id)?.endsAt ?? null) : s.endsAt;
    return endsAt === null ? [] : [{ id: s.id, name: statusOnWords(s, nameOf(s.actorId)), endsAt, caster: null, hidden: s.secret }];
  });
}

// Rest (DG5; the answers after #170) --------------------------------------------------------------------------------

/** A character's rest choice and when they last rested, as stored. */
export interface CharacterRest {
  id: string;
  actorId: string;
  campaignId: string;
  /** When they chose Rest this turn (Rest today) for the step under way; null when they haven't. */
  chosenAt: number | null;
  restedAt: number | null;
  /** M5b g6 (B5): when they answered Push on for the rest under way; null when they haven't. */
  pushingAt: number | null;
  /** When they last pushed on without resting; null once they rest ("Rest due · you pushed on" until then). */
  pushedOnAt: number | null;
  /** When their group's rest countdown last restarted (a rest applied to them); null: from the expedition's start. */
  periodFrom: number | null;
  /** A rest called out of turn for their group (the Rest button), and by whom; null when none is open. */
  calledAt: number | null;
  calledBy: string | null;
  version: number;
}

export function toCharacterRest(row: Record<string, unknown>): CharacterRest {
  return {
    id: String(row.id),
    actorId: String(row.actor_id),
    campaignId: String(row.campaign_id),
    chosenAt: numOrNull(row.chosen_at),
    restedAt: numOrNull(row.rested_at),
    pushingAt: numOrNull(row.pushing_at),
    pushedOnAt: numOrNull(row.pushed_on_at),
    periodFrom: numOrNull(row.period_from),
    calledAt: numOrNull(row.called_at),
    calledBy: typeof row.called_by === 'string' ? row.called_by : null,
    version: numOrNull(row.version) ?? 1,
  };
}

/** Everyone's rest rows this person can see. Null on error. */
export async function loadRests(db: Db, campaignId: string): Promise<CharacterRest[] | null> {
  const { data, error } = await db.from('character_rests').select('*').eq('campaign_id', campaignId);
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map(toCharacterRest);
}

/** What the mode's rest rule says now: how often, whether it's due this step, and its button's words. */
export interface RestNow {
  every: number;
  /** Rest fell due at the start of this step (the step right after each `every` since the expedition began). */
  due: boolean;
  /** "Rest this turn" in turn modes, "Rest today" in day modes. */
  button: string;
  /** "Resting this turn" / "Resting today". */
  resting: string;
  /** The pack's condition id for Push on, if any. */
  condition: string | null;
}

/** The mode's rest rule now; null when the mode has none (or its length can't be read). */
export function restNow(mode: Mode | null, units: TimeUnits, startedAt: number, now: number, stepSeconds: number | null): RestNow | null {
  if (!mode?.rest) return null;
  const every = toSeconds(mode.rest.every, units);
  if (!every || every <= 0) return null;
  const since = now - startedAt;
  const step = stepSeconds && stepSeconds > 0 ? stepSeconds : every;
  const due = since >= every && since % every < Math.min(step, every);
  const day = mode.pace === 'day';
  return { every, due, button: day ? 'Rest today' : 'Rest this turn', resting: day ? 'Resting today' : 'Resting this turn', condition: mode.rest.condition };
}

/** The rule in the pack's words for ⓘ: its note, else "Rest 1 turn every 6 turns. Pushing on marks Weary." */
export function restRuleWords(mode: Mode, conditionName: string | null): string[] {
  const rest = mode.rest;
  if (!rest) return [];
  const amount = (a: Amount) => plural(a.value, a.unit.replace(/s$/, ''));
  const plain = `Rest${rest.length ? ` ${amount(rest.length)}` : ''} every ${amount(rest.every)}.${conditionName ? ` Pushing on marks ${conditionName} on those who didn't rest.` : ''}`;
  return [...(rest.note ? [rest.note] : []), plain, REST_ANSWER_WORDS];
}

/** The app's own line on how a rest is answered, last of `restRuleWords`; a player's Rest pop-up leaves it out (PL8). */
export const REST_ANSWER_WORDS = 'When a rest is due, answer Rest or Push on before the GM moves on: resting counts that step as rest (checks still run); pushing on, or not answering, marks the condition.';

// Commands ---------------------------------------------------------------------------------------------------------

type Character = { id: string; campaignId: string; ownerUserId: string | null };

/** 03 "Add or remove a status on a character", the remove half (and Step up / down): the GM, or the player for their own character (or hireling). */
export const mayChangeStatus = (user: CurrentUser, character: Character) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/** What adding a status is about: whose characters, and whether its timer is secret (the GM's only). */
export interface StatusTarget {
  campaignId: string;
  characters: Character[];
  secret: boolean;
}

/**
 * 03 "Add a status to a character" (M5 gate C1, ruled 2026-11-01): the GM's only. A player never adds one to their
 * own character; a status comes from the GM, or (from M7) automatically from a spell or ability.
 */
export const mayAddStatus = (user: CurrentUser, character: Character) => isGm(user, character.campaignId);

const mayAdd = (user: CurrentUser, target: StatusTarget) =>
  target.characters.length > 0 && target.characters.every((c) => c.campaignId === target.campaignId && mayAddStatus(user, c));

/** What + Status (or Push on) puts on: a condition, or a typed name, with an optional timer. */
export interface NewStatus {
  name: string;
  condition: Condition | null;
  /** Its timer: length in seconds and the unit it's shown in; null for none. */
  timer: { seconds: number; unit: string } | null;
  secret: boolean;
  note?: string | null;
  /** M5b g6 (B6): it ends when they rest ("Until rest"). */
  untilRest?: boolean;
  /** A typed status's own Stacks (a condition's comes from the pack). */
  stacks?: boolean;
}

async function statusRows(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<CharacterStatus[]>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return ok(rows.filter(isRecord).map(toCharacterStatus));
}

const addArgs = (input: { target: StatusTarget; status: NewStatus }, source: StatusSource) => ({
  campaign: input.target.campaignId,
  actors: input.target.characters.map((c) => c.id),
  status_name: input.status.condition?.name ?? input.status.name.trim(),
  condition_id: input.status.condition?.id,
  icon: input.status.condition?.icon ?? undefined,
  stacking: input.status.condition?.stacks ?? input.status.stacks ?? false,
  levels: (input.status.condition?.levels ?? null) as unknown as Json,
  timer_seconds: input.status.timer?.seconds,
  timer_unit: input.status.timer?.unit,
  secret: input.status.secret,
  note: input.status.note ?? undefined,
  source,
  until_rest: input.status.untilRest === true,
});

/**
 * + Status: a condition or a typed name on one or more characters, with an optional timer (the GM may keep it
 * secret). On a character who has it already, a condition that stacks adds 1 and one with levels steps up. Logged
 * (Simple); Undo takes it off again.
 */
export const addStatus = defineCommand({
  name: 'status.add',
  target: (input: { target: StatusTarget; status: NewStatus }) => input.target,
  allowed: mayAdd,
  run: (db, _user, input) => statusRows(db.rpc('add_status', addArgs(input, input.status.condition ? 'condition' : 'typed'))),
});

/**
 * Push on (the rest reminder): the pack's condition on the names ticked (those who didn't rest); a condition that
 * stacks adds 1 each time. The GM's. Logged (Simple); Undo takes it off again.
 */
export const pushOn = defineCommand({
  name: 'rest.pushOn',
  target: (input: { target: StatusTarget; status: NewStatus }) => input.target,
  allowed: (user: CurrentUser, target: StatusTarget) => isGm(user, target.campaignId) && mayAdd(user, target),
  run: (db, _user, input) => statusRows(db.rpc('add_status', addArgs(input, 'rest'))),
});

type StatusChange = { character: Character; status: CharacterStatus };

async function statusRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<CharacterStatus>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) && typeof row.id === 'string' ? ok(toCharacterStatus(row)) : fromError({ code: '42501', message: '' });
}

/** Remove: the status ends now. Logged (Simple); Undo puts it back. */
export const removeStatus = defineCommand({
  name: 'status.remove',
  target: (input: StatusChange) => input.character,
  allowed: mayChangeStatus,
  run: (db, _user, input) => statusRow(db.rpc('remove_status', { status: input.status.id, seen_version: input.status.version })),
});

/** Step up / Step down a status with levels; down from its first level ends it. Logged (Simple); Undo steps back. */
export const stepStatus = defineCommand({
  name: 'status.step',
  target: (input: StatusChange & { step: 1 | -1 }) => input.character,
  allowed: mayChangeStatus,
  run: (db, _user, input) => statusRow(db.rpc('step_status', { status: input.status.id, step: input.step, seen_version: input.status.version })),
});

/**
 * The GM's time-left stepper (plan m5b-creation-retest-3 F; Francis on #560, 2026-11-08): a timed status's time left
 * set from the clock's now, in seconds (at least 1; End it now ends it). The GM's only; a secret timer stays in the
 * GM's own table. Logged (Simple, the GM's); Undo puts the time back.
 */
export const setStatusTime = defineCommand({
  name: 'status.setTime',
  target: (input: StatusChange & { secondsLeft: number }) => input.character,
  allowed: (user: CurrentUser, character: Character) => isGm(user, character.campaignId),
  run: (db, _user, input) => statusRow(db.rpc('set_status_time', { status: input.status.id, seconds_left: input.secondsLeft })),
});

/** Who a rest choice is for: the campaign and the characters (all this person's to play). */
export interface RestTarget {
  campaignId: string;
  characters: Character[];
}

/**
 * Rest this turn (Rest today), or not after all: the characters' choice for the step under way; the GM's next Next
 * turn (Next day) applies it. The GM's Rested marks everyone. Logged (Simple); Undo takes it back.
 */
export const chooseRest = defineCommand({
  name: 'rest.choose',
  target: (input: { target: RestTarget; resting: boolean }) => input.target,
  allowed: (user: CurrentUser, target: RestTarget) => target.characters.length > 0 && target.characters.every((c) => c.campaignId === target.campaignId && mayChangeStatus(user, c)),
  run: async (db, _user, input): Promise<CommandResult<CharacterRest[]>> => {
    const { data, error } = await db.rpc('choose_rest', { actors: input.target.characters.map((c) => c.id), resting: input.resting });
    if (error) return fromError(error);
    return ok((Array.isArray(data) ? data : []).filter(isRecord).map(toCharacterRest));
  },
});

export const STATUS_COMMANDS = [addStatus, pushOn, removeStatus, stepStatus, setStatusTime, chooseRest] as const;
