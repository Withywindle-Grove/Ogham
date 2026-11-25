// Activities as the campaign keeps them (M5b step 3, build orders 1–2; ruled 2026-10-30, D3, S4-8; docs/05
// "Activities"; supabase/migrations/…_m5b_3_activities.sql). The engine (activities.ts) works out who may act, the
// cost, the roll and the finder, and writes nothing; this file holds the run rows and the two commands:
//   activity.apply: one activity done by a group: the cost off today's budget and the yield into the finder's pack,
//     in one request (one log line). The GM, or a member with a character in the group.
//   activity.undo: the yield out (the line it made, while untouched), the points back, the run marked undone; the
//     run's author or the GM, the same day. Logged as an undo, each change linked to the one it reverses.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import type { ItemCopy } from '../inventory/inventory.ts';
import { mayName, type EnteredRoll } from './activities.ts';
import type { Activity } from './modes.ts';
import type { GroupTarget } from './travelPlay.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type ActivityOutcome = 'worked' | 'failed' | 'done';

export interface ActivityRun {
  id: string;
  campaignId: string;
  group: number;
  activityId: string;
  activityName: string;
  actorIds: string[];
  rolls: EnteredRoll[];
  outcome: ActivityOutcome;
  spent: number;
  finderId: string | null;
  yieldName: string | null;
  yieldQty: number;
  createdBy: string | null;
  undone: boolean;
}

export function toActivityRun(row: Record<string, unknown>): ActivityRun {
  const rolls = Array.isArray(row.rolls) ? row.rolls.filter(isRecord).map((r) => ({ actorId: String(r.actorId ?? ''), roll: Number(r.roll) })) : [];
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    group: Number(row.group_number ?? 1),
    activityId: String(row.activity_id ?? ''),
    activityName: String(row.activity_name ?? ''),
    actorIds: Array.isArray(row.actor_ids) ? row.actor_ids.map(String) : [],
    rolls,
    outcome: row.outcome === 'failed' ? 'failed' : row.outcome === 'done' ? 'done' : 'worked',
    spent: Number(row.spent ?? 0),
    finderId: typeof row.finder_id === 'string' ? row.finder_id : null,
    yieldName: typeof row.yield_name === 'string' ? row.yield_name : null,
    yieldQty: Number(row.yield_qty ?? 0),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    undone: row.undone === true,
  };
}

async function rpcRun(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<ActivityRun>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toActivityRun(row)) : fromError({ code: '42501', message: '' });
}

/** An activity's target: the group, the activity's kind, and the players of those named as acting or finding. */
export interface ActivityTarget extends GroupTarget {
  /** The activity's `who` in the setting rules (one, several, party). */
  who: Activity['who'];
  /** The player of each one named, acting or finding (a hireling's is its employer's); null: the GM's. */
  ownersNamed: readonly (string | null)[];
}

/**
 * Who may run an activity for a group: the GM, or a member whose character is in it (the database's in_my_group);
 * in an activity one character does, a player names only their own characters and hirelings (ac-1, 2026-11-11).
 */
export const mayDoActivity = (user: CurrentUser, target: ActivityTarget): boolean =>
  isGm(user, target.campaignId) ||
  (isMember(user, target.campaignId) && target.mine && target.ownersNamed.every((owner) => mayName(target, false, user.id, owner)));

export interface ApplyActivityInput {
  target: ActivityTarget;
  activity: { id: string; name: string };
  /** Everyone acting (characters of the group), the finder one of them. */
  actorIds: string[];
  finderId: string | null;
  rolls: EnteredRoll[];
  outcome: ActivityOutcome;
  /** What comes off today's budget (activities.ts spendOf). */
  spend: number;
  /** The item from the setting rules and how many; null or 0: nothing found. */
  yield: { item: ItemCopy; qty: number } | null;
}

/** Done (D3, S4-8): the cost and the yield in one request, so one log line and one Undo. */
export const applyActivity = defineCommand({
  name: 'activity.apply',
  log: 'simple',
  target: (input: ApplyActivityInput) => input.target,
  allowed: mayDoActivity,
  run: (db, _user, input) => {
    const found = input.yield && input.yield.qty > 0 ? input.yield : null;
    return rpcRun(
      db.rpc('apply_activity', {
        campaign: input.target.campaignId,
        group_no: input.target.group,
        activity_id: input.activity.id,
        activity_name: input.activity.name,
        actors: input.actorIds,
        finder: input.finderId,
        rolls: input.rolls as unknown as Json,
        outcome: input.outcome,
        spend: input.spend,
        yield_entry: found?.item.libraryEntryId ?? undefined,
        yield_name: found?.item.name,
        yield_category: found?.item.category ?? '',
        yield_weight: found?.item.weightCoin ?? undefined,
        yield_slots: found?.item.slots ?? undefined,
        yield_stack: found?.item.stack ?? 1,
        yield_qty: found?.qty ?? 0,
      }),
    );
  },
});

/** Undo (D3): the run's author or the GM. */
export const undoActivity = defineCommand({
  name: 'activity.undo',
  log: 'simple',
  target: (input: { campaignId: string; runId: string; authorUserId: string | null }) => input,
  allowed: (user, target) => isMember(user, target.campaignId) && (isGm(user, target.campaignId) || target.authorUserId === user.id),
  run: (db, _user, input) => rpcRun(db.rpc('undo_activity', { run_id: input.runId })),
});

/** The run an activity.apply log line made (its activity_runs row), for the log's Undo. */
export const runOfEntry = (events: readonly { targetTable?: string | null; targetId?: string | null; before: unknown }[]): string | null =>
  events.find((e) => e.targetTable === 'activity_runs' && e.before === null)?.targetId ?? null;

export const ACTIVITY_COMMANDS = [applyActivity, undoActivity] as const;

/** The pack items a character carries, by the pack's item id (for `requires.item`); empty when unreadable. */
export async function loadCarriedItemIds(db: Db, actorId: string): Promise<Set<string>> {
  const { data, error } = await db.from('inventory_lines').select('source_entry_id').eq('actor_id', actorId);
  if (error || !data) return new Set();
  return new Set((data as { source_entry_id: string | null }[]).map((l) => l.source_entry_id).filter((id): id is string => typeof id === 'string'));
}
