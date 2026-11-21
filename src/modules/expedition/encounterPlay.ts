// Encounter waiting (M5b step 2; docs/05 "Encounter waiting", ruled 2026-10-30, D11 and S2-4;
// supabase/migrations/20261103100000_m5b_2_waiting_encounters.sql). A hit of an encounter check queues one card on the
// GM console; the GM starts it when it suits (in M5b, Start opens the row's text and its stat block references,
// read-only; the fight arrives with M6, ruled 2026-11-03), views it, or dismisses it (Undo).
//   * The card reads its hit (check_results): the check's name, when it fell, and the row the GM tapped (check.setRoll),
//     so a row picked after the card was queued shows on it. Undoing the hit hides its card.
//   * The GM's alone: players never receive waiting encounters (row-level security).
//   * A night hit's "Which watch?" waits for camp (m5b-4): `watch` stays empty until then.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { CheckLine } from './card.ts';
import { toCheckResult, type CheckResult } from './reminderPlay.ts';
import { rowLabel, type ReadTable, type TableRow } from './tables.ts';

export interface WaitingEncounter {
  id: string;
  campaignId: string;
  expeditionId: string | null;
  checkResultId: string;
  watch: string | null;
  state: 'waiting' | 'started' | 'dismissed';
  createdAt: string;
  version: number;
}

/** A waiting card with the hit it came from. */
export interface EncounterCard {
  encounter: WaitingEncounter;
  hit: CheckResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function toWaitingEncounter(row: Record<string, unknown>): WaitingEncounter {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: typeof row.expedition_id === 'string' ? row.expedition_id : null,
    checkResultId: String(row.check_result_id),
    watch: typeof row.watch === 'string' && row.watch.trim() ? row.watch : null,
    state: row.state === 'started' ? 'started' : row.state === 'dismissed' ? 'dismissed' : 'waiting',
    createdAt: String(row.created_at ?? ''),
    version: typeof row.version === 'number' ? row.version : 1,
  };
}

/**
 * The cards waiting on this expedition, newest first: queued, not started or dismissed, and their hit not undone.
 * Null if unreadable (a player reads nothing: the database gives them no rows).
 */
export async function loadWaitingEncounters(db: Db, campaignId: string, expeditionId: string): Promise<EncounterCard[] | null> {
  const { data, error } = await db
    .from('waiting_encounters')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('expedition_id', expeditionId)
    .eq('state', 'waiting')
    .eq('undone', false)
    .order('created_at', { ascending: false });
  if (error) return null;
  const waiting = ((data ?? []) as Record<string, unknown>[]).map(toWaitingEncounter);
  if (waiting.length === 0) return [];
  const hits = await db
    .from('check_results')
    .select('*')
    .in(
      'id',
      waiting.map((w) => w.checkResultId),
    )
    .eq('undone', false);
  if (hits.error) return null;
  const byId = new Map(((hits.data ?? []) as Record<string, unknown>[]).map((r) => [String(r.id), toCheckResult(r)]));
  return waiting.flatMap((encounter) => {
    const hit = byId.get(encounter.checkResultId);
    return hit ? [{ encounter, hit }] : [];
  });
}

/** "Encounter waiting · Wandering check · Abbey › Mortal: Pilgrims · 1d6", or "· no row yet" before the table pick. */
export function cardWords(card: EncounterCard): string {
  return ['Encounter waiting', card.hit.name, card.hit.rowText ?? 'no row yet'].join(', ');
}

/**
 * What Start (and View) show for the GM: the row the hit read, found again on its table by its range, and the stat
 * blocks it names (their names and one-line descriptions; read-only). Empty when the table or row can't be found.
 */
export function rowOfHit(hit: CheckResult, tables: ReadonlyMap<string, ReadTable>): { table: ReadTable; row: TableRow } | null {
  const table = hit.tableId ? tables.get(hit.tableId) : undefined;
  if (!table || !hit.roll) return null;
  const row = table.rows.find((r) => rowLabel(r) === hit.roll);
  return row ? { table, row } : null;
}

/**
 * Whether a hit on this card line queues an Encounter waiting card: an encounter check's hit does (the mode's
 * wandering check, a place's own); a lost check's doesn't; one of the GM's own checks does when it's marked
 * Encounter check.
 */
export function hitQueuesEncounter(check: Pick<CheckLine, 'source' | 'checkId' | 'encounter' | 'lost'>, reminders: readonly { id: string; encounterCheck: boolean }[] | null): boolean {
  if (check.lost) return false;
  if (check.source === 'gm') {
    const own = reminders?.find((r) => r.id === check.checkId);
    if (own) return own.encounterCheck;
  }
  return check.encounter;
}

// Commands ---------------------------------------------------------------------------------------------------------

type CampaignTarget = { campaignId: string };
const gmOnly = (user: CurrentUser, target: CampaignTarget) => isGm(user, target.campaignId);

async function rpcRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<WaitingEncounter>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toWaitingEncounter(row)) : fromError({ code: '42501', message: '' });
}

/** A hit of an encounter check queues its card (one per hit). Logged Verbose (the hit is the Simple line); Undo takes the card away. */
export const queueEncounter = defineCommand({
  name: 'encounter.queue',
  log: 'verbose',
  target: (input: { campaignId: string; result: CheckResult }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('queue_encounter', { result: input.result.id })),
});

/** Start: in M5b it marks the card started and opens the row's text (M6 turns it into a fight). Logged Simple; Undo puts it back. */
export const startEncounter = defineCommand({
  name: 'encounter.start',
  target: (input: { campaignId: string; encounter: WaitingEncounter }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('start_encounter', { encounter: input.encounter.id, seen_version: input.encounter.version })),
});

/** Dismiss: the card goes. Logged Simple; Undo brings it back. */
export const dismissEncounter = defineCommand({
  name: 'encounter.dismiss',
  target: (input: { campaignId: string; encounter: WaitingEncounter }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('dismiss_encounter', { encounter: input.encounter.id, seen_version: input.encounter.version })),
});

/** Which watch? (M5b step 4, D18): a night hit's card names the watch that was awake ("2nd watch · Reed, Moss"). The GM's; Undo clears it. */
export const setEncounterWatch = defineCommand({
  name: 'encounter.watch',
  log: 'verbose',
  target: (input: { campaignId: string; encounter: WaitingEncounter; watch: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('set_encounter_watch', { encounter: input.encounter.id, watch: input.watch, seen_version: input.encounter.version })),
});

export const ENCOUNTER_COMMANDS = [queueEncounter, startEncounter, dismissEncounter, setEncounterWatch] as const;
