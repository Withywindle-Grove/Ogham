// Marching order as the campaign keeps it (M5 step 8; docs/04 "MarchingOrder"; docs/03 "Set marching order"; ruled
// M5-6, 2026-10-25; per group, DG14 and DG8, ruled 2026-10-30): one row per party group
// (supabase/migrations/…_m5_marching.sql, …_m5_party_groups.sql) with its rows; the saved orders are the
// campaign's, kept on group 1's row (the party's). The GM always may change it; players wherever "Players can
// reorder marching order" is on (default Yes). Every move is logged. A move made from an old copy is refused
// ("That's changed since. Here's the latest."), so two devices moving at once never lose one silently.
// src/core/marchingRows.ts is the pure part.
// No lock (B11 of docs/plans/scene-point-to-point.md; p2p-21 and flag 5, ruled 2026-11-18): neither this rule nor
// the database (…_p2p_b11_marching_no_lock.sql) looks at a stored lock any more. Old locks stay stored and do nothing.
export { playersReorderOf, playersSeeHpOf } from '../../core/campaignSettings.ts';
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { readRows, type Rows } from '../../core/marchingRows.ts';

export interface MarchingPreset {
  name: string;
  rows: Rows;
}

export interface MarchingOrder {
  id: string;
  campaignId: string;
  /** Its party group (1: the party). */
  group: number;
  rows: Rows;
  presets: MarchingPreset[];
  /** The saved order it was last set from (null once moved by hand). */
  lastPreset: string | null;
  /** A lock stored before 2026-11-18 (B11). Kept as stored; nothing looks at it. */
  locked: boolean;
  version: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function toMarchingOrder(row: Record<string, unknown>): MarchingOrder {
  const presets = Array.isArray(row.presets)
    ? row.presets.flatMap((p) => (isRecord(p) && typeof p.name === 'string' && p.name.trim() ? [{ name: p.name.trim(), rows: readRows(p.rows) }] : []))
    : [];
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    group: typeof row.group_number === 'number' ? row.group_number : 1,
    rows: readRows(row.rows),
    presets,
    lastPreset: typeof row.last_preset === 'string' && row.last_preset.trim() ? row.last_preset : null,
    locked: row.locked === true,
    version: typeof row.version === 'number' ? row.version : 1,
  };
}

/** Every group's marching order in the campaign (group 1's first), or 'error' if they couldn't be loaded. */
export async function loadMarchingOrders(db: Db, campaignId: string): Promise<MarchingOrder[] | 'error'> {
  const { data, error } = await db.from('marching_orders').select('*').eq('campaign_id', campaignId);
  if (error) return 'error';
  return (data ?? []).map((row) => toMarchingOrder(row as Record<string, unknown>)).sort((a, b) => a.group - b.group);
}

/** A character who marches: an approved, active character or hireling of the campaign (docs/05: hirelings too). */
export interface Marcher {
  id: string;
  campaignId: string;
  name: string;
  kind: string;
  ownerUserId: string | null;
  level: number;
  hpCurrent: number | null;
  hpMax: number | null;
  archived: boolean;
  /** Their (first) class's pack id, for the modifiers keyed to the party (ex-2, ga-3); missing: not loaded. */
  classRef?: string | null;
  /** Their portrait's file, for the marching order's circle (S12); missing: not loaded. */
  portraitAssetId?: string | null;
}

/** A character's first class (actors.classes[0].classRef), or null. */
function firstClassRef(classes: unknown): string | null {
  const first = Array.isArray(classes) ? (classes[0] as { classRef?: unknown } | undefined) : undefined;
  return typeof first?.classRef === 'string' ? first.classRef : null;
}

/** Everyone who marches, by name (the order the newly added join the back in). Null if they couldn't be loaded. */
export async function loadMarchers(db: Db, campaignId: string): Promise<Marcher[] | null> {
  const { data, error } = await db
    .from('actors')
    .select('id, campaign_id, name, kind, owner_user_id, approval, status, level, hp_current, hp_max, classes, portrait_asset_id')
    .eq('campaign_id', campaignId)
    .in('kind', ['pc', 'hireling'])
    .eq('approval', 'approved');
  if (error) return null;
  return (data ?? [])
    .filter((a) => a.status === 'active')
    .map((a) => ({
      id: a.id,
      campaignId: a.campaign_id,
      name: a.name,
      kind: a.kind,
      ownerUserId: a.owner_user_id,
      level: a.level,
      hpCurrent: a.hp_current,
      hpMax: a.hp_max,
      archived: false,
      classRef: firstClassRef(a.classes),
      portraitAssetId: a.portrait_asset_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** What the permission rule looks at: the campaign (and the group's order it changes) and the setting. */
export interface MarchingTarget {
  campaignId: string;
  /** The party group whose order it is (1: the party). */
  group: number;
  playersReorder: boolean;
}

/** 03 "Set marching order": the GM always; a member wherever the setting is on (no lock: p2p-21, B11). */
export const mayMarch = (user: CurrentUser, target: MarchingTarget): boolean =>
  isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.playersReorder);

/** Why someone may not move it, in words for the pop-up (null when they may). */
export function whyNot(user: CurrentUser, target: MarchingTarget): string | null {
  if (mayMarch(user, target)) return null;
  if (!isMember(user, target.campaignId)) return "You don't have permission to do that.";
  return 'Only the GM sets the marching order in this campaign.';
}

async function orderRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<MarchingOrder>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) && typeof row.id === 'string' ? ok(toMarchingOrder(row)) : fromError({ code: '42501', message: '' });
}

/** The version the person's copy showed (nothing for an order they've never seen). */
const seenOf = (order: { version: number } | null | undefined) => order?.version;

/** A move (hold to drag a row; join the row ahead; a row of their own): the order is now these rows. */
export const setMarchingOrder = defineCommand({
  name: 'marching.set',
  log: 'simple',
  target: (input: { target: MarchingTarget; order: MarchingOrder | null; rows: Rows }) => input.target,
  allowed: mayMarch,
  run: (db, _user, input) =>
    orderRow(
      db.rpc('set_marching_order', {
        campaign: input.target.campaignId,
        new_rows: input.rows as unknown as Json,
        seen_version: seenOf(input.order),
        party_group: input.target.group,
      }),
    ),
});

/** Use a preset: the group's order is that saved order (anyone who isn't in the group now is left out). */
export const applyMarchingPreset = defineCommand({
  name: 'marching.usePreset',
  log: 'simple',
  target: (input: { target: MarchingTarget; order: MarchingOrder | null; name: string }) => input.target,
  allowed: mayMarch,
  run: (db, _user, input) =>
    orderRow(db.rpc('use_marching_preset', { campaign: input.target.campaignId, preset_name: input.name, seen_version: seenOf(input.order), party_group: input.target.group })),
});

/**
 * Save as…: the group's order as it is now, under a name among the campaign's saved orders (the same name is
 * replaced). `order` is group 1's (the party's), where the saved orders are kept: its copy version is the one checked.
 */
export const saveMarchingPreset = defineCommand({
  name: 'marching.savePreset',
  log: 'verbose',
  target: (input: { target: MarchingTarget; order: MarchingOrder | null; name: string }) => input.target,
  allowed: mayMarch,
  run: (db, _user, input) =>
    orderRow(db.rpc('save_marching_preset', { campaign: input.target.campaignId, preset_name: input.name, seen_version: seenOf(input.order), party_group: input.target.group })),
});

/** Delete a saved order (Undo puts it back). `order` is group 1's, where the saved orders are kept. */
export const deleteMarchingPreset = defineCommand({
  name: 'marching.deletePreset',
  log: 'verbose',
  target: (input: { target: MarchingTarget; order: MarchingOrder | null; name: string }) => input.target,
  allowed: mayMarch,
  run: (db, _user, input) => orderRow(db.rpc('delete_marching_preset', { campaign: input.target.campaignId, preset_name: input.name, seen_version: seenOf(input.order) })),
});

/**
 * Lock or unlock: the GM's old switch. No screen reaches it since B11 (p2p-21, 2026-11-18), and the value it stores
 * stops nobody. Kept, with its database function and its log lines, so that what was logged still reads and can
 * still be undone; nothing here is deleted. `order` is group 1's.
 */
export const lockMarchingOrder = defineCommand({
  name: 'marching.lock',
  log: 'simple',
  target: (input: { target: MarchingTarget; order: MarchingOrder | null; locked: boolean }) => input.target,
  allowed: (user: CurrentUser, target: MarchingTarget) => isGm(user, target.campaignId),
  run: (db, _user, input) => orderRow(db.rpc('lock_marching_order', { campaign: input.target.campaignId, lock_it: input.locked, seen_version: seenOf(input.order) })),
});

export const MARCHING_COMMANDS = [setMarchingOrder, applyMarchingPreset, saveMarchingPreset, deleteMarchingPreset, lockMarchingOrder] as const;
