// Inventory (M4, docs/04-data-model.md "Inventory and encumbrance"; docs/05-features.md). Each line is on one
// carrier: a character, or the campaign's Party stash. A line keeps its own copy of the item: its name, category,
// weight, slots and stack, and its details (everything a player may see of the entry: slot, hands, armour type,
// weapon tags, container, notes, properties, source…), so updating or deleting setting rules never takes items
// off a sheet. For an item from the setting rules the database fills the copy in itself, never from the device,
// and never the hidden fields. `libraryEntryId` and the source pack and entry id only point back to where it
// came from (no link the database would cascade), for looking details up or refreshing them later.
// Who may change what (docs/03-roles-permissions.md): the GM anything; a player their own characters' lines;
// any member the Party stash's; and anyone who may take an item off a carrier may hand it to another carrier
// in the same campaign.
// Shared live (M5 step 4): each line has a version. A change made from the person's copy names the version it saw,
// and the database refuses it if the line has changed since (a "stale" result: show the latest). A command tried
// again with the same request id changes nothing twice (supabase/migrations/…_m5_intents.sql).
import {
  defineCommand,
  failed,
  fromError,
  fromWrite,
  isGm,
  isMember,
  notAllowed,
  ok,
  requestIdOf,
  stale,
  type CommandResult,
  type CurrentUser,
} from '../../core/commands.ts';
import { encumbranceModeOf, rechargeDefaultOf, type EncumbranceMode } from '../../core/campaignSettings.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';

/** Where items are carried: a character, or the Party stash (a location). */
export interface CarrierRef {
  campaignId: string;
  actorId: string | null;
  locationId: string | null;
  /** The character's player; null for the stash or a character a player doesn't own. */
  ownerUserId: string | null;
  /** A character removed from play: only the GM changes what it carries. */
  archived: boolean;
}

/** A line on its carrier, as the permission rules see it. */
export interface LineRef {
  id: string;
  carrier: CarrierRef;
  /**
   * The version of the line the person's copy shows: a change made from that copy is refused if the line has
   * changed since. Left out for a change that doesn't depend on the copy (an Undo toast's quick reversal).
   */
  version?: number;
}

export type HowGot = 'bought' | 'found' | 'given';

/** What an item is, copied onto the line when it's added. */
export interface ItemCopy {
  libraryEntryId: string | null;
  name: string;
  category: string;
  weightCoin: number | null;
  slots: number | null;
  stack: number;
  /** The item's other details (a one-off's notes, say); from the setting rules, the database fills these in. */
  details?: Record<string, unknown>;
}

export interface InventoryLine extends ItemCopy {
  id: string;
  details: Record<string, unknown>;
  /** Where it came from: the pack and the entry's id in it (null for a one-off). */
  sourcePackId: string | null;
  sourceEntryId: string | null;
  /** Visible charges left (null: none, not set yet, or hidden). */
  chargesLeft: number | null;
  /** Hidden charges: the total is the GM's; the line counts the uses. */
  chargesHidden: boolean;
  chargesUsed: number;
  /** The GM has told the holder a hidden-charge item is spent. */
  spentShown: boolean;
  /** Pinned to At hand on the character's Player screen. */
  pinned: boolean;
  /** Hidden from At hand by its player, though it would show there by itself. */
  atHandHidden: boolean;
  /** A player's one-off waits for the GM ("pending") and counts for nothing until approved. */
  approval: 'approved' | 'pending';
  /** How many units the weight is for (a bundle's: "Torches (6)" weighs its weight per 6). */
  perUnits: number;
  /** Raised by the database on every change; sent back with a change so a save from an old copy is refused. */
  version: number;
  /**
   * Magic armour whose base is picked when it's found (07, `armour.baseArmour: { choose }`; ruled 2026-10-29): the
   * chosen base armour's item id, or null until it's chosen.
   */
  baseArmourId: string | null;
  /** A holder (a lantern) that burnt out and needs fuel before it's lit again (M5 step 7 fix); false for most. */
  needsFuel?: boolean;
  /** A holder's fuel left in it (seconds) while it isn't the light burning; null when full (or not a holder). */
  fuelLeftSeconds?: number | null;
  /**
   * A weapon's chosen mode (ah-3; Design on #569, 2026-11-09: a shared game fact, logged): one of its `weapon.modes`
   * ids, or null for a fresh weapon (its default: the first mode it can use; round 3). A spent mode stays stored.
   */
  modeId?: string | null;
  campaignId: string;
  actorId: string | null;
  locationId: string | null;
  qty: number;
  containerLineId: string | null;
  equipped: boolean;
  howGot: HowGot;
  cost: string;
  notes: string;
}

const COLUMNS =
  'id, campaign_id, actor_id, location_id, library_entry_id, name, category, weight_coin, slots, stack, qty, container_line_id, equipped, how_got, cost, notes, item_data, source_pack_id, source_entry_id, charges_left, charges_hidden, charges_used, spent_shown, pinned, at_hand_hidden, approval, per_units, version, base_armour_id, needs_fuel, fuel_left_seconds, mode_id';

type LineRow = {
  id: string;
  campaign_id: string;
  actor_id: string | null;
  location_id: string | null;
  library_entry_id: string | null;
  name: string;
  category: string;
  weight_coin: number | null;
  slots: number | null;
  stack: number;
  qty: number;
  container_line_id: string | null;
  equipped: boolean;
  how_got: string;
  cost: string;
  notes: string;
  item_data: unknown;
  source_pack_id: string | null;
  source_entry_id: string | null;
  charges_left: number | null;
  charges_hidden: boolean;
  charges_used: number;
  spent_shown: boolean;
  pinned: boolean;
  at_hand_hidden: boolean;
  approval: string;
  per_units: number;
  version: number;
  base_armour_id?: string | null;
  needs_fuel?: boolean;
  fuel_left_seconds?: number | null;
  mode_id?: string | null;
};

function toLine(row: LineRow): InventoryLine {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    actorId: row.actor_id,
    locationId: row.location_id,
    libraryEntryId: row.library_entry_id,
    name: row.name,
    category: row.category,
    weightCoin: row.weight_coin,
    slots: row.slots,
    stack: row.stack,
    qty: row.qty,
    containerLineId: row.container_line_id,
    equipped: row.equipped,
    howGot: row.how_got as HowGot,
    cost: row.cost,
    notes: row.notes,
    details: row.item_data && typeof row.item_data === 'object' && !Array.isArray(row.item_data) ? (row.item_data as Record<string, unknown>) : {},
    sourcePackId: row.source_pack_id,
    sourceEntryId: row.source_entry_id,
    chargesLeft: row.charges_left,
    chargesHidden: row.charges_hidden,
    chargesUsed: row.charges_used,
    spentShown: row.spent_shown,
    pinned: row.pinned,
    atHandHidden: row.at_hand_hidden,
    approval: row.approval === 'pending' ? 'pending' : 'approved',
    perUnits: row.per_units,
    version: row.version,
    baseArmourId: row.base_armour_id ?? null,
    needsFuel: row.needs_fuel === true,
    fuelLeftSeconds: typeof row.fuel_left_seconds === 'number' ? row.fuel_left_seconds : null,
    modeId: typeof row.mode_id === 'string' ? row.mode_id : null,
  };
}

/** May this person put items on, or take items off, this carrier? */
export function mayChangeCarrier(user: CurrentUser, carrier: CarrierRef): boolean {
  if (isGm(user, carrier.campaignId)) return true;
  if (!isMember(user, carrier.campaignId)) return false;
  if (carrier.locationId !== null) return true;
  return carrier.ownerUserId === user.id && !carrier.archived;
}

/** May this person hand an item to this carrier? Any carrier in their campaign (a gift needs no yes). */
function mayReceive(user: CurrentUser, from: CarrierRef, to: CarrierRef): boolean {
  return to.campaignId === from.campaignId && isMember(user, to.campaignId) && (isGm(user, to.campaignId) || !to.archived);
}

const carrierColumns = (carrier: CarrierRef) => ({ actor_id: carrier.actorId, location_id: carrier.locationId });
const isWholeCount = (n: number) => Number.isInteger(n) && n > 0;

/** The version the person's copy showed, sent with a change (nothing when the change doesn't depend on the copy). */
const seen = (line: { version?: number }) => (line.version !== undefined ? { version: line.version } : {});

/**
 * Why a change or removal touched no line: this same request removed it already (a retry after a lost answer:
 * fine), the line changed or went since (stale), or the access rules refused it.
 */
async function noLineWhy(db: Db, lineId: string, requestId: string, version?: number): Promise<CommandResult<null>> {
  const done = await db.from('events').select('id').eq('request_id', requestId).eq('target_id', lineId).is('after', null).limit(1);
  if (!done.error && done.data.length > 0) return ok(null);
  const now = await db.from('inventory_lines').select('version').eq('id', lineId).maybeSingle();
  if (now.error) return fromError(now.error);
  if (now.data !== null) return version !== undefined && now.data.version !== version ? stale() : notAllowed();
  // Gone: removed since (a removal this person can see in the log), or never theirs to see.
  const removed = await db.from('events').select('id').eq('target_id', lineId).is('after', null).limit(1);
  return !removed.error && removed.data.length > 0 ? stale() : notAllowed();
}

/** A change to one line, made from the person's copy (its version); a line that went since is stale. */
export async function changeLine<T>(
  db: Db,
  line: { id: string; version?: number },
  patch: Record<string, unknown>,
  columns: string,
  requestId: string,
): Promise<CommandResult<T>> {
  const saved = fromWrite(await db.from('inventory_lines').update({ ...patch, ...seen(line) }).eq('id', line.id).select(columns));
  if (saved.ok || saved.reason !== 'not-allowed') return saved as CommandResult<T>;
  const why = await noLineWhy(db, line.id, requestId);
  return why.ok ? notAllowed() : why;
}

/** Removes a line, but only as the person's copy had it; the same request removing it already is fine. */
async function removeLine(db: Db, line: { id: string; version?: number }, requestId: string): Promise<CommandResult<null>> {
  let query = db.from('inventory_lines').delete().eq('id', line.id);
  if (line.version !== undefined) query = query.eq('version', line.version);
  const gone = await query.select('id');
  if (gone.error) return fromError(gone.error);
  return gone.data.length > 0 ? ok(null) : noLineWhy(db, line.id, requestId, line.version);
}

/** Add an item to a carrier: from the setting rules (a copy of it) or a one-off. How it was got is kept. */
export const addItem = defineCommand({
  name: 'inventory.add',
  target: (input: {
    carrier: CarrierRef;
    item: ItemCopy;
    qty: number;
    howGot: HowGot;
    cost?: string;
    containerLineId?: string | null;
    equipped?: boolean;
    /** The setting rules hide this item's charges (its total will be the GM's). */
    chargesHidden?: boolean;
    /** The GM's note on something given ("From the drowned shrine"). */
    note?: string;
    /** Magic armour's base, picked as it's added (one of its armour.baseArmour.choose); left out to choose later. */
    baseArmourId?: string | null;
  }) =>
    input.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<InventoryLine>> => {
    if (!isWholeCount(input.qty)) return failed('How many must be a whole number, 1 or more.');
    const name = input.item.name.trim();
    if (!name) return failed('The item needs a name.');
    // The new line's id is the request's, so a retry of the same add finds the line it made instead of a second one.
    const lineId = requestIdOf(meta);
    const inserted = await db
        .from('inventory_lines')
        .insert({
          id: lineId,
          campaign_id: input.carrier.campaignId,
          ...carrierColumns(input.carrier),
          library_entry_id: input.item.libraryEntryId,
          name,
          category: input.item.category,
          weight_coin: input.item.weightCoin,
          slots: input.item.slots,
          stack: input.item.stack,
          item_data: (input.item.details ?? {}) as Json,
          qty: input.qty,
          container_line_id: input.containerLineId ?? null,
          equipped: input.equipped ?? false,
          charges_hidden: input.chargesHidden ?? false,
          how_got: input.howGot,
          cost: input.howGot === 'bought' ? (input.cost ?? '').trim() : '',
          notes: (input.note ?? '').trim(),
          ...(input.baseArmourId ? { base_armour_id: input.baseArmourId } : {}),
        })
        .select(COLUMNS);
    if (inserted.error?.code === '23505') {
      const made = fromWrite(await db.from('inventory_lines').select(COLUMNS).eq('id', lineId));
      return made.ok ? ok(toLine(made.value as unknown as LineRow)) : made;
    }
    const saved = fromWrite(inserted);
    return saved.ok ? ok(toLine(saved.value as LineRow)) : saved;
  },
});

/** Take some or all of a line away (used up, lost, sold). Taking all of it removes the line. */
export const removeItem = defineCommand({
  name: 'inventory.remove',
  target: (input: { line: LineRef; qty: number; of: number }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!isWholeCount(input.qty)) return failed('How many must be a whole number, 1 or more.');
    if (input.qty < input.of) {
      const left = await changeLine<{ qty: number }>(db, input.line, { qty: input.of - input.qty }, 'qty', requestIdOf(meta));
      return left.ok ? ok(left.value.qty) : left;
    }
    const gone = await removeLine(db, input.line, requestIdOf(meta));
    return gone.ok ? ok(0) : gone;
  },
});

/**
 * Use one up (Design on #552, 2026-11-07): Fire, Drink, Eat or Use from At hand counts the item down by one, logged as
 * what happened ("Wren drank a Moss draught, 1 left"), with Undo. The last one leaves play and the log keeps a copy
 * (hard rule 4, "used up"); Undo puts it back (public.undoable_deletions lists item.use). `verb` is the row's word,
 * kept on the request for the log's words; the database only counts down or deletes, as Drop does.
 * `keepModeOf` (ah-3; Design on #569, round 3): a weapon whose fresh default mode this use spent the last of; that mode
 * is stored on the weapon in the same request, after the use, so it stays disengaged ("nothing chosen") instead of
 * sliding on to the next kind; one log line, and one Undo brings back both the stack and the fresh weapon.
 */
export const useItem = defineCommand({
  name: 'item.use',
  log: 'simple',
  target: (input: { line: LineRef; of: number; verb: 'Fire' | 'Drink' | 'Eat' | 'Use'; keepModeOf?: { id: string; modeId: string } }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!isWholeCount(input.of)) return failed('How many must be a whole number, 1 or more.');
    let left: number;
    if (input.of > 1) {
      const counted = await changeLine<{ qty: number }>(db, input.line, { qty: input.of - 1 }, 'qty', requestIdOf(meta));
      if (!counted.ok) return counted;
      left = counted.value.qty;
    } else {
      const gone = await removeLine(db, input.line, requestIdOf(meta));
      if (!gone.ok) return gone;
      left = 0;
    }
    if (input.keepModeOf) {
      const kept = await changeLine<{ mode_id: string | null }>(db, { id: input.keepModeOf.id }, { mode_id: input.keepModeOf.modeId }, 'mode_id', requestIdOf(meta));
      if (!kept.ok) return kept;
    }
    return ok(left);
  },
});

/**
 * Choose a weapon's mode (ah-3; Design on #569, 2026-11-09: a shared game fact, logged, Undo): one of its
 * `weapon.modes` ids, or null for none. Whoever may use or equip the item may set it (the line's own access rules).
 * The log reads "Sam chose Short bow: silver arrows".
 */
export const setWeaponMode = defineCommand({
  name: 'item.setMode',
  log: 'simple',
  target: (input: { line: LineRef; modeId: string | null }) => input.line.carrier,
  allowed: (user, carrier) => carrier.actorId !== null && mayChangeCarrier(user, carrier),
  run: async (db, _user, input, meta): Promise<CommandResult<string | null>> => {
    const modeId = input.modeId === null ? null : input.modeId.trim().slice(0, 100) || null;
    const saved = await changeLine<{ mode_id: string | null }>(db, input.line, { mode_id: modeId }, 'mode_id', requestIdOf(meta));
    return saved.ok ? ok(saved.value.mode_id) : saved;
  },
});

/** A stack's count, typed or with − and + (arrows, rations). */
export const setItemQty = defineCommand({
  name: 'inventory.setQty',
  log: 'verbose',
  target: (input: { line: LineRef; qty: number }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!isWholeCount(input.qty)) return failed('How many must be a whole number, 1 or more.');
    const saved = await changeLine<{ qty: number }>(db, input.line, { qty: input.qty }, 'qty', requestIdOf(meta));
    return saved.ok ? ok(saved.value.qty) : saved;
  },
});

/** Worn or in hand, or not. */
export const equipItem = defineCommand({
  name: 'inventory.equip',
  target: (input: { line: LineRef; equipped: boolean }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<boolean>> => {
    const saved = await changeLine<{ equipped: boolean }>(db, input.line, { equipped: input.equipped, container_line_id: null }, 'equipped', requestIdOf(meta));
    return saved.ok ? ok(saved.value.equipped) : saved;
  },
});

/** Put an item on despite a setting's warning (ruled 2026-10-21): the same change, logged as an override. */
export const equipAnyway = defineCommand({
  name: 'inventory.equipAnyway',
  target: (input: { line: LineRef }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<boolean>> => {
    const saved = await changeLine<{ equipped: boolean }>(db, input.line, { equipped: true, container_line_id: null }, 'equipped', requestIdOf(meta));
    return saved.ok ? ok(saved.value.equipped) : saved;
  },
});

/** Tells the GM a setting's rule couldn't be checked (docs/07: skipped, never guessed); the database writes the line. */
export const noteRuleSkipped = defineCommand({
  name: 'rule.skipped',
  log: 'none',
  target: (input: { campaignId: string; hookId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isMember(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const { error } = await db.rpc('note_rule_skipped', { campaign: input.campaignId, hook: input.hookId });
    return error ? (error.code === '42501' ? notAllowed() : failed(error.message)) : ok(null);
  },
});

/**
 * Part of a stack as its own line, in one database step (split_inventory_line): the rest stays, and the copy keeps
 * everything the line says (bundle share, hidden charges, revealed fields). Returns the copy's id.
 */
async function splitLine(db: Db, line: { id: string; version?: number }, qty: number): Promise<CommandResult<string>> {
  const { data, error } = await db.rpc('split_inventory_line', {
    line: line.id,
    how_many: qty,
    ...(line.version !== undefined ? { seen_version: line.version } : {}),
  });
  if (error) return fromError(error);
  if (typeof data !== 'string') return failed("Couldn't split the stack. Try again.");
  return ok(data);
}

/**
 * Move some or all of a line: into a container, onto another of your carriers, into the Party stash, or to
 * another character (giving). Moving part of a stack splits it: the moved part becomes a new line.
 */
export const moveItem = defineCommand({
  name: 'inventory.move',
  target: (input: { line: LineRef; to: CarrierRef; containerLineId?: string | null; qty: number; of: number }) => ({
    from: input.line.carrier,
    to: input.to,
  }),
  allowed: (user, target: { from: CarrierRef; to: CarrierRef }) => mayChangeCarrier(user, target.from) && mayReceive(user, target.from, target.to),
  run: async (db, _user, input, meta): Promise<CommandResult<InventoryLine>> => {
    if (!isWholeCount(input.qty) || input.qty > input.of) return failed(`How many must be a whole number from 1 to ${input.of}.`);
    const placed = { ...carrierColumns(input.to), container_line_id: input.containerLineId ?? null, equipped: false };
    if (input.qty === input.of) {
      const moved = await changeLine<LineRow>(db, input.line, placed, COLUMNS, requestIdOf(meta));
      return moved.ok ? ok(toLine(moved.value)) : moved;
    }
    // Part of a stack: the rest stays; a copy with the moved count goes (split in one database step on this
    // carrier, then handed over, so the access rules check the giving like any other move).
    const made = await splitLine(db, input.line, input.qty);
    if (!made.ok) return made;
    const moved = await changeLine<LineRow>(db, { id: made.value }, placed, COLUMNS, requestIdOf(meta));
    return moved.ok ? ok(toLine(moved.value)) : moved;
  },
});

/**
 * Give some or all of a line to someone or something outside the party ("Other…": an NPC, a shrine, anything),
 * taking it out of the party; the log says who or what it went to (M4 gate run). Part of a stack goes as its own
 * line, made and removed at once, so the rest stays as it was.
 */
export const giveAway = defineCommand({
  name: 'inventory.giveAway',
  target: (input: { line: LineRef; qty: number; of: number; to: string }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<null>> => {
    const to = input.to.trim().slice(0, 100);
    if (!to) return failed('Say who or what it goes to.');
    if (!isWholeCount(input.qty) || input.qty > input.of) return failed(`How many must be a whole number from 1 to ${input.of}.`);
    let goes: { id: string; version?: number } = input.line;
    if (input.qty < input.of) {
      const made = await splitLine(db, input.line, input.qty);
      if (!made.ok) return made;
      goes = { id: made.value };
    }
    const named = fromWrite(await db.from('inventory_lines').update({ given_to: to, ...seen(goes) }).eq('id', goes.id).select('id, version'));
    if (!named.ok) {
      if (named.reason !== 'not-allowed') return named;
      // Already given away by this same request (a retry), or gone or changed since.
      const why = await noLineWhy(db, goes.id, requestIdOf(meta));
      return why.ok || why.reason !== 'not-allowed' ? why : named;
    }
    return removeLine(db, { id: goes.id, version: named.value.version }, requestIdOf(meta));
  },
});

/** The GM approves a player's one-off: it counts from now on (logged). The GM may edit it first (ruled 2026-10-24). */
export const approveItem = defineCommand({
  name: 'inventory.approve',
  target: (input: { line: LineRef; edits?: { name: string; weightCoin: number | null; slots: number | null } }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<InventoryLine>> => {
    const patch: { approval: 'approved'; name?: string; weight_coin?: number | null; slots?: number | null } = { approval: 'approved' };
    if (input.edits) {
      const name = input.edits.name.trim();
      if (!name) return failed('The item needs a name.');
      const whole = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0);
      if (!whole(input.edits.weightCoin) || !whole(input.edits.slots)) return failed('Weight and slots must be whole numbers.');
      Object.assign(patch, { name, weight_coin: input.edits.weightCoin, slots: input.edits.slots });
    }
    const saved = await changeLine<LineRow>(db, input.line, patch, COLUMNS, requestIdOf(meta));
    return saved.ok ? ok(toLine(saved.value)) : saved;
  },
});

/** The GM declines a player's one-off: it goes (logged, with a full copy in the log). */
export const declineItem = defineCommand({
  name: 'inventory.decline',
  target: (input: { line: LineRef }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<null>> => removeLine(db, input.line, requestIdOf(meta)),
});

/**
 * Empty a container in one step (ruled 2026-10-24): what's directly inside goes to Carried (on the same carrier),
 * to another carrier, or is dropped. One logged change; only the contents move (a bag inside takes its own along).
 */
export const emptyContainer = defineCommand({
  name: 'inventory.empty',
  target: (input: { line: LineRef; to: 'carried' | 'drop' | CarrierRef }) => ({ from: input.line.carrier, to: typeof input.to === 'object' ? input.to : input.line.carrier }),
  allowed: (user, target: { from: CarrierRef; to: CarrierRef }) => mayChangeCarrier(user, target.from) && mayReceive(user, target.from, target.to),
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    // What's inside, as this person sees it; if the access rules move fewer, the change wasn't theirs to make.
    const found = await db.from('inventory_lines').select('id').eq('container_line_id', input.line.id);
    if (found.error) return failed(found.error.message);
    const count = found.data.length;
    if (count === 0) return ok(0);
    const inside = db.from('inventory_lines');
    const moved = (result: { data: { id: string }[] | null; error: { code?: string; message: string } | null }): CommandResult<number> =>
      result.error
        ? result.error.code === '42501'
          ? notAllowed()
          : failed(result.error.message)
        : (result.data?.length ?? 0) < count
          ? notAllowed()
          : ok(result.data?.length ?? 0);
    const done =
      input.to === 'drop'
        ? moved(await inside.delete().eq('container_line_id', input.line.id).select('id'))
        : input.to === 'carried'
          ? moved(await inside.update({ container_line_id: null }).eq('container_line_id', input.line.id).select('id'))
          : moved(await inside.update({ ...carrierColumns(input.to), container_line_id: null, equipped: false }).eq('container_line_id', input.line.id).select('id'));
    return done;
  },
});

/**
 * Magic armour's base (07, `armour.baseArmour: { choose }`; ruled 2026-10-29): picked once, by whoever may change the
 * item, when it's found or later from "Choose base armour"; after that only the GM changes it. Logged.
 * `takeOff` (bq3-8, ruled 2026-11-04): worn armour whose picked base the wearer's class can't wear comes off in the
 * same change, carried, so one log line says both and one Undo puts both back. The caller checks the class.
 */
export const setBaseArmour = defineCommand({
  name: 'inventory.setBaseArmour',
  target: (input: { line: LineRef & { baseArmourId: string | null }; baseArmourId: string; takeOff?: boolean }) => ({
    ...input.line.carrier,
    picked: input.line.baseArmourId !== null,
  }),
  allowed: (user, target: CarrierRef & { picked: boolean }) => isGm(user, target.campaignId) || (!target.picked && mayChangeCarrier(user, target)),
  run: async (db, _user, input, meta): Promise<CommandResult<InventoryLine>> => {
    if (!input.baseArmourId.trim()) return failed('Choose the base armour.');
    const patch = { base_armour_id: input.baseArmourId, ...(input.takeOff ? { equipped: false } : {}) };
    const saved = await changeLine<LineRow>(db, input.line, patch, COLUMNS, requestIdOf(meta));
    return saved.ok ? ok(toLine(saved.value)) : saved;
  },
});

/** Pin an item to At hand on its character's Player screen, or unpin it (logged). Pins leave with the item. */
export const pinItem = defineCommand({
  name: 'inventory.pin',
  target: (input: { line: LineRef; pinned: boolean }) => input.line.carrier,
  allowed: (user, carrier) => carrier.actorId !== null && mayChangeCarrier(user, carrier),
  run: async (db, _user, input, meta): Promise<CommandResult<boolean>> => {
    const saved = await changeLine<{ pinned: boolean }>(db, input.line, { pinned: input.pinned }, 'pinned', requestIdOf(meta));
    return saved.ok ? ok(saved.value.pinned) : saved;
  },
});

/**
 * Hide something that shows in At hand by itself (in hand, or worn or held with charges), or show it there again
 * (ruled 2026-10-23; detailed log only). Like a pin, the choice goes when the item leaves the character.
 */
export const hideFromAtHand = defineCommand({
  name: 'inventory.atHand',
  log: 'verbose',
  target: (input: { line: LineRef; hidden: boolean }) => input.line.carrier,
  allowed: (user, carrier) => carrier.actorId !== null && mayChangeCarrier(user, carrier),
  run: async (db, _user, input, meta): Promise<CommandResult<boolean>> => {
    const saved = await changeLine<{ at_hand_hidden: boolean }>(db, input.line, { at_hand_hidden: input.hidden }, 'at_hand_hidden', requestIdOf(meta));
    return saved.ok ? ok(saved.value.at_hand_hidden) : saved;
  },
});

/**
 * The GM shows the holder one of an item's hidden fields (a curse, the true bonus): it's added to what the line
 * says about its item, where its holder (and everyone who sees the line) can read it. Logged.
 */
export const revealItemField = defineCommand({
  name: 'inventory.reveal',
  target: (input: { line: LineRef; field: string; value: unknown }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<InventoryLine>> => {
    // Read fresh, and saved only if nothing changed in between.
    const found = fromWrite(await db.from('inventory_lines').select('item_data, version').eq('id', input.line.id));
    if (!found.ok) return found;
    const details = (found.value.item_data && typeof found.value.item_data === 'object' ? found.value.item_data : {}) as Record<string, unknown>;
    const saved = await changeLine<LineRow>(
      db,
      { id: input.line.id, version: found.value.version },
      { item_data: { ...details, [input.field]: input.value } as Json },
      COLUMNS,
      requestIdOf(meta),
    );
    return saved.ok ? ok(toLine(saved.value)) : saved;
  },
});

/** Everything carried in a campaign that this person may see, and the campaign's Party stash. */
export async function loadInventory(db: Db, campaignId: string): Promise<{ lines: InventoryLine[]; stashId: string | null } | null> {
  const [lines, stash] = await Promise.all([
    db.from('inventory_lines').select(COLUMNS).eq('campaign_id', campaignId).order('created_at'),
    db.from('locations').select('id').eq('campaign_id', campaignId).eq('kind', 'stash').maybeSingle(),
  ]);
  if (lines.error || stash.error) return null;
  return { lines: (lines.data as LineRow[]).map(toLine), stashId: (stash.data as { id: string } | null)?.id ?? null };
}

/** A carrier with a name to show ("Ash", "Party stash"). */
export type NamedCarrier = CarrierRef & { name: string };

/** Who can carry things in a campaign: approved characters still in play, and the Party stash. */
export async function loadCarriers(db: Db, campaignId: string): Promise<NamedCarrier[] | null> {
  const [actors, places] = await Promise.all([
    db.from('actors').select('id, name, owner_user_id, status').eq('campaign_id', campaignId).eq('approval', 'approved').neq('status', 'archived').order('name'),
    db.from('locations').select('id, name').eq('campaign_id', campaignId).eq('kind', 'stash'),
  ]);
  if (actors.error || places.error) return null;
  return [
    ...actors.data.map((a) => ({ campaignId, actorId: a.id, locationId: null, ownerUserId: a.owner_user_id, archived: false, name: a.name })),
    ...places.data.map((l) => ({ campaignId, actorId: null, locationId: l.id, ownerUserId: null, archived: false, name: l.name })),
  ];
}

/** The campaign's encumbrance mode ("none" when unset). Null if unread. */
export async function loadInventorySettings(db: Db, campaignId: string): Promise<{ mode: EncumbranceMode; rechargeDefault: boolean } | null> {
  const found = await db.from('campaigns').select('settings').eq('id', campaignId).maybeSingle();
  if (found.error) return null;
  return { mode: encumbranceModeOf(found.data?.settings), rechargeDefault: rechargeDefaultOf(found.data?.settings) };
}
