// A shop's stock for the day (W12; docs/plans/dec-3-the-whole-town.md row W12; brief
// docs/plans/briefs/dec-3-w12-day-stock-brief.md; tn-4 to tn-8, ap-13, ap-14, mc-73, mc-74; Francis's yes w12-1 and
// w12-2; supabase/migrations/20261115110000_dec_3_w12_shop_stock.sql). Data and logic only: no screen here (W9, W10
// and W11 draw it from page 19's approved frames).
//   * The record: for a campaign, a shop (a `buy` service's id), a thing (an item's pack id) and a campaign day, the
//     GM's answer: in, out or undecided. No row: the thing reads as its default (stockDefault), worked out here from
//     the item's own `availability` and never stored.
//   * The day is the campaign clock's day as the app counts it everywhere a new day matters:
//     `readClock(seconds, units).day` (src/modules/expedition/clock.ts; the stash history's "today" reads the same).
//     A new day has no rows, so the shop reads as before anyone answered; yesterday's rows stay.
//   * stock.set (the GM: a thing in or out; Undo puts it back, undecided included) and stock.reset (the GM: every
//     thing with a chance back to undecided; Undo puts the answers back). The GM's lines alone.
//   * The players' reader (loadStockInForPlayer) returns only the things in force in, for one shop: never one out or
//     undecided, its id, or a count. The database works that out itself (the day's row, else its own default); the
//     device's list only narrows it.
import { defineCommand, fromError, isGm, ok, type CommandResult } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A stored answer, or a default: in stock, not in stock, or not yet decided ("?"). */
export type StockAnswer = 'in' | 'out' | 'undecided';

/** An item's `availability` as the pack writes it (07, a6-2: `{ where?, chance?, rarity?, note? }`). */
export interface ItemAvailability {
  /** The settlement sizes it is sold in, in the setting's own size names; empty when the pack names none. */
  where: string[];
  /** Its chance: "always", or "x-in-y" as the pack writes it; '' when none. */
  chance: string;
  rarity: string;
  note: string;
}

/** An item's `availability` read safely; null when it has none (or nothing in it can be read). */
export function readAvailability(value: unknown): ItemAvailability | null {
  if (!isRecord(value)) return null;
  const where = Array.isArray(value.where) ? value.where.map(text).filter(Boolean) : [];
  const read: ItemAvailability = { where, chance: text(value.chance), rarity: text(value.rarity), note: text(value.note) };
  return read.where.length > 0 || read.chance || read.rarity || read.note ? read : null;
}

/** Whether a chance is "always" (any case). */
export const isAlways = (chance: string): boolean => chance.trim().toLowerCase() === 'always';

/**
 * What a thing with no availability at all reads as before the GM answers (w12-2, Francis, 2026-11-15: in stock by
 * default, until the GM answers otherwise). Kept apart so the ruling sits in one place.
 */
export const WITHOUT_AVAILABILITY: StockAnswer = 'in';

/**
 * What a thing reads as before the GM has answered (the brief's item 5), from the item's `availability` and the town's
 * size (null when it isn't known):
 *   * no availability at all: WITHOUT_AVAILABILITY (w12-2: in);
 *   * sold by size (`where`) in a town of unknown size: undecided (tn-6), checked before any chance;
 *   * sold by size and the town has a size not in the list: out ("Not sold in <size>");
 *   * sold by size, the town's size in the list and no chance: in (tn-5: "Always");
 *   * a chance of "always": in;
 *   * a chance such as "3-in-6": undecided (the GM rolls or picks);
 *   * only a rarity or only a note: undecided.
 * Computed every time, never stored. The database's private.stock_default follows the same rules (the players'
 * reader works the default out itself); supabase/tests/dec-3-w12-shop-stock.test.ts keeps the two in step.
 */
export function stockDefault(availability: unknown, townSize: string | null, withoutAvailability: StockAnswer = WITHOUT_AVAILABILITY): StockAnswer {
  const a = readAvailability(availability);
  if (!a) return withoutAvailability;
  const size = text(townSize).toLowerCase();
  const sizes = a.where.map((w) => w.toLowerCase());
  if (sizes.length > 0) {
    if (!size) return 'undecided';
    if (!sizes.includes(size)) return 'out';
    if (!a.chance) return 'in';
  }
  if (a.chance) return isAlways(a.chance) ? 'in' : 'undecided';
  return 'undecided';
}

/** Whether a thing has a chance to decide ("x-in-y", not "always"): what Reset puts back on "?" (ap-12). */
export const hasChance = (availability: unknown): boolean => {
  const a = readAvailability(availability);
  return a !== null && a.chance !== '' && !isAlways(a.chance);
};

/** The answer in force: the GM's stored answer always wins; else the default. */
export const answerInForce = (stored: StockAnswer | null | undefined, byDefault: StockAnswer): StockAnswer => stored ?? byDefault;

/** One stored answer as the GM reads it. */
export interface StockLine {
  id: string;
  serviceId: string;
  itemId: string;
  day: number;
  answer: StockAnswer;
}

const ANSWERS: readonly StockAnswer[] = ['in', 'out', 'undecided'];

const toLine = (row: Record<string, unknown>): StockLine | null => {
  const answer = ANSWERS.find((a) => a === row.answer);
  if (!answer || typeof row.id !== 'string' || typeof row.day !== 'number') return null;
  return { id: row.id, serviceId: String(row.service_id), itemId: String(row.item_id), day: row.day, answer };
};

/** The GM's stored answers for a shop on a day (live rows only); null when they couldn't be read. */
export async function loadStockLines(db: Db, campaignId: string, serviceId: string, day: number): Promise<StockLine[] | null> {
  const { data, error } = await db.from('shop_stock').select('id, service_id, item_id, day, answer').eq('campaign_id', campaignId).eq('service_id', serviceId).eq('day', day).eq('undone', false);
  if (error) return null;
  return (data ?? []).flatMap((r) => toLine(r as Record<string, unknown>) ?? []);
}

/**
 * The things in stock at a shop on a day, as a player reads them: the items for sale whose answer in force is in (the
 * day's stored answer, else the default), as the database works it out. `offered`, when given, only narrows the answer
 * to those ids; it never adds one. Never a thing out or undecided. Null when it couldn't be read.
 * A pack's shop (a `place:<entry id>` key; sh-1 a): only the GM's stored "in" answers for the day, no default, and
 * `offered` ignored (migration 20261115150000).
 */
export async function loadStockInForPlayer(db: Db, campaignId: string, serviceId: string, day: number, offered?: readonly string[]): Promise<string[] | null> {
  const { data, error } = await db.rpc('shop_stock_in', { campaign: campaignId, service: serviceId, on_day: day, ...(offered ? { offered: [...offered] } : {}) });
  if (error) return null;
  return (data ?? []).flatMap((r: { item_id: string | null }) => (r.item_id ? [r.item_id] : [])).sort();
}

/** The input to stock.set: a thing in or out at a shop on a day. */
export interface SetStockInput {
  campaignId: string;
  serviceId: string;
  itemId: string;
  day: number;
  answer: 'in' | 'out';
}

/** Stocked? (stock.set): the GM sets one thing in or out for the day. Logged, the GM's; Undo puts it back. */
export const setStock = defineCommand({
  name: 'stock.set',
  log: 'simple',
  target: (input: SetStockInput) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<StockLine>> => {
    const { data, error } = await db.rpc('set_shop_stock', {
      campaign: input.campaignId,
      service: input.serviceId,
      item: input.itemId,
      on_day: input.day,
      answer: input.answer,
    });
    if (error) return fromError(error);
    const line = isRecord(data) ? toLine(data) : null;
    return line ? ok(line) : fromError({ message: "That wasn't saved. Try again." });
  },
});

/** The input to stock.reset: the shop, the day, and its things with a chance (hasChance). */
export interface ResetStockInput {
  campaignId: string;
  serviceId: string;
  day: number;
  itemIds: readonly string[];
}

/** Reset (stock.reset): every thing with a chance back on "?" for the day. Logged, the GM's; Undo puts the answers back. */
export const resetStock = defineCommand({
  name: 'stock.reset',
  log: 'simple',
  target: (input: ResetStockInput) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const { data, error } = await db.rpc('reset_shop_stock', { campaign: input.campaignId, service: input.serviceId, on_day: input.day, items: [...input.itemIds] });
    if (error) return fromError(error);
    return ok(typeof data === 'number' ? data : 0);
  },
});

export const SHOP_STOCK_COMMANDS = [setStock, resetStock] as const;
