// Sheet changes (plan m5b-sheet-revised B; ruled 2026-11-08, evening): a player's change to a score or to Max HP on
// an approved character goes to the GM as a request; the sheet keeps the old figure, marked "17 waiting", until the
// GM approves it. Details save at once (character.edit); only these figures wait. The GM's own edits never wait.
// Rows: public.sheet_changes (the GM and the character's player read them; their log lines are the player's own).
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { CharacterRef } from './commands.ts';

/** The field a Max HP change is to (a score's is the key of the campaign field that holds it). */
export const HP_MAX_FIELD = 'hpMax';

export type SheetChangeStatus = 'waiting' | 'approved' | 'refused' | 'withdrawn';

export interface SheetChange {
  id: string;
  campaignId: string;
  actorId: string;
  requesterId: string | null;
  /** 'hpMax', or the key of the field that holds the score. */
  field: string;
  /** Its words, as the player saw them ("Muscle", "Max HP"). */
  label: string;
  from: number | null;
  to: number;
  status: SheetChangeStatus;
  /** The GM's reason for a refusal ('' when none was given). */
  reason: string;
  answeredAt: string | null;
  createdAt: string;
  version: number;
}

const COLUMNS = 'id, campaign_id, actor_id, requester_id, field, label, from_value, to_value, status, reason, answered_at, created_at, version';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

function toSheetChange(row: Record<string, unknown>): SheetChange {
  const status = row.status === 'approved' || row.status === 'refused' || row.status === 'withdrawn' ? row.status : 'waiting';
  return {
    id: text(row.id),
    campaignId: text(row.campaign_id),
    actorId: text(row.actor_id),
    requesterId: typeof row.requester_id === 'string' ? row.requester_id : null,
    field: text(row.field),
    label: text(row.label),
    from: typeof row.from_value === 'number' ? row.from_value : null,
    to: typeof row.to_value === 'number' ? row.to_value : 0,
    status,
    reason: text(row.reason),
    answeredAt: typeof row.answered_at === 'string' ? row.answered_at : null,
    createdAt: text(row.created_at),
    version: typeof row.version === 'number' ? row.version : 1,
  };
}

/**
 * The sheet changes the reader may read, newest first, not undone: a character's (`actorId`), or the campaign's
 * waiting ones for the GM (`waiting`). Null if they couldn't be loaded.
 */
export async function loadSheetChanges(db: Db, campaignId: string, options: { actorId?: string; waiting?: boolean } = {}): Promise<SheetChange[] | null> {
  let query = db.from('sheet_changes').select(COLUMNS).eq('campaign_id', campaignId).eq('undone', false);
  if (options.actorId) query = query.eq('actor_id', options.actorId);
  if (options.waiting) query = query.eq('status', 'waiting');
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
  if (error) return null;
  return (data ?? []).filter(isRecord).map(toSheetChange);
}

/** "Muscle 16 → 17" (the figure before left out when there was none). */
export function changeWords(change: Pick<SheetChange, 'label' | 'from' | 'to'>): string {
  return change.from === null ? `${change.label} ${change.to}` : `${change.label} ${change.from} → ${change.to}`;
}

/**
 * The newest answered change the player hasn't been told of yet, out of two loads of the same character's changes:
 * one that waited before and is approved or refused now. Null when nothing was answered in between.
 */
export function newlyAnswered(before: readonly SheetChange[], now: readonly SheetChange[]): SheetChange | null {
  const waited = new Set(before.filter((c) => c.status === 'waiting').map((c) => c.id));
  return now.find((c) => waited.has(c.id) && (c.status === 'approved' || c.status === 'refused')) ?? null;
}

/** What the player's toast says when the GM answers: "Your GM approved Muscle 17." / "...refused Muscle 17: why." */
export function answerWords(change: SheetChange): string {
  if (change.status === 'approved') return `Your GM approved ${change.label} ${change.to}.`;
  return `Your GM refused ${change.label} ${change.to}${change.reason ? `: ${change.reason}` : '.'}`;
}

async function rpcRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<SheetChange>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toSheetChange(row)) : fromError({ code: '42501', message: '' });
}

/** sheet.requestChange: the character's player asks the GM for a score or Max HP (an approved character). */
export const requestSheetChange = defineCommand({
  name: 'sheet.requestChange',
  log: 'simple',
  target: (input: { character: CharacterRef; field: string; label: string; to: number }) => input.character,
  allowed: (user: CurrentUser, character: CharacterRef) =>
    isMember(user, character.campaignId) && character.ownerType === 'user' && character.ownerUserId === user.id && !character.archived,
  run: (db, _user, input) => rpcRow(db.rpc('request_sheet_change', { actor: input.character.id, field: input.field, label: input.label, to_value: input.to })),
});

/** sheet.takeBackChange: its player takes a waiting change back. */
export const takeBackSheetChange = defineCommand({
  name: 'sheet.takeBackChange',
  log: 'simple',
  target: (input: { change: SheetChange }) => ({ campaignId: input.change.campaignId, requesterId: input.change.requesterId }),
  allowed: (user: CurrentUser, target: { campaignId: string; requesterId: string | null }) => isMember(user, target.campaignId) && target.requesterId === user.id,
  run: (db, _user, input) => rpcRow(db.rpc('take_back_sheet_change', { change: input.change.id, seen_version: input.change.version })),
});

/** sheet.approveChange: the GM approves; the figure goes onto the character in the same change. */
export const approveSheetChange = defineCommand({
  name: 'sheet.approveChange',
  log: 'simple',
  target: (input: { change: SheetChange }) => ({ campaignId: input.change.campaignId }),
  allowed: (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: (db, _user, input) => rpcRow(db.rpc('answer_sheet_change', { change: input.change.id, approve: true, seen_version: input.change.version })),
});

/** sheet.refuseChange: the GM refuses, with a reason the player's line shows (optional). */
export const refuseSheetChange = defineCommand({
  name: 'sheet.refuseChange',
  log: 'simple',
  target: (input: { change: SheetChange; reason: string }) => ({ campaignId: input.change.campaignId }),
  allowed: (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: (db, _user, input) => rpcRow(db.rpc('answer_sheet_change', { change: input.change.id, approve: false, reason: input.reason.trim(), seen_version: input.change.version })),
});

export const SHEET_CHANGE_COMMANDS = [requestSheetChange, takeBackSheetChange, approveSheetChange, refuseSheetChange] as const;
