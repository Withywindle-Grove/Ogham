// The coin line's words (December step 6, piece c, the words only; docs/plans/dec-6-purse.md, "Words"):
// "12 crowns, 30 herons, 4 bits", "No coin", and an amount's words for buttons and log lines ("2 herons").
// Pure: these only format what they are given and read no purse (hidden means hidden: the caller has already
// been allowed to see the coins it passes in).
//
// Amounts are whole numbers (hard rule 8). One that isn't (a fraction, a negative, not a number) is never printed:
// the coin line leaves that coin out as if none, and amountWords refuses it (null).

/** One of the setting's coins, as the words need it. */
export interface Denomination {
  /** The key a purse stores this coin under (rules set `currency[].key`). */
  key: string;
  /** The setting's name for the coin, used as given (`currency[].label`, else the key). */
  label: string;
  /** The name for one; used only with `pluralName` (both or neither: the app never invents a singular). */
  unitName?: string;
  /** The name for more than one; used only with `unitName`. */
  pluralName?: string;
}

const NO_COIN = 'No coin';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const words = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
/** Thousands with a comma, as the Pack tab prints them (`num` in app/LoadSummary.tsx; a module doesn't import a screen). */
const count = (n: number) => n.toLocaleString('en');

/**
 * The setting's coins in the order it lists them: the `currency` of the top rules set that names any. A coin is valid
 * as `coinsOf` (characters/startingGear.ts) counts it: a key and a whole `valueInBase` above 0, so the two pick the same
 * set and the same coins; `coinsOf` sorts them biggest first for prices, this keeps the setting's order. A key listed
 * twice is read once, the first time. `unitName` and `pluralName` are read only when both are given. None named, none
 * returned: nothing is invented.
 */
export function denominationsOf(rulesSets: readonly Record<string, unknown>[]): Denomination[] {
  for (const rules of [...rulesSets].reverse()) {
    if (!Array.isArray(rules.currency)) continue;
    const coins: Denomination[] = [];
    for (const c of rules.currency) {
      if (!isRecord(c) || !words(c.key) || !whole(c.valueInBase) || c.valueInBase === 0) continue;
      if (coins.some((known) => known.key === c.key)) continue;
      const coin: Denomination = { key: c.key, label: words(c.label) ? c.label : c.key };
      if (words(c.unitName) && words(c.pluralName)) Object.assign(coin, { unitName: c.unitName, pluralName: c.pluralName });
      coins.push(coin);
    }
    if (coins.length > 0) return coins;
  }
  return [];
}

/**
 * An amount of one coin as words: "2 herons", "12,000 herons"; "1 heron" only where the setting gives both a
 * `unitName` and a `pluralName`, otherwise the label as given whatever the amount ("1 gp"). Null (refused) for an
 * amount that isn't whole and from 0.
 */
export function amountWords(coin: Denomination, amount: number): string | null {
  if (!whole(amount)) return null;
  const named = coin.unitName !== undefined && coin.pluralName !== undefined;
  const name = named ? (amount === 1 ? coin.unitName : coin.pluralName) : coin.label;
  return `${count(amount)} ${name}`;
}

/**
 * The coin line: each of the setting's coins the purse holds, in the setting's order, "12 crowns, 30 herons, 4 bits";
 * then any coin under a key the setting doesn't list, as written, in the purse's order ("12 crowns, 7 zz"). A coin at
 * none is left out (a key listed twice is printed once); "No coin" only when the purse holds nothing at all, or there
 * is no purse: it never reads empty while it holds coin.
 */
export function coinLine(denominations: readonly Denomination[], purse: unknown): string {
  if (!isRecord(purse)) return NO_COIN;
  const listed = new Map<string, Denomination>();
  for (const coin of denominations) if (!listed.has(coin.key)) listed.set(coin.key, coin);
  const parts: string[] = [];
  for (const coin of listed.values()) {
    const amount = purse[coin.key];
    if (whole(amount) && amount > 0) parts.push(amountWords(coin, amount) as string);
  }
  for (const [key, amount] of Object.entries(purse)) {
    if (!listed.has(key) && whole(amount) && amount > 0) parts.push(`${count(amount)} ${key}`);
  }
  return parts.length > 0 ? parts.join(', ') : NO_COIN;
}
