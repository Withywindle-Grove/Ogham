// The GM's pins for this session and a row read without a hit (M5b step g3; docs/05 "Encounter tables, full screen",
// M5 gate B2, ruled 2026-11-01; supabase/migrations/20261102110000_m5b_g3_table_pins.sql).
//   * A pin is made in the Table library › (prep) and belongs to the session it was made in, or (made between
//     sessions) to the next one; it ends with that session. The database counts a pin only while no session has ended
//     since it was made, so nothing is removed when a session ends (hard rule 4).
//   * A row tapped on a table opened without a hit (Explore's Encounter tables row) is recorded "rolled by hand".
// Both are the GM's alone: tables never reach players' devices. Each command is an intent with a request id; undo
// marks a made pin or read undone, and undoing Unpin pins it again.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';

export interface TablePin {
  id: string;
  campaignId: string;
  tableId: string;
  pinnedAt: string;
  version: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function toTablePin(row: Record<string, unknown>): TablePin {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    tableId: String(row.table_id ?? ''),
    pinnedAt: String(row.pinned_at ?? ''),
    version: typeof row.version === 'number' ? row.version : 1,
  };
}

/** The pins in play now (this session's, or the next one's between sessions), oldest first. Null if unreadable. */
export async function loadTablePins(db: Db, campaignId: string): Promise<TablePin[] | null> {
  const { data, error } = await db.rpc('table_pins_now', { campaign: campaignId });
  return error ? null : ((data ?? []) as unknown as Record<string, unknown>[]).filter(isRecord).map(toTablePin);
}

type CampaignTarget = { campaignId: string };
const gmOnly = (user: CurrentUser, target: CampaignTarget) => isGm(user, target.campaignId);

async function rpcRow<T>(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, read: (row: Record<string, unknown>) => T): Promise<CommandResult<T>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(read(row)) : fromError({ code: '42501', message: '' });
}

/** Pin a table for this session (the Table library ›, prep). Logged Verbose; Undo takes the pin away. */
export const pinTable = defineCommand({
  name: 'tables.pin',
  log: 'verbose',
  target: (input: { campaignId: string; tableId: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('pin_table', { campaign: input.campaignId, table_id: input.tableId }), toTablePin),
});

/** Unpin it. Logged Verbose; Undo pins it again. */
export const unpinTable = defineCommand({
  name: 'tables.unpin',
  log: 'verbose',
  target: (input: { campaignId: string; pin: TablePin }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('unpin_table', { pin: input.pin.id, seen_version: input.pin.version }), toTablePin),
});

/** A row read from a table opened without a hit: "rolled by hand". Logged Simple; Undo takes it back. */
export const readTableByHand = defineCommand({
  name: 'tables.readByHand',
  target: (input: { campaignId: string; tableId: string; roll: string; rowText: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) =>
    rpcRow(db.rpc('read_table_by_hand', { campaign: input.campaignId, table_id: input.tableId, roll: input.roll, row_text: input.rowText }), (row) => ({
      id: String(row.id),
      tableId: String(row.table_id ?? ''),
      roll: String(row.roll ?? ''),
      rowText: String(row.row_text ?? ''),
    })),
});

export const TABLE_COMMANDS = [pinTable, unpinTable, readTableByHand] as const;
