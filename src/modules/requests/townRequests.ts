// Town requests (M5b step 6e; docs/plans/m5b-6-settlements.md "Step 6e"; ruled 2026-10-30, ST5–ST9; dt-11 and st-3;
// supabase/migrations/20261104190000_m5b_6e_town_requests.sql): buying, selling, lodging and town activities as
// Requests (M5 step 12), one record and one card, no second system.
//   Buying (ST5): Ask for… sends a `buy` request (the pack's item or Something not listed…); the GM answers In stock
//   (the pack's price), Not here, or Price… (the GM's own); the player replies Buy it (the item comes into the pack as
//   bought, its price as text) or Leave it.
//   Selling (ST6): Sell… sends a `sell` request (the line, how many, the buyer: a shop or a person); the GM's Offer
//   starts from the pack's sale rule; the player Accepts (the item leaves the pack; Undo puts it back) or Declines
//   (nothing changes). Buy it's made line IS undone, by the buyer's own Undo (undoBuy, bu-1) while nobody has touched it;
//   the general Undo still refuses it (hard rule 4's sixth exception).
//   Lodging (ST7 with dt-11, st-3): a lodging from the town's list is picked at once (town.stay, answered by the
//   database); Somewhere else… waits for the GM's Yes (with its cost in words) or No (Not available).
//   Town activities (ST8): the pack's, or Something else…, sent to the GM to narrate (`askGm`).
//   Costs are text until purses (M7b).
import { defineCommand, fromError, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { coinsOf, priceOf, showMoney, type Coin } from '../characters/startingGear.ts';
import { morningStarts, type TimeUnits } from '../expedition/clock.ts';
import { addItem, removeItem, type CarrierRef, type ItemCopy, type LineRef } from '../inventory/inventory.ts';
import { toRequest, type AskingCharacter, type Request } from './requests.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

// Prompts -----------------------------------------------------------------------------------------------------------

/** What Ask for… asks: at which shop (a `buy` service), which item (the pack's, or none: Something not listed…). */
export interface BuyPrompt {
  serviceId: string | null;
  shop: string;
  /** The pack's item id; null for Something not listed…. */
  itemId: string | null;
  item: string;
  /** The pack's price in words ("4 gp"); '' when it has none. */
  price: string;
}

/** What Sell… offers: the line, how many of it, and the buyer (a `sell` service, or a person by name). */
export interface SellPrompt {
  lineId: string;
  item: string;
  /** The pack's item id the line came from (its price, for the sale rule); null for a one-off. */
  itemId: string | null;
  qty: number;
  of: number;
  serviceId: string | null;
  buyer: string;
}

/** A stay (lodging): a lodging from the list (its key in places.town, its name and rate), or Somewhere else…. */
export interface StayPrompt {
  listed: boolean;
  key: string;
  name: string;
  rate: string;
  /** The campaign clock (seconds) when it was picked: the overnight card reads the stay picked before the morning. */
  at: number;
  /** The town it's in, by name (the player's devices don't see the place's id). */
  town: string;
}

/** A town activity sent to the GM: the pack's (its id), or Something else… (null). */
export interface TownActivityPrompt {
  townActivity: string | null;
  name: string;
}

export function readBuyPrompt(prompt: Record<string, unknown>): BuyPrompt | null {
  const item = text(prompt.item);
  if (!item) return null;
  return { serviceId: text(prompt.serviceId) || null, shop: text(prompt.shop), itemId: text(prompt.itemId) || null, item, price: text(prompt.price) };
}

export function readSellPrompt(prompt: Record<string, unknown>): SellPrompt | null {
  const item = text(prompt.item);
  const lineId = text(prompt.lineId);
  if (!item || !lineId) return null;
  const of = Math.max(1, whole(prompt.of) ?? 1);
  return { lineId, item, itemId: text(prompt.itemId) || null, qty: Math.min(of, Math.max(1, whole(prompt.qty) ?? 1)), of, serviceId: text(prompt.serviceId) || null, buyer: text(prompt.buyer) };
}

export function readStayPrompt(prompt: Record<string, unknown>): StayPrompt | null {
  const name = text(prompt.name);
  if (!name) return null;
  return { listed: prompt.listed === true, key: text(prompt.key), name, rate: text(prompt.rate), at: whole(prompt.at) ?? 0, town: text(prompt.town) };
}

export function readTownActivityPrompt(prompt: Record<string, unknown>): TownActivityPrompt | null {
  if (!('townActivity' in prompt)) return null;
  return { townActivity: text(prompt.townActivity) || null, name: text(prompt.name) };
}

// The pack's rules for town trade (07 Settlements, st-2) ------------------------------------------------------------

/** The availability chance (07 `settlement.availability { bySize: [{ size, chance }] }`): each size's chance, and the note. */
export interface Availability {
  bySize: { size: string; chance: number }[];
  note: string;
}

/** The top rules set's availability, or null. */
export function availabilityOf(rulesSets: readonly Record<string, unknown>[]): Availability | null {
  for (const rules of [...rulesSets].reverse()) {
    const a = isRecord(rules.settlement) ? rules.settlement.availability : null;
    if (!isRecord(a) || !Array.isArray(a.bySize)) continue;
    const bySize = a.bySize.flatMap((s) => (isRecord(s) && text(s.size) && whole(s.chance) !== null ? [{ size: text(s.size), chance: s.chance as number }] : []));
    if (bySize.length > 0 || text(a.note)) return { bySize, note: text(a.note) };
  }
  return null;
}

/** "Hamlet 0% · Small town 100%": the chance by size, in words. */
export const availabilityWords = (a: Availability): string => a.bySize.map((s) => `${s.size} ${s.chance}%`).join(', ');

/**
 * The share of the price a buyer pays, in percent (07 `settlement.salePrice { default, byService? }`; a seller
 * service's own `rate`): by the service first, then its rate, then the default; null when nothing says.
 */
export function saleShare(rulesSets: readonly Record<string, unknown>[], serviceId: string | null, serviceRate: number | null): number | null {
  for (const rules of [...rulesSets].reverse()) {
    const sale = isRecord(rules.settlement) ? rules.settlement.salePrice : null;
    if (!isRecord(sale)) continue;
    const byService = isRecord(sale.byService) && serviceId ? whole(sale.byService[serviceId]) : null;
    if (byService !== null) return byService;
    if (serviceRate !== null) return serviceRate;
    const fallback = whole(sale.default);
    if (fallback !== null) return fallback;
  }
  return serviceRate;
}

/**
 * The suggested price for a sale: the item's price (its pack `value`) times how many, times the share, rounded down,
 * in the setting's coins ("20 gp", "2 sp 5 cp"). Integers only. Null when the item has no price or nothing says the share.
 */
export function suggestedSale(value: unknown, qty: number, share: number | null, rulesSets: readonly Record<string, unknown>[]): string | null {
  if (share === null) return null;
  const coins: Coin[] = coinsOf(rulesSets);
  const unit = biggestIn(value, coins);
  if (!unit) return null;
  const each = priceOf(value, coins, unit);
  if (each === null) return null;
  const base = Math.floor((each * qty * share) / 100);
  return showMoney(base, coins, unit);
}

/** The biggest coin a price names (the one the suggestion is said in). */
function biggestIn(value: unknown, coins: readonly Coin[]): Coin | null {
  if (!isRecord(value)) return null;
  const named = coins.filter((c) => whole(value[c.key]) !== null);
  if (named.length > 0) return named[0]!;
  const key = Object.keys(value)[0];
  return key && whole(value[key]) !== null ? { key, label: key, valueInBase: 1 } : null;
}

// The overnight card (ST9) -------------------------------------------------------------------------------------------

/**
 * A character's stay for the night: the newest stay (a listed pick, or Somewhere else… the GM said Yes to) in this
 * town, picked on the clock before `before`. Null when there's none.
 */
export function stayFor(requests: readonly Request[], actorId: string, town: string, before: number): { name: string; rate: string } | null {
  const stays = requests
    .filter((r) => r.kind === 'lodging' && r.actorId === actorId && r.status === 'answered' && r.answer !== null)
    .filter((r) => (r.answer!.kind === 'stay' ? true : r.answer!.kind === 'yesNo' && r.answer!.yes))
    .flatMap((r) => {
      const p = readStayPrompt(r.prompt);
      return p && p.town === town && p.at < before ? [{ r, p }] : [];
    })
    .sort((a, b) => b.p.at - a.p.at || b.r.createdAt.localeCompare(a.r.createdAt));
  const newest = stays[0];
  if (!newest) return null;
  return { name: newest.p.name, rate: newest.p.listed ? newest.p.rate : newest.r.costText };
}

/** A character's current stay in a town (the newest, any time): the radio that's filled on Where you stay. */
export const currentStay = (requests: readonly Request[], actorId: string, town: string) => stayFor(requests, actorId, town, Number.MAX_SAFE_INTEGER);

/**
 * The morning the clock is in (ST9): its index (counted from the clock's start), when it began, and when the night
 * before began (seconds on the campaign clock). The card shows from the morning until the night (`showing`): a GM
 * who moves on to the afternoon before a player looks doesn't lose it. Null without a day length.
 */
export function morningOf(now: number, units: TimeUnits): { index: number; start: number; nightStart: number; showing: boolean } | null {
  const day = units.day;
  if (!day || day <= 0) return null;
  const at = morningStarts(units);
  const index = Math.floor((now - at) / day);
  const start = index * day + at;
  return { index, start, nightStart: start - Math.floor(day / 3), showing: now - start < Math.floor((day * 2) / 3) };
}

/** A status that started or ended overnight, for the card. */
export interface StatusChange {
  name: string;
  change: 'started' | 'ended';
}

/** "Last night: The Lantern Rest · 2 sp a night"; "Ended: Poisoned". The card's lines (none: no card). */
export function overnightLines(stay: { name: string; rate: string } | null, changes: readonly StatusChange[]): string[] {
  const lines: string[] = [];
  if (stay) lines.push(`Last night: ${stay.name}${stay.rate ? `, ${stay.rate}` : ''}`);
  const ended = changes.filter((c) => c.change === 'ended').map((c) => c.name);
  const started = changes.filter((c) => c.change === 'started').map((c) => c.name);
  if (ended.length > 0) lines.push(`Ended: ${ended.join(', ')}`);
  if (started.length > 0) lines.push(`Started: ${started.join(', ')}`);
  return lines;
}

/** The character's statuses that started or ended between two clock times (after `from`, up to `to`); null if they couldn't be read. */
export async function loadStatusChanges(db: Db, campaignId: string, actorId: string, from: number, to: number): Promise<StatusChange[] | null> {
  const { data, error } = await db.from('character_statuses').select('name, started_at, ended_at').eq('campaign_id', campaignId).eq('actor_id', actorId).eq('undone', false);
  if (error) return null;
  const within = (t: unknown) => typeof t === 'number' && t > from && t <= to;
  return (data ?? []).flatMap((r): StatusChange[] => [
    ...(within(r.started_at) ? [{ name: String(r.name), change: 'started' as const }] : []),
    ...(within(r.ended_at) ? [{ name: String(r.name), change: 'ended' as const }] : []),
  ]);
}

// Commands -----------------------------------------------------------------------------------------------------------

async function rpcRequest(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<Request>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(toRequest(row)) : fromError({ code: '42501', message: '' });
}

/**
 * The requester's reply (request.reply): Buy it or Leave it on a priced buy answer, Accept or Decline an offer.
 * Buying brings the item into the character's pack as bought, the price as text (inventory.add's line); a sale
 * accepted takes it out (inventory.remove's). Both in the same request: a sale's Undo puts the reply and the item back; a purchase's Undo is the buyer's own, request.undoBuy (bu-1), not the general one.
 */
export const replyRequest = defineCommand({
  name: 'request.reply',
  log: 'simple',
  target: (input: {
    request: Request;
    accept: boolean;
    buy?: { carrier: CarrierRef; item: ItemCopy; cost: string };
    sell?: { line: LineRef; qty: number; of: number };
  }) => ({ campaignId: input.request.campaignId, requesterId: input.request.requesterId }),
  allowed: (user: CurrentUser, target: { campaignId: string; requesterId: string | null }) => isMember(user, target.campaignId) && target.requesterId === user.id,
  run: async (db, user, input, meta): Promise<CommandResult<Request>> => {
    const replied = await rpcRequest(db.rpc('reply_request', { request: input.request.id, accept: input.accept, seen_version: input.request.version }));
    if (!replied.ok || !input.accept) return replied;
    if (input.buy) {
      const added = await addItem.run(db, user, { carrier: input.buy.carrier, item: input.buy.item, qty: 1, howGot: 'bought', cost: input.buy.cost }, meta);
      if (!added.ok) return added;
    }
    if (input.sell) {
      const gone = await removeItem.run(db, user, { line: input.sell.line, qty: input.sell.qty, of: input.sell.of }, meta);
      if (!gone.ok) return gone;
    }
    return replied;
  },
});

/** Stay here (town.stay): a lodging from the town's list, for a player's own character; no GM needed (dt-11, st-3). */
export const chooseStay = defineCommand({
  name: 'town.stay',
  log: 'simple',
  target: (input: { character: AskingCharacter; stay: StayPrompt }) => ({ campaignId: input.character.campaignId, ownerUserId: input.character.ownerUserId }),
  allowed: (user: CurrentUser, target: { campaignId: string; ownerUserId: string | null }) => isMember(user, target.campaignId) && target.ownerUserId === user.id,
  run: (db, _user, input) =>
    rpcRequest(
      db.rpc('send_request', {
        campaign: input.character.campaignId,
        actor: input.character.id,
        kind: 'lodging',
        body: `Staying at ${input.stay.name}`,
        cost_text: input.stay.rate,
        prompt: { ...input.stay, listed: true } as unknown as Json,
      }),
    ),
});

/**
 * Undo on Buy it (request.undoBuy; Francis's bu-1 and hr4, the sixth named exception to hard rule 4): the buyer's own
 * Undo of their own purchase removes the bought line while nobody has touched it (its version unchanged since the
 * purchase made it); the log keeps a full copy. Nothing was charged, so no coin moves; a spend made from the toast is a
 * separate entry and stays. The GM's general Undo still refuses a purchase.
 */
export const undoBuy = defineCommand({
  name: 'request.undoBuy',
  log: 'simple',
  target: (input: { request: Request }) => ({ campaignId: input.request.campaignId, requesterId: input.request.requesterId }),
  allowed: (user: CurrentUser, target: { campaignId: string; requesterId: string | null }) => isMember(user, target.campaignId) && target.requesterId === user.id,
  run: (db, _user, input) => rpcRequest(db.rpc('undo_buy', { request: input.request.id })),
});

export const TOWN_REQUEST_COMMANDS = [replyRequest, chooseStay, undoBuy] as const;
