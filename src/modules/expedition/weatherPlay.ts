// Today's weather, as the campaign keeps it (M5b; ruled 2026-10-30: D1, S2-1, A8–A12; docs/03 "Weather roll", 05
// "Seasons, weather and the calendar"; supabase/migrations/…_m5b_weather_roll.sql). One weather per `rollEvery` step
// of an expedition: the first entry counts. Any member enters the roll while "Weather rolled by" is Players (the
// default), and the GM can always enter it instead; the database reads the row from the weather table (the table
// never reaches a player's device) and keeps its result and tags. The entrant can undo it from the toast; after
// that only the GM changes it (weather.correct, a correction with the fiat seal). Also the plain words each tag
// shows as ("Wet · lighting a campfire is hard", "Mired · −2 travel points").
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { WeatherTag } from './modes.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/** "Weather rolled by" (04 weatherRolledBy): Players by default. */
export type WeatherRolledBy = 'players' | 'gm';

export function weatherRolledByOf(settings: unknown): WeatherRolledBy {
  return isRecord(settings) && settings.weatherRolledBy === 'gm' ? 'gm' : 'players';
}

/** One step's weather: the table and roll, the row's result and tags, who entered it and when, who changed it since. */
export interface WeatherRoll {
  id: string;
  campaignId: string;
  expeditionId: string;
  period: number;
  startsAt: number;
  tableId: string;
  roll: string;
  result: string;
  tags: string[];
  enteredBy: string | null;
  enteredAt: string;
  correctedBy: string | null;
  version: number;
}

export function toWeatherRoll(row: Record<string, unknown>): WeatherRoll {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: String(row.expedition_id),
    period: num(row.period),
    startsAt: num(row.starts_at),
    tableId: String(row.table_id ?? ''),
    roll: String(row.roll ?? ''),
    result: String(row.result ?? ''),
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [],
    enteredBy: str(row.entered_by),
    enteredAt: String(row.entered_at ?? ''),
    correctedBy: str(row.corrected_by),
    version: num(row.version, 1),
  };
}

/** The live weather of an expedition's step, or null when none is in yet (undefined when it can't be read). */
export async function loadWeather(db: Db, expeditionId: string, period: number): Promise<WeatherRoll | null | undefined> {
  const { data, error } = await db.from('weather_rolls').select('*').eq('expedition_id', expeditionId).eq('period', period).eq('undone', false).maybeSingle();
  if (error) return undefined;
  return data ? toWeatherRoll(data as Record<string, unknown>) : null;
}

/** What to roll for a weather table ("d8"), never its rows; null when it names none or can't be read. */
export async function loadWeatherDie(db: Db, campaignId: string, tableId: string): Promise<string | null> {
  const { data, error } = await db.rpc('weather_die', { campaign: campaignId, table_id: tableId });
  return error || typeof data !== 'string' || !data.trim() ? null : data.trim();
}

/** The display names of the people who entered or changed weather, by user id. */
export async function loadWeatherPeople(db: Db, campaignId: string): Promise<Map<string, { name: string; gm: boolean }>> {
  const { data, error } = await db.from('members').select('user_id, base_role, profiles!members_user_id_fkey(display_name)').eq('campaign_id', campaignId);
  if (error || !data) return new Map();
  return new Map(
    (data as { user_id: string; base_role: string | null; profiles: { display_name: string | null } | null }[]).map((m) => [
      m.user_id,
      { name: m.profiles?.display_name?.trim() || 'Someone', gm: m.base_role === 'gm' },
    ]),
  );
}

/**
 * Each of today's tags in plain words (A11): its name, then the pack's text, then any number it changes on the
 * travel budget, named as the pack names the budget ("Mired · −2 travel points"). A tag the pack doesn't describe
 * shows its id, tidied ("poor-visibility" → "Poor visibility"). Never the GM's movement warning.
 */
export function weatherTagLines(tags: readonly string[], known: Readonly<Record<string, WeatherTag>>, budgetName: string | null = null): string[] {
  return weatherTagParts(tags, known, budgetName).map((part) => [part.label, ...part.words].join(', '));
}

/**
 * The same, apart (the Weather sheet, T6: "Wet. A fire needs dry tinder."): each tag's name as the label, then its words,
 * the pack's text and any number it changes on the travel budget, each as the pack or the app says it.
 */
export function weatherTagParts(tags: readonly string[], known: Readonly<Record<string, WeatherTag>>, budgetName: string | null = null): { label: string; words: string[] }[] {
  return [...new Set(tags)].map((id) => {
    const tag = known[id];
    const words: string[] = [];
    if (tag?.note) words.push(tag.note);
    if (tag?.budget) words.push(`${tag.budget > 0 ? '+' : '−'}${Math.abs(tag.budget)} ${budgetName ?? 'to the travel budget'}`);
    return { label: tag?.name ?? tidy(id), words };
  });
}

function tidy(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

/** The travel budget's name for the tag lines, from a mode's `movement` (07: `{ kind: "budget", name, unit }`), lower case. */
export function budgetNameOf(movement: Record<string, unknown> | null): string | null {
  if (!movement || movement.kind !== 'budget') return null;
  const name = str(movement.name) ?? str(movement.unit);
  return name ? name.toLowerCase() : null;
}

// Commands ---------------------------------------------------------------------------------------------------------

async function rpcRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<WeatherRoll>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toWeatherRoll(row)) : fromError({ code: '42501', message: '' });
}

export interface WeatherEntry {
  campaignId: string;
  expeditionId: string;
  period: number;
  startsAt: number;
  tableId: string;
  roll: string;
  /** The campaign's "Weather rolled by". */
  rolledBy: WeatherRolledBy;
}

/** The app's copy of the rule: the GM always; any member while players roll it. */
export function mayEnterWeather(user: CurrentUser, target: { campaignId: string; rolledBy: WeatherRolledBy }): boolean {
  return isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.rolledBy === 'players');
}

/** Enter today's weather (the first entry counts); the database reads the row. */
export const enterWeather = defineCommand({
  name: 'weather.enter',
  target: (input: WeatherEntry) => ({ campaignId: input.campaignId, rolledBy: input.rolledBy }),
  allowed: mayEnterWeather,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('enter_weather', {
        campaign: input.campaignId,
        expedition: input.expeditionId,
        period: input.period,
        starts_at: input.startsAt,
        table_id: input.tableId,
        roll: input.roll,
      }),
    ),
});

/** The GM changes today's weather, any time: another roll or another weather table. Logged as a correction (fiat). */
export const correctWeather = defineCommand({
  name: 'weather.correct',
  target: (input: { campaignId: string; weather: WeatherRoll; tableId: string; roll: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  fiat: (user, target) => isGm(user, target.campaignId),
  run: (db, _user, input) =>
    rpcRow(db.rpc('correct_weather', { weather: input.weather.id, table_id: input.tableId, roll: input.roll, seen_version: input.weather.version })),
});

export const WEATHER_COMMANDS = [enterWeather, correctWeather] as const;
