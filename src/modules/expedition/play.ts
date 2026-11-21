// The clock, sessions and expeditions as the campaign keeps them (M5 step 5; docs/04 "Session", "Expedition",
// "Campaign clock"; docs/05 "Expeditions, time and light"; ruled 2026-10-29: D18–D23, D32, E36, afternoon ruling 1).
// One seconds counter per campaign moves only when the GM moves it: the mode's main advance (+N on a long press),
// Advance by… (not a correction), Downtime's +1 day, +1 week or a later day, and Set time… (a correction). A
// session marks play, never the clock. An expedition keeps where the clock was when it started and who went, and
// its end keeps how long it took; a full rest gives back the ability uses that come back on a rest or a day.
// Each command is an intent with a request id, and names the copy it was made from, so two devices can't
// overwrite each other (supabase/migrations/…_m5_clock.sql). Every one undoes from the log.
import { defineCommand, failed, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { makePlaceInRequest, type PackPlaceEntry } from './placeFromPack.ts';
import { DEFAULT_TIME } from '../../core/campaignSettings.ts';
import { taggedDb } from '../../core/eventTags.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { toCharacterRef, type CharacterRef } from '../characters/commands.ts';
import { limitedAbilities } from '../characters/playState.ts';
import { clockShown, isPartOfDay, partOfDay, readClock, timeExtraOf, timeUnits, turnsPerHourOf, unitName, type TimeUnits } from './clock.ts';
import type { Chance, Mode } from './modes.ts';
import { backAtPlace } from './placePlay.ts';
import type { Advance as ProcedureAdvance, Summary as ProcedureSummaryOf } from './procedure.ts';

/** What one advance (or several summed up) brought: the engine's result. */
export type ProcedureSummary = ProcedureAdvance | ProcedureSummaryOf;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface Clock {
  id: string;
  campaignId: string;
  seconds: number;
  /** The copy this device has: a save from an older one is refused. */
  version: number;
}

export interface Session {
  id: string;
  campaignId: string;
  number: number;
  startedAt: string;
  endedAt: string | null;
  version: number;
}

export interface Expedition {
  id: string;
  campaignId: string;
  /** The exploration mode's id. */
  mode: string;
  /** On the campaign clock. */
  startedAt: number;
  endedAt: number | null;
  /** The approved, active characters when it started (a snapshot, E36). */
  whoWent: string[];
  /** How long it took (seconds), once ended; whether the party had its full rest. */
  summary: { seconds: number | null; fullRest: boolean } | null;
  /** The GM used the pack's safe paths in Leave the dungeon (sq-2: logged as expedition.safePaths). */
  safePaths: boolean;
  /**
   * In a safe place? (m8b-0 delivery 5): the GM's answer on End expedition's summary; null until answered (and while
   * under way: Undo of End forgets it). Yes offers Start downtime · Not yet under the summary.
   */
  endedSafe: boolean | null;
  /** When it was started, in real time (so a session started after it is a session resumed mid-dungeon, DG16). */
  createdAt: string | null;
  version: number;
}

/** What Scene shows: the clock, the session running and the expedition under way (each null when there's none). */
export interface SceneState {
  clock: Clock | null;
  session: Session | null;
  expedition: Expedition | null;
  /**
   * The GM said "Not now" to "Which season?" and no session has started since (ruled 2026-10-30): it isn't asked
   * again, on any GM device, until the next session.
   */
  seasonNotNow: boolean;
  /** A session has been played in this campaign before (so a session not running now is paused or ended; B7). */
  played?: boolean;
  /** The newest session's number (running or not, never undone): the paused band's "Session N." (S9). */
  lastSession?: number | null;
  /**
   * Adventure or Downtime (dt-2, M5b step 6a): End expedition leaves the campaign in Adventure, with no expedition
   * running ("in town"); Start downtime and End downtime are their own taps. Missing: read as Downtime (as before).
   */
  campaignMode?: 'adventure' | 'downtime';
  /** The newest expedition's mode (ended or under way, not undone): the current mode between expeditions; null if none. */
  lastMode?: string | null;
}

/** Whether "Not now" (said at `saidAt`) still holds: no session (not undone) has started since. */
export function seasonNotNowHolds(saidAt: string | null, latestSessionStart: string | null): boolean {
  if (!saidAt) return false;
  return latestSessionStart === null || Date.parse(latestSessionStart) <= Date.parse(saidAt);
}

const num =(value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export function toClock(row: Record<string, unknown>): Clock {
  return { id: String(row.id), campaignId: String(row.campaign_id), seconds: num(row.seconds), version: num(row.version, 1) };
}

export function toSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    number: num(row.number, 1),
    startedAt: String(row.started_at ?? ''),
    endedAt: typeof row.ended_at === 'string' ? row.ended_at : null,
    version: num(row.version, 1),
  };
}

export function toExpedition(row: Record<string, unknown>): Expedition {
  const summary = isRecord(row.summary) ? row.summary : null;
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    mode: String(row.mode ?? ''),
    startedAt: num(row.started_at),
    endedAt: typeof row.ended_at === 'number' ? row.ended_at : null,
    whoWent: Array.isArray(row.who_went) ? row.who_went.map(String) : [],
    summary: summary ? { seconds: typeof summary.seconds === 'number' ? summary.seconds : null, fullRest: summary.fullRest === true } : null,
    safePaths: row.safe_paths === true,
    endedSafe: typeof row.ended_safe === 'boolean' ? row.ended_safe : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    version: num(row.version, 1),
  };
}

/**
 * Resumed mid-dungeon (ruled 2026-10-30, DG16): the session running started after the expedition under way did, so
 * Scene opens on the same place, lights and clock, and says so once. Pure.
 */
export function resumedMidDungeon(session: Pick<Session, 'startedAt'> | null, expedition: Pick<Expedition, 'createdAt'> | null): boolean {
  if (!session || !expedition?.createdAt) return false;
  return Date.parse(expedition.createdAt) < Date.parse(session.startedAt);
}

/** The campaign's clock, its running session and its expedition under way. Null if they couldn't be loaded. */
export async function loadScene(db: Db, campaignId: string): Promise<SceneState | null> {
  const [clock, session, expedition, campaign, latest, lastTrip] = await Promise.all([
    db.from('campaign_clocks').select('*').eq('campaign_id', campaignId).maybeSingle(),
    db.from('sessions').select('*').eq('campaign_id', campaignId).is('ended_at', null).eq('undone', false).maybeSingle(),
    db.from('expeditions').select('*').eq('campaign_id', campaignId).is('ended_at', null).eq('undone', false).maybeSingle(),
    db.from('campaigns').select('season_not_now_at, mode').eq('id', campaignId).maybeSingle(),
    db.from('sessions').select('started_at, number').eq('campaign_id', campaignId).eq('undone', false).order('started_at', { ascending: false }).limit(1),
    db.from('expeditions').select('mode').eq('campaign_id', campaignId).eq('undone', false).order('created_at', { ascending: false }).limit(1),
  ]);
  if (clock.error || session.error || expedition.error || campaign.error || latest.error || lastTrip.error) return null;
  const campaignMode = (campaign.data as { mode?: string } | null)?.mode === 'adventure' ? 'adventure' : 'downtime';
  const lastMode = (lastTrip.data?.[0] as { mode?: string } | undefined)?.mode ?? null;
  const saidAt = (campaign.data as { season_not_now_at?: string | null } | null)?.season_not_now_at ?? null;
  const latestRow = latest.data?.[0] as { started_at?: string; number?: number } | undefined;
  const latestStart = latestRow?.started_at ?? null;
  return {
    clock: clock.data ? toClock(clock.data as Record<string, unknown>) : null,
    session: session.data ? toSession(session.data as Record<string, unknown>) : null,
    expedition: expedition.data ? toExpedition(expedition.data as Record<string, unknown>) : null,
    seasonNotNow: seasonNotNowHolds(saidAt, latestStart),
    played: latestStart !== null,
    lastSession: typeof latestRow?.number === 'number' ? latestRow.number : null,
    campaignMode,
    lastMode,
  };
}

/**
 * The kinds of log line the strip's Undo steps back through: the clock's moves. Move on (place.moveOn, December step
 * 4) is one: it moves the clock by the way's turns in the same request as the place.
 */
export const CLOCK_MOVES = ['time.advance', 'time.advanceBy', 'time.partOfDay', 'time.downtime', 'time.set', 'place.moveOn'] as const;

/** This person's newest move of the clock that isn't undone yet (what the strip's Undo undoes), or null. */
export async function latestClockMove(db: Db, campaignId: string, userId: string): Promise<string | null> {
  const mine = await db
    .from('events')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('actor_user_id', userId)
    .in('type', [...CLOCK_MOVES])
    .order('seq', { ascending: false })
    .limit(20);
  const ids = (mine.data ?? []).map((e) => (e as { id: string }).id);
  if (mine.error || ids.length === 0) return null;
  const reverted = await db.from('events').select('reverts_event_id').in('reverts_event_id', ids);
  if (reverted.error) return null;
  const gone = new Set((reverted.data ?? []).map((e) => (e as { reverts_event_id: string }).reverts_event_id));
  return ids.find((id) => !gone.has(id)) ?? null;
}

/** A travel day the card started after a move of the clock: its log line, and the group whose day it was. */
export interface DayStart {
  eventId: string;
  group: number;
}

/**
 * The travel days the expedition's groups were moved on to since a move of the clock, not undone yet, newest first,
 * one per request: the travel card starts the morning in its own request after the clock reaches it, so the strip's
 * Undo of that move takes these back too (gate walk, finding 1a: a forced march came back as a fresh day). Only a day
 * that moved an existing row on counts: a group's first day (a new expedition, or a group split off since) was made,
 * not moved on, and stays (review of #617). Empty when there are none; null when they couldn't be read.
 */
export async function dayStartsAfter(db: Db, campaignId: string, expeditionId: string, moveId: string): Promise<DayStart[] | null> {
  const [move, rows, starts] = await Promise.all([
    db.from('events').select('seq, request_id').eq('id', moveId).maybeSingle(),
    db.from('travel_groups').select('id, group_number').eq('campaign_id', campaignId).eq('expedition_id', expeditionId),
    // Seq is compared below, not in the query: a number, newest first, within the last 50 starts.
    db
      .from('events')
      .select('id, seq, request_id, target_id, before, after')
      .eq('campaign_id', campaignId)
      .eq('type', 'travel.dayStart')
      .eq('target_table', 'travel_groups')
      .order('seq', { ascending: false })
      .limit(50),
  ]);
  if (move.error || !move.data || rows.error || starts.error) return null;
  const from = Number((move.data as { seq: number }).seq);
  // The days the move itself started (fix F86/F87: in its own request) go back with it; only later ones are listed.
  const own = (move.data as { request_id?: string | null }).request_id ?? null;
  const groupOf = new Map(((rows.data ?? []) as { id: string; group_number: number }[]).map((r) => [String(r.id), Number(r.group_number)]));
  const dayOf = (snapshot: unknown) => (snapshot && typeof snapshot === 'object' ? (snapshot as { day?: unknown }).day : undefined);
  const after = ((starts.data ?? []) as { id: string; seq: number; request_id: string | null; target_id: string | null; before: unknown; after: unknown }[]).filter((e) => {
    const was = dayOf(e.before);
    const now = dayOf(e.after);
    return Number(e.seq) > from && (own === null || e.request_id !== own) && groupOf.has(String(e.target_id)) && typeof was === 'number' && typeof now === 'number' && was < now;
  });
  if (after.length === 0) return [];
  const reverted = await db.from('events').select('reverts_event_id').in('reverts_event_id', after.map((e) => e.id));
  if (reverted.error) return null;
  const gone = new Set((reverted.data ?? []).map((e) => (e as { reverts_event_id: string }).reverts_event_id));
  const seen = new Set<string>();
  const found: DayStart[] = [];
  for (const e of after) {
    if (gone.has(e.id)) continue;
    const request = e.request_id ?? e.id;
    if (seen.has(request)) continue;
    seen.add(request);
    found.push({ eventId: e.id, group: groupOf.get(String(e.target_id))! });
  }
  return found;
}

/** What stands in the way of undoing a move of the clock that started a travel day (ud-2): the newest later change. */
export interface StandsInTheWay {
  kind: 'move' | 'forcedMarch' | 'other';
  group: number;
  /** A move's place by name (where the group is entering, or arrived), when it has one. */
  place: string | null;
}

/**
 * The newest change, not undone, made to a travel day that a move of the clock started (in the move's own request),
 * after that move: a Move…, a forced march, or something else (a pace, an activity's points). It is why Undo of the
 * move is refused whole (ruled ud-1). Null when nothing stands in the way or it couldn't be read. The mechanism of
 * ud-2 only: no screen says it yet (the refusal's words wait for approval).
 */
export async function standsInTheWay(db: Db, campaignId: string, moveId: string): Promise<StandsInTheWay | null> {
  const move = await db.from('events').select('seq, request_id').eq('id', moveId).maybeSingle();
  const request = (move.data as { request_id?: string | null } | null)?.request_id ?? null;
  if (move.error || !move.data || !request) return null;
  const own = await db.from('events').select('seq, target_id').eq('campaign_id', campaignId).eq('request_id', request).eq('target_table', 'travel_groups');
  const started = (own.data ?? []) as { seq: number; target_id: string | null }[];
  if (own.error || started.length === 0) return null;
  const rows = [...new Set(started.map((e) => String(e.target_id)))];
  const from = Math.max(...started.map((e) => Number(e.seq)));
  const later = await db
    .from('events')
    .select('id, seq, type, request_id, target_id, after, reverts_event_id')
    .eq('campaign_id', campaignId)
    .eq('target_table', 'travel_groups')
    .in('target_id', rows)
    .order('seq', { ascending: false })
    .limit(50);
  if (later.error) return null;
  type Change = { id: string; seq: number; type: string; request_id: string | null; target_id: string | null; after: unknown; reverts_event_id: string | null };
  const since = ((later.data ?? []) as Change[]).filter((e) => Number(e.seq) > from);
  const gone = new Set(since.map((e) => e.reverts_event_id).filter(Boolean));
  const found = since.find((e) => !e.reverts_event_id && !gone.has(e.id));
  if (!found) return null;
  const after = (found.after && typeof found.after === 'object' ? found.after : {}) as { group_number?: unknown; pending_place_name?: unknown };
  const group = Number(after.group_number ?? 1);
  if (found.type === 'travel.forceMarch') return { kind: 'forcedMarch', group, place: null };
  if (found.type !== 'travel.move') return { kind: 'other', group, place: null };
  // Entering a place: its name as the GM has it is in the GM's part of the row (fm-1: travel_group_secrets, changed in
  // the move's own request; only the GM reads those lines). The row itself keeps only the players' name, once shown.
  const secret = found.request_id
    ? await db.from('events').select('after').eq('campaign_id', campaignId).eq('request_id', found.request_id).eq('target_table', 'travel_group_secrets').eq('target_id', String(found.target_id))
    : null;
  const entering = ((secret?.data ?? []) as { after: unknown }[]).map((e) => (e.after as { pending_place_name?: unknown } | null)?.pending_place_name).find((name) => typeof name === 'string' && name);
  if (typeof entering === 'string') return { kind: 'move', group, place: entering };
  if (typeof after.pending_place_name === 'string' && after.pending_place_name) return { kind: 'move', group, place: after.pending_place_name };
  // An arrival: the place is kept with the group's place, made in the move's request.
  const arrived = found.request_id ? await db.from('events').select('after').eq('campaign_id', campaignId).eq('request_id', found.request_id).eq('target_table', 'group_places') : null;
  const placeId = ((arrived?.data ?? []) as { after: unknown }[]).map((e) => (e.after as { place_id?: unknown } | null)?.place_id).find((id) => typeof id === 'string');
  const named = placeId ? await db.from('places').select('name').eq('id', placeId as string).maybeSingle() : null;
  return { kind: 'move', group, place: (named?.data as { name?: string } | null)?.name ?? null };
}

/** Where an expedition started (DG1), as the GM reads it: the place's name and the mode it started in. */
export interface StartPlace {
  name: string;
  mode: string;
}

/** The longest place name Where? takes (the database refuses longer). */
export const PLACE_NAME_MAX = 200;

/** Where the expedition started, for the GM (players can't read it, so null); null too when none was given. */
export async function loadStartPlace(db: Db, expeditionId: string): Promise<StartPlace | null> {
  const { data, error } = await db.from('expedition_places').select('name, mode').eq('expedition_id', expeditionId).eq('undone', false).maybeSingle();
  if (error || !data) return null;
  return { name: String(data.name), mode: String(data.mode) };
}

/**
 * Recent places (DG1): the places earlier expeditions started from, newest first, each name once (with its newest
 * mode), at most `limit`. Empty for players (the GM's alone) or when none could be read.
 */
export async function loadRecentPlaces(db: Db, campaignId: string, limit = 5): Promise<StartPlace[]> {
  const { data, error } = await db
    .from('expedition_places')
    .select('name, mode, created_at')
    .eq('campaign_id', campaignId)
    .eq('undone', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return recentPlaces(data.map((r) => ({ name: String(r.name), mode: String(r.mode) })), limit);
}

/** Newest first, each name once (compared without case or spaces at the ends), at most `limit`. Pure. */
export function recentPlaces(rows: readonly StartPlace[], limit = 5): StartPlace[] {
  const seen = new Set<string>();
  const out: StartPlace[] = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name.trim(), mode: r.mode });
    if (out.length >= limit) break;
  }
  return out;
}

/** A character who went, as the end of an expedition shows them: name, HP, and what the full rest reads. */
export interface WentCharacter {
  ref: CharacterRef;
  name: string;
  level: number;
  classRef: string | null;
  raceRef: string | null;
  hpCurrent: number | null;
  hpMax: number | null;
}

/**
 * The characters in play (Start downtime's full rest, every character once): the campaign's approved, active player
 * characters, oldest first (who an expedition takes along). Null if unreadable.
 */
export async function loadParty(db: Db, campaignId: string): Promise<WentCharacter[] | null> {
  const { data, error } = await db
    .from('actors')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('kind', 'pc')
    .eq('approval', 'approved')
    .eq('status', 'active')
    .order('created_at');
  if (error) return null;
  return loadWhoWent(db, (data ?? []).map((r) => String((r as { id: unknown }).id)));
}

/** The characters who went, in the snapshot's order (those no longer readable are left out). Null if unreadable. */
export async function loadWhoWent(db: Db, ids: readonly string[]): Promise<WentCharacter[] | null> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from('actors')
    .select('id, campaign_id, owner_type, owner_user_id, approval, status, name, level, classes, race_ref, hp_current, hp_max')
    .in('id', [...ids]);
  if (error) return null;
  const rows = (data ?? []) as Record<string, unknown>[];
  return ids.flatMap((id) => {
    const r = rows.find((row) => row.id === id);
    if (!r) return [];
    const first = Array.isArray(r.classes) ? (r.classes[0] as { classRef?: unknown } | undefined) : undefined;
    return [
      {
        ref: toCharacterRef(r as Parameters<typeof toCharacterRef>[0]),
        name: String(r.name ?? ''),
        level: typeof r.level === 'number' ? r.level : 1,
        classRef: typeof first?.classRef === 'string' ? first.classRef : null,
        raceRef: typeof r.race_ref === 'string' ? r.race_ref : null,
        hpCurrent: typeof r.hp_current === 'number' ? r.hp_current : null,
        hpMax: typeof r.hp_max === 'number' ? r.hp_max : null,
      },
    ];
  });
}

// Commands ---------------------------------------------------------------------------------------------------------

type CampaignTarget = { campaignId: string };
const gmOnly = (user: CurrentUser, target: CampaignTarget) => isGm(user, target.campaignId);

async function rpcRow<T>(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, read: (row: Record<string, unknown>) => T): Promise<CommandResult<T>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(read(row)) : fromError({ code: '42501', message: '' });
}

/**
 * "Not now" on "Which season?" (ruled 2026-10-30): kept with the campaign, so no GM device asks again until the next
 * session starts. Logged Verbose. Gives back when it was said.
 */
export const seasonNotNow = defineCommand({
  name: 'calendar.seasonNotNow',
  log: 'verbose',
  target: (input: { campaignId: string }) => input,
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('season_not_now', { campaign: input.campaignId });
    if (error) return fromError(error);
    return typeof data === 'string' ? ok(data) : fromError({ code: '42501', message: '' });
  },
});

/** Start session (one tap on the GM console; D20). Refused while one is running. */
export const startSession = defineCommand({
  name: 'session.start',
  target: (input: { campaignId: string }) => input,
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('start_session', { campaign: input.campaignId }), toSession),
});

/** End session (⋯). Sessions mark play: neither moves game time. */
export const endSession = defineCommand({
  name: 'session.end',
  target: (input: { campaignId: string; session: Session }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('end_session', { session: input.session.id, seen_version: input.session.version }), toSession),
});

/** Start expedition's answer: the expedition, and how many pieces came back shown at its Where? (0: none, or new). */
export type Started = Expedition & { backShown: number };

/** The toasts' tail when a known place brings its pieces back (g2b gp-5): " · 2 pieces shown again"; nothing for 0. */
export function shownAgainWords(count: number): string {
  if (count <= 0) return '';
  return `, ${count === 1 ? '1 piece' : `${count} pieces`} shown again`;
}

/**
 * Start expedition: one tap plus a mode (D21) and an optional Where? (DG1: a recent place or a typed name); the
 * database keeps the clock's time and who went, and the place for the GM only (DG9), and the campaign goes into
 * Adventure. A Where? visited before starts with what was shown at the end of its last visit (gp-5, "any
 * expedition"; the g2b follow-up ruled 2026-11-02): place.backAt for each group placed there, each its own request
 * (its own Verbose line and Undo), as Where now? does. A place never visited: nothing shown, no line.
 */
export const startExpedition = defineCommand({
  name: 'expedition.start',
  target: (input: { campaignId: string; mode: string; place?: string | null; placeId?: string | null; packEntry?: PackPlaceEntry | null; regionalTables?: Record<string, unknown> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, user, input): Promise<CommandResult<Started>> => {
    const place = input.place?.trim() ?? '';
    // A place picked from a pack (pull request 2): made (or found) in this same request, one line and one Undo.
    const made = input.packEntry ? await makePlaceInRequest(db, input.campaignId, input.packEntry, input.regionalTables) : null;
    if (made && !made.ok) return made;
    const placeId = made ? made.value.id : input.placeId;
    // With a place id (M8b slice 0: a place picked from a pack, which may share its name with another), that place.
    const started = await rpcRow(
      placeId
        ? db.rpc('start_expedition_at', { campaign: input.campaignId, mode_id: input.mode, place: placeId })
        : db.rpc('start_expedition', { campaign: input.campaignId, mode_id: input.mode, ...(place ? { place_name: place } : {}) }),
      toExpedition,
    );
    if (!started.ok) return started;
    if (!place && !placeId) return ok({ ...started.value, backShown: 0 });
    const visits = await db
      .from('group_places')
      .select('id, group_number, place_id')
      .eq('campaign_id', input.campaignId)
      .eq('expedition_id', started.value.id)
      .eq('undone', false)
      .eq('moved_on', false)
      .order('group_number');
    // The expedition stands either way; a failed seeding says so rather than hiding the start.
    const notBack = (message: string) => failed<Started>(`The expedition started, but the pieces shown last time couldn't be brought back: ${message}`);
    if (visits.error) return notBack(visits.error.message);
    let backShown = 0;
    for (const visit of visits.data ?? []) {
      if (!visit.place_id) continue;
      // Its own request (a new id and name), as after Where now?: the shows are one line of their own, undone on their own.
      const back = await backAtPlace.run(taggedDb(db, { type: backAtPlace.name, level: 'verbose' }), user, { campaignId: input.campaignId, row: { id: String(visit.id) } });
      if (!back.ok) return notBack(back.message);
      backShown = Math.max(backShown, back.value);
    }
    return ok({ ...started.value, backShown });
  },
});

/**
 * End expedition (D22: no confirm; its summary shows with Undo). The campaign stays in Adventure, with no expedition
 * running (dt-2, M5b step 6a): the party may set out again at once; Start downtime is its own tap.
 */
export const endExpedition = defineCommand({
  name: 'expedition.end',
  target: (input: { campaignId: string; expedition: Expedition }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('end_expedition', { expedition: input.expedition.id, seen_version: input.expedition.version }), toExpedition),
});

/** Full rest (D23), a one-tap line in the end summary: the named ability uses come back for each character who went. */
export const fullRest = defineCommand({
  name: 'expedition.fullRest',
  target: (input: { campaignId: string; expedition: Expedition; refills: Record<string, string[]> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('full_rest', { expedition: input.expedition.id, refills: input.refills as unknown as Json }), toExpedition),
});

/**
 * Use safe paths (of-5, sq-2): Leave the dungeon's pack procedure, used on the expedition under way. One Simple line,
 * the GM's, with Undo; a second use changes nothing (the database gives the expedition back as it is).
 */
export const leaveBySafePaths = defineCommand({
  name: 'expedition.safePaths',
  target: (input: { campaignId: string; expedition: Expedition }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('use_safe_paths', { expedition: input.expedition.id }), toExpedition),
});

/**
 * In a safe place? (m8b-0 delivery 5, ruled 2026-11-06): the GM's Yes or No on End expedition's summary, kept with the
 * expedition's end. One Verbose line (the Simple log folds a Yes into End's own line); the other button changes it;
 * the same answer again changes nothing. Undo of End forgets it (the database clears it with the end).
 */
export const answerSafePlace = defineCommand({
  name: 'expedition.safePlace',
  log: 'verbose',
  target: (input: { campaignId: string; expedition: Expedition; safe: boolean }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('answer_safe_place', { expedition: input.expedition.id, safe: input.safe }), toExpedition),
});

/**
 * `rest` (M5b g6, B5): the open rest flows' answers to apply with the move (who is in them, the pack's condition).
 * `camps` (M5b step 4, D20): tonight's camps Next day applies, in the same request, so the move's one Undo takes
 * them back too (applied after the clock moved: a move refused as stale applies nothing).
 * `days` (fix F86/F87): the travel days a move into a new day starts, one per group, each with the day's budget as this
 * device worked it out; the database starts them with the clock, in the same transaction (yesterday's shortfall paid
 * first), so the day's record never lags the clock and the move's one Undo takes them back too.
 */
export interface TravelDayStart {
  group: number;
  day: number;
  total: number;
  pace: 'foot' | 'riding' | 'cart';
  gmPerDay: number | null;
}
type Advance = { campaignId: string; clock: Clock; seconds: number; rest?: Json | null; camps?: string[]; days?: TravelDayStart[] };
const advance = async (db: Db, input: Advance) => {
  const moved = await rpcRow(
    db.rpc('advance_clock', { campaign: input.campaignId, by_seconds: input.seconds, seen_version: input.clock.version, ...(input.rest ? { rest: input.rest } : {}), ...(input.days?.length ? { days: input.days as unknown as Json } : {}) }),
    toClock,
  );
  if (!moved.ok || !input.camps?.length) return moved;
  const { error } = await db.rpc('apply_camps', { campaign: input.campaignId, camps: input.camps });
  return error ? fromError(error) : moved;
};

/** The mode's main advance (Next turn, or the mode's step), and its long press +N: the clock moves on. */
export const advanceTime = defineCommand({
  name: 'time.advance',
  log: 'verbose',
  target: (input: Advance) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => advance(db, input),
});

/**
 * Next part of day (M5b step 6a, ST1): a town mode's main advance (its step is a part of the day), during an
 * expedition (the procedure runs, as for any step) or in town between expeditions (a plain move). Simple in the log.
 */
export const nextPartOfDay = defineCommand({
  name: 'time.partOfDay',
  target: (input: Advance) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => advance(db, input),
});

/**
 * Start downtime (M5b step 6a; ST10 as split by dt-2): a full rest for every character in play (the uses named in
 * `refills` come back: those that return on a rest or a day), then the campaign goes into Downtime; the town
 * switches turn off with it (sw-3). Refused while an expedition is under way. One request: one Undo puts it all back.
 */
export const startDowntime = defineCommand({
  name: 'downtime.start',
  target: (input: { campaignId: string; refills: Record<string, string[]> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<'downtime'>> => {
    const { error } = await db.rpc('start_downtime', { campaign: input.campaignId, refills: input.refills as unknown as Json });
    return error ? fromError(error) : ok('downtime');
  },
});

/** End downtime (ST11): back to Adventure, no expedition running (M7 adds its summary and clock ticks). */
export const endDowntime = defineCommand({
  name: 'downtime.end',
  target: (input: { campaignId: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<'adventure'>> => {
    const { error } = await db.rpc('end_downtime', { campaign: input.campaignId });
    return error ? fromError(error) : ok('adventure');
  },
});

/** Advance by… (an amount and a unit): a normal advance, never a correction. */
export const advanceTimeBy = defineCommand({
  name: 'time.advanceBy',
  target: (input: Advance) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => advance(db, input),
});

/** Downtime's +1 day, +1 week or a later day (D32: only the GM moves game time; real time isn't counted). */
export const passDowntime = defineCommand({
  name: 'time.downtime',
  target: (input: Advance) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => advance(db, input),
});

/** Set time… (genuine corrections only): the clock jumps, and nothing in the procedure runs. */
export const setTime = defineCommand({
  name: 'time.set',
  target: (input: { campaignId: string; clock: Clock; to: number }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('set_clock', { campaign: input.campaignId, to_seconds: input.to, seen_version: input.clock.version }), toClock),
});

// The first day's start time (M5 gate B13; g1's scope check ruled 2026-11-01, option A) -----------------------------

/** The first day's start time, "Start time" in Rules for this campaign (04 `startTime`). */
export interface StartTime {
  hour: number;
  minute: number;
}

/** The start time until the GM sets one: 06:00, never 00:00 (B13). */
export const DEFAULT_START_TIME: StartTime = { hour: 6, minute: 0 };

/** The saved start time, or null when there's none (or it doesn't read). */
export function startTimeOf(value: unknown): StartTime | null {
  if (!isRecord(value)) return null;
  const { hour, minute } = value;
  return Number.isInteger(hour) && Number.isInteger(minute) && (hour as number) >= 0 && (minute as number) >= 0 ? { hour: hour as number, minute: minute as number } : null;
}

/** "06:00". */
export const startTimeWords = (start: StartTime): string => `${two(start.hour)}:${two(start.minute)}`;

/** Where the start time puts the clock on Day 1, in seconds; null when it doesn't fit this campaign's hour or day. */
export function startSeconds(start: StartTime, units: TimeUnits): number | null {
  const at = start.hour * units.hour! + start.minute * 60;
  return start.minute * 60 < units.hour! && at < units.day! ? at : null;
}

/**
 * The clock has moved (ruled 2026-11-01, B13 option A): past Day 1, or an expedition has been started (and not
 * undone), or a move of the clock (an advance, Advance by…, Downtime, To a time) stands in the log, not undone.
 * Setting the start time isn't a move. Until it has moved, the start time puts the clock at that time; after, the
 * start time only shows, and the time changes with Advance by… → To a time. Null if it couldn't be read.
 */
export async function clockHasMoved(db: Db, campaignId: string, seconds: number, units: TimeUnits): Promise<boolean | null> {
  if (seconds >= units.day!) return true;
  const [expeditions, moves] = await Promise.all([
    db.from('expeditions').select('id').eq('campaign_id', campaignId).eq('undone', false).limit(1),
    db.from('events').select('id').eq('campaign_id', campaignId).in('type', [...CLOCK_MOVES]).limit(200),
  ]);
  if (expeditions.error || moves.error) return null;
  if ((expeditions.data ?? []).length > 0) return true;
  const ids = (moves.data ?? []).map((e) => (e as { id: string }).id);
  if (ids.length === 0) return false;
  const reverted = await db.from('events').select('reverts_event_id').in('reverts_event_id', ids);
  if (reverted.error) return null;
  const gone = new Set((reverted.data ?? []).map((e) => (e as { reverts_event_id: string }).reverts_event_id));
  return ids.some((id) => !gone.has(id));
}

/** The campaign's clock and whether it has moved (for the start time in Rules for this campaign); null if unread. */
export async function loadStartClock(db: Db, campaignId: string, units: TimeUnits): Promise<{ clock: Clock; moved: boolean } | null> {
  const found = await db.from('campaign_clocks').select('*').eq('campaign_id', campaignId).maybeSingle();
  if (found.error || !found.data) return null;
  const clock = toClock(found.data as Record<string, unknown>);
  const moved = await clockHasMoved(db, campaignId, clock.seconds, units);
  return moved === null ? null : { clock, moved };
}

export const CLOCK_HAS_MOVED = "The clock has moved since the adventure began, so the start time only shows now. Change the time with Advance by… → To a time.";

/**
 * Start time (B13, ruled 2026-11-01): saves the first day's start time into the campaign's settings and, while the
 * clock hasn't moved, puts the clock at that time on Day 1. One logged change (Simple): the setting and the clock
 * together, and one Undo puts both back. Once the clock has moved it's refused (the start time only shows).
 */
export const setStartTime = defineCommand({
  name: 'time.start',
  target: (input: { campaignId: string; start: StartTime; clock: Clock; units: TimeUnits }) => ({
    campaignId: input.campaignId,
  }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<Clock>> => {
    const to = startSeconds(input.start, input.units);
    if (to === null) return { ok: false, reason: 'failed', message: `The start time is a time of day, from 00:00 to ${two(Math.floor(input.units.day! / input.units.hour!) - 1)}:${two(Math.floor(input.units.hour! / 60) - 1)}.` };
    const moved = await clockHasMoved(db, input.campaignId, input.clock.seconds, input.units);
    if (moved === null) return { ok: false, reason: 'failed', message: "Couldn't check the clock. Try again." };
    if (moved) return { ok: false, reason: 'failed', message: CLOCK_HAS_MOVED };
    const current = await db.from('campaigns').select('settings').eq('id', input.campaignId).maybeSingle();
    if (current.error) return fromError(current.error);
    const was = (current.data as { settings?: unknown } | null)?.settings;
    const settings = { ...(isRecord(was) ? was : {}), startTime: { hour: input.start.hour, minute: input.start.minute } };
    const saved = await db.from('campaigns').update({ settings: settings as Json }).eq('id', input.campaignId).select('id');
    if (saved.error) return fromError(saved.error);
    if (input.clock.seconds === to) return ok(input.clock);
    return rpcRow(db.rpc('set_clock', { campaign: input.campaignId, to_seconds: to, seen_version: input.clock.version }), toClock);
  },
});

export const EXPEDITION_COMMANDS = [seasonNotNow, startSession, endSession, startExpedition, endExpedition, fullRest, leaveBySafePaths, answerSafePlace, advanceTime, advanceTimeBy, nextPartOfDay, passDowntime, setTime, setStartTime, startDowntime, endDowntime] as const;

// Reading the time ---------------------------------------------------------------------------------------------------

/** The campaign's time units: its time lengths (Rules for this campaign), with the setting's turnsPerHour and extras. */
export function campaignUnits(settings: Record<string, unknown> | null, rulesSets: readonly Record<string, unknown>[]): TimeUnits {
  const time = isRecord(settings?.time) ? settings.time : {};
  const whole = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback);
  return timeUnits(
    {
      roundSeconds: whole(time.roundSeconds, DEFAULT_TIME.roundSeconds),
      turnMinutes: whole(time.turnMinutes, DEFAULT_TIME.turnMinutes),
      dayHours: whole(time.dayHours, DEFAULT_TIME.dayHours),
      turnsPerHour: turnsPerHourOf(rulesSets),
    },
    timeExtraOf(rulesSets),
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A length of time in words ("10 minutes", "1 day 2 hours"): the one in core, for the log and the strip alike. */
export { timeWords } from '../../core/timeWords.ts';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Without a pack calendar, the clock's day as a day and month (M5 gate B13, ruled 2026-11-01): 30-day months, twelve
 * to a year, numbered, not named: "Day 14 · Month 3"; from the second year, "· Year 2" too.
 */
export function plainDate(day: number): string {
  const index = Math.max(0, day - 1);
  const year = Math.floor(index / 360) + 1;
  return `Day ${(index % 30) + 1}, Month ${(Math.floor(index / 30) % 12) + 1}${year > 1 ? `, Year ${year}` : ''}`;
}

/**
 * "Day 3 · Month 1 · 08:10": the clock's date and time of day; with the calendar's date for that day ("14 Reedmonth
 * (spring)", once the calendar start is set), that date; without one, a numbered day and month (B13).
 */
export function clockWords(seconds: number, units: TimeUnits, date?: string | null): string {
  const reading = readClock(seconds, units);
  return `${date ?? plainDate(reading.day)}, ${two(reading.hour)}:${two(reading.minute)}`;
}

/** The mode's main advance: "Next turn", "Next hour", "Next day" (or "Next 4 hours" for a longer step). */
export function advanceLabel(mode: Mode, units: TimeUnits): string {
  if (isPartOfDay(mode.step.unit)) return mode.step.value === 1 ? 'Next part of day' : `Next ${mode.step.value} parts of the day`;
  const unit = unitName(mode.step.unit, units);
  return mode.step.value === 1 ? `Next ${unit}` : `Next ${plural(mode.step.value, unit)}`;
}

/** The step's unit, for counts ("turn", "day"). */
export function stepUnit(mode: Mode, units: TimeUnits): string {
  return unitName(mode.step.unit, units);
}

/**
 * In Adventure with no expedition running (after End expedition, or End downtime; dt-2): the current mode's name, and
 * the part of the day when its step is one ("Settlement · night").
 */
export function betweenLine(mode: Mode, now: number, units: TimeUnits): string {
  return isPartOfDay(mode.step.unit) ? `${mode.name}, ${partOfDay(now, units)}` : mode.name;
}

/** "Delve · turn 3": the mode's name and the expedition's step count, from 1. */
export function expeditionLine(mode: Mode, expedition: Pick<Expedition, 'startedAt'>, now: number, units: TimeUnits): string {
  // A town mode's step is a part of the day (ST1): the strip shows the part, "Settlement · afternoon".
  if (isPartOfDay(mode.step.unit)) return `${mode.name}, ${partOfDay(now, units)}`;
  const shown = clockShown(now, units, { expedition: { startedAt: expedition.startedAt, step: mode.step } });
  return shown.step ? `${mode.name}, ${shown.step.unit} ${shown.step.number}` : mode.name;
}

/**
 * The step part of an expedition line ("Dungeon, deep, turn 2" → "turn 2"), cut by the mode's name so a name with a
 * comma in it stays whole; the whole line when it has no step. Pure.
 */
export function stepOfLine(line: string, modeName: string): string {
  return line.startsWith(`${modeName}, `) ? line.slice(modeName.length + 2) : line;
}

// The full rest ------------------------------------------------------------------------------------------------------

/** A character who went, as the full rest needs it: their class and race from the setting, and their level. */
export interface Rester {
  id: string;
  level: number;
  klass: Record<string, unknown> | null;
  race: Record<string, unknown> | null;
}

/** For each character, the abilities whose uses come back on a rest or a day (D23); characters with none are left out. */
export function restRefills(characters: readonly Rester[]): Record<string, string[]> {
  const refills: Record<string, string[]> = {};
  for (const c of characters) {
    const names = limitedAbilities(c.klass, c.race, c.level)
      .filter((a) => /^(rest|day)$/i.test(a.refill.trim()))
      .map((a) => a.name);
    if (names.length > 0) refills[c.id] = [...new Set(names)];
  }
  return refills;
}

/** The setting's healing rule as text (rulesSets[].healing, shown at a full rest), top pack first; null when none says. */
export function healingText(rulesSets: readonly Record<string, unknown>[]): string | null {
  for (const rules of [...rulesSets].reverse()) {
    const healing = rules.healing;
    if (typeof healing === 'string' && healing.trim()) return healing.trim();
    if (isRecord(healing)) {
      const lines = Object.values(healing).filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      if (lines.length > 0) return lines.join(' ');
    }
  }
  return null;
}

// How chances and the procedure's notes read (the reminder card, card.ts and ReminderCard.tsx, uses them) ---------

/** Faces as words: "1–2", "1", "1, 3". */
export function facesWords(on: readonly number[]): string {
  const sorted = [...new Set(on)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1;
    runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return runs.join(', ');
}

/** A chance as the prompt says it, the chance first ("Roll 1d6 · on 1–2"); the GM judges one with no chance. */
export function chanceWords(chance: Chance | null): string {
  if (!chance || chance.on.length === 0) return "the GM's call";
  return chance.die ? `Roll 1${chance.die}, on ${facesWords(chance.on)}` : `on ${facesWords(chance.on)}`;
}

/** The procedure's note steps, as one quiet line ("Listen at the dark · Choose a course"); empty when there are none. */
export function noteLine(advance: Pick<ProcedureSummary, 'quiet'>): string {
  return advance.quiet.filter((q) => q.kind === 'note').map((q) => q.name).join(', ');
}
