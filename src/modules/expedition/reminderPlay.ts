// The GM's reminders and the results of checks, as the campaign keeps them (M5 step 6; docs/05 "Expeditions, time
// and light", "Explore, Encounter and Fight"; docs/03: reminders the GM makes and changes, players see the public
// ones; checks the GM records, players see the results only when the campaign next goes into Downtime; ruled
// 2026-10-29, D30–D31). A reminder repeats on the campaign clock; a check reminder shows Hit / Miss on the card and
// may name the table a hit rolls; an Encounter check is the kind a location's own check stands in for (M8b).
// Each command is an intent with a request id; a change names the copy it was made from, so two devices can't
// overwrite each other (supabase/migrations/…_m5_reminders.sql). A made reminder or result undoes by being marked
// undone, never removed (hard rule 4).
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import type { ModifierLine } from './checks.ts';
import type { Amount } from './clock.ts';
import type { Chance } from './modes.ts';
import { storedChance, type ReminderSpec } from './reminders.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export interface Reminder extends ReminderSpec {
  campaignId: string;
  version: number;
}

export function toReminder(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    label: String(row.label ?? ''),
    kind: row.kind === 'check' ? 'check' : 'reminder',
    encounterCheck: row.encounter_check === true,
    every: { value: num(row.every_value, 1), unit: String(row.every_unit ?? 'turn') },
    anchor: num(row.anchor),
    active: row.active !== false,
    isPublic: row.is_public === true,
    chance: storedChance(row.chance),
    tableId: str(row.table_id),
    note: str(row.note),
    version: num(row.version, 1),
  };
}

/** A recorded check: hit or miss, when, the modifiers it had, and (after a hit) the table, the roll and its row. */
export interface CheckResult {
  id: string;
  campaignId: string;
  expeditionId: string | null;
  checkKey: string;
  name: string;
  source: 'mode' | 'location' | 'gm';
  outcome: 'hit' | 'miss';
  atSeconds: number;
  modifiers: { label: string; add: number | null; source: string }[];
  note: string | null;
  tableId: string | null;
  roll: string | null;
  rowText: string | null;
  revealed: boolean;
  /** checks[].secret: hidden from players until Downtime unless the GM reveals it. */
  secret: boolean;
  version: number;
  /** When it was recorded (the database's time), for the night check's "after the camp was made". */
  createdAt?: string;
}

export function toCheckResult(row: Record<string, unknown>): CheckResult {
  const mods = Array.isArray(row.modifiers) ? row.modifiers.filter(isRecord) : [];
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: str(row.expedition_id),
    checkKey: String(row.check_key ?? ''),
    name: String(row.name ?? ''),
    source: row.source === 'location' ? 'location' : row.source === 'gm' ? 'gm' : 'mode',
    outcome: row.outcome === 'hit' ? 'hit' : 'miss',
    atSeconds: num(row.at_seconds),
    modifiers: mods.map((m) => ({ label: String(m.label ?? ''), add: typeof m.add === 'number' ? m.add : null, source: String(m.source ?? 'rules') })),
    note: str(row.note),
    tableId: str(row.table_id),
    roll: str(row.roll),
    rowText: str(row.row_text),
    revealed: row.revealed === true,
    secret: row.secret !== false,
    version: num(row.version, 1),
    createdAt: String(row.created_at ?? ''),
  };
}

/** The campaign's reminders this person may read (a player gets only the public ones), oldest first. Null if unreadable. */
export async function loadReminders(db: Db, campaignId: string): Promise<Reminder[] | null> {
  const { data, error } = await db.from('reminders').select('*').eq('campaign_id', campaignId).eq('undone', false).order('created_at', { ascending: true });
  return error ? null : ((data ?? []) as Record<string, unknown>[]).map(toReminder);
}

/** The check results this person may read (a player: only revealed ones), newest first. Null if unreadable. */
export async function loadCheckResults(db: Db, campaignId: string, limit = 12): Promise<CheckResult[] | null> {
  const { data, error } = await db
    .from('check_results')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('undone', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  return error ? null : ((data ?? []) as Record<string, unknown>[]).map(toCheckResult);
}

/**
 * The results of the last expedition that ended, as a player can read them once revealed (the database gives a player
 * nothing before that). Empty when there's none. Scene's "Revealed this downtime" card that showed them went at the
 * M5 gate (B17); the database tests use it to prove the reveal.
 */
export async function loadRevealedResults(db: Db, campaignId: string): Promise<CheckResult[]> {
  const last = await db.from('expeditions').select('id, ended_at').eq('campaign_id', campaignId).eq('undone', false).order('started_at', { ascending: false }).limit(3);
  const id = ((last.data ?? []) as { id: string; ended_at: number | null }[]).find((x) => x.ended_at !== null)?.id ?? null;
  if (!id) return [];
  const results = await loadCheckResults(db, campaignId, 24);
  return (results ?? []).filter((r) => r.expeditionId === id);
}

/** Every item line that recharges on a timer (the GM reads them all): its id, name and its own `recharge`. */
export async function loadRecharging(db: Db, campaignId: string): Promise<{ lineId: string; name: string; recharge: unknown; line: Record<string, unknown> }[]> {
  const { data, error } = await db.from('inventory_lines').select('*').eq('campaign_id', campaignId);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).flatMap((row) => {
    const item = isRecord(row.item_data) ? row.item_data : {};
    return isRecord(item.recharge) ? [{ lineId: String(row.id), name: String(row.name ?? ''), recharge: item.recharge, line: row }] : [];
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

export interface ReminderFields {
  label: string;
  kind: 'reminder' | 'check';
  encounterCheck: boolean;
  every: Amount;
  isPublic: boolean;
  chance: Chance | null;
  tableId: string | null;
  note: string | null;
}

/** A new reminder (any time, even mid-session): it starts counting from the clock's time now. */
export const addReminder = defineCommand({
  name: 'reminder.add',
  target: (input: { campaignId: string; fields: ReminderFields }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('add_reminder', {
        campaign: input.campaignId,
        label: input.fields.label,
        kind: input.fields.kind,
        encounter_check: input.fields.encounterCheck,
        every_value: input.fields.every.value,
        every_unit: input.fields.every.unit,
        is_public: input.fields.isPublic,
        chance: (input.fields.chance ?? null) as unknown as Json,
        table_id: input.fields.tableId ?? '',
        note: input.fields.note ?? '',
      }),
      toReminder,
    ),
});

/** A change to a reminder: its words, how often, public or not, stopped or running again (from now). */
export const editReminder = defineCommand({
  name: 'reminder.edit',
  target: (input: { campaignId: string; reminder: Reminder; changes: Partial<ReminderFields> & { active?: boolean } }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => {
    const c = input.changes;
    const changes: Record<string, unknown> = {};
    if (c.label !== undefined) changes.label = c.label;
    if (c.kind !== undefined) changes.kind = c.kind;
    if (c.encounterCheck !== undefined) changes.encounter_check = c.encounterCheck;
    if (c.every !== undefined) {
      changes.every_value = c.every.value;
      changes.every_unit = c.every.unit;
    }
    if (c.isPublic !== undefined) changes.is_public = c.isPublic;
    if (c.chance !== undefined) changes.chance = c.chance;
    if (c.tableId !== undefined) changes.table_id = c.tableId ?? '';
    if (c.note !== undefined) changes.note = c.note ?? '';
    if (c.active !== undefined) changes.active = c.active;
    return rpcRow(db.rpc('edit_reminder', { reminder: input.reminder.id, changes: changes as Json, seen_version: input.reminder.version }), toReminder);
  },
});

export interface CheckRecord {
  checkKey: string;
  name: string;
  source: 'mode' | 'location' | 'gm';
  outcome: 'hit' | 'miss';
  modifiers: readonly ModifierLine[];
  note?: string | null;
  /** checks[].secret (default true): an open result shows to players at once. */
  secret?: boolean;
}

const recordWith = (db: Db, input: { campaignId: string; record: CheckRecord }) =>
  rpcRow(
    db.rpc('record_check', {
      campaign: input.campaignId,
      check_key: input.record.checkKey,
      name: input.record.name,
      source: input.record.source,
      outcome: input.record.outcome,
      modifiers: input.record.modifiers.map((m) => ({ label: m.label, add: m.add, source: m.source })) as unknown as Json,
      note: input.record.note ?? '',
      secret: input.record.secret !== false,
    }),
    toCheckResult,
  );

/** Hit or Miss, logged at once; players see it only when the campaign next goes into Downtime. */
export const recordCheck = defineCommand({
  name: 'check.record',
  target: (input: { campaignId: string; record: CheckRecord }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => recordWith(db, input),
});

/**
 * "Checked today · Check again" (05, Once per period; ruled 2026-10-29): the GM runs a check that already ran this
 * period once more. Recorded like any check, but logged Verbose (a routine step).
 */
export const recordCheckAgain = defineCommand({
  name: 'check.again',
  log: 'verbose',
  target: (input: { campaignId: string; record: CheckRecord }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => recordWith(db, input),
});

/**
 * Check now (ruled 2026-10-30, DG3): an ad-hoc wandering check at any time, from the check marker or ⋯. Recorded
 * like any check, under its own name in the log (Simple); the regular schedule carries on.
 */
export const recordCheckNow = defineCommand({
  name: 'check.now',
  target: (input: { campaignId: string; record: CheckRecord }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => recordWith(db, input),
});

/** After a hit: the table rolled, what the dice showed and the row it read (the app never rolls). */
export const setCheckRoll = defineCommand({
  name: 'check.setRoll',
  target: (input: { campaignId: string; result: CheckResult; tableId: string; roll: string; rowText: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('set_check_roll', { result: input.result.id, table_id: input.tableId, roll: input.roll, row_text: input.rowText, seen_version: input.result.version }),
      toCheckResult,
    ),
});

/** The GM shows one secret result to the players now (ruled 2026-10-29); logged, and undo hides it again. */
export const revealCheck = defineCommand({
  name: 'check.reveal',
  target: (input: { campaignId: string; result: CheckResult }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('reveal_check', { result: input.result.id, seen_version: input.result.version }), toCheckResult),
});

export const REMINDER_COMMANDS = [addReminder, editReminder, recordCheck, recordCheckAgain, recordCheckNow, setCheckRoll, revealCheck] as const;

/** A unit's one name, from either form ("turns" or "turn", "watches" or "watch"), as it was written otherwise. */
export function unitOne(unit: string): string {
  const u = unit.trim();
  if (/(ch|sh|ss|x|z)es$/i.test(u)) return u.slice(0, -2);
  return u.replace(/s$/i, '');
}

/** "1 turn", "2 turns", "2 watches": a count and its unit, one helper for every reminder line. */
export function unitWords(n: number, unit: string): string {
  const one = unitOne(unit);
  return n === 1 ? `1 ${one}` : `${n} ${/(ch|sh|s|x|z)$/i.test(one) ? `${one}es` : `${one}s`}`;
}

/** "Every 2 turns", "Every day", "Every 2 watches". */
export function everyWords(every: Amount): string {
  return every.value === 1 ? `Every ${unitOne(every.unit)}` : `Every ${unitWords(every.value, every.unit)}`;
}
