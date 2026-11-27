// K16a: a hoard's rows from a Treasure piece (docs/plans/dec-6-the-whole-pack-tab.md, row K16; pk-1, pf-6, pk-11,
// pg-1; the pack-format additions pf-24 and pf-24a; the Pack page's frame PK5). The rows the GM will hand out when a
// Treasure piece is tapped: the send command (K16b) and its sheets (K16c) come later.
// Pure, and for the GM's device only: a thing's worth is the GM's ("Value stays yours", pg-1), and nothing here is
// sent to a player.
//   * A treasure entry hands out coin if and only if it has a `coins` map (pf-24): `{ <the setting's coin key>: <whole
//     number, 0 or more> }`, as a purse holds coin. One coin row per such entry (pf-6: "coin is a row like any other"),
//     never one per hoard. `value` only says what a thing is worth and is never handed out as coin.
//   * An odd coin word is never guessed (pf-24a): the pack stores the amount under the coin it is read as, and says how
//     with `coinsReadAs: { printed, note }`. The row keeps the entry's text (the book's words as printed) and carries
//     the note; what is sent on is the `coins` map (PK5).
//   * A thing is a known item by its id, else a one-off by its words. An entry with both coins and a thing's worth
//     gives both rows.
import { plainLinks } from '../library/linkMarks.ts';
import { amountWords, type Denomination } from '../inventory/coinWords.ts';
import { chunksOf, hoardWordsOf, magicItemOf } from './placeFromPack.ts';
import { PLACE_TEXT_MAX } from './placePlay.ts';

/** Coin by the setting's coin key, whole numbers (hard rule 8). */
export type Coins = Record<string, number>;

/** One amount of a coin row, in the setting's coin names ("40 herons"). */
export interface CoinAmount {
  key: string;
  amount: number;
  words: string;
}

/** A thing to hand out: a known item by its id, or a one-off by its words. */
export interface ThingRow {
  kind: 'thing';
  /** The treasure entry it comes from, by its place in the pack's list. */
  entry: number;
  /** The entry's words as the pack writes them, link marks read as their words. */
  text: string;
  /** The item's id when the setting has it; null for a one-off. */
  itemId: string | null;
  /** The pack's `itemId` when the setting has no such item: kept, never dropped silently (the row is a one-off). */
  unknownItemId?: string;
  /** What it is worth (`value`), the GM's alone (pg-1); null when the pack gives none. */
  worth: Coins | null;
  /** How many the row hands out (B15, p2p-28: a treasure entry's `qty`, b15f-1; a whole number of 1 or more); 1 when not given. */
  qty: number;
  /**
   * What the senses tell of the magic item this thing is (b15f-2: the pack's `magicItem.noticed`), the players' to read
   * once drawn, never mixed with the truth; kept here with the thing as found and drawn nowhere before 5 December. Null
   * otherwise.
   */
  noticed: string | null;
  /** The real name of the magic item this thing is (B15, p2p-29: the entry's `magicItem`), the GM's alone; null otherwise. */
  magic: string | null;
}

/** Coin to hand out: one entry's `coins`. */
export interface CoinRow {
  kind: 'coin';
  entry: number;
  /** The entry's words as printed (pk-11, PK5: the book's words, "200 hn."). */
  text: string;
  /** Its amounts in the setting's coin order and names; a coin at 0 is kept as the pack wrote it. */
  amounts: CoinAmount[];
  /** What is sent on: the coins the setting knows, at whole amounts. */
  coins: Coins;
  /** How an odd coin word was read, in the pack's words (pf-24a); null when the pack says nothing. */
  readAs: { printed: string; note: string } | null;
  /**
   * The keys of `coins` this setting can't hand out: not one of its coins, or an amount that isn't a whole number of 0
   * or more. Reported, never guessed and never dropped silently.
   */
  notCoins: string[];
}

export type HoardRow = ThingRow | CoinRow;

/** The rows a tap on a Treasure piece offers: its hoard (pf-6) and the hoard's name; a lone entry is a hoard of one. */
export interface Hoard {
  name: string | null;
  /** The hoard's own line of words (B15, p2p-28: the place's `hoards`), as the piece shows it; null for a hoard without. */
  words: string | null;
  rows: HoardRow[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** The words a Treasure piece was made from: the entry's text, links read as their words, split as the pieces are. */
const pieceParts = (text: string): string[] => chunksOf(plainLinks(text), PLACE_TEXT_MAX);

/** A thing's worth as the pack gives it: its whole amounts, or null for none. */
function worthOf(value: unknown): Coins | null {
  if (!isObject(value)) return null;
  const out: Coins = {};
  for (const [key, amount] of Object.entries(value)) if (whole(amount)) out[key] = amount;
  return Object.keys(out).length > 0 ? out : null;
}

function coinRow(entry: Record<string, unknown>, index: number, text: string, setting: readonly Denomination[]): CoinRow {
  const given = entry.coins as Record<string, unknown>;
  const known = new Map(setting.map((coin) => [coin.key, coin]));
  const amounts: CoinAmount[] = [];
  const coins: Coins = {};
  for (const coin of setting) {
    const amount = given[coin.key];
    if (!Object.hasOwn(given, coin.key) || !whole(amount)) continue;
    amounts.push({ key: coin.key, amount, words: amountWords(coin, amount)! });
    coins[coin.key] = amount;
  }
  const notCoins = Object.entries(given)
    .filter(([key, amount]) => !known.has(key) || !whole(amount))
    .map(([key]) => key);
  const readAs = isObject(entry.coinsReadAs) && words(entry.coinsReadAs.printed) && words(entry.coinsReadAs.note)
    ? { printed: words(entry.coinsReadAs.printed), note: words(entry.coinsReadAs.note) }
    : null;
  return { kind: 'coin', entry: index, text, amounts, coins, readAs, notCoins };
}

function thingRow(entry: Record<string, unknown>, index: number, text: string, items: ReadonlySet<string>): ThingRow {
  const id = words(entry.itemId);
  const qty = whole(entry.qty) && entry.qty >= 1 ? entry.qty : 1;
  const magic = magicItemOf(entry);
  const row: ThingRow = { kind: 'thing', entry: index, text, itemId: id && items.has(id) ? id : null, worth: worthOf(entry.value), qty, magic: magic?.name ?? null, noticed: magic?.noticed || null };
  if (id && !items.has(id)) row.unknownItemId = id;
  return row;
}

/** One entry's rows, thing first: a thing (an item, or the words of one with no coins, or a worth beside its coins), then its coin. */
function rowsOf(entry: Record<string, unknown>, index: number, setting: readonly Denomination[], items: ReadonlySet<string>): HoardRow[] {
  const text = plainLinks(words(entry.text));
  const hasCoins = isObject(entry.coins);
  const isThing = !!words(entry.itemId) || !hasCoins || entry.value !== undefined;
  return [...(isThing ? [thingRow(entry, index, text, items)] : []), ...(hasCoins ? [coinRow(entry, index, text, setting)] : [])];
}

/**
 * The hoard behind a Treasure piece (pf-6, pk-1), as rows to hand out, in the pack's order. `place` is the place's pack
 * entry (its `treasure` list), `coins` the setting's coins (`denominationsOf`), `items` the item ids the setting has.
 * The piece is found by the words it was made from (`composePackPlace` makes one piece per treasure entry, or several
 * parts of a long one); its hoard is every entry at the place sharing its `hoard` name, or the entry alone. No
 * treasure behind the piece: no rows. Never throws; changes nothing it is given.
 */
export function hoardRows(piece: { kind: string; text: string; lead?: string | null }, place: Record<string, unknown>, coins: readonly Denomination[], items: ReadonlySet<string>): Hoard {
  const none: Hoard = { name: null, words: null, rows: [] };
  if (piece.kind !== 'treasure' || !Array.isArray(place.treasure)) return none;
  const entries = place.treasure as unknown[];
  // A hoard with its own words is one piece led by its name (B15): found by that name, so the GM may change its words.
  const lead = (piece.lead ?? '').trim();
  const hoardWords = lead ? hoardWordsOf(place).get(lead) : undefined;
  if (hoardWords !== undefined) {
    const members = entries.flatMap((e, index) => (isObject(e) && words(e.text) !== '' && words(e.hoard) === lead ? [[e, index] as const] : []));
    return { name: lead, words: hoardWords, rows: members.flatMap(([e, index]) => rowsOf(e, index, coins, items)) };
  }
  const said = piece.text.trim();
  const at = entries.findIndex((e) => isObject(e) && words(e.text) !== '' && pieceParts(words(e.text)).includes(said));
  if (at < 0) return none;
  const tapped = entries[at] as Record<string, unknown>;
  const name = words(tapped.hoard) || null;
  const members = entries.flatMap((e, index) => (isObject(e) && words(e.text) !== '' && (index === at || (name !== null && words(e.hoard) === name)) ? [[e, index] as const] : []));
  return { name, words: null, rows: members.flatMap(([e, index]) => rowsOf(e, index, coins, items)) };
}

/** A thing row's words with how many, as the hoard's sheet shows it (page 30, HM2): "Swords ×4"; a single one alone. */
export const thingWords = (row: Pick<ThingRow, 'text' | 'qty'>): string => (row.qty > 1 ? `${row.text} ×${row.qty}` : row.text);

/**
 * The one thing a Treasure piece hands out (sf-8; page 44, TR1 "One thing"): a hoard of a single thing row, one of it.
 * Null for a count: several rows, a thing with a count over 1, or coin. Pure.
 */
export function oneThing(hoard: Pick<Hoard, 'rows'>): ThingRow | null {
  const [only, ...more] = hoard.rows;
  return only && more.length === 0 && only.kind === 'thing' && only.qty === 1 ? only : null;
}

/**
 * The thing a magic item's piece tells the truth of (B15, p2p-29): the piece is led by the item's real name, and the
 * place's treasure entry whose `magicItem` has that name is the thing (`entry`, its place in the treasure list, as a
 * hoard row's). Null for any other piece, or when no entry has that name. Pure; never throws.
 */
export function magicPieceOf(piece: { kind: string; lead?: string | null }, place: Record<string, unknown>): { entry: number; name: string } | null {
  const lead = (piece.lead ?? '').trim();
  if (piece.kind !== 'other' || !lead || !Array.isArray(place.treasure)) return null;
  const entry = (place.treasure as unknown[]).findIndex((e) => isObject(e) && words(e.text) !== '' && magicItemOf(e)?.name === lead);
  return entry < 0 ? null : { entry, name: lead };
}

/**
 * The things in a send that arrive named (B15, page 30, HM3's pick): each thing row with a magic item whose piece is
 * revealed (`revealed`: shown to some group by a show not undone, hidden since or not), as `find.give`'s `named` (its
 * piece, and its place among the send's things). Whichever group's card it is sent from (the local review of #10, under
 * sw-8: a name revealed is everyone's). Every such thing, not only the first (the local review of #1101). Pure.
 */
export function namedThings(
  rows: readonly HoardRow[],
  pieces: readonly { id: string; kind: string; lead?: string | null }[],
  place: Record<string, unknown>,
  revealed: ReadonlySet<string>,
): { piece: string; thing: number }[] {
  const things = rows.filter((r): r is ThingRow => r.kind === 'thing');
  return things.flatMap((thing, at) => {
    const piece = thing.magic ? pieces.find((p) => revealed.has(p.id) && magicPieceOf(p, place)?.entry === thing.entry) : undefined;
    return piece ? [{ piece: piece.id, thing: at }] : [];
  });
}

// K21's logic half (docs/plans/dec-6-the-whole-pack-tab.md, row K21 and "The first-night seven"; pf-6, pf-24, pf-24a,
// pk-11, pu-3, pu-5; frames PK3 and PK5 of pack/08, ap-6, 2026-11-14). Coin in a hoard, and on the find card, as data;
// no word here reaches a screen in this step. What isn't ruled is never guessed: it is refused, by its reason, and the
// status file asks.

/** The most of one coin a send may carry: the database's own limit (public.give_find takes 1 to 9 digits). */
export const MOST_COIN = 999_999_999;

/** Why an amount of coin can't be handed out: never guessed, never dropped silently (the status file's ⚑). */
export type CoinRefusal = 'notACoin' | 'notWhole' | 'tooMuch';

/** A hoard's coin, all of it, as it would land in a purse. */
export interface HoardCoin {
  /** What lands in the purse: each of the setting's coins, the hoard's whole amounts added up, none at 0. */
  coins: Coins;
  /** The same amounts in the setting's order and coin words ("40 herons"). */
  amounts: CoinAmount[];
  /**
   * Each coin row's own words as the book prints them, with the pack's note where it reads an odd coin word
   * (pk-11, pf-24a: "200 hn." and the note); kept as written, never reworded.
   */
  printed: { entry: number; text: string; readAs: { printed: string; note: string } | null }[];
  /** What can't be handed out, by entry and coin key, and why: left out of `coins`, never guessed. */
  refused: { entry: number | null; key: string; why: CoinRefusal }[];
}

/**
 * A hoard's coin (K21; pf-6, pf-24): from the hoard's rows (`hoardRows`), the coin it holds in the purse's own units,
 * the setting's coins at whole amounts added up across its coin rows; and each coin row's printed words with pk-11's
 * note where the pack gives one. Only a `coins` map is coin (pf-24): a thing's `value` is never counted. A coin at 0 is
 * left out, and a hoard with no coin to hand out gives null (never a "0" line). An amount the setting can't hand out (a
 * key that isn't one of its coins, an amount that isn't a whole number of 0 or more, a total past the database's
 * limit) is refused by its reason and left out.
 */
export function hoardCoin(rows: readonly HoardRow[], setting: readonly Denomination[]): HoardCoin | null {
  const known = new Set(setting.map((coin) => coin.key));
  const totals: Coins = {};
  const printed: HoardCoin['printed'] = [];
  const refused: HoardCoin['refused'] = [];
  for (const row of rows) {
    if (row.kind !== 'coin') continue;
    for (const key of row.notCoins) refused.push({ entry: row.entry, key, why: known.has(key) ? 'notWhole' : 'notACoin' });
    const gives = Object.values(row.coins).some((n) => n > 0);
    if (gives || row.notCoins.length > 0) printed.push({ entry: row.entry, text: row.text, readAs: row.readAs });
    for (const [key, n] of Object.entries(row.coins)) if (n > 0) totals[key] = (totals[key] ?? 0) + n;
  }
  const coins: Coins = {};
  const amounts: CoinAmount[] = [];
  for (const coin of setting) {
    const n = totals[coin.key];
    if (n === undefined || n <= 0) continue;
    if (n > MOST_COIN) {
      refused.push({ entry: null, key: coin.key, why: 'tooMuch' });
      continue;
    }
    coins[coin.key] = n;
    amounts.push({ key: coin.key, amount: n, words: amountWords(coin, n)! });
  }
  return amounts.length > 0 || refused.length > 0 ? { coins, amounts, printed, refused } : null;
}

/** The coin a find card names (PK3), for the one player it goes to. */
export interface FindCardCoin {
  /** One line each, in the setting's order and coin words ("40 herons"); a coin at 0 is left out. */
  lines: string[];
  /** Coin counts as one on the Pack icon's count (PK3), however many coins; 0 when no line can be shown. */
  countsAs: 0 | 1;
  /** Keys in what was received that aren't a whole amount of one of the setting's coins: refused, not shown. */
  refused: string[];
}

/**
 * The coin lines of a find card (K21, PK3), from the coin the find put in the purse (`findCoinOf`, read from the log
 * lines the reader may read). Only the receiver's player and the GM read a purse's line (pu-9), so for anyone else
 * `received` is null and there is no line here: their log line says "coin", with no amount (K28). The coin lands in the
 * purse, not in the lists: these are lines of the card, never things. Null when nothing was received.
 */
export function findCardCoin(received: Coins | null, setting: readonly Denomination[]): FindCardCoin | null {
  if (received === null) return null;
  const lines: string[] = [];
  for (const coin of setting) {
    const n = received[coin.key];
    if (whole(n) && n > 0) lines.push(amountWords(coin, n)!);
  }
  const known = new Set(setting.map((coin) => coin.key));
  const refused = Object.entries(received)
    .filter(([key, n]) => !known.has(key) || !whole(n))
    .map(([key]) => key);
  return lines.length > 0 || refused.length > 0 ? { lines, countsAs: lines.length > 0 ? 1 : 0, refused } : null;
}
