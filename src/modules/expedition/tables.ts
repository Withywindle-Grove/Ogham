// Reading a table's row from a roll made at the table (docs/05 "Explore, Encounter and Fight": Hit in M5 and the
// current encounter table, ruled 2026-10-29, D30; docs/07 "tables"). The app never rolls: the GM types what the dice
// showed and the matching row lights. Every row shape 07 allows is read: plain rows with a range ({ min, max, result,
// count? }), composite dice ("d4/d10", each row with its "3/7" key), a matrix (columns, each row's results in column
// order, its range as min/max or a level such as "2", "3–4" or "8+"), a lookup (no die: { key, value } or
// { key, values }, a key that isn't a range being the row's label), a row's `cells` (one per column, all shown) and
// its `items`. A matrix's column is the GM's pick, or the terrain's own (encounterColumn). `rowText` is the one reader
// of a row's words for every screen that shows one (fix-table-row-shapes). Anything a table writes oddly is left out,
// never guessed. Pure.

export interface TableRow {
  /** The range the roll falls in (inclusive); null when the row has none (a composite die's row uses `key`). */
  min: number | null;
  max: number | null;
  /** A composite die's result, as "3/7". */
  key: string | null;
  /** A lookup row's key, or a matrix row's level, that isn't a range ("Footbridge", "6 or lower"): the row's label. */
  label: string | null;
  /** The result, or (a matrix) one per column. */
  result: string | null;
  results: string[];
  /** Every column's words, all shown (a row's `cells`, or a lookup row's `values`), in column order; '' for a blank one. */
  cells: string[];
  /** The items the row gives (07 `items`, the kit line's shape): a one-off's name, else the item's id. */
  items: { name: string; qty: number }[];
  /** How many ("1d4"), for encounter rows. */
  count: string | null;
  note: string | null;
  /** The stat block the row names (07: encounter rows may add statBlockId), for its one-line description. */
  statBlockId: string | null;
  /** A stat block in another attached pack, "<meta.id>:<id>" (07 References; December 5a): resolved by rowLinks.ts. */
  statBlockRef?: string | null;
  /** The table the row opens next, as the pack names it: its `tableRef` ("<meta.id>:<id>") or same-pack `tableId`. */
  link?: string | null;
  /** That table's id once resolved against the campaign's packs (rowLinks.ts); a same-pack `tableId` before then. */
  tableLink?: string | null;
  /** The links the row names that the campaign's packs don't have (rowLinks.ts), shown with the row's own words. */
  missing?: string[];
  /**
   * The creatures a row lists as one encounter (07 `statBlockIds`, G-68; each with its own count, pf-2, December 5b),
   * in the pack's order: the stat block as the pack names it, its id once resolved (rowLinks.ts), and how many.
   */
  creatures?: RowCreature[];
  /** The table this row opens next by terrain (07 `next: { byTerrain, default }`, ga-2); null for a plain row. */
  next: RowNext | null;
}

/** One creature of a row's `statBlockIds` (pf-2): a plain id, or { statBlockId | statBlockRef, count }. */
export interface RowCreature {
  /** As the pack names it: an id, or "<meta.id>:<id>". */
  ref: string;
  /** The stat block's id once resolved against the campaign's packs (rowLinks.ts); the plain id until then. */
  statBlockId: string | null;
  /**
   * Its own count (pf-2). A plain id has none: the row's count is the group's, shown once as How many. In a row that
   * mixes counted and plain entries, the plain ones take the row's (as the lead's ruling reads; ⚑ to the lead).
   */
  count: string | null;
  /** The count is the creature's own (not the row's). */
  ownCount: boolean;
}

/** A row's next table by terrain (ga-2): a terrain's id or class id → table id, in the pack's order; and the default. */
export interface RowNext {
  byTerrain: { key: string; tableId: string }[];
  default: string | null;
}

/** Where the party is, for a row's next table by terrain: the terrain's id and its class (07 Terrain). */
export interface TerrainKey {
  id: string;
  classId: string | null;
}

export interface ReadTable {
  id: string;
  name: string;
  /** The die named ("d8", "d4/d10"); null for a lookup with no die. */
  die: string | null;
  /** A matrix's column labels (empty for a plain table). */
  columns: string[];
  rows: TableRow[];
  /** The die is two dice read apart ("d4/d10"): the roll is typed as "3/7". */
  composite: boolean;
  /** A row's result names the next table through this ("wild-{result}"). */
  nextTablePattern: string | null;
  note: string | null;
  /** One line on what the table covers (07 `tables[].description`, G-44), for the GM's table list. */
  description: string | null;
  /**
   * How a name table's columns join (07 `join`, ct-7, G-192): a row's cells read as one name with this between them
   * ("" makes "Adder" + "ley" read "Adderley"); null when the table doesn't say (each cell under its header).
   */
  join: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null);
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/**
 * "2", "3-4", "3–4", "8+", "≤2": a range; null when it can't be read. "8+" is 8 or more and "≤2" is 2 or less (any
 * roll up to 2, a modified one below the die's lowest too): the open end is the largest or smallest safe integer.
 */
export function rangeOf(value: unknown): { min: number; max: number } | null {
  if (int(value) !== null) return { min: value as number, max: value as number };
  if (typeof value !== 'string') return null;
  const plain = value.trim();
  const span = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(plain);
  if (span) return { min: Number(span[1]), max: Number(span[2]) };
  const up = /^(\d+)\s*\+$/.exec(plain);
  if (up) return { min: Number(up[1]), max: Number.MAX_SAFE_INTEGER };
  const down = /^≤\s*(\d+)$/.exec(plain);
  if (down) return { min: Number.MIN_SAFE_INTEGER, max: Number(down[1]) };
  const one = /^(\d+)$/.exec(plain);
  return one ? { min: Number(one[1]), max: Number(one[1]) } : null;
}

/** A row's `next`, read leniently: entries that aren't text are left out; null when nothing is left. */
function readNext(value: unknown): RowNext | null {
  if (!isRecord(value)) return null;
  const byTerrain = isRecord(value.byTerrain)
    ? Object.entries(value.byTerrain).flatMap(([key, id]) => {
        const tableId = typeof id === 'string' && id.trim() ? id.trim() : null;
        return key.trim() && tableId ? [{ key: key.trim(), tableId }] : [];
      })
    : [];
  const fallback = typeof value.default === 'string' && value.default.trim() ? value.default.trim() : null;
  return byTerrain.length > 0 || fallback ? { byTerrain, default: fallback } : null;
}

/**
 * A row's `statBlockIds` (pf-2): each entry a plain id or { statBlockId | statBlockRef, count }; an entry with neither
 * id is left out. A plain id has no count of its own: the row's `count` is the group's; only in a row that mixes
 * counted and plain entries does a plain one take the row's count.
 */
function readCreatures(value: unknown, rowCount: string | null): RowCreature[] {
  if (!Array.isArray(value)) return [];
  const mixed = value.some((entry) => isRecord(entry) && text(entry.count) !== null);
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return entry.trim() ? [{ ref: entry.trim(), statBlockId: entry.trim(), count: mixed ? rowCount : null, ownCount: false }] : [];
    if (!isRecord(entry)) return [];
    const ref = text(entry.statBlockRef) ?? text(entry.statBlockId);
    const own = text(entry.count);
    return ref ? [{ ref, statBlockId: text(entry.statBlockRef) ? null : ref, count: own ?? (mixed ? rowCount : null), ownCount: own !== null }] : [];
  });
}

/** A row's `items`, read leniently: each line's `name`, else its `itemId`; a count that isn't a whole number is 1. */
function readItems(value: unknown): { name: string; qty: number }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((line) => {
    const name = text(line.name) ?? text(line.itemId);
    const qty = int(line.qty);
    return name ? [{ name, qty: qty !== null && qty > 0 ? qty : 1 }] : [];
  });
}

const keyOf = (value: string) => value.replace(/\s+/g, '').replace(/[\\|,]/g, '/');

function readRow(data: Record<string, unknown>): TableRow | null {
  const min = int(data.min);
  const max = int(data.max);
  const range = min !== null ? { min, max: max ?? min } : (rangeOf(data.roll) ?? rangeOf(data.level) ?? (data.key !== undefined && !String(data.key).includes('/') ? rangeOf(data.key) : null));
  const key = typeof data.key === 'string' && data.key.includes('/') ? keyOf(data.key) : null;
  const label = !range && !key ? (text(data.key) ?? text(data.level)) : null;
  const results = Array.isArray(data.results) ? data.results.map((r) => text(r) ?? '—') : [];
  const said = Array.isArray(data.cells) ? data.cells : Array.isArray(data.values) ? data.values : [];
  const cells = said.map((c) => text(c) ?? '');
  const items = readItems(data.items);
  const result = text(data.result) ?? text(data.value);
  if (!range && !key && !label) return null;
  if (result === null && results.length === 0 && !cells.some(Boolean) && items.length === 0) return null;
  return { min: range?.min ?? null, max: range?.max ?? null, key, label, result, results, cells, items, count: text(data.count), note: text(data.note) ?? text(data.notes), statBlockId: text(data.statBlockId), statBlockRef: text(data.statBlockRef), link: text(data.tableRef) ?? text(data.tableId), tableLink: text(data.tableId), creatures: readCreatures(data.statBlockIds, text(data.count)), next: readNext(data.next) };
}

/** A table entry's data, read leniently; null when it has no rows that can be read. */
export function readTable(id: string, name: string, data: Record<string, unknown>): ReadTable | null {
  const rows = (Array.isArray(data.rows) ? data.rows : []).filter(isRecord).flatMap((r) => readRow(r) ?? []);
  if (rows.length === 0) return null;
  const die = text(data.die) ?? text(data.roll);
  return {
    id,
    name,
    die,
    columns: Array.isArray(data.columns) ? data.columns.map((c) => text(c) ?? '').filter(Boolean) : [],
    rows,
    composite: !!die && die.includes('/'),
    nextTablePattern: text(data.nextTablePattern),
    note: text(data.dieNote) ?? text(data.note) ?? text(data.notes),
    description: text(data.description),
    join: typeof data.join === 'string' ? data.join : null,
  };
}

export type RowReading =
  | { ok: true; index: number; row: TableRow; result: string; count: string | null; column: string | null }
  | { ok: false; message: string };

/** A row's result, in its column for a matrix; null when a matrix needs a column picked first. */
export function resultOf(table: ReadTable, row: TableRow, column: string | null): string | null {
  if (row.results.length === 0) return row.result;
  if (column === null) return table.columns.length <= 1 ? (row.results[0] ?? null) : null;
  const at = table.columns.indexOf(column);
  return at >= 0 ? (row.results[at] ?? null) : null;
}

/** The table's columns are a pick (a matrix: rows give one result per column); a row's `cells` or a lookup's `values` aren't. */
export const pickColumns = (table: ReadTable): string[] => (table.columns.length > 1 && table.rows.some((r) => r.results.length > 0) ? table.columns : []);

/**
 * A row's words, the one reader for every screen that shows a row (the GM's tables screen, the table pop-up, Table library ›
 * and the GM reference): a matrix's result in the column picked (all of them, when none is or the table names no
 * columns); else its cells, each
 * under its column's header ("First name: Brindle · Surname: Ashcombe"), or one name when the table says how they
 * join (ct-7: "Adderley"); else its result; else its item list
 * ("Reed lantern ×2, Wick"). "—" when it has none.
 */
export function rowText(table: ReadTable, row: TableRow, column: string | null): string {
  if (row.results.length > 0) return (table.columns.length > 0 ? resultOf(table, row, column) : null) ?? row.results.join(', ');
  // A name table that says how its columns join (ct-7) reads as one name: "Adderley", not "First: Adder · Second: ley".
  if (table.join !== null && row.cells.some(Boolean)) {
    const parts = row.cells.filter(Boolean);
    // As at creation (kindredTables.ts joinName): with join "" one hyphen goes at each seam ("Adder-" + "-bald").
    return table.join === '' ? parts.map((p, i) => p.slice(i > 0 && p.startsWith('-') ? 1 : 0, i < parts.length - 1 && p.endsWith('-') ? -1 : undefined)).join('') : parts.join(table.join);
  }
  const cells = row.cells.flatMap((cell, i) => (cell ? [table.columns[i] ? `${table.columns[i]}: ${cell}` : cell] : []));
  if (cells.length > 0) return cells.join(', ');
  if (row.result) return row.result;
  if (row.items.length > 0) return row.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(', ');
  return '—';
}

/** The row a roll lands on: typed as a number, or "3/7" for a composite die. Says plainly what's wrong otherwise. */
export function rowFor(table: ReadTable, typed: string, column: string | null = null): RowReading {
  const said = typed.trim();
  if (!said) return { ok: false, message: 'Type what the dice showed.' };
  let index: number;
  if (table.composite) {
    const key = keyOf(said);
    if (!/^\d+\/\d+$/.test(key)) return { ok: false, message: `Type both dice, like 3/7 (${table.die}).` };
    index = table.rows.findIndex((r) => r.key === key);
  } else {
    if (!/^\d{1,4}$/.test(said)) return { ok: false, message: 'Type a whole number, like 4.' };
    const n = Number(said);
    index = table.rows.findIndex((r) => r.min !== null && r.max !== null && n >= r.min && n <= r.max);
  }
  if (index < 0) return { ok: false, message: `No row of ${table.name} has ${said}. Check the roll.` };
  const row = table.rows[index]!;
  if (row.results.length > 0 && table.columns.length > 1 && (column === null || !table.columns.includes(column))) {
    return { ok: false, message: 'Pick a column first.' };
  }
  const result = rowText(table, row, column);
  return { ok: true, index, row, result, count: row.count, column: row.results.length > 0 ? column : null };
}

/** A row's result in words, with how many ("Bog lurkers · 1d4"). */
export function resultWords(result: string, count: string | null): string {
  return count ? `${result}, ${count}` : result;
}

/** Finds a table's own id from an id as a result or pattern spells it; null when there's no such table. */
export type TableLookup = (id: string) => string | null;

/**
 * The lookup for a set of table ids: whatever the case ("Wild-B-Animal" finds "wild-b-animal"; pack review area 2,
 * 2026-11-03). An exact match wins over one that differs only in case.
 */
export function tableLookup(ids: Iterable<string>): TableLookup {
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  for (const id of ids) {
    exact.add(id);
    if (!folded.has(id.toLowerCase())) folded.set(id.toLowerCase(), id);
  }
  return (id) => (exact.has(id) ? id : (folded.get(id.toLowerCase()) ?? null));
}

/** A result as an id: trimmed, without a trailing marker such as "*", "†" or "‡" (a footnote in the book). */
export const resultAsId = (result: string) => result.trim().replace(/[\s*†‡]+$/u, '');

/**
 * Whether the row's own `count` still says something (pf-2): not when every creature it lists has its own count, unless
 * the row also names its own stat block (the count is then that one's).
 */
export function rowCountShown(row: TableRow): boolean {
  const creatures = row.creatures ?? [];
  return row.count !== null && (row.statBlockId !== null || !(creatures.length > 0 && creatures.every((c) => c.ownCount)));
}

/** The table a result leads to (one more level allowed, 05): the pattern's, or a table named by the result; else null. */
export function nextTableId(table: ReadTable, result: string, known: TableLookup): string | null {
  const said = resultAsId(result);
  if (!said) return null;
  const viaPattern = table.nextTablePattern ? known(table.nextTablePattern.replace('{result}', said)) : null;
  return viaPattern ?? known(said);
}

/**
 * The table a row's `next` opens (ga-2): the current terrain's (its id first, then its class), else the default; a
 * table the setting rules don't have is passed over. Null when none of them is a table.
 */
export function nextByTerrain(next: RowNext, terrain: TerrainKey | null, known: TableLookup): string | null {
  const keyed = (key: string | null) => (key ? next.byTerrain.find((b) => b.key.toLowerCase() === key.toLowerCase()) : undefined);
  const picked = terrain ? (keyed(terrain.id) ?? keyed(terrain.classId)) : undefined;
  return (picked ? known(picked.tableId) : null) ?? (next.default ? known(next.default) : null);
}

/**
 * The table a row leads to (a nested table, 05: "a row pointing to another table opens that table next"): a row's
 * `next` by the terrain (ga-2), else the table the row names (`tableId`, or `tableRef` in another attached pack once
 * resolved; December 5a), else through the table's pattern or a result naming a table, in the column picked; null
 * when it leads nowhere.
 */
export function rowLeadsTo(table: ReadTable, row: TableRow, column: string | null, known: TableLookup, terrain: TerrainKey | null = null): string | null {
  const byTerrain = row.next ? nextByTerrain(row.next, terrain, known) : null;
  if (byTerrain) return byTerrain;
  const named = row.tableLink ? known(row.tableLink) : null;
  if (named) return named;
  const result = resultOf(table, row, column);
  return result ? nextTableId(table, result, known) : null;
}

/**
 * Every table a row's `next` may open, the one for this terrain first (ga-2): the GM's pick of the other in the
 * table's header, and the list of linked tables when reading. Only tables the setting rules have; empty for a plain row.
 */
export function rowNextChoices(row: TableRow, terrain: TerrainKey | null, known: TableLookup): string[] {
  if (!row.next) return [];
  const first = nextByTerrain(row.next, terrain, known);
  const all = [first, ...row.next.byTerrain.map((b) => known(b.tableId)), row.next.default ? known(row.next.default) : null];
  return all.filter((id, i): id is string => !!id && all.indexOf(id) === i);
}

/** The tables a table's rows lead to, for reading (Table library ›, the GM reference): each once, in row order. */
export function linkedTables(table: ReadTable, known: TableLookup, terrain: TerrainKey | null = null): string[] {
  const ids = table.rows.flatMap((row) => [...rowNextChoices(row, terrain, known), rowLeadsTo(table, row, null, known, terrain)]);
  return ids.filter((id, i): id is string => !!id && ids.indexOf(id) === i);
}

/** A row's label for the reference list: "1–2", "7", "3/7", "8+", "≤2". */
export function rowLabel(row: TableRow): string {
  if (row.key) return row.key;
  if (row.label) return row.label;
  if (row.min === null) return '';
  if (row.max === null || row.max === row.min) return String(row.min);
  if (row.min === Number.MIN_SAFE_INTEGER) return `≤${row.max}`;
  return row.max === Number.MAX_SAFE_INTEGER ? `${row.min}+` : `${row.min}–${row.max}`;
}
