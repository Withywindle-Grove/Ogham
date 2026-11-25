// Requests (M5 step 12; ruled 2026-10-31, Q6 and Q3; 2026-10-30, DG17 and DG18; docs/05 "Requests", "Something
// else…", "Leave the dungeon"; docs/03 the Requests row; supabase/migrations/…_m5_requests.sql): one record and one
// card for every "a player asks, the GM answers" flow. A player sends one for their own character (M5b's buying,
// selling, lodging and secret activities; Describe what you want to do sent them until the M5 gate removed it, A5)
// and may withdraw it while it waits; the GM asks (Leave the dungeon's escape rolls: one per character,
// or one for the party) and answers from Waiting for you, with Undo. Only the GM and the requester read a request
// (everyone, when it's the party's). The answer kinds are a closed set; in M5 only Yes / No has buttons.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { depthModifier, depthWords, type DungeonExit, type RolledExit } from '../expedition/dungeonExit.ts';

export const REQUEST_KINDS = ['describe', 'escapeRoll', 'secretActivity', 'buy', 'sell', 'lodging', 'askGm'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type Direction = 'playerAsks' | 'gmAsks';
export type RequestStatus = 'waiting' | 'answered' | 'withdrawn';
export type AnswerKind = 'yesNo' | 'hitMissChoice' | 'offer';

/** The longest request text the database takes. */
export const REQUEST_TEXT_MAX = 2000;

/**
 * The escape roll's prompt, as the GM asked it: the roll, every switch, the depth worked out (a snapshot of 07's
 * dungeonExit). Only what the player needs: the pack's doom table and safe paths stay on the GM's side.
 */
export interface EscapePrompt {
  roll: NonNullable<DungeonExit['roll']>;
  modifiers: { id: string; name: string; value: number }[];
  /** The depth's part, already worked out for the levels below the first (T3). */
  depth: number;
  levelsDown: number;
}

/** The prompt Leave the dungeon sends, from the pack's rule and the levels down (never the doom table). Pure. */
export function escapePromptOf(rule: RolledExit, levelsDown: number): EscapePrompt {
  return { roll: rule.roll, modifiers: rule.modifiers, depth: depthModifier(rule, levelsDown), levelsDown };
}

/**
 * A secret activity's request (M5b step 3, S4-3): the pack's activity by id (the GM's device reads the secret prompt
 * from the pack: the chance, the result, the table; nothing of it is in the request), the group, who's acting, and
 * what it costs when the GM accepts (points off today's budget, or all that's left; a time cost takes none).
 */
export interface SecretActivityPrompt {
  activityId: string;
  group: number;
  actorIds: string[];
  spend: number | 'all';
}

/** What the GM's Yes costs the group (from the prompt): points off today's budget, or all that's left. */
export type SecretActivityCost = Pick<SecretActivityPrompt, 'spend'>;

export function readSecretActivityPrompt(prompt: Record<string, unknown>): SecretActivityPrompt | null {
  if (typeof prompt.activityId !== 'string' || !prompt.activityId) return null;
  return {
    activityId: prompt.activityId,
    group: Math.max(1, Math.trunc(num(prompt.group, 1))),
    actorIds: Array.isArray(prompt.actorIds) ? prompt.actorIds.filter((id): id is string => typeof id === 'string') : [],
    spend: prompt.spend === 'all' ? 'all' : Math.max(0, Math.trunc(num(prompt.spend))),
  };
}

/** The player's part of an escape roll: what they rolled, and the switches on. */
export interface EscapeEntry {
  roll: number;
  on: string[];
}

/**
 * The GM's answer. Yes / No carries a note (and, in answers given before Describe… was removed at the M5 gate, A5, a
 * cost in turns: read back, never set now); an escape roll its outcome.
 */
export type Answer =
  | { kind: 'yesNo'; yes: boolean; turns: number; note: string }
  | { kind: 'escape'; out: boolean; note: string }
  // Buying (M5b step 6e, ST5): In stock at the pack's price, Not here, or the GM's own price.
  | { kind: 'buy'; result: BuyResult; price: string; note: string }
  // Selling (ST6): the GM's offer, in words until purses.
  | { kind: 'offer'; price: string; note: string }
  // A lodging from the town's list (dt-11, st-3): answered by the database at once, with no GM.
  | { kind: 'stay'; listed: boolean };

export type BuyResult = 'inStock' | 'notHere' | 'price';
export type Reply = 'accept' | 'decline';

export interface Request {
  id: string;
  campaignId: string;
  expeditionId: string | null;
  group: number | null;
  /** The member whose request it is; null for one asked of the whole party. */
  requesterId: string | null;
  actorId: string | null;
  kind: RequestKind;
  direction: Direction;
  text: string;
  costText: string;
  prompt: Record<string, unknown>;
  entry: Record<string, unknown> | null;
  status: RequestStatus;
  answerKind: AnswerKind;
  answer: Answer | null;
  answeredAt: string | null;
  /** The requester's reply to a priced answer (Buy it / Leave it; Accept / Decline); null until then. */
  reply: Reply | null;
  createdAt: string;
  version: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function toAnswer(value: unknown): Answer | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'escape') return { kind: 'escape', out: value.out === true, note: text(value.note) };
  if (value.kind === 'yesNo') return { kind: 'yesNo', yes: value.yes === true, turns: Math.max(0, Math.trunc(num(value.turns))), note: text(value.note) };
  if (value.kind === 'buy') {
    const result: BuyResult = value.result === 'inStock' ? 'inStock' : value.result === 'price' ? 'price' : 'notHere';
    return { kind: 'buy', result, price: result === 'notHere' ? '' : text(value.price), note: text(value.note) };
  }
  if (value.kind === 'offer') return { kind: 'offer', price: text(value.price), note: text(value.note) };
  if (value.kind === 'stay') return { kind: 'stay', listed: value.listed === true };
  return null;
}

export function toRequest(row: Record<string, unknown>): Request {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: typeof row.expedition_id === 'string' ? row.expedition_id : null,
    group: typeof row.group_number === 'number' ? row.group_number : null,
    requesterId: typeof row.requester_id === 'string' ? row.requester_id : null,
    actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
    kind: (REQUEST_KINDS as readonly string[]).includes(String(row.kind)) ? (row.kind as RequestKind) : 'describe',
    direction: row.direction === 'gmAsks' ? 'gmAsks' : 'playerAsks',
    text: text(row.text),
    costText: text(row.cost_text),
    prompt: isRecord(row.prompt) ? row.prompt : {},
    entry: isRecord(row.entry) ? row.entry : null,
    status: row.status === 'answered' ? 'answered' : row.status === 'withdrawn' ? 'withdrawn' : 'waiting',
    answerKind: row.answer_kind === 'offer' ? 'offer' : row.answer_kind === 'hitMissChoice' ? 'hitMissChoice' : 'yesNo',
    answer: toAnswer(row.answer),
    answeredAt: typeof row.answered_at === 'string' ? row.answered_at : null,
    reply: row.reply === 'accept' ? 'accept' : row.reply === 'decline' ? 'decline' : null,
    createdAt: text(row.created_at),
    version: num(row.version, 1),
  };
}

const COLUMNS = 'id, campaign_id, expedition_id, group_number, requester_id, actor_id, kind, direction, text, cost_text, prompt, entry, status, answer_kind, answer, answered_at, reply, created_at, version';

/**
 * The requests the reader may read (the GM every one; a player their own, and the party's), not undone, newest
 * first; `waiting` only those still waiting. Null if they couldn't be loaded.
 */
export async function loadRequests(db: Db, campaignId: string, options: { waiting?: boolean; limit?: number } = {}): Promise<Request[] | null> {
  let query = db.from('requests').select(COLUMNS).eq('campaign_id', campaignId).eq('undone', false);
  if (options.waiting) query = query.eq('status', 'waiting');
  const { data, error } = await query.order('created_at', { ascending: false }).limit(options.limit ?? 50);
  if (error) return null;
  return (data ?? []).map((row) => toRequest(row as Record<string, unknown>));
}

/** The names of the characters requests are for, by id (those the reader may read). */
export async function loadRequestNames(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from('actors').select('id, name').in('id', [...ids]);
  return new Map((data ?? []).map((a) => [String(a.id), String(a.name)]));
}

/**
 * The approved, active hirelings in play by their player (M5 gate C6: a hireling leaves with its employer and shares
 * their escape result; until hirelings carry their employer (04 employerActorId), the player who owns them stands
 * in for it).
 */
export async function loadHirelingsByPlayer(db: Db, campaignId: string): Promise<Map<string, string[]>> {
  const { data } = await db.from('actors').select('name, owner_user_id, approval, status').eq('campaign_id', campaignId).eq('kind', 'hireling');
  const found = new Map<string, string[]>();
  for (const h of data ?? []) {
    if (h.approval !== 'approved' || h.status !== 'active' || !h.owner_user_id) continue;
    found.set(h.owner_user_id, [...(found.get(h.owner_user_id) ?? []), h.name]);
  }
  return found;
}

/**
 * The party's request: asked of the whole party, it has no player and no character (as the database reads it,
 * private.is_party_request). A question to one player whose account was deleted has no player but keeps its
 * character: it stays the GM's.
 */
export function isPartyRequest(r: { requesterId: string | null; direction: Direction; actorId?: string | null }): boolean {
  return r.requesterId === null && r.direction === 'gmAsks' && (r.actorId ?? null) === null;
}

/** A player's own requests, and the party's: those to show on their Scene (waiting first, then answered, newest first). */
export function mine(requests: readonly Request[], userId: string): Request[] {
  const own = requests.filter((r) => r.requesterId === userId || isPartyRequest(r));
  return [...own.filter((r) => r.status === 'waiting'), ...own.filter((r) => r.status === 'answered')];
}

// Escape rolls -----------------------------------------------------------------------------------------------------

export function readEscapePrompt(prompt: Record<string, unknown>): EscapePrompt | null {
  const roll = isRecord(prompt.roll) ? prompt.roll : null;
  const which = roll && typeof roll.save === 'string' ? { save: roll.save } : roll && typeof roll.check === 'string' ? { check: roll.check } : null;
  if (!which) return null;
  return {
    roll: which,
    modifiers: (Array.isArray(prompt.modifiers) ? prompt.modifiers : []).flatMap((m) => (isRecord(m) && typeof m.id === 'string' ? [{ id: m.id, name: text(m.name) || m.id, value: Math.trunc(num(m.value)) }] : [])),
    depth: Math.trunc(num(prompt.depth)),
    levelsDown: Math.max(0, Math.trunc(num(prompt.levelsDown))),
  };
}

export function readEscapeEntry(entry: Record<string, unknown> | null): EscapeEntry | null {
  if (!entry || typeof entry.roll !== 'number' || !Number.isInteger(entry.roll)) return null;
  return { roll: entry.roll, on: Array.isArray(entry.on) ? entry.on.filter((id): id is string => typeof id === 'string') : [] };
}

/** The roll with the switches on and the depth counted: "14 + 2 (Has a map) − 1 (depth) = 15". Pure. */
export function escapeTotal(prompt: EscapePrompt, entry: EscapeEntry): { total: number; parts: string[] } {
  const parts: string[] = [];
  let total = entry.roll;
  for (const m of prompt.modifiers) {
    if (!entry.on.includes(m.id)) continue;
    total += m.value;
    parts.push(`${signed(m.value)} (${m.name})`);
  }
  if (prompt.depth !== 0) {
    total += prompt.depth;
    parts.push(`${signed(prompt.depth)} (${depthWords(prompt.levelsDown)})`);
  }
  return { total, parts };
}

export const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** What an escape roll asks for, in words: "Save: breath" or "Check: climbing". */
export const escapeRollWords = (prompt: EscapePrompt) => ('save' in prompt.roll ? `Save: ${prompt.roll.save}` : `Check: ${prompt.roll.check}`);

/** The answer in the player's words. */
export function answerWords(request: Request): string {
  const a = request.answer;
  if (!a) return '';
  if (a.kind === 'escape') return a.out ? 'Out safely' : 'Lost below';
  if (a.kind === 'buy') return a.result === 'notHere' ? 'Not here' : a.result === 'inStock' ? `In stock: ${a.price}` : a.price;
  if (a.kind === 'offer') return `Offers ${a.price}`;
  if (a.kind === 'stay') return 'Staying';
  if (request.kind === 'lodging') return a.yes ? `Yes, you can stay${request.costText ? `, ${request.costText}` : ''}` : 'Not available';
  if (!a.yes) return 'No';
  return a.turns > 0 ? `Yes, ${a.turns} ${a.turns === 1 ? 'turn' : 'turns'}` : 'Yes';
}

// Commands ---------------------------------------------------------------------------------------------------------

async function rpcRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<Request>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toRequest(row)) : fromError({ code: '42501', message: '' });
}

/** The character a player asks for: theirs (its owner), in this campaign. */
export interface AskingCharacter {
  id: string;
  campaignId: string;
  ownerUserId: string | null;
}

/** Send to the GM (request.send): a player's own character asks. */
export const sendRequest = defineCommand({
  name: 'request.send',
  log: 'simple',
  target: (input: { character: AskingCharacter; kind: RequestKind; text: string; costText?: string; prompt?: Record<string, unknown> }) => ({
    campaignId: input.character.campaignId,
    ownerUserId: input.character.ownerUserId,
  }),
  allowed: (user: CurrentUser, target: { campaignId: string; ownerUserId: string | null }) => isMember(user, target.campaignId) && target.ownerUserId === user.id,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('send_request', {
        campaign: input.character.campaignId,
        actor: input.character.id,
        kind: input.kind,
        body: input.text.trim(),
        cost_text: input.costText ?? '',
        prompt: (input.prompt ?? {}) as Json,
      }),
    ),
});

/** Cancel (request.withdraw): the requester takes it back while it waits. */
export const withdrawRequest = defineCommand({
  name: 'request.withdraw',
  log: 'simple',
  target: (input: { request: Request }) => ({ campaignId: input.request.campaignId, requesterId: input.request.requesterId, direction: input.request.direction }),
  // A player takes back their own ask; the GM takes back what the GM asked (an escape roll). The database agrees.
  allowed: (user: CurrentUser, target: { campaignId: string; requesterId: string | null; direction: Direction }) =>
    isMember(user, target.campaignId) && (target.direction === 'gmAsks' ? isGm(user, target.campaignId) : target.requesterId === user.id),
  run: (db, _user, input) => rpcRow(db.rpc('withdraw_request', { request: input.request.id, seen_version: input.request.version })),
});

/**
 * Enter roll (request.enter): the player's part of what the GM asked (the party's, anyone in it); or the GM's "Enter
 * for <name>" for a player without a device (M5 gate C7, ruled 2026-11-01), logged as the GM's. Verbose.
 */
export const enterRequest = defineCommand({
  name: 'request.enter',
  log: 'verbose',
  target: (input: { request: Request; entry: EscapeEntry }) => ({ campaignId: input.request.campaignId, requesterId: input.request.requesterId, direction: input.request.direction, actorId: input.request.actorId }),
  allowed: (user: CurrentUser, target: { campaignId: string; requesterId: string | null; direction?: Direction; actorId?: string | null }) =>
    isMember(user, target.campaignId) &&
    (isGm(user, target.campaignId)
      ? target.direction === 'gmAsks'
      : target.requesterId === user.id || isPartyRequest({ ...target, direction: target.direction ?? 'gmAsks' })),
  run: (db, _user, input) => rpcRow(db.rpc('enter_request', { request: input.request.id, entry: input.entry as unknown as Json, seen_version: input.request.version })),
});

/**
 * The GM's answer (request.answer): Yes / No with a Describe…'s cost in turns and a note, or an escape roll's outcome
 * (Send). With `costSeconds` the clock moves on by that much in the same request (one advance; Undo puts both back).
 */
export const answerRequest = defineCommand({
  name: 'request.answer',
  log: 'simple',
  target: (input: { request: Request; answer: Answer; costText?: string; costSeconds?: number; activity?: SecretActivityCost }) => ({ campaignId: input.request.campaignId }),
  allowed: (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: (db, _user, input) =>
    input.activity
      ? rpcRow(
          db.rpc('answer_secret_activity', {
            request: input.request.id,
            answer: input.answer as unknown as Json,
            spend: input.activity.spend === 'all' ? 0 : input.activity.spend,
            all_left: input.activity.spend === 'all',
            seen_version: input.request.version,
          }),
        )
      : rpcRow(
      db.rpc('answer_request', {
        request: input.request.id,
        answer: input.answer as unknown as Json,
        ...(input.costText !== undefined ? { cost_text: input.costText } : {}),
        ...(input.costSeconds && input.costSeconds > 0 ? { cost_seconds: input.costSeconds } : {}),
        seen_version: input.request.version,
      }),
    ),
});

/** Leave the dungeon (request.ask): the GM asks each character in play, or the party as one, per `who`. */
export const askRequests = defineCommand({
  name: 'request.ask',
  log: 'simple',
  target: (input: { campaignId: string; kind: RequestKind; who: 'each' | 'party'; prompt: Record<string, unknown>; text?: string }) => ({ campaignId: input.campaignId }),
  allowed: (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<Request[]>> => {
    const { data, error } = await db.rpc('ask_requests', { campaign: input.campaignId, kind: input.kind, who: input.who, prompt: input.prompt as Json, body: input.text ?? '' });
    if (error) return fromError(error);
    return ok((Array.isArray(data) ? data : []).filter(isRecord).map(toRequest));
  },
});

export const REQUEST_COMMANDS = [sendRequest, withdrawRequest, enterRequest, answerRequest, askRequests] as const;
