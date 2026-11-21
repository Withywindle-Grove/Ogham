// Calls to adventure for the GM (dec-12 piece B; ruled mc-61 to mc-64, 2026-11-12; pictures 03-01, 03-02, 03-03,
// 03-03b, 03-10, 03-11, 03-12, 03-14, 03-15 on the branch design-december-mockups): the campaign's adventures, each
// with its hooks (kept as library entries of kind `adventureHook`, the GM's alone), and the sends (public.hook_sends,
// supabase/migrations/20261113210000_dec_12b_calls_to_adventure.sql).
//   * What is left to give: a hook counts as sent once it has one live send ("6 of 17 sent"); an adventure with
//     nothing left says "All sent".
//   * A hook's row: its name; "Pays …"; "From <giver>, at <place>"; and a sent one says to whom and when.
//   * hook.send (logged, Undo marks it undone): to a character or to the party, with the words and pays for this send
//     (the book's, or the GM's own; the pack never changes). A second send to the same hearer is refused in words.
// The words a player is sent reach them only through a send: an unsent hook never leaves the GM's library.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { plainHook, readStoredHook, type StoredHook } from './adventureHooks.ts';
import { plainLinks } from './linkMarks.ts';
import { readRumourTable, type RumourGive, type RumourTable } from './rumours.ts';

/** One adventure attached to the campaign, with its hooks in the pack's order and its rumours tables (piece E). */
export interface Adventure {
  packId: string;
  name: string;
  hooks: StoredHook[];
  rumours: RumourTable[];
}

/** One send of a hook: to a character (`actorId`) or the party (null). */
export interface HookSend {
  id: string;
  campaignId: string;
  packId: string;
  hookId: string;
  actorId: string | null;
  name: string;
  body: string;
  pays: string;
  clockSeconds: number;
  createdAt: string;
}

/** A character a hook can be sent to (a player's character in play). */
export interface Hearer {
  id: string;
  name: string;
  /** Whose character it is, for the list's muted line: the player's name, or "you" for one the GM plays (SC-1). */
  player: string;
}

/** What the GM's calls to adventure read: the adventures, the live sends of hooks and the live gives of rumours. */
export interface Calls {
  adventures: Adventure[];
  sends: HookSend[];
  gives: RumourGive[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const key = (packId: string, hookId: string) => `${packId}/${hookId}`;

/** The live sends of each hook, by pack and hook id. */
function sendsByHook(sends: readonly HookSend[]): Map<string, HookSend[]> {
  const by = new Map<string, HookSend[]>();
  for (const send of sends) by.set(key(send.packId, send.hookId), [...(by.get(key(send.packId, send.hookId)) ?? []), send]);
  return by;
}

/** How many of these adventures' hooks have been sent at least once, of how many. */
export function sentCount(adventures: readonly Adventure[], sends: readonly HookSend[]): { sent: number; of: number } {
  const by = sendsByHook(sends);
  let sent = 0;
  let of = 0;
  for (const adventure of adventures) {
    for (const hook of adventure.hooks) {
      of += 1;
      if ((by.get(key(adventure.packId, hook.id)) ?? []).length > 0) sent += 1;
    }
  }
  return { sent, of };
}

/** "6 of 17 sent", or "All sent" for an adventure with nothing left (frame 2). */
export function sentWords(count: { sent: number; of: number }, allSaid = false): string {
  return allSaid && count.of > 0 && count.sent === count.of ? 'All sent' : `${count.sent} of ${count.of} sent`;
}

/** A hook's sends, oldest first. */
export function sendsOf(sends: readonly HookSend[], packId: string, hookId: string): HookSend[] {
  return sends.filter((s) => s.packId === packId && s.hookId === hookId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const lowerFirst = (words: string) => (words ? words.charAt(0).toLowerCase() + words.slice(1) : words);
const withStop = (words: string) => (/[.!?…]$/.test(words) ? words : `${words}.`);

/** A hook's row's lines under its name (mc-63, picture 03-12's right-hand row): what it pays, then who gives it and where. */
export function hookRowLines(hook: StoredHook): string[] {
  const lines: string[] = [];
  if (hook.pays) lines.push(withStop(`Pays ${lowerFirst(hook.pays)}`));
  if (hook.giver) lines.push(withStop(`From ${hook.giver.name}${hook.giver.place ? `, at ${hook.giver.place}` : ''}`));
  return lines;
}

/** "Sent to the party, day 1" / "Sent to Wren, day 3": to whom and when (frame 2b). */
export function sentLine(send: HookSend, hearers: readonly Hearer[], dayOf: ((seconds: number) => number) | null): string {
  const who = send.actorId === null ? 'the party' : (hearers.find((h) => h.id === send.actorId)?.name ?? 'a character');
  return `Sent to ${who}${dayOf ? `, day ${dayOf(send.clockSeconds)}` : ''}`;
}

/** Whether this hook has a live send to that hearer (a character's id, or null for the party). */
export function alreadySent(sends: readonly HookSend[], packId: string, hookId: string, actorId: string | null): boolean {
  return sends.some((s) => s.packId === packId && s.hookId === hookId && s.actorId === actorId);
}

/** The longest name a sent hook keeps (hook_sends.name). */
export const HOOK_NAME_MAX = 200;

/**
 * Why a hook can't be sent by its name, in the database's words (20261113220000_dec_12b_send_hook_refusals.sql), or
 * null: a name empty once its link marks are words, or over 200 characters. Read on the name as the GM's sheet shows it.
 */
export function hookNameProblem(name: string): string | null {
  // As private.plain_link_text: each mark as its words, then anything still starting "[[<kind>:" dropped.
  const named = plainLinks(name).replace(/\[\[[A-Za-z]+:[^\]\s]*(\]\])?/g, '').trim();
  if (!named) return 'This call to adventure has no name the players can read. It needs fixing in its pack.';
  // In characters, as Postgres's length() counts them: an emoji is one, not two UTF-16 units.
  if ([...named].length > HOOK_NAME_MAX) return `A call to adventure's name is at most ${HOOK_NAME_MAX} characters.`;
  return null;
}

/** The refusal of a second send to the same hearer, in the database's words. */
export function alreadyWords(hearer: string): string {
  return `It wasn't sent again: ${hearer} already has it. Nothing changed.`;
}

type SendRow = {
  id: string;
  campaign_id: string;
  pack_id: string;
  hook_key: string;
  actor_id: string | null;
  name: string;
  body: string;
  pays: string;
  clock_seconds: number | string | null;
  created_at: string;
  undone?: boolean | null;
  /** 'hook', or 'rumour' for a row given by rumour.give (20261114220000_dec_12e_rumours.sql). */
  kind?: string | null;
};

/** A stored send as the app reads it. */
export function toHookSend(row: SendRow): HookSend {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    packId: row.pack_id,
    hookId: row.hook_key,
    actorId: row.actor_id,
    name: row.name,
    body: row.body,
    pays: row.pays ?? '',
    clockSeconds: Number(row.clock_seconds ?? 0),
    createdAt: row.created_at,
  };
}

/**
 * The campaign's adventures with their hooks and rumours tables, and the live sends and gives (the GM's device; a player
 * reads no hook entries and no table). An adventure is an attached pack of kind adventure that has at least one hook or
 * one rumours table. Null if it couldn't be read.
 */
export async function loadCalls(db: Db, campaignId: string): Promise<Calls | null> {
  const links = await db.from('campaign_packs').select('pack_id, priority, packs(name, kind)').eq('campaign_id', campaignId);
  if (links.error) return null;
  const packs = links.data
    .filter((l) => l.packs?.kind === 'adventure')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
    .map((l) => ({ packId: l.pack_id, name: l.packs?.name ?? 'Adventure' }));
  if (packs.length === 0) return { adventures: [], sends: [], gives: [] };
  const packIds = packs.map((p) => p.packId);
  const [entries, tables, sends] = await Promise.all([
    db.from('library_entries').select('pack_id, pack_entry_id, name, data').eq('kind', 'adventureHook').in('pack_id', packIds),
    // An adventure's tables, its rumours tables picked out here (piece E): the GM's alone, as every table is.
    db.from('library_entries').select('pack_id, pack_entry_id, name, data').eq('kind', 'table').in('pack_id', packIds),
    db.from('hook_sends').select('id, campaign_id, pack_id, hook_key, actor_id, name, body, pays, clock_seconds, created_at, undone, kind').eq('campaign_id', campaignId).eq('undone', false),
  ]);
  if (entries.error || tables.error || sends.error) return null;
  const adventures = packs
    .map((pack) => ({
      ...pack,
      hooks: entries.data
        .filter((e) => e.pack_id === pack.packId)
        .map((e) => plainHook(readStoredHook({ packEntryId: e.pack_entry_id, name: e.name, data: e.data })))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
      rumours: tables.data
        .filter((e) => e.pack_id === pack.packId && isObject(e.data))
        .flatMap((e) => readRumourTable(pack.packId, e.pack_entry_id, e.name, e.data as Record<string, unknown>) ?? []),
    }))
    .filter((a) => a.hooks.length > 0 || a.rumours.length > 0);
  const rows = sends.data as SendRow[];
  return {
    adventures,
    sends: rows.filter((row) => (row.kind ?? 'hook') === 'hook').map(toHookSend),
    gives: rows
      .filter((row) => row.kind === 'rumour')
      .map((row) => ({ id: row.id, packId: row.pack_id, key: row.hook_key, actorId: row.actor_id, clockSeconds: Number(row.clock_seconds ?? 0), createdAt: row.created_at })),
  };
}

/**
 * The log line that made this send (its hook.send line on the hook_sends row): what its toast's Undo undoes, so the
 * Undo never reaches a newer send (the review of #741). Null when it can't be found.
 */
export async function sendEventId(db: Db, campaignId: string, sendId: string, type: 'hook.send' | 'rumour.give' = 'hook.send'): Promise<string | null> {
  const { data, error } = await db
    .from('events')
    .select('id, before, seq')
    .eq('campaign_id', campaignId)
    .eq('type', type)
    .eq('target_table', 'hook_sends')
    .eq('target_id', sendId)
    .order('seq', { ascending: true });
  if (error || !data) return null;
  const made = (data as { id: string; before: unknown }[]).find((e) => e.before === null);
  return made?.id ?? null;
}

/**
 * The characters in play a hook can be sent to, by name, each with whose it is: the player's name from the campaign's
 * members, or "you" for a character the reader (the GM) plays, who stays in the list (SC-1, approved by Francis
 * 2026-11-13). Null if they couldn't be read.
 */
export async function loadHearers(db: Db, campaignId: string, userId: string): Promise<Hearer[] | null> {
  const [actors, members] = await Promise.all([
    db.from('actors').select('id, name, kind, approval, status, owner_type, owner_user_id').eq('campaign_id', campaignId),
    db.from('members').select('user_id, profiles!members_user_id_fkey(display_name)').eq('campaign_id', campaignId),
  ]);
  if (actors.error || members.error) return null;
  const rows = (members.data ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[];
  const names = new Map(rows.map((m) => [m.user_id, m.profiles?.display_name?.trim() || 'A player']));
  return actors.data
    .filter((a) => a.kind === 'pc' && a.approval === 'approved' && (a.status ?? 'active') === 'active' && a.owner_type === 'user' && !!a.owner_user_id)
    .map((a) => ({ id: a.id, name: a.name, player: a.owner_user_id === userId ? 'you' : (names.get(a.owner_user_id!) ?? 'A player') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The input to hook.send: the hook, who hears it (null: the party), and the words and pays for this send. */
export interface SendHookInput {
  campaignId: string;
  packId: string;
  hookId: string;
  actorId: string | null;
  body: string;
  pays: string;
}

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** Who hears it? (hook.send): the GM sends a hook to a character or to the party. Logged; Undo marks it undone. */
export const sendHook = defineCommand({
  name: 'hook.send',
  log: 'simple',
  target: (input: SendHookInput) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<HookSend>> => {
    const { data, error } = await db.rpc('send_hook', {
      campaign: input.campaignId,
      pack: input.packId,
      hook_key: input.hookId,
      body: input.body.trim(),
      pays: input.pays.trim(),
      ...(input.actorId ? { to_actor: input.actorId } : {}),
    });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as SendRow | null;
    return row ? ok(toHookSend(row)) : fromError({ message: "That wasn't sent. Try again." });
  },
});

export const CALL_COMMANDS = [sendHook];
