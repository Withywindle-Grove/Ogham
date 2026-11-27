// Purses, the first cut (December step 6, piece b; docs/plans/dec-6-purse.md; ruling pk-6). Each character (and
// hireling) has a purse, and the Party stash holds coin too: whole numbers by coin, keyed by the setting's coins (the
// rules set's `currency[].key`, docs/07). Devices never write the purses table: these five commands call the
// database's functions (supabase/migrations/…_dec_6b_purse_commands.sql), which check who is asking, keep every
// purse at zero or more, and log each change (Undo puts it back while nothing has changed since).
//   purse.add     the GM gives coin to a character's purse or the stash
//   purse.remove  the GM takes coin from either, out of play
//   purse.spend   a player spends from their own character's purse (it leaves play; a few words on what for)
//   purse.give    a player gives from their own character's purse to another character or to the stash
//   purse.take    a player takes from the stash, or from a Down or dead character's purse (ruled 2026-10-29), into
//                 their own character's; the GM from any purse into any character's
// The coin line and its sheets are piece (c): src/app/PurseSheet.tsx, on the Pack tab (K9, K10).
import { defineCommand, failed, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { amountWords, type Denomination } from './coinWords.ts';
import type { CarrierRef } from './inventory.ts';

/**
 * An amount of one coin in the setting's words for the log's lines ("40 herons", the coin-words helpers); a coin the
 * setting doesn't list, by its key ("40 zz").
 */
export function coinAmountIn(denominations: readonly Denomination[]): (key: string, n: number) => string {
  return (key, n) => {
    const coin = denominations.find((d) => d.key === key);
    return (coin && amountWords(coin, n)) ?? `${n} ${key}`;
  };
}

/** An amount of coin: a coin's key (the setting's `currency[].key`) to a whole number. */
export type Coins = Readonly<Record<string, number>>;

/**
 * A purse's owner as the permission rules see it: a character (or hireling) or the Party stash. An archived
 * character's purse follows its pack: only the GM changes it (the lead, 2026-11-13).
 */
export type PurseRef = Pick<CarrierRef, 'campaignId' | 'actorId' | 'locationId' | 'ownerUserId' | 'archived'> & {
  /** The character's approval ("draft", "pending", "approved", "rejected"); left out, approved (and for the stash). */
  approval?: string;
};

/** As the database has it: coin goes only to an approved character (or the stash). */
const approvedOrStash = (purse: PurseRef) => purse.locationId !== null || (purse.approval ?? 'approved') === 'approved';
/** As the database has it: nobody, the GM included, touches another person's draft. */
const othersDraft = (user: CurrentUser, purse: PurseRef) => purse.approval === 'draft' && purse.ownerUserId !== user.id;

/** Where coin is taken from: the stash, or a character's purse, with whether that character is Down or dead now. */
export interface TakeFrom extends PurseRef {
  downOrDead: boolean;
}

/** The setting's name for each coin, by key ("heron" → "herons"), for a refusal's words; a coin not named shows its key. */
export type CoinNames = Readonly<Record<string, string>>;

/** The database's code for "that purse doesn't have that much" (supabase/migrations/…_dec_6b_purse_commands.sql). */
export const SHORT_CODE = 'GR422';
/** The database's code for "a purse can't hold more than 999,999,999 of a coin". */
export const TOO_MUCH_CODE = 'GR423';

/** Is this an amount the database takes: one coin or more, each a whole number from 1 up? */
export function isAmount(coins: Coins): boolean {
  const entries = Object.entries(coins);
  return entries.length > 0 && entries.every(([key, n]) => key.trim() === key && key.length > 0 && Number.isInteger(n) && n >= 1 && n <= 999_999_999);
}

/** The approved refusal (plan, Words): "<Name> has 30 herons." (the stash: "The stash has 0 herons."). */
export function shortWords(name: string, has: number, coin: string, names?: CoinNames): string {
  return `${name} has ${has} ${names?.[coin] ?? coin}.`;
}

/** The lead's words (2026-11-13) for the cap: "<Name> can't hold more than 999,999,999 herons." */
export function tooMuchWords(name: string, coin: string, names?: CoinNames): string {
  return `${name} can't hold more than 999,999,999 ${names?.[coin] ?? coin}.`;
}

/** A database refusal as a result: "short" and "too much" in the approved words (the setting's coin name), the rest as usual. */
export function purseResult(error: { code?: string; message: string; details?: string | null } | null, names?: CoinNames): CommandResult<null> {
  if (!error) return ok(null);
  if (error.code === SHORT_CODE || error.code === TOO_MUCH_CODE) {
    try {
      const detail = JSON.parse(error.details ?? '') as { name?: unknown; coin?: unknown; has?: unknown };
      if (typeof detail.name === 'string' && typeof detail.coin === 'string') {
        if (error.code === TOO_MUCH_CODE) return failed(tooMuchWords(detail.name, detail.coin, names));
        if (typeof detail.has === 'number') return failed(shortWords(detail.name, detail.has, detail.coin, names));
      }
    } catch {
      // The database's own words, below.
    }
    return failed(error.message);
  }
  return fromError(error);
}

/**
 * A character's purse as the read rule lets this person read it (piece a): its coins, or null when nothing came back
 * (no row yet, or not theirs to read: the database sends nothing of another living character's purse). The Pack asks
 * only for its own player's character (piece c, K9); the rule is the guard either way.
 */
export async function loadPurse(db: Db, campaignId: string, actorId: string): Promise<Coins | null> {
  return wholeCoins(await db.from('purses').select('coins').eq('campaign_id', campaignId).eq('actor_id', actorId).maybeSingle());
}

/** The Party stash's coin (K13, pu-3): every member may read it (the read rule); null when nothing came back. */
export async function loadStashCoin(db: Db, campaignId: string, locationId: string): Promise<Coins | null> {
  return wholeCoins(await db.from('purses').select('coins').eq('campaign_id', campaignId).eq('location_id', locationId).maybeSingle());
}

/** A purse row's coins as whole numbers of 1 or more (anything else left out); null for no row or an error. */
function wholeCoins({ data, error }: { data: { coins: Json } | null; error: unknown }): Coins | null {
  if (error || !data) return null;
  const coins = data.coins;
  if (typeof coins !== 'object' || coins === null || Array.isArray(coins)) return {};
  const whole: Record<string, number> = {};
  for (const [key, n] of Object.entries(coins)) if (typeof n === 'number' && Number.isInteger(n) && n > 0) whole[key] = n;
  return whole;
}

/** The lead's words (2026-11-13) for an amount that isn't whole numbers of 1 or more. */
export const AMOUNT = 'Say how many: a whole number, 1 or more.';

/** Does this person play this character (a hireling's employer plays it), approved and still in play (not archived)? */
const owns = (user: CurrentUser, purse: PurseRef) =>
  purse.actorId !== null && isMember(user, purse.campaignId) && purse.ownerUserId === user.id && !purse.archived && (purse.approval ?? 'approved') === 'approved';

export const addCoin = defineCommand({
  name: 'purse.add',
  target: (input: { to: PurseRef; coins: Coins; names?: CoinNames }) => input.to,
  allowed: (user, to) => isGm(user, to.campaignId) && !othersDraft(user, to),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    if (!isAmount(input.coins)) return failed(AMOUNT);
    const { error } = await db.rpc('purse_add', {
      campaign: input.to.campaignId,
      actor: input.to.actorId as string,
      location: input.to.locationId as string,
      coins: input.coins as Json,
    });
    return purseResult(error, input.names);
  },
});

export const removeCoin = defineCommand({
  name: 'purse.remove',
  target: (input: { from: PurseRef; coins: Coins; names?: CoinNames }) => input.from,
  allowed: (user, from) => isGm(user, from.campaignId) && !othersDraft(user, from),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    if (!isAmount(input.coins)) return failed(AMOUNT);
    const { error } = await db.rpc('purse_remove', {
      campaign: input.from.campaignId,
      actor: input.from.actorId as string,
      location: input.from.locationId as string,
      coins: input.coins as Json,
    });
    return purseResult(error, input.names);
  },
});

export const spendCoin = defineCommand({
  name: 'purse.spend',
  target: (input: { from: PurseRef; coins: Coins; whatFor?: string; names?: CoinNames }) => input.from,
  allowed: owns,
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    if (!isAmount(input.coins)) return failed(AMOUNT);
    const whatFor = input.whatFor?.trim().slice(0, 500) ?? '';
    const { error } = await db.rpc('purse_spend', {
      campaign: input.from.campaignId,
      actor: input.from.actorId as string,
      coins: input.coins as Json,
      ...(whatFor ? { what_for: whatFor } : {}),
    });
    return purseResult(error, input.names);
  },
});

export const giveCoin = defineCommand({
  name: 'purse.give',
  target: (input: { from: PurseRef; to: PurseRef; coins: Coins; names?: CoinNames }) => ({ campaignId: input.from.campaignId, from: input.from, to: input.to }),
  allowed: (user, t) =>
    owns(user, t.from) &&
    t.to.campaignId === t.from.campaignId &&
    approvedOrStash(t.to) &&
    (t.to.locationId !== null || (t.to.actorId !== null && t.to.actorId !== t.from.actorId && !t.to.archived)),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    if (!isAmount(input.coins)) return failed(AMOUNT);
    const { error } = await db.rpc('purse_give', {
      campaign: input.from.campaignId,
      from_actor: input.from.actorId as string,
      to_actor: input.to.actorId as string,
      to_location: input.to.locationId as string,
      coins: input.coins as Json,
    });
    return purseResult(error, input.names);
  },
});

export const takeCoin = defineCommand({
  name: 'purse.take',
  target: (input: { from: TakeFrom; to: PurseRef; coins: Coins; names?: CoinNames }) => ({ campaignId: input.to.campaignId, from: input.from, to: input.to }),
  allowed: (user, t) =>
    t.from.campaignId === t.to.campaignId &&
    t.to.actorId !== null &&
    t.from.actorId !== t.to.actorId &&
    approvedOrStash(t.to) &&
    ((isGm(user, t.to.campaignId) && !othersDraft(user, t.from)) || (owns(user, t.to) && (t.from.locationId !== null || t.from.downOrDead))),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    if (!isAmount(input.coins)) return failed(AMOUNT);
    const { error } = await db.rpc('purse_take', {
      campaign: input.to.campaignId,
      from_actor: input.from.actorId as string,
      from_location: input.from.locationId as string,
      to_actor: input.to.actorId as string,
      coins: input.coins as Json,
    });
    return purseResult(error, input.names);
  },
});
