// Camp as the campaign keeps it (M5b step 4, build orders 1–4; ruled 2026-10-30, D5, D13–D17; docs/05 Camp;
// supabase/migrations/…_m5b_4_camp.sql). The engine (camp.ts) reads the pack's camp and the record; this file holds
// the rows and the commands, each an intent with a request id:
//   camp.open  the group makes camp for the evening (the GM, or a player of the group); a quick camp is one tap;
//   camp.fuel  firewood from a character's pack onto the campfire (lights it when it's out);
//   camp.cook  the cook's ingredients into portions in the pot;
//   camp.talk  campfire talk: it worked or it didn't;
//   camp.eat   a character eats: a portion from the pot, or food from their own pack.
// The GM writes for anyone; a player for their own characters, from their own pack (the database checks it too).
// Give food is the inventory's own move (inventory.move): from the giver's pack to the hungry character's.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import type { CampEntry, CampEntryKind } from './camp.ts';
import type { GroupTarget } from './travelPlay.ts';
import type { FoodKind } from './wildPack.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export interface CampRow {
  id: string;
  campaignId: string;
  expeditionId: string;
  group: number;
  /** The expedition's day whose evening it is (0 the first). */
  day: number;
  quick: boolean;
  fireTypeId: string | null;
  fireName: string | null;
  fuelItem: string | null;
  /** When Next day applied it (the clock); null while it's open. */
  appliedAt: number | null;
  createdBy: string | null;
  /** When it was made (the database's time), for the night check's "after the camp was made". */
  createdAt?: string;
}

export function toCampRow(row: Record<string, unknown>): CampRow {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: String(row.expedition_id),
    group: num(row.group_number, 1),
    day: num(row.day),
    quick: row.quick === true,
    fireTypeId: str(row.fire_type_id),
    fireName: str(row.fire_name),
    fuelItem: str(row.fuel_item),
    appliedAt: typeof row.applied_at === 'number' ? row.applied_at : null,
    createdBy: str(row.created_by),
    createdAt: String(row.created_at ?? ''),
  };
}

const KINDS: readonly CampEntryKind[] = ['fuel', 'cook', 'talk', 'meal', 'watches', 'sleep'];
const FOODS: readonly FoodKind[] = ['cooked', 'fresh', 'preserved'];

export function toCampEntry(row: Record<string, unknown>): CampEntry {
  const raw = Array.isArray(row.detail) ? row.detail : [];
  const detail = raw.filter(isRecord).map((d) => ({ name: String(d.name ?? ''), qty: num(d.qty), difficulty: str(d.difficulty), roll: str(d.roll) }));
  const watches = raw.filter(Array.isArray).map((w) => (w as unknown[]).map(String));
  return {
    id: String(row.id),
    campId: String(row.camp_id),
    kind: KINDS.find((k) => k === row.kind) ?? 'meal',
    actorId: String(row.actor_id),
    qty: num(row.qty),
    seconds: num(row.seconds),
    at: num(row.at),
    lineId: str(row.line_id),
    foodName: str(row.food_name),
    foodKind: FOODS.find((k) => k === row.food_kind) ?? null,
    fromPot: row.from_pot === true,
    outcome: row.outcome === 'worked' || row.outcome === 'failed' || row.outcome === 'good' || row.outcome === 'bad' ? row.outcome : null,
    detail,
    watches,
    createdBy: str(row.created_by),
    createdAt: String(row.created_at ?? ''),
  };
}

/** Each group's camp for one evening of the expedition (those the reader may read), with what was done in it, by group. */
export async function loadCamps(db: Db, campaignId: string, expeditionId: string, day: number): Promise<Map<number, { camp: CampRow; entries: CampEntry[] }> | null> {
  const found = await loadCampsWhere(db, campaignId, expeditionId, { day });
  return found ? new Map(found.map((c) => [c.camp.group, c])) : null;
}

/** The expedition's camps Next day hasn't applied yet (any evening), with their entries; null when unreadable. */
export const loadOpenCamps = (db: Db, campaignId: string, expeditionId: string) => loadCampsWhere(db, campaignId, expeditionId, { open: true });

async function loadCampsWhere(db: Db, campaignId: string, expeditionId: string, where: { day?: number; open?: boolean }): Promise<{ camp: CampRow; entries: CampEntry[] }[] | null> {
  let query = db.from('camps').select('*').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false);
  if (where.day !== undefined) query = query.eq('day', where.day);
  if (where.open) query = query.is('applied_at', null);
  const camps = await query;
  if (camps.error) return null;
  const rows = (camps.data ?? []).map((r) => toCampRow(r as Record<string, unknown>));
  if (rows.length === 0) return [];
  const entries = await db.from('camp_entries').select('*').in('camp_id', rows.map((r) => r.id)).eq('undone', false).order('created_at');
  if (entries.error) return null;
  const all = (entries.data ?? []).map((e) => toCampEntry(e as Record<string, unknown>));
  return rows.map((camp) => ({ camp, entries: all.filter((e) => e.campId === camp.id) }));
}

/** Which of these characters cast (D18's warning): their class (actors.classes[].classRef) is one of `casterClasses`. */
export async function loadCasters(db: Db, ids: readonly string[], casterClasses: ReadonlySet<string>): Promise<Set<string>> {
  if (ids.length === 0 || casterClasses.size === 0) return new Set();
  const { data, error } = await db.from('actors').select('id, classes').in('id', [...ids]);
  if (error || !data) return new Set();
  const refs = (c: unknown) => (Array.isArray(c) ? c.filter(isRecord).flatMap((x) => (typeof x.classRef === 'string' ? [x.classRef] : [])) : []);
  return new Set((data as { id: string; classes: unknown }[]).filter((a) => refs(a.classes).some((r) => casterClasses.has(r))).map((a) => a.id));
}

async function rpcRow<T>(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, as: (row: Record<string, unknown>) => T): Promise<CommandResult<T>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) && typeof row.id === 'string' ? ok(as(row)) : fromError({ code: '42501', message: '' });
}

/**
 * Why Make camp is blocked now, as the pop-up says it, or null when camp may be made (plan scene-point-to-point B18;
 * p2p-23): never while an encounter waits, never at a Location the pack marks "no camp here" (`noCampAt`, the place's
 * name). The waiting encounter is said first: it is what the GM can clear where they stand. The pop-up is the whole
 * rule for now: the database refuses no camp (the plan's ⚑ 7, ruled 2026-11-18).
 * `unread` (the review of #1020): what the app has not read is not "nothing". While what waits, or where the party
 * is, is still being read ('reading') or could not be read ('failed'), camp is blocked too, in its own words; a reason
 * known for sure is still said before it.
 */
export function whyNoCamp(at: { encountersWaiting: number; noCampAt: string | null; unread?: 'reading' | 'failed' | null }): { title: string; words: string } | null {
  const title = 'Make camp';
  if (at.encountersWaiting === 1) return { title, words: 'An encounter is waiting. Start it or dismiss it under Waiting for you, then make camp.' };
  if (at.encountersWaiting > 1) return { title, words: `${at.encountersWaiting} encounters are waiting. Start or dismiss them under Waiting for you, then make camp.` };
  if (at.noCampAt !== null) return { title, words: `The adventure pack says there is no camp at ${at.noCampAt || 'this Location'}. Move on, then make camp.` };
  if (at.unread === 'failed') return { title, words: "Couldn't read what is waiting here. Check your connection and try again." };
  if (at.unread === 'reading') return { title, words: 'Still reading what is waiting here. Try again in a moment.' };
  return null;
}

/** Who may make camp for a group: the GM, or a member whose character is in it. */
export const mayMakeCamp = (user: CurrentUser, target: GroupTarget): boolean =>
  isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.mine);

/** A character acting in camp: the GM for anyone, a player for their own. */
export interface CampActor {
  campaignId: string;
  id: string;
  ownerUserId: string | null;
}

export const mayActInCamp = (user: CurrentUser, actor: CampActor): boolean =>
  isGm(user, actor.campaignId) || (isMember(user, actor.campaignId) && actor.ownerUserId === user.id);

/** Make camp (D13): the evening's camp for the group, with the pack's campfire; a quick camp is the whole of it. */
export const openCamp = defineCommand({
  name: 'camp.open',
  log: 'simple',
  target: (input: { target: GroupTarget; day: number; quick?: boolean; fire?: { typeId: string; name: string; fuelItem: string | null } | null }) => input.target,
  allowed: mayMakeCamp,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('open_camp', {
        campaign: input.target.campaignId,
        group_no: input.target.group,
        day: input.day,
        quick: input.quick ?? false,
        fire_type_id: input.fire?.typeId ?? undefined,
        fire_name: input.fire?.name ?? undefined,
        fuel_item: input.fire?.fuelItem ?? undefined,
      }),
      toCampRow,
    ),
});

/** Add firewood from packs (D16): bundles from one line of a character's pack, each burning the light type's length. */
export const addCampFuel = defineCommand({
  name: 'camp.fuel',
  log: 'simple',
  target: (input: { campId: string; actor: CampActor; lineId: string; qty: number; secondsEach: number }) => input.actor,
  allowed: mayActInCamp,
  run: (db, _user, input) => rpcRow(db.rpc('add_camp_fuel', { camp: input.campId, actor: input.actor.id, line: input.lineId, qty: input.qty, seconds_each: input.secondsEach }), toCampEntry),
});

/** Cook (D15): ingredients from the cook's pack become portions in the pot. */
export const cookAtCamp = defineCommand({
  name: 'camp.cook',
  log: 'simple',
  target: (input: { campId: string; actor: CampActor; ingredients: { lineId: string; qty: number }[]; portions: number }) => input.actor,
  allowed: mayActInCamp,
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('cook_at_camp', {
        camp: input.campId,
        cook: input.actor.id,
        ingredients: input.ingredients.map((i) => ({ line: i.lineId, qty: i.qty })) as unknown as Json,
        portions: input.portions,
      }),
      toCampEntry,
    ),
});

/** Campfire talk (D17): it worked, or it didn't. */
export const campTalk = defineCommand({
  name: 'camp.talk',
  log: 'simple',
  target: (input: { campId: string; actor: CampActor; outcome: 'worked' | 'failed' }) => input.actor,
  allowed: mayActInCamp,
  run: (db, _user, input) => rpcRow(db.rpc('camp_talk', { camp: input.campId, actor: input.actor.id, outcome: input.outcome }), toCampEntry),
});

/** Eat (D14): a portion from the pot, or one of a food line from the character's own pack. Once per camp. */
export const eatAtCamp = defineCommand({
  name: 'camp.eat',
  log: 'verbose',
  target: (input: { campId: string; actor: CampActor; fromPot: boolean; lineId?: string | null }) => input.actor,
  allowed: mayActInCamp,
  run: (db, _user, input) => rpcRow(db.rpc('eat_at_camp', { camp: input.campId, actor: input.actor.id, from_pot: input.fromPot, line: input.lineId ?? undefined }), toCampEntry),
});

/** Set the watches (D18): the group's order, each watch 1–3 of its characters. `actor` is who set it. */
export const setCampWatches = defineCommand({
  name: 'camp.watches',
  log: 'simple',
  target: (input: { campId: string; actor: CampActor; watches: string[][] }) => input.actor,
  allowed: mayActInCamp,
  run: (db, _user, input) => rpcRow(db.rpc('set_camp_watches', { camp: input.campId, actor: input.actor.id, watches: input.watches as unknown as Json }), toCampEntry),
});

/** Sleep (D19): a character's roll and how they slept; the GM may change the difficulty. */
export const campSleep = defineCommand({
  name: 'camp.sleep',
  log: 'verbose',
  target: (input: { campId: string; actor: CampActor; difficulty?: string | null; roll?: string | null; outcome?: 'good' | 'bad' | null }) => ({ ...input.actor, setsDifficulty: !!input.difficulty }),
  allowed: (user, target: CampActor & { setsDifficulty: boolean }) => mayActInCamp(user, target) && (!target.setsDifficulty || isGm(user, target.campaignId)),
  run: (db, _user, input) =>
    rpcRow(
      db.rpc('camp_sleep', { camp: input.campId, actor: input.actor.id, difficulty: input.difficulty ?? undefined, roll: input.roll ?? undefined, outcome: input.outcome ?? undefined }),
      toCampEntry,
    ),
});

/**
 * Apply tonight's camps (D20). Next day sends them with the clock's move instead (play.ts `camps`), so the move's
 * one Undo takes them back; this command is the same apply on its own (the GM's).
 */
export const applyCamps = defineCommand({
  name: 'camp.apply',
  log: 'simple',
  target: (input: { campaignId: string; camps: string[] }) => ({ campaignId: input.campaignId }),
  allowed: (user, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: async (db, _user, input) => {
    const { data, error } = await db.rpc('apply_camps', { campaign: input.campaignId, camps: input.camps });
    if (error) return fromError(error);
    return ok((Array.isArray(data) ? data : []).filter(isRecord).map(toCampRow));
  },
});

export const CAMP_COMMANDS = [openCamp, addCampFuel, cookAtCamp, campTalk, eatAtCamp, setCampWatches, campSleep, applyCamps] as const;
