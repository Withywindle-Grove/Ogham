// "Carrying treasure" under basic (armour) encumbrance (pack review area 3, build order 12; ruled 2026-11-04, eq-3,
// docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md). Treasure in a character's load suggests the switch on;
// the GM switches it per character (one Simple log line, Undo), and the speed follows through the load's movement
// row (encumbrance.ts `carriedLoad`, `speedOf`) and the database's tier line. "Significant" stays the GM's judgement.
// Kept as actors.carrying_treasure (supabase/migrations/20261104220000_m5b_area_3_carrying_treasure.sql): null follows
// the pack, true or false is the GM's word; only the GM changes it (a database guard).
import { defineCommand, fromWrite, isGm, notAllowed, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { CarrierRef } from './inventory.ts';

/** The GM's switch for one character: null = follow the pack (the suggestion). */
export type TreasureSwitch = boolean | null;

/** Whether the character counts as carrying treasure: the GM's word when set, else the pack's suggestion. */
export function carryingTreasure(suggested: boolean, gmSwitch: TreasureSwitch): boolean {
  return gmSwitch ?? suggested;
}

/**
 * What the GM's next tap should store, so the switch stays a plain on/off on screen: the opposite of what shows,
 * stored as "follow the pack" (null) when that is what the pack suggests anyway.
 */
export function nextTreasureSwitch(suggested: boolean, gmSwitch: TreasureSwitch): TreasureSwitch {
  const next = !carryingTreasure(suggested, gmSwitch);
  return next === suggested ? null : next;
}

/** Why the switch reads as it does: "treasure in the pack", "nothing counts as treasure", or the GM's word. */
export function treasureSwitchWords(suggested: boolean, gmSwitch: TreasureSwitch): string {
  if (gmSwitch === null) return suggested ? 'treasure in the pack' : 'nothing counts as treasure';
  return gmSwitch === suggested ? 'the GM agrees with the pack' : `the GM's call, the pack suggests ${suggested ? 'on' : 'off'}`;
}

/** Every character's switch in a campaign (actor id → the switch); null when they can't be read. */
export async function loadTreasureSwitches(db: Db, campaignId: string): Promise<Map<string, TreasureSwitch> | null> {
  const found = await db.from('actors').select('id, carrying_treasure').eq('campaign_id', campaignId);
  if (found.error) return null;
  return new Map(found.data.map((a) => [a.id, a.carrying_treasure ?? null]));
}

/** One character's switch; null when unread or not set. */
export async function loadTreasureSwitch(db: Db, actorId: string): Promise<TreasureSwitch> {
  const found = await db.from('actors').select('carrying_treasure').eq('id', actorId).maybeSingle();
  return found.error || !found.data ? null : (found.data.carrying_treasure ?? null);
}

/** The GM switches Carrying treasure for one character: on, off, or back to following the pack (null). Logged, with Undo. */
export const setCarryingTreasure = defineCommand({
  name: 'inventory.carryingTreasure',
  target: (input: { carrier: CarrierRef; on: TreasureSwitch }) => input.carrier,
  allowed: (user: CurrentUser, carrier: CarrierRef) => carrier.actorId !== null && isGm(user, carrier.campaignId),
  run: async (db, _user, input): Promise<CommandResult<TreasureSwitch>> => {
    // The Party stash (no actor) has no switch: refused as such, never sent to the database as an id of "null".
    if (input.carrier.actorId === null) return notAllowed('Only a character has Carrying treasure.');
    const saved = fromWrite(await db.from('actors').update({ carrying_treasure: input.on }).eq('id', input.carrier.actorId).select('id, carrying_treasure'));
    return saved.ok ? ok(saved.value.carrying_treasure ?? null) : saved;
  },
});
