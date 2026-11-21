// Starting gear at creation (docs/05 "Starting money", 06 "Shopping"; ruled 2026-10-25): what a kit or an item
// costs, in the setting's coins, and what's left of the starting money. Until purses arrive (M7) nothing is
// paid: the cost is noted, "Gold left" shows, going over warns but never blocks. Integers only: amounts are
// counted in the setting's base coin (its currency's valueInBase). Pure.

export interface Coin {
  key: string;
  label: string;
  valueInBase: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** The setting's coins (rules set `currency`, the top one that has them), biggest first. */
export function coinsOf(rulesSets: readonly Record<string, unknown>[]): Coin[] {
  for (const rules of [...rulesSets].reverse()) {
    if (!Array.isArray(rules.currency)) continue;
    const coins = rules.currency.flatMap((c) =>
      isRecord(c) && typeof c.key === 'string' && whole(c.valueInBase) ? [{ key: c.key, label: typeof c.label === 'string' ? c.label : c.key, valueInBase: c.valueInBase as number }] : [],
    );
    if (coins.length > 0) return coins.sort((a, b) => b.valueInBase - a.valueInBase);
  }
  return [];
}

/** The coin the starting money is counted in: the one its roll ends with ("3d6 × 10 gp" → gp), else the setting's gp, else one plain coin. */
export function moneyCoin(startingMoney: string, coins: readonly Coin[]): Coin {
  const last = /([A-Za-z]+)\s*$/.exec(startingMoney.trim())?.[1]?.toLowerCase();
  return (
    coins.find((c) => c.key.toLowerCase() === last || c.label.toLowerCase() === last) ??
    coins.find((c) => c.key === 'gp') ?? { key: last ?? 'coins', label: last ?? 'coins', valueInBase: 1 }
  );
}

/** An item's price in base coins (its `value`, like { "gp": 1, "sp": 5 }); null when it has none or names an unknown coin. */
export function priceOf(value: unknown, coins: readonly Coin[], unit: Coin): number | null {
  if (whole(value) !== null) return (value as number) * unit.valueInBase;
  if (!isRecord(value)) return null;
  let total = 0;
  for (const [key, amount] of Object.entries(value)) {
    const coin = coins.find((c) => c.key === key) ?? (key === unit.key ? unit : undefined);
    if (!coin || whole(amount) === null) return null;
    total += (amount as number) * coin.valueInBase;
  }
  return total;
}

/** A kit's price in base coins (its costGp, in gold, or in the money's coin when the setting has no gold). */
export function kitPrice(kit: Record<string, unknown>, coins: readonly Coin[], unit: Coin): number | null {
  const cost = whole(kit.costGp);
  if (cost === null) return null;
  return cost * (coins.find((c) => c.key === 'gp')?.valueInBase ?? unit.valueInBase);
}

/** An amount in base coins as words: "12 gp", or "12 gp 5 sp" when it isn't whole in the money's coin. */
export function showMoney(base: number, coins: readonly Coin[], unit: Coin): string {
  const sign = base < 0 ? '−' : '';
  let left = Math.abs(base);
  if (left % unit.valueInBase === 0 || coins.length === 0) return `${sign}${Math.floor(left / unit.valueInBase)} ${unit.key}`;
  const parts: string[] = [];
  for (const coin of coins.filter((c) => c.valueInBase <= unit.valueInBase)) {
    const n = Math.floor(left / coin.valueInBase);
    if (n > 0) parts.push(`${n} ${coin.key}`);
    left -= n * coin.valueInBase;
  }
  return `${sign}${parts.join(' ') || `0 ${unit.key}`}`;
}

/**
 * The kits a class may take: those naming it in classIds, and those naming no class. Class kits only (cw-9, 2026-11-06:
 * the "Any class can take any kit" setting is gone; a stored value is ignored). Don't re-propose.
 */
export function kitsFor<T extends { data: Record<string, unknown> }>(kits: readonly T[], classRef: string): T[] {
  const mine = (kit: T) => {
    const ids = kit.data.classIds;
    return !Array.isArray(ids) || ids.length === 0 || ids.includes(classRef);
  };
  return kits.filter(mine);
}

/**
 * The kits the Gear step offers (after-test A4, ruled by Francis 2026-11-06): the class's own; a class with no kit of
 * its own is offered every kit in play, each needing the GM's special approval (`special`).
 */
export function kitsOffered<T extends { data: Record<string, unknown> }>(kits: readonly T[], classRef: string): { kits: T[]; special: boolean } {
  const mine = kitsFor(kits, classRef);
  return mine.length > 0 || kits.length === 0 ? { kits: mine, special: false } : { kits: [...kits], special: true };
}

/**
 * One gear line (a kit's, a roll row's, a trait-list entry's, the setting's `startingEquipment`; cs-6, rc-3): an item
 * id and how many (1 when it doesn't say), or a one-off by `name` (no library item: `itemId` is ''). `units` counts
 * single pieces of a bundled item and wins over `qty` (G-92: "10 arrows from a quiver of 20" gives 10, not 200).
 */
export interface KitItem {
  itemId: string;
  qty: number;
  /** Single pieces of a bundled item (`units`, a whole number); left out when the line counts whole items or bundles. */
  units?: number;
  /** A one-off's name (rc-3: a `{ name }` line); only when `itemId` is ''. */
  name?: string;
}

/** What a gear line depends on (cs-6, G-88): the character's size (`ifSize`) and the kindred's armour substitutes. */
export interface GearContext {
  /** The kindred's `size` as the class plays it ("Small"); '' or left out without one. */
  size?: string;
  /** The kindred's `armourSubstitutes` ({ "<item id>": "<item id>" }). */
  substitutes?: Record<string, unknown>;
  /** An item's name by its id, for a roll's or choice's heading ("Torches"); the id when it doesn't say. */
  nameOf?: (itemId: string) => string | undefined;
  /** The character's class id: a kit roll with `forClasses` shows only to those classes (eq-9); left out, every roll shows. */
  classId?: string;
  /** What an item's single pieces are called (its `pluralName`, else `unitName`), for a roll of pieces' heading ("Torches"). */
  piecesNameOf?: (itemId: string) => string | undefined;
}

/**
 * A count of an item's single pieces in words (a kit's `units` line, G-92; after-test A1): the pack's `unitName` for
 * one and `pluralName` for more ("4 iron rations"), else "Iron ration ×4", as the pack view's countWords says. An item
 * with no piece name is its own piece ("Dry rations ×4").
 */
export function piecesWords(name: string, data: Record<string, unknown>, n: number): string {
  const word = (key: string) => (typeof data[key] === 'string' && String(data[key]).trim() ? String(data[key]).trim() : null);
  const one = word('unitName');
  const many = word('pluralName');
  if (n === 1) return one ?? name;
  // Leading the words, the piece's name takes a capital ("Torch ×3", not "torch ×3": R3, the Pack test).
  const lead = one ?? name;
  return many ? `${n} ${many}` : `${lead.charAt(0).toLocaleUpperCase()}${lead.slice(1)} ×${n}`;
}

/** What an item's single pieces are called for a heading ("Ration days"): its `pluralName`, else `unitName`; null without them. */
export function piecesName(data: Record<string, unknown>): string | null {
  for (const key of ['pluralName', 'unitName']) {
    const word = typeof data[key] === 'string' ? String(data[key]).trim() : '';
    if (word) return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return null;
}

const text =(value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A line's `ifSize` swap for the character's size (`{ "Small": { "itemId": "<id>", "qty"? } }`, any case); null when none. */
function sizeSwap(line: Record<string, unknown>, size: string): Record<string, unknown> | null {
  if (!isRecord(line.ifSize) || !size) return null;
  const found = Object.entries(line.ifSize).find(([key]) => key.trim().toLowerCase() === size.trim().toLowerCase());
  return found && isRecord(found[1]) ? found[1] : null;
}

/** An item id through the kindred's armour substitutes (G-88: a Small kindred's kit gives its own armour). */
const substituted = (itemId: string, ctx: GearContext) => {
  const swap = isRecord(ctx.substitutes) ? text(ctx.substitutes[itemId]) : '';
  return swap || itemId;
};

/** "1d6" as its dice (one to three dice of up to 20 sides, at most 30 results); null for a number or anything else. */
export function unitsDice(value: unknown): { count: number; sides: number } | null {
  const m = /^(\d*)d(\d+)$/i.exec(text(value).replace(/\s+/g, ''));
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  if (count < 1 || count > 3 || sides < 2 || sides > 20 || count * sides - count + 1 > 30) return null;
  return { count, sides };
}

/** A raw line read for the character: the size swap, then the substitute; `units` as a whole number only. */
function readLine(raw: unknown, ctx: GearContext): KitItem | null {
  if (typeof raw === 'string') return raw.trim() ? { itemId: substituted(raw.trim(), ctx), qty: 1 } : null;
  if (!isRecord(raw)) return null;
  const swap = sizeSwap(raw, ctx.size ?? '');
  const id = text(swap?.itemId) || text(raw.itemId);
  const qty = whole(swap?.qty) ?? whole(raw.qty);
  const units = whole(raw.units);
  const count = qty && qty > 0 ? qty : 1;
  if (id) return { itemId: substituted(id, ctx), qty: count, ...(units && units > 0 ? { units } : {}) };
  // rc-3: a line by name only is a one-off (no weight or price).
  const name = text(raw.name);
  return name ? { itemId: '', qty: count, name } : null;
}

/** Gear lines read for the character (cs-6: `ifSize`, `armourSubstitutes`, `units`; rc-3: `{ name }` lines). */
export function gearLines(value: unknown, ctx: GearContext = {}): KitItem[] {
  return Array.isArray(value) ? value.flatMap((line) => readLine(line, ctx) ?? []) : [];
}

/**
 * A line the player settles on the Gear step (cs-6): a `oneOf` choice (the line's `itemId` is the default) or `units`
 * given as dice ("1d6" torches, rolled at the table). Only a kit's own `items` have them; elsewhere such a line gives
 * its default, or one bundle.
 */
const settledHere = (raw: unknown) => isRecord(raw) && ((Array.isArray(raw.oneOf) && raw.oneOf.some((id) => text(id))) || unitsDice(raw.units) !== null);

/** What a kit always holds (its `items`), for the character; the lines the player settles are its rolls instead. */
export const kitContents = (kit: Record<string, unknown>, ctx: GearContext = {}): KitItem[] =>
  gearLines(Array.isArray(kit.items) ? kit.items.filter((raw) => !settledHere(raw)) : [], ctx);

/**
 * A roll in a rolled kit (`rolls`): rolled at the table `times` times on `die`; each row gives its items. A `choice`
 * is a `oneOf` line (cs-6): no die, one row per item, the default (`preset`) ticked until another is tapped.
 */
export interface KitRollRule {
  name: string;
  die: string;
  times: number;
  rows: { min: number; max: number; items: KitItem[] }[];
  /** A `oneOf` line: picked, not rolled. */
  choice?: boolean;
  /** The row ticked before any tap (a choice's default). */
  preset?: number;
  /** A roll made more than once where the book says two different ones (bq-1): a row can't be picked twice. */
  distinct?: boolean;
}

/**
 * Whether a kit roll is for the character's class (eq-9: one quick kit, each class its own rolls): a roll with
 * `forClasses` (class ids, a list or one id) shows only to those classes; one without shows to every class. With no
 * class known (`classId` left out), every roll shows.
 */
export function rollForClass(roll: Record<string, unknown>, classId: string | undefined): boolean {
  const ids = (Array.isArray(roll.forClasses) ? roll.forClasses : [roll.forClasses]).map(text).filter(Boolean);
  return ids.length === 0 || classId === undefined || ids.includes(classId.trim());
}

/**
 * A kit's rolls, the ones that make sense (a name, a die and rows with whole ranges), then one per line of its `items`
 * the player settles (cs-6, G-92): `units` as dice ("Roll 1d6 · Torches", a row per result, each that many single
 * pieces), and `oneOf` ("Choose one · …", the default ticked). Their order follows the kit's, so saved picks stay put.
 */
export function kitRolls(kit: Record<string, unknown>, ctx: GearContext = {}): KitRollRule[] {
  const rolls = Array.isArray(kit.rolls)
    ? kit.rolls.flatMap((roll): KitRollRule[] => {
        if (!isRecord(roll) || typeof roll.name !== 'string' || typeof roll.die !== 'string' || !Array.isArray(roll.rows)) return [];
        if (!rollForClass(roll, ctx.classId)) return [];
        const rows = roll.rows.flatMap((row) => {
          if (!isRecord(row) || whole(row.min) === null || whole(row.max) === null) return [];
          return [{ min: row.min as number, max: row.max as number, items: gearLines(row.items, ctx) }];
        });
        const times = whole(roll.times);
        return rows.length > 0 ? [{ name: roll.name, die: roll.die, times: times && times > 0 ? times : 1, rows, ...(roll.distinct === true ? { distinct: true } : {}) }] : [];
      })
    : [];
  const nameOf = (id: string) => ctx.nameOf?.(id) ?? id;
  const settled = (Array.isArray(kit.items) ? kit.items : []).filter(settledHere).flatMap((raw): KitRollRule[] => {
    const line = raw as Record<string, unknown>;
    const base = readLine({ ...line, units: undefined }, ctx);
    if (!base || !base.itemId) return [];
    if (Array.isArray(line.oneOf) && line.oneOf.some((id) => text(id))) {
      const ids = [...new Set([text(line.itemId), ...line.oneOf.map(text)].filter(Boolean).map((id) => substituted(id, ctx)))];
      const at = Math.max(0, ids.indexOf(base.itemId));
      return [{ name: ids.map(nameOf).join(' or '), die: '', times: 1, choice: true, preset: at, rows: ids.map((id) => ({ min: 0, max: 0, items: [{ itemId: id, qty: base.qty }] })) }];
    }
    const dice = unitsDice(line.units)!;
    const rows = Array.from({ length: dice.count * dice.sides - dice.count + 1 }, (_, i) => dice.count + i).map((n) => ({ min: n, max: n, items: [{ itemId: base.itemId, qty: 1, units: n }] }));
    return [{ name: ctx.piecesNameOf?.(base.itemId) ?? nameOf(base.itemId), die: `${dice.count > 1 ? dice.count : 1}d${dice.sides}`, times: 1, rows }];
  });
  return [...rolls, ...settled];
}

/** A row's range as words: "3" or "3–4". */
export const rangeWords = (row: { min: number; max: number }) => (row.min === row.max ? `${row.min}` : `${row.min}–${row.max}`);

/** Everything a kit puts in the pack: its own items and, for a rolled kit, the rows picked for each roll. */
export function kitTaken(kit: Record<string, unknown>, picks: readonly (readonly number[])[], ctx: GearContext = {}): KitItem[] {
  const rolled = kitRolls(kit, ctx).flatMap((roll, i) => (picks[i] ?? []).flatMap((row) => roll.rows[row]?.items ?? []));
  return [...kitContents(kit, ctx), ...rolled];
}

/** How many single pieces a line puts in the pack: its `units`, else its count times the item's bundle. */
export const piecesOf = (line: KitItem, bundle: number): number => line.units ?? line.qty * bundle;

/** One purchase in the shopping: what it's called (a kit by name), its price in the base coin, and the lines it added. */
export interface Purchase {
  label: string;
  price: number;
  lines: { id: string; qty: number }[];
  /** A kit's id (the Gear step, m5b-0c slice 5): the kit rows read what's taken from it. */
  kitId?: string;
  /** A rolled kit's tapped rows, per roll and per time rolled (picks[roll][time] = row). */
  picks?: number[][];
}

// The Gear step (m5b-0c slice 5; cr-14, mockup creation/06) ----------------------------------------------------------

/**
 * What the player decided on Gear, as one comparable string (creation follow-up, 2026-11-07: Next reads "Back to
 * review" while nothing changed since the step opened from the review). Gear saves as it goes, so the step compares
 * this before and after rather than asking whether anything was saved: the coin as shown and whether it is the
 * untouched average; each purchase and kit by its label, price, kit and rolled rows (never the pack lines' ids, which
 * a put-back-and-take-again renews); the rows picked on each pick table; the trinket's words and roll. Taking
 * something and putting it back reads as unchanged, as it is.
 */
export function gearSignature(record: Record<string, unknown>, coin: { shown: string; usual: boolean }): string {
  const bought = Array.isArray(record.bought) ? record.bought.filter(isRecord) : [];
  const purchases = bought.map((p) => [p.label, p.price, p.kitId ?? null, p.picks ?? null]);
  const picks = isRecord(record.givenPicks)
    ? Object.keys(record.givenPicks)
        .sort()
        .map((table) => {
          const rows = (record.givenPicks as Record<string, unknown>)[table];
          return [table, Array.isArray(rows) ? rows.filter(isRecord).map((r) => r.row) : []];
        })
        .filter(([, rows]) => (rows as unknown[]).length > 0)
    : [];
  const trinket = isRecord(record.trinket) ? [record.trinket.text ?? null, record.trinket.rolled ?? null] : null;
  return JSON.stringify({ coin: [coin.shown.trim(), coin.usual], purchases, picks, trinket });
}

const topOf = (rulesSets: readonly Record<string, unknown>[], key: string): unknown => {
  for (const rules of [...rulesSets].reverse()) if (rules[key] !== undefined) return rules[key];
  return undefined;
};

/**
 * Whether the Gear step offers Browse the shop (cf-4, ruled 2026-11-02): not when the setting's `startingGear.shop` is
 * false. The rules sets are already resolved for the campaign's options (a setting that rolls its gear when an option is
 * off says so through `byOption`), so the app keeps no option ids.
 */
/**
 * How many kits a character may take (07 `creation.kits.pick`, Design 2026-11-07): the Gear step's heading, "To choose
 * (pick N)". A positive whole number from the top rules set that says; 1 when none does (or the value can't be read).
 * Past it, a kit is still takeable: Gear says so and flags it for the GM (Design, 2026-11-07).
 */
export function kitsToPick(rulesSets: readonly Record<string, unknown>[]): number {
  for (const rules of [...rulesSets].reverse()) {
    const kits = isRecord(rules.creation) && isRecord(rules.creation.kits) ? rules.creation.kits : null;
    if (kits && kits.pick !== undefined) return Number.isInteger(kits.pick) && (kits.pick as number) > 0 ? (kits.pick as number) : 1;
  }
  return 1;
}

export function shopOpen(rulesSets: readonly Record<string, unknown>[]): boolean {
  const gear = topOf(rulesSets, 'startingGear');
  return !(isRecord(gear) && gear.shop === false);
}

/**
 * What everyone starts with, whatever the class (07 `startingEquipment`, a list of item ids; cf-4): the Gear step's
 * Given group. An id named twice is two of it. Empty when the setting gives nothing.
 */
export function startingEquipment(rulesSets: readonly Record<string, unknown>[], ctx: GearContext = {}): KitItem[] {
  const lines = topOf(rulesSets, 'startingEquipment');
  if (!Array.isArray(lines)) return [];
  // Ids, or `{ itemId, qty, units? }` lines (cs-6, G-92); a pick line is read by startingPicks.
  const out: KitItem[] = [];
  for (const line of gearLines(lines.filter((l) => !(isRecord(l) && isRecord(l.pick))), ctx)) {
    const had = line.units === undefined ? out.find((l) => l.units === undefined && l.itemId === line.itemId && l.name === line.name) : undefined;
    if (had) had.qty += line.qty;
    else out.push({ ...line });
  }
  return out;
}

/** A pick from a table in the setting's given gear (of-11, G-83: `{ "pick": { "tableId", "upTo" } }`): up to N rows, fewer allowed. */
export interface GearPick {
  tableId: string;
  upTo: number;
}

/** The setting's given gear's picks, in order (of-11); a pick without a table or a count of at least 1 is left out. */
export function startingPicks(rulesSets: readonly Record<string, unknown>[]): GearPick[] {
  const lines = topOf(rulesSets, 'startingEquipment');
  if (!Array.isArray(lines)) return [];
  return lines.flatMap((l) => {
    const pick = isRecord(l) && isRecord(l.pick) ? l.pick : null;
    const upTo = whole(pick?.upTo);
    return pick && text(pick.tableId) && upTo && upTo > 0 ? [{ tableId: text(pick.tableId), upTo }] : [];
  });
}

/** A gear table's rows as the pick reads them (a table row's `items`, read for the character); rows giving nothing are left out. */
export function pickRows(table: Record<string, unknown>, ctx: GearContext = {}): { min: number; max: number; result: string; items: KitItem[] }[] {
  if (!Array.isArray(table.rows)) return [];
  return table.rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const items = gearLines(row.items, ctx);
    if (items.length === 0) return [];
    const min = whole(row.min) ?? 0;
    return [{ min, max: whole(row.max) ?? min, result: text(row.result), items }];
  });
}

/** The pick's rows already put in the pack, as the record keeps them (`givenPicks[<table id>]`: row numbers and lines). */
export function givenPicksOf(record: Record<string, unknown>, tableId: string): { row: number; lines: { id: string; qty: number }[] }[] {
  const all = isRecord(record.givenPicks) ? record.givenPicks[tableId] : undefined;
  if (!Array.isArray(all)) return [];
  return all.filter(isRecord).flatMap((p) =>
    Number.isInteger(p.row) && Array.isArray(p.lines)
      ? [{ row: p.row as number, lines: p.lines.filter(isRecord).flatMap((l) => (typeof l.id === 'string' && Number.isInteger(l.qty) ? [{ id: l.id, qty: l.qty as number }] : [])) }]
      : [],
  );
}

/** A pick's heading (of-11, ct3-6's pick-N, fewer allowed): "Pick up to 4 · Starting adventuring items". */
export const pickTitle = (pick: GearPick, tableName: string) => `${tableName}: pick up to ${pick.upTo}`;

/** A pick's count: "0 of 4 picked", every pick counted (a row picked twice is two, R3-8). */
export const pickMeta = (pick: GearPick, picked: number) => `${picked} of ${pick.upTo} picked`;

/**
 * What a pick table's rows put in the pack, thing by thing, in the order taken (cts-3). A thing given by two rows, or by
 * a row taken twice, is one line with its sum: a row of 2 eels taken twice is 4 eels, never "×2 ×2". Whole items and
 * single pieces (`units`) are summed apart. A row the table doesn't have gives nothing; the rows are left as they are.
 */
export function takenLines(rows: readonly { items: readonly KitItem[] }[], taken: readonly number[]): KitItem[] {
  const out: KitItem[] = [];
  for (const row of taken) {
    for (const line of rows[row]?.items ?? []) {
      const at = out.findIndex((l) => l.itemId === line.itemId && l.name === line.name && (l.units === undefined) === (line.units === undefined));
      const had = out[at];
      if (!had) out.push({ ...line });
      else out[at] = had.units !== undefined && line.units !== undefined ? { ...had, units: had.units + line.units } : { ...had, qty: had.qty + line.qty };
    }
  }
  return out;
}

/**
 * The one summed list of a pick table's names (cts-1, cts-3; the plan's ⚑ 4): every name, in the order taken, a thing
 * once with its sum ("Reed rope, Eel hooks ×2, Tallow candles ×3"). `nameOf` words one summed line as the pack does
 * ("Eel hooks ×2", "3 tallow candles"); a line it can't name (the setting no longer has the thing) is left out.
 */
export function pickNames(rows: readonly { items: readonly KitItem[] }[], taken: readonly number[], nameOf: (line: KitItem) => string | undefined): string[] {
  return takenLines(rows, taken).flatMap((line) => {
    const name = nameOf(line);
    return name ? [name] : [];
  });
}

/**
 * A pick table's row on Gear once its sheet is closed (cts-3). Nothing taken: "0 of 4 picked. 20 to choose from".
 * Something taken: "4 of 4 picked: Reed rope, Eel hooks ×2, Tallow candles ×3", with no "to choose from". The row
 * keeps it to two lines on screen; the words name every thing. Every pick is counted (a row taken twice is two, R3-8).
 */
export function pickRowWords(pick: GearPick, rows: readonly { items: readonly KitItem[] }[], taken: readonly number[], nameOf: (line: KitItem) => string | undefined): string {
  if (taken.length === 0) return `${pickMeta(pick, 0)}. ${rows.length} to choose from`;
  const names = pickNames(rows, taken, nameOf);
  return names.length > 0 ? `${pickMeta(pick, taken.length)}: ${names.join(', ')}` : pickMeta(pick, taken.length);
}

/** The pick table's sheet foot (cts-1): "0 of 4 marked", then "4 of 4 marked: Reed rope, Eel hooks ×2, Tallow candles ×3". */
export function pickFootWords(pick: GearPick, rows: readonly { items: readonly KitItem[] }[], marked: readonly number[], nameOf: (line: KitItem) => string | undefined): string {
  const count = `${marked.length} of ${pick.upTo} marked`;
  const names = pickNames(rows, marked, nameOf);
  return names.length > 0 ? `${count}: ${names.join(', ')}` : count;
}

/** A tap on a pick's row when the marks are full (cs-15: a tap marks): why nothing happened. */
export const pickFull = (pick: GearPick) => `${pick.upTo} of ${pick.upTo} marked: take one off to mark another.`;

/**
 * What the kindred gives at creation (cs-2: a race's `startingItems`, item ids), added to the setting's given gear in
 * the Gear step's Given group, each row saying "from your kindred". Pass the race as the character plays it
 * (creation.ts raceAsPlayed: a kindred-class's own kindred gives nothing beside it, cs-4). An id named twice is two.
 */
export function kindredItems(race: Record<string, unknown> | null | undefined): KitItem[] {
  return startingEquipment(race && Array.isArray(race.startingItems) ? [{ startingEquipment: race.startingItems }] : []);
}

/** The gear context of a kindred as the class plays it (cs-6): its size and armour substitutes. */
export function gearContextOf(
  race: Record<string, unknown> | null | undefined,
  nameOf?: (itemId: string) => string | undefined,
  classId?: string,
  piecesNameOf?: (itemId: string) => string | undefined,
): GearContext {
  return {
    size: race ? text(race.size) : '',
    substitutes: race && isRecord(race.armourSubstitutes) ? race.armourSubstitutes : {},
    ...(nameOf ? { nameOf } : {}),
    ...(classId !== undefined ? { classId } : {}),
    ...(piecesNameOf ? { piecesNameOf } : {}),
  };
}

/** A roll's or choice's heading: a choice reads "Choose one · Fiddle or Pipe" (cs-6). */
export function settleTitle(roll: Pick<KitRollRule, 'name' | 'die' | 'times' | 'choice'>): string {
  return roll.choice ? `Choose one: ${roll.name}` : rollTitle(roll);
}

/** The given gear already put in the pack, as the creation record keeps it (`givenGear`: line ids and counts); null when not yet. */
export function givenGearOf(record: Record<string, unknown>): { id: string; qty: number }[] | null {
  if (!Array.isArray(record.givenGear)) return null;
  return record.givenGear.flatMap((l) => (isRecord(l) && typeof l.id === 'string' && Number.isInteger(l.qty) ? [{ id: l.id, qty: l.qty as number }] : []));
}

/** The step's title and Help me choose, the app's own (cr-6: about the choice, never the rules). */
export const GEAR_TITLE = 'Gear';
export const GEAR_HELP = {
  kit: "Gear is what your character carries into their first adventure: armour, weapons, light and food. A kit is a ready-made set that covers the basics in one pick; the shop lets you choose item by item with your starting coin. What you carry has weight, and a heavy load slows you down: the load line shows it as you add. If you're unsure, take a kit, then check you have light and food, or ask your GM.",
  shop: "Gear is what your character carries into their first adventure: armour, weapons, light and food. You buy it item by item in the shop with your starting coin. What you carry has weight, and a heavy load slows you down: the load line shows it as you add. If you're unsure, buy armour and a weapon your class can use, then light and food, or ask your GM.",
  given: "Gear is what your character carries into their first adventure. In this setting it is given or rolled, not bought: the step shows what you start with and asks only for the rolls and choices your setting leaves to you. If you're unsure, roll at the table and tap what you rolled, or ask your GM.",
} as const;

/** Help me choose for Gear (cw-4), by what the step offers: a kit, only the shop, or gear given and nothing bought. */
export function gearHelp(offers: { kits: boolean; shop: boolean }): string {
  return offers.kits ? GEAR_HELP.kit : offers.shop ? GEAR_HELP.shop : GEAR_HELP.given;
}


/**
 * The coins trait-list entries add to starting money (rc-2 `money`), as the record keeps them (`traitMoney`, by list):
 * counted in the money's coin, like the typed roll. 0 without.
 */
export function entryMoneyOf(record: unknown): number {
  const all = isRecord(record) && isRecord(record.traitMoney) ? Object.values(record.traitMoney) : [];
  return all.reduce<number>((sum, n) => sum + (whole(n) ?? 0), 0);
}

/**
 * Whether the starting coin on a creation record is the setting's usual, never stepped or typed (cw-11, Design's answer
 * 2): the record's `moneyTouched` is false (slice D's `coinRolled` reads the same flag). The review and the GM's approval card say "100, the usual (not rolled)" then,
 * else "100 rolled". A record without the flag (from before cw-11) was typed: rolled.
 */
export const moneyUsualOf = (record: unknown): boolean => isRecord(record) && record.moneyTouched === false && typeof record.startingMoney === 'number';

/** The money typed: a whole number, or null. */
export const readMoney = (text: string): number | null => (/^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : null);

/**
 * What Next says on the Gear step (cr-14: it checks overspending, nothing else; a character may set out with
 * nothing). With no money typed Next goes on and the purse starts at 0 (ruled 2026-11-02).
 */
export function gearProblem({ left, show }: { moneyRoll?: string; money?: number | null; left: number; show: (base: number) => string }): string | null {
  if (left < 0) return `${show(-left)} short: put something back.`;
  return null;
}

/** What a paid thing answers instead of being taken (never greyed, mockup creation/06): null when it fits. */
export function shortOf(price: number, left: number, moneyTyped: boolean, show: (base: number) => string): string | null {
  if (price <= 0) return null;
  if (!moneyTyped) return 'Type your starting money first.';
  return price > left ? `${show(price - left)} short.` : null;
}

/** The foot's hint: "1 kit · 2 bought". */
/**
 * The Gear step's state in its foot (cs-22, pictures creation/final 21-F1, 21-F2): "No kit yet, nothing bought"; "1 kit,
 * 1 of 2 picked, 2 things bought", a pick table's count in its place.
 */
export const gearHint = (kits: number, bought: number, picks: readonly { taken: number; upTo: number }[] = []) =>
  [kits === 0 ? 'No kit yet' : `${kits} ${kits === 1 ? 'kit' : 'kits'}`, ...picks.map((p) => `${p.taken} of ${p.upTo} picked`), bought === 0 ? 'nothing bought' : `${bought} ${bought === 1 ? 'thing' : 'things'} bought`].join(', ');

/** A set of things' weight in the campaign's mode: "520 coins", "9 slots", or '' when it isn't tracked or unknown. */
export function weightWords(lines: readonly { weightCoin: number | null; slots: number | null; qty: number }[], mode: string): string {
  if (mode === 'slot') {
    const known = lines.filter((l) => l.slots !== null);
    if (known.length === 0) return '';
    const n = known.reduce((sum, l) => sum + (l.slots ?? 0) * l.qty, 0);
    return `${n} ${n === 1 ? 'slot' : 'slots'}`;
  }
  if (mode === 'none') return '';
  const known = lines.filter((l) => l.weightCoin !== null);
  if (known.length === 0) return '';
  return `${known.reduce((sum, l) => sum + (l.weightCoin ?? 0) * l.qty, 0)} coins`;
}

/** A rolled kit's picks with nothing tapped: one empty slot per time each roll is rolled. */
export const noRollPicks = (kit: Record<string, unknown>, ctx: GearContext = {}): (number | undefined)[][] =>
  kitRolls(kit, ctx).map((r) => Array.from({ length: r.times }, () => (r.choice ? r.preset : undefined)));

/** The first roll with a time not tapped yet, by its name ("Armour", "Weapons"); null when every one is tapped. */
export function untappedRoll(kit: Record<string, unknown>, picks: readonly (readonly (number | undefined)[])[], ctx: GearContext = {}): string | null {
  const rolls = kitRolls(kit, ctx);
  for (let i = 0; i < rolls.length; i++) {
    const roll = rolls[i]!;
    for (let t = 0; t < roll.times; t++) if (picks[i]?.[t] === undefined) return roll.name;
  }
  return null;
}

/** One row tapped for one roll and time: picked, or unpicked when it was the one. */
export function tapRollRow(picks: readonly (readonly (number | undefined)[])[], roll: number, time: number, row: number): (number | undefined)[][] {
  return picks.map((times, i) => (i !== roll ? [...times] : times.map((p, t) => (t !== time ? p : p === row ? undefined : row))));
}

/** How many of a roll's times this row has (0, 1, 2…): the row shows ✓, or ✓✓ when tapped twice. */
export const rowTimes = (picks: readonly (readonly (number | undefined)[])[], roll: number, row: number): number => (picks[roll] ?? []).filter((p) => p === row).length;

/**
 * A row tapped on a roll shown as one table (ct3-6, ruled 2026-11-03: "Roll d4 twice · pick 2", the player taps two
 * rows). An untapped row fills the first empty time. A tapped row is tapped again (✓✓: dice can show the same twice,
 * and a row of gear twice is two of it) while a time is still empty, else it is untapped, every time it had. A tap on
 * an untapped row when every time is filled changes nothing and says why ("2 of 2 tapped · untap one first.").
 * `distinct` (bq-1, the roll's `distinct: true`): a tapped row tapped again untaps at once, every time it had, with
 * no message (sq-3, 2026-11-04: the row's state says it all).
 */
export function tapRollGroupRow(
  picks: readonly (readonly (number | undefined)[])[],
  roll: number,
  row: number,
  distinct = false,
): { picks: (number | undefined)[][]; problem: string | null } {
  const next = picks.map((times) => [...times]);
  const times = next[roll];
  if (!times) return { picks: next, problem: null };
  // A roll made once: the row tapped is the one (another row moves the tap; the same row untaps it), as before.
  if (times.length === 1) return { picks: tapRollRow(picks, roll, 0, row), problem: null };
  const empty = times.indexOf(undefined);
  const has = times.includes(row);
  if (has && (empty < 0 || distinct)) next[roll] = times.map((p) => (p === row ? undefined : p));
  else if (empty >= 0) times[empty] = row;
  else return { picks: next, problem: `${times.length} of ${times.length} tapped: untap one first.` };
  return { picks: next, problem: null };
}

/** A roll's heading as one table (ct3-6): "Roll d6 · Armour"; "Roll d4 twice · pick 2 · Weapons". */
export function rollTitle(roll: Pick<KitRollRule, 'name' | 'die' | 'times'>): string {
  if (roll.times <= 1) return `${roll.name}: roll ${roll.die}`;
  return `${roll.name}: roll ${roll.die} ${roll.times === 2 ? 'twice' : `${roll.times} times`}, pick ${roll.times}`;
}

/** A roll's count beside its heading: "tap your result", "tap your results", "1 of 2 tapped". */
export function rollMeta(roll: Pick<KitRollRule, 'times'>, picks: readonly (number | undefined)[] | undefined): string {
  const tapped = (picks ?? []).filter((p) => p !== undefined).length;
  if (tapped === 0) return roll.times > 1 ? 'tap your results' : 'tap your result';
  return `${tapped} of ${roll.times} tapped`;
}

/**
 * What the shopping bought, as kept on the creation record. An entry without a price or lines (older records) is
 * listed but can't be refunded.
 */
export function purchasesOf(value: unknown): Purchase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p): Purchase[] => {
    if (typeof p === 'string') return [{ label: p, price: 0, lines: [] }];
    if (!p || typeof p !== 'object') return [];
    const { label, price, lines, kitId, picks } = p as Record<string, unknown>;
    if (typeof label !== 'string') return [];
    const kept = Array.isArray(lines)
      ? lines.flatMap((l) => {
          const { id, qty } = (l ?? {}) as Record<string, unknown>;
          return typeof id === 'string' && Number.isInteger(qty) && (qty as number) > 0 ? [{ id, qty: qty as number }] : [];
        })
      : [];
    const rows = Array.isArray(picks) && picks.every((times) => Array.isArray(times) && times.every((r) => Number.isInteger(r) && r >= 0)) ? (picks as number[][]) : null;
    return [
      {
        label,
        price: Number.isInteger(price) && (price as number) >= 0 ? (price as number) : 0,
        lines: kept,
        ...(typeof kitId === 'string' ? { kitId } : {}),
        ...(rows ? { picks: rows } : {}),
      },
    ];
  });
}

/**
 * What Next said it did with a pick table's marks (cs-42, the lead's words): "2 taken from Odds and ends.", "1 put back
 * in Odds and ends.", "2 taken, 1 put back in Odds and ends."; figures, the table's name as the pack writes it.
 */
export function nextTakeWords(table: string, taken: number, putBack: number): string {
  if (taken > 0 && putBack > 0) return `${taken} taken, ${putBack} put back in ${table}.`;
  if (putBack > 0) return `${putBack} put back in ${table}.`;
  return `${taken} taken from ${table}.`;
}
