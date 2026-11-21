// A kindred's own creation tables (cs-1, design/rulings/m5b-0c-creation-survey-2026-11-03.md; 07 "The survey's
// fields": races[].tables { names?, trinket?, details?: [tableIds], growth? }; mockup creation/11). Pure: the tables a
// kindred points at, read from the campaign's tables in play; a name made from the columns tapped; the row a typed roll
// lands on; and the character's details as kept on the sheet. The app never rolls: each table opens, the player rolls
// at the table and taps the row (or types the number on a long table).
//
// Where they're kept (no migration, 2026-11-04): the details and the growth on the character's `fields` under one key
// no campaign field uses (`_details`), so the owner changes them from the sheet before and after approval, as any field;
// the trinket's line on the creation record (`trinket`), beside the kit's, so a change of kindred takes it out with the
// rest of the gear (creation.redo).

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/** One row: its range, its words, and its cells when the table has columns (a name table's first name · surname). */
export interface TableRow {
  min: number;
  max: number;
  text: string;
  cells: string[];
  /** The alignment the row carries (a knight's liege, cs-3, G-89): picking it sets the character's; absent when none. */
  alignment?: string;
  /**
   * The row's plain name when its words carry more (cw-12: a liege row's `name` is the house alone, "House Saltreach",
   * where its `result` is "House Saltreach (Mire)"): what a pick writes and what the pick row and entry show.
   */
  name?: string;
  /** The row's longer words (a house's note), shown in its entry (cw-5); absent when none. */
  note?: string;
}

/** A table as creation reads it. */
export interface CreationTable {
  id: string;
  name: string;
  /** "d12"; '' when the table doesn't say. */
  die: string;
  description: string;
  source: string;
  /** Column headings ("First name", "Surname"); empty for a one-column table. */
  columns: string[];
  rows: TableRow[];
  /**
   * How a name table's tapped columns join (ct-7, G-192): '' for two halves of one word ("Adder" + "ley"); a space
   * when the table doesn't say.
   */
  join: string;
  /**
   * The pack it came from when the race had no table of its own for the slot and an attached pack's table offered one
   * (ct-5, ct-6: shown "Optional · from <pack>"); absent for the race's own tables.
   */
  from?: string;
  /**
   * The pack's own first line for the table's sheet (R3-2, 07): "Roll d20 twice: a first name, then a house name".
   * Absent: the app says only "Roll d<N>, then tap the rows." The app never composes one from the parts' names.
   */
  rollPrompt?: string;
}

/** The tables a kindred points at; a missing or unknown one is null (or left out of `details`). */
export interface KindredTables {
  names: CreationTable | null;
  /**
   * The other name tables the same pack offers when the kindred has none (after-test A5: a male, a female and a
   * surname table): each one more row under the Name field. Left out when there are none; never with the kindred's own.
   */
  moreNames?: CreationTable[];
  trinket: CreationTable | null;
  details: CreationTable[];
  growth: CreationTable | null;
}

/** Every name table for the Name field, in order: the kindred's own, else each one the first pack offers. */
export const nameTablesOf = (tables: KindredTables): CreationTable[] => (tables.names ? [tables.names, ...(tables.moreNames ?? [])] : []);

export const NO_TABLES: KindredTables = { names: null, trinket: null, details: [], growth: null };

/** A table entry (`kind: 'table'`) as creation reads it; null when it has no usable rows. */
export function tableOf(entry: { packEntryId: string; name: string; data: Record<string, unknown> }): CreationTable | null {
  const data = entry.data;
  const columns = Array.isArray(data.columns) ? data.columns.map(text).filter(Boolean) : [];
  const rows = (Array.isArray(data.rows) ? data.rows : []).flatMap((row): TableRow[] => {
    if (!isRecord(row)) return [];
    const min = whole(row.min);
    const max = whole(row.max) ?? min;
    // A row keys its cells by column name ({"First half": "Reed-"}) when it has no `cells` list.
    const cells = Array.isArray(row.cells) ? row.cells.map(text) : columns.map((c) => text(row[c]));
    const words = text(row.result) || cells.filter(Boolean).join(', ');
    if (min === null || max === null || !words) return [];
    const alignment = text(row.alignment);
    const name = text(row.name);
    const note = text(row.note);
    return [{ min, max, text: words, cells, ...(alignment ? { alignment } : {}), ...(name ? { name } : {}), ...(note ? { note } : {}) }];
  });
  if (rows.length === 0) return null;
  const rollPrompt = text(data.rollPrompt);
  return { id: entry.packEntryId, name: entry.name, die: text(data.die), description: text(data.description), source: text(data.source), columns, rows, join: joinOf(data), ...(rollPrompt ? { rollPrompt } : {}) };
}

/** A table's `join` (ct-7): the text put between tapped name columns; a space when it doesn't say (or says something not text). */
export const joinOf = (data: Record<string, unknown>): string => (typeof data.join === 'string' ? data.join : ' ');

/** The creation slots a table can name in its `uses` (ct-5): offered at creation to a race without its own. */
export const CREATION_SLOTS = ['creation.names', 'creation.details', 'creation.trinket'] as const;
export type CreationSlot = (typeof CREATION_SLOTS)[number];

/** The words over a table creation offers from another pack (ct-6). */
export const fromLabel = (table: Pick<CreationTable, 'from'>): string | undefined => (table.from ? `Optional, from ${table.from}` : undefined);

const usesSlot = (data: Record<string, unknown>, slot: CreationSlot) => (Array.isArray(data.uses) ? data.uses : typeof data.uses === 'string' ? [data.uses] : []).some((u) => typeof u === 'string' && u.trim() === slot);

/** A slot table's `forRaces` (G-203): the race ids it's bound to (one word is read as a list); [] when unbound. */
export const forRacesOf = (data: Record<string, unknown>): string[] =>
  (Array.isArray(data.forRaces) ? data.forRaces : typeof data.forRaces === 'string' ? [data.forRaces] : []).filter((r): r is string => typeof r === 'string' && r.trim() !== '').map((r) => r.trim());

/** A table in play as kindredTables reads it: `packId` says which attached pack it's from (for the fallback, ct-5). */
export type TableInPlay = { packEntryId: string; name: string; data: Record<string, unknown>; packId?: string };

/**
 * The tables a kindred's `tables` point at, as the character plays the kindred (pass creation.ts raceAsPlayed: a
 * kindred-class keeps its kindred's tables, cs-4). `tables` are the campaign's tables in play (optionGate.ts
 * entriesInPlay), so a table switched off by an option isn't offered.
 *
 * Slot by slot (ct-3, ct-5): names, details and trinket the kindred doesn't fill come from an attached pack's table
 * whose `uses` names the slot (`creation.names`, `creation.details`, `creation.trinket`), the first pack in the GM's
 * order (`packs`, top first) that has one; each such table carries `from` (its pack's name). Details are one slot: the
 * kindred's own list wins whole, otherwise every details table of the first pack that offers any. Growth is the
 * kindred's only.
 *
 * A slot table with `forRaces` (G-203, ruled 2026-11-07, a; Design's answer the same day) is offered to those kindreds:
 * slot by slot, after the kindred's own `tables` (both show, the bound one "Optional, from <pack>"), and it displaces
 * the unbound offers (ct-5) for the slots it fills. One trinket only: the kindred's own wins. A table bound to other
 * kindreds is never offered to this one.
 */
export function kindredTables(race: { packEntryId?: string; data: Record<string, unknown> } | null | undefined, tables: readonly TableInPlay[], packs: readonly { packId: string; name: string }[] = []): KindredTables {
  if (!race) return NO_TABLES;
  const said = isRecord(race.data.tables) ? race.data.tables : {};
  const find = (id: unknown) => {
    const entry = typeof id === 'string' ? tables.find((t) => t.packEntryId === id.trim()) : undefined;
    return entry ? tableOf(entry) : null;
  };
  const own = (Array.isArray(said.details) ? said.details : []).flatMap((id) => {
    const found = find(id);
    return found ? [found] : [];
  });
  const raceId = race.packEntryId ?? '';
  const order = (t: TableInPlay) => {
    const at = packs.findIndex((p) => p.packId === t.packId);
    return at < 0 ? packs.length : at;
  };
  // The tables bound to this kindred for a slot (G-203), every pack's, in the GM's order: the kindred's own.
  const bound = (slot: CreationSlot): CreationTable[] =>
    !raceId
      ? []
      : tables
          .filter((t) => usesSlot(t.data, slot) && forRacesOf(t.data).includes(raceId))
          .sort((a, b) => order(a) - order(b))
          .flatMap((t) => {
            const table = tableOf(t);
            const pack = packs.find((p) => p.packId === t.packId);
            return table ? [{ ...table, ...(pack ? { from: pack.name } : {}) }] : [];
          });
  // The packs' unbound offers for a slot, in the GM's order: the first pack with any wins the slot.
  const offered = (slot: CreationSlot): CreationTable[] => {
    for (const pack of packs) {
      const found = tables.flatMap((t) => {
        if (t.packId !== pack.packId || !usesSlot(t.data, slot) || forRacesOf(t.data).length > 0) return [];
        const table = tableOf(t);
        return table ? [{ ...table, from: pack.name }] : [];
      });
      if (found.length > 0) return found;
    }
    return [];
  };
  // A slot: the kindred's own first, then the tables bound to it (both show); the unbound offers only when neither has any.
  const slotTables = (mine: CreationTable[], slot: CreationSlot) => {
    const all = [...mine, ...bound(slot)];
    return all.length > 0 ? all : offered(slot);
  };
  const ownNames = find(said.names);
  const nameTables = slotTables(ownNames ? [ownNames] : [], 'creation.names');
  const ownTrinket = find(said.trinket);
  return {
    names: nameTables[0] ?? null,
    ...(nameTables.length > 1 ? { moreNames: nameTables.slice(1) } : {}),
    // One trinket: the kindred's own, else the first bound one, else the unbound offer.
    trinket: slotTables(ownTrinket ? [ownTrinket] : [], 'creation.trinket')[0] ?? null,
    details: slotTables(own, 'creation.details'),
    growth: find(said.growth),
  };
}

/** Whether the Details step has anything to show for this kindred: a detail table, a growth, or age, height or weight dice. */
export function detailsStepExists(race: { data: Record<string, unknown> } | null | undefined, tables: KindredTables): boolean {
  return tables.details.length > 0 || tables.growth !== null || physicalOf(race).length > 0;
}

/** The kindred's age, height and weight: the pack's words (shown) and, where the pack gives one, its usual value. */
export const PHYSICAL = [
  { key: 'age', label: 'Age' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
] as const;
export type PhysicalKey = (typeof PHYSICAL)[number]['key'];

/** The unit each is kept in (Design's answers, 2026-11-06): whole years, inches, pounds. */
const UNIT: Record<PhysicalKey, 'years' | 'in' | 'lb'> = { age: 'years', height: 'in', weight: 'lb' };

/** One way of working out the usual value: a base, plus dice (their total times `times`); a variant's label ("Tall"). */
export interface UsualPart {
  label?: string;
  base: number;
  dice?: string;
  times?: number;
}

/**
 * A kindred's usual age, height or weight as the pack gives it (07 `races[].usual.<age|height|weight>`; Design's
 * answers 2026-11-06): `{ base, dice?, times?, unit }`, or `{ variants: [{ label, base, dice }], unit }`. `start` is where
 * the stepper starts (the first variant's base plus its dice's average, rounded to the step); `step` is what − and +
 * move by (age 1, or the formula's `times`; height 1 in; weight 5 lb).
 */
export interface Usual {
  unit: 'years' | 'in' | 'lb';
  parts: UsualPart[];
  start: number;
  step: number;
}

/** "2d6" → its count and sides; null when it isn't plain dice. */
function plainDice(dice: string): { count: number; sides: number } | null {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*$/i.exec(dice);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  return count >= 1 && sides >= 1 ? { count, sides } : null;
}

function usualPart(raw: unknown): UsualPart | null {
  if (!isRecord(raw)) return null;
  const base = whole(raw.base);
  if (base === null || base < 0) return null;
  const dice = text(raw.dice);
  if (dice && !plainDice(dice)) return null;
  const times = raw.times === undefined ? null : whole(raw.times);
  if (raw.times !== undefined && (times === null || times < 1)) return null;
  const label = text(raw.label);
  return { base, ...(dice ? { dice } : {}), ...(times !== null ? { times } : {}), ...(label ? { label } : {}) };
}

/** A part's average: the base plus the dice's average times `times`. */
function averageOf(part: UsualPart): number {
  const d = part.dice ? plainDice(part.dice) : null;
  return part.base + (d ? (d.count * (d.sides + 1)) / 2 : 0) * (part.times ?? 1);
}

/**
 * The kindred's usual age, height or weight (Design, 2026-11-06), read from `usual`, never from the words (they stay
 * the caption). Null without one, or when it can't be read (a unit that isn't this key's, a base that isn't a whole
 * number, dice that aren't plain): the step then keeps the typed field. Never a guess.
 */
export function usualOf(race: { data: Record<string, unknown> } | null | undefined, key: PhysicalKey): Usual | null {
  const all = race && isRecord(race.data.usual) ? race.data.usual : null;
  const raw = all && isRecord(all[key]) ? all[key] : null;
  if (!raw || text(raw.unit) !== UNIT[key]) return null;
  const listed = Array.isArray(raw.variants) ? raw.variants.map(usualPart) : [usualPart(raw)];
  if (listed.length === 0 || listed.some((p) => p === null)) return null;
  const parts = listed as UsualPart[];
  const step = key === 'age' ? (parts[0]!.times ?? 1) : key === 'weight' ? 5 : 1;
  const start = Math.max(step, Math.round(averageOf(parts[0]!) / step) * step);
  return { unit: UNIT[key], parts, start, step };
}

/** Inches as a height: "5 ft 7 in", "5 ft", "8 in". */
export function feetAndInches(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return ft === 0 ? `${inch} in` : inch === 0 ? `${ft} ft` : `${ft} ft ${inch} in`;
}

/** A usual value as the box shows it: a height in feet and inches, an age or a weight as the number. */
export const usualBox = (key: PhysicalKey, n: number): string => (key === 'height' ? feetAndInches(n) : String(n));

/** A usual value as the review and the sheet show it: "40 years", "5 ft 7 in", "150 lb". */
export const usualWords = (key: PhysicalKey, n: number): string => (key === 'height' ? feetAndInches(n) : `${n} ${UNIT[key]}`);

/**
 * What the player typed (or an older character kept as free text), read as a whole number in the key's unit; null when
 * it doesn't read as one. Age: "40", "40 years". Weight: "150", "150 lb". Height, in inches: "67", "67 in", "5 7",
 * "5'7", "5′7″", "5 ft 7 in", "5 ft".
 */
export function readUsual(key: PhysicalKey, typed: string): number | null {
  const t = typed.trim().toLowerCase();
  if (!t) return null;
  if (key === 'age') {
    const m = /^(\d{1,5})\s*(?:years?|yrs?)?$/.exec(t);
    return m ? Number(m[1]) : null;
  }
  if (key === 'weight') {
    const m = /^(\d{1,5})\s*(?:lbs?|pounds?)?$/.exec(t);
    return m ? Number(m[1]) : null;
  }
  const inches = /^(\d{1,4})\s*(?:in|inch|inches|"|″)?$/.exec(t);
  if (inches) return Number(inches[1]);
  const feet = /^(\d{1,2})\s*(ft|feet|foot|'|′)?\s*(\d{1,2})?\s*(?:in|inch|inches|"|″)?$/.exec(t);
  if (!feet || (feet[2] === undefined && feet[3] === undefined)) return null;
  const inch = feet[3] === undefined ? 0 : Number(feet[3]);
  return inch < 12 ? Number(feet[1]) * 12 + inch : null;
}

/**
 * A Body card's dice line (final drafts D, ⚑ 2 of the plan): built from the pack's `usual`, never from its words:
 * "1d6 + 18", "5 ft + 2d6 in", "2d6 × 5 + 120" (the unit beside the stepper, D4); a variant leads with its label ("Tall: …"). A part
 * with a base and no dice says nothing (its label alone in a variant).
 */
export function usualDiceLine(key: PhysicalKey, usual: Usual): string {
  const one = (p: UsualPart) => {
    const lead = p.label ? `${p.label}: ` : '';
    // The unit is said once, beside the stepper (D4, cs-8): the line names the dice alone.
    if (!p.dice) return lead ? lead.replace(/: $/, '') : '';
    const dice = `${p.dice}${p.times && p.times > 1 ? ` × ${p.times}` : ''}`;
    if (p.base === 0) return `${lead}${dice}`;
    return key === 'height' ? `${lead}${feetAndInches(p.base)} + ${dice} in` : `${lead}${dice} + ${p.base}`;
  };
  return usual.parts.map(one).filter(Boolean).join('; ');
}

/** A usual's formula in words, for a kindred whose pack has no words of its own: "15 + 2d10 years", "Tall 5 ft 4 in + 2d6 in". */
export function usualFormula(key: PhysicalKey, usual: Usual): string {
  const one = (p: UsualPart) => {
    if (!p.dice) return `${p.label ? `${p.label} ` : ''}${usualWords(key, p.base)}`;
    const dice = `${p.dice}${p.times && p.times > 1 ? ` × ${p.times}` : ''} ${UNIT[key]}`;
    const base = p.base > 0 ? `${key === 'height' ? feetAndInches(p.base) : p.base} + ` : '';
    return `${p.label ? `${p.label} ` : ''}${base}${dice}`;
  };
  return usual.parts.map(one).join('; ');
}

/** One of age, height and weight on the Details step: the pack's words (the caption) and its usual when it has one. */
export interface PhysicalField {
  key: PhysicalKey;
  label: string;
  /** The pack's words ("15 + 2d10 years"), else the usual's formula. */
  dice: string;
  /** Where the stepper starts and how it steps (Design, 2026-11-06); absent: the typed field, as before. */
  usual?: Usual;
}

export function physicalOf(race: { data: Record<string, unknown> } | null | undefined): PhysicalField[] {
  if (!race) return [];
  return PHYSICAL.flatMap((p) => {
    const words = text(race.data[p.key]);
    const usual = usualOf(race, p.key);
    if (!words && !usual) return [];
    return [{ key: p.key, label: p.label, dice: words || usualFormula(p.key, usual!), ...(usual ? { usual } : {}) }];
  });
}

/**
 * A kept age, height or weight in words for the review and the sheet: with the kindred's usual, a number in its unit
 * reads "40 years", "5 ft 7 in", "150 lb"; anything else (free text from before, or no usual) as kept.
 */
export function physicalWords(field: Pick<PhysicalField, 'key' | 'usual'>, kept: string): string {
  if (!field.usual) return kept;
  const n = readUsual(field.key, kept);
  return n === null ? kept : usualWords(field.key, n);
}

/** "Roll d12"; "Roll on the table" when the table names no die. */
export const rollWords = (table: Pick<CreationTable, 'die'>) => (table.die ? `Roll ${table.die}` : 'Roll on the table');

/** A row's range as words: "3" or "3–4". */
export const rangeOf = (row: Pick<TableRow, 'min' | 'max'>) => (row.min === row.max ? `${row.min}` : `${row.min}–${row.max}`);

/** The row a typed roll lands on (its index), or −1 when the number is on no row. */
export function rowFor(table: Pick<CreationTable, 'rows'>, rolled: number): number {
  return table.rows.findIndex((r) => rolled >= r.min && rolled <= r.max);
}

/**
 * What a roll typed on a table's sheet shows (m5b-long-tables, B with C's field, 2026-11-09): the row the number falls
 * in (a ranged row counts: 37 lands on 37–40), or null with the line saying why. Whole numbers only: "37" is 37, never
 * 3 (the whole text is read, never a prefix). The line is only for a problem (#571 round 3: no helper line): empty
 * for a match and for an empty box (every row).
 */
export function typedRow(table: Pick<CreationTable, 'rows'>, text: string): { row: number | null; line: string } {
  const typed = text.trim();
  if (typed === '') return { row: null, line: '' };
  if (!/^\d+$/.test(typed)) return { row: null, line: 'Whole numbers only.' };
  const rolled = Number(typed);
  const row = rowFor(table, rolled);
  return row >= 0 ? { row, line: '' } : { row: null, line: `No row has ${rolled}.` };
}

/** The index of the row whose words (or plain name, cw-12) are these (a saved pick), or −1. */
export const rowOf = (table: Pick<CreationTable, 'rows'>, words: string | undefined): number => (words ? table.rows.findIndex((r) => r.text === words || (!!r.name && r.name === words)) : -1);

/** What a pick of this row writes (cw-12): its plain name when it has one, else its words. */
export const rowWords = (row: Pick<TableRow, 'text' | 'name'>): string => row.name || row.text;

/** Whether a table is long enough for the go-to-number box (a d100, say): more rows than a phone shows at once. */
export const isLong = (table: Pick<CreationTable, 'rows'>) => table.rows.length > 12;

/** The fewest rows a band of the range bar holds once a table splits evenly (Design, #571 round 3: bands of 25–40). */
export const BAND_ROWS = 25;

/** A table with this many rows or more lays its rows out in two columns on a tablet (#571 round 2: 24–39 scroll fine so). */
export const LONG_ROWS = 24;

/** A table with this many rows or more has the range bar (Design, #571 final round); fewer scroll fine in two columns. */
export const BAR_ROWS = 50;

/**
 * A long table's bands for its range bar (m5b-long-tables; Design's rounds on #571, 2026-11-09): by the number of
 * rows, never the die. Under 50 rows, null (no bar: they scroll fine). Otherwise the rows split evenly into as many
 * bands of 25 or more as fit, which keeps every band within 25–40 rows. Each band is labelled by the die values its
 * rows cover: "1–25" … "76–100" for a d100 with a row per value, "1–50", "51–100" for 50 rows of two. Each band holds
 * its rows' indexes.
 */
export function rowBands(table: Pick<CreationTable, 'rows'>): { heading: string; rows: number[] }[] | null {
  const count = table.rows.length;
  if (count < BAR_ROWS) return null;
  const bands = Math.floor(count / BAND_ROWS);
  return Array.from({ length: bands }, (_, band) => {
    const from = Math.floor((band * count) / bands);
    const to = Math.floor(((band + 1) * count) / bands);
    const rows = Array.from({ length: to - from }, (_, n) => from + n);
    return { heading: `${table.rows[from]!.min}–${table.rows[to - 1]!.max}`, rows };
  });
}

/**
 * A name table's columns, each a list of what can be tapped (every row's cell in that column, in order). A table
 * without columns is one column of its rows' words.
 */
export function nameColumns(table: CreationTable): { heading: string; cells: { row: number; text: string }[] }[] {
  if (table.columns.length === 0) return [{ heading: 'Name', cells: table.rows.map((r, row) => ({ row, text: r.text })) }];
  return table.columns.map((heading, c) => ({ heading, cells: table.rows.flatMap((r, row) => (r.cells[c] ? [{ row, text: r.cells[c]! }] : [])) }));
}

/** "a, b and c". */
export const andList = (parts: readonly string[]) => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/**
 * The first line of a name table's sheet (R3-2): the pack's `rollPrompt` when it has one; otherwise only the die,
 * "Roll d20, then tap the rows." ("the row" for a one-part name; "Roll on the table" without a die). Never composed
 * from the parts' names.
 */
export function nameSheetRollWords(table: CreationTable): string {
  if (table.rollPrompt) return table.rollPrompt;
  return `${rollWords(table)}, then tap the ${nameColumns(table).length > 1 ? 'rows' : 'row'}.`;
}

/**
 * A name table's row line (final drafts C): its die and its parts, "d20: first names, family names"; another pack's
 * says so first, "Optional, from Table Generator. d100".
 */
export function nameTableLine(table: CreationTable): string {
  const parts = table.columns.length > 1 ? table.columns.map((c) => c.toLowerCase()).join(', ') : '';
  const what = [table.die, parts].filter(Boolean).join(': ');
  return [fromLabel(table), what].filter(Boolean).join('. ');
}

/**
 * The name the columns tapped make, in column order ("Bramble Reedwhistle"), joined by the table's `join` (ct-7: ''
 * makes "Adder" + "ley" one word, "Adderley"); '' when none is tapped.
 */
export const nameFrom = (parts: readonly (string | undefined)[], join = ' '): string => joinName(parts.map((p) => (p ?? '').trim()).filter(Boolean), join);

/**
 * Name parts joined (ct-7). With join "" a book's printed halves ("Adder-" and "-bald") lose one hyphen each side of
 * every seam, so they read "Adderbald"; a part without a hyphen is kept as it is. The cells keep the book's words.
 */
export function joinName(parts: readonly string[], join: string): string {
  if (join !== '') return parts.join(join);
  return parts.map((part, i) => part.slice(i > 0 && part.startsWith('-') ? 1 : 0, i < parts.length - 1 && part.endsWith('-') ? -1 : undefined)).join('');
}

/** A part's heading as words for "still to roll": "House names" → "house name". */
const partLeft = (heading: string) => heading.trim().toLowerCase().replace(/names$/, 'name');

/**
 * What Use this name writes (R3-1): the parts tapped, in the pack's part order, joined by the table's `join`; the rolls
 * they sit on ("3", "14") and the parts not tapped ("house name"), for the line under the field. Never a dangling
 * hyphen (Design on #564): a printed half ("Reed-") with its other half unpicked loses its seam's hyphen, "Reed".
 * '' and [] when nothing is tapped.
 */
export function rolledName(table: CreationTable, tapped: readonly (string | undefined)[]): { name: string; rolled: string[]; left: string[] } {
  const parts = nameColumns(table);
  const rolled = parts.flatMap((part, i) => {
    const cell = tapped[i] ? part.cells.find((c) => c.text === tapped[i]) : undefined;
    return cell ? [rangeOf(table.rows[cell.row]!)] : [];
  });
  const left = parts.flatMap((p, i) => (tapped[i] ? [] : [partLeft(p.heading)]));
  const joined = nameFrom(parts.map((_, i) => tapped[i]), table.join);
  return { name: table.join === '' ? joined.replace(/^-+|-+$/g, '') : joined, rolled, left };
}

/**
 * The line under the Name field once a table filled it (R3-1, mockup creation/final/10): "From Fen names, rolled 3 and
 * 14. Edit the field to change it."; with a part not rolled, "From Fen names, rolled 3, house name still to roll. …".
 */
export const nameFromLine = (tableName: string, rolled: readonly string[], left: readonly string[] = []): string =>
  `From ${tableName}${rolled.length > 0 ? `, rolled ${andList(rolled)}` : ''}${left.length > 0 ? `, ${andList(left)} still to roll` : ''}. Edit the field to change it.`;

/**
 * The sheet's foot line (mockup creation/final/10): what's tapped and what's still to roll, "Picked: Caradoc, house
 * name still to roll."; nothing tapped, "Nothing picked yet."
 */
export function pickedNameLine(table: CreationTable, tapped: readonly (string | undefined)[]): string {
  const parts = nameColumns(table);
  const picked = parts.flatMap((_, i) => (tapped[i] ? [tapped[i]!] : []));
  if (picked.length === 0) return 'Nothing picked yet.';
  const left = parts.flatMap((p, i) => (tapped[i] ? [] : [partLeft(p.heading)]));
  return `Picked: ${picked.join(', ')}${left.length > 0 ? `, ${andList(left)} still to roll` : ''}.`;
}

/** The key the details are kept under on the character's fields: no campaign field uses it. */
export const DETAILS_KEY = '_details';

/** The character's details (cs-1): each detail table's row, age, height and weight as typed, the growths picked. */
export interface CharacterDetails {
  /** By table id: the row's words. */
  tables: Record<string, string>;
  age?: string;
  height?: string;
  weight?: string;
  /** Growths in order (one at Level 1; more at later levels, M7). */
  growth?: string[];
  /**
   * Age, height or weight left at the kindred's average, never stepped or typed (final drafts D, the average stepper's
   * touched flag): the review and the GM's card say "the average, not rolled". Information, not an exception.
   */
  averaged?: PhysicalKey[];
}

export const NO_DETAILS: CharacterDetails = { tables: {} };

/** The details as the character's fields keep them; empty when none. */
export function detailsOf(fields: unknown): CharacterDetails {
  const saved = isRecord(fields) && isRecord(fields[DETAILS_KEY]) ? fields[DETAILS_KEY] : null;
  if (!saved) return { tables: {} };
  const tables = isRecord(saved.tables) ? Object.fromEntries(Object.entries(saved.tables).flatMap(([id, v]) => (text(v) ? [[id, text(v)]] : []))) : {};
  const out: CharacterDetails = { tables };
  for (const p of PHYSICAL) if (text(saved[p.key])) out[p.key] = text(saved[p.key]);
  const growth = Array.isArray(saved.growth) ? saved.growth.map(text).filter(Boolean) : [];
  if (growth.length > 0) out.growth = growth;
  const averaged = Array.isArray(saved.averaged) ? PHYSICAL.map((p) => p.key).filter((k) => (saved.averaged as unknown[]).includes(k) && !!out[k]) : [];
  if (averaged.length > 0) out.averaged = averaged;
  return out;
}

const MAX_TEXT = 200;

/** The details cleaned for saving: blanks dropped, words trimmed and capped. */
export function cleanDetails(details: CharacterDetails): CharacterDetails {
  const cap = (v: string | undefined) => (v ?? '').trim().slice(0, MAX_TEXT);
  const tables = Object.fromEntries(Object.entries(details.tables).flatMap(([id, v]) => (cap(v) ? [[id, cap(v)]] : [])));
  const out: CharacterDetails = { tables };
  for (const p of PHYSICAL) if (cap(details[p.key])) out[p.key] = cap(details[p.key]);
  const growth = (details.growth ?? []).map(cap).filter(Boolean);
  if (growth.length > 0) out.growth = growth;
  // Only those still filled in keep their flag.
  const averaged = PHYSICAL.map((p) => p.key).filter((k) => (details.averaged ?? []).includes(k) && !!out[k]);
  if (averaged.length > 0) out.averaged = averaged;
  return out;
}

/** Whether nothing is filled in. */
export const detailsEmpty = (details: CharacterDetails) => Object.keys(cleanDetails(details).tables).length === 0 && PHYSICAL.every((p) => !details[p.key]?.trim()) && !(details.growth ?? []).some((g) => g.trim());

/** How many of the step's things are filled in, for its hint: "2 of 7 filled in". */
export function detailsCount(details: CharacterDetails, tables: KindredTables, physical: readonly { key: PhysicalKey }[]): { filled: number; of: number } {
  const clean = cleanDetails(details);
  const filled = tables.details.filter((t) => clean.tables[t.id]).length + physical.filter((p) => clean[p.key]).length + (tables.growth && (clean.growth ?? []).length > 0 ? 1 : 0);
  return { filled, of: tables.details.length + physical.length + (tables.growth ? 1 : 0) };
}

/**
 * The details as lines for the review and the sheet ("Head: Ears notched from old fights"), in the step's order: the
 * kindred's detail tables, age, height, weight, then the growth. A table the kindred no longer has isn't shown (its
 * words stay saved).
 */
export function detailLines(details: CharacterDetails, tables: KindredTables, physical: readonly Pick<PhysicalField, 'key' | 'label' | 'usual'>[], kindred?: string): { key: string; label: string; value: string }[] {
  const clean = cleanDetails(details);
  return [
    ...tables.details.flatMap((t) => (clean.tables[t.id] ? [{ key: t.id, label: shortTableName(t.name, kindred), value: clean.tables[t.id]! }] : [])),
    // Left at the average (final drafts D): said in words, as information.
    ...physical.flatMap((p) => (clean[p.key] ? [{ key: p.key, label: p.label, value: `${physicalWords(p, clean[p.key]!)}${(clean.averaged ?? []).includes(p.key) ? ', the average, not rolled' : ''}` }] : [])),
    ...(tables.growth && (clean.growth ?? []).length > 0 ? [{ key: tables.growth.id, label: shortTableName(tables.growth.name, kindred), value: clean.growth!.join(', ') }] : []),
  ];
}

/**
 * A detail table's name without the kindred's in front ("Bog folk looks" → "Looks"), for the step's rows; a name
 * that's only one word stays as it is.
 */
export function shortTableName(name: string, kindred?: string): string {
  const trimmed = name.trim();
  if (kindred && trimmed.toLowerCase().startsWith(`${kindred.trim().toLowerCase()} `)) {
    const rest = trimmed.slice(kindred.trim().length).trim();
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return trimmed;
}

/** The trinket the Gear step put in the pack, as the creation record keeps it (`trinket`); null when none. */
export interface TrinketPick {
  tableId: string;
  text: string;
  /** The pack line it became. */
  lineId: string;
  /** The number typed or the row's low end, for "rolled 37". */
  rolled?: number;
}

export function trinketOf(creation: unknown): TrinketPick | null {
  const t = isRecord(creation) && isRecord(creation.trinket) ? creation.trinket : null;
  if (!t || typeof t.tableId !== 'string' || typeof t.lineId !== 'string' || !text(t.text)) return null;
  const rolled = whole(t.rolled);
  return { tableId: t.tableId, text: text(t.text), lineId: t.lineId, ...(rolled !== null ? { rolled } : {}) };
}

/** The trinket's item name: the row's words, capped to what a pack line holds. */
export const trinketName = (words: string) => words.trim().slice(0, MAX_TEXT);
