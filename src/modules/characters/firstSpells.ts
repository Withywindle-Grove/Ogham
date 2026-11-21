// First spells (M5b step 0c, slice 4; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-13, cr-25; docs/07
// `spellcasting.firstSpells` and `known`; mockup creation/05-first-spells). Pure: whether this character has the step,
// and its groups: Given (in the book, not untickable) · Pick N from the class list · Roll dN, one group per table of
// `rollTable` (an id or a list; a table the pack marks `"gmOnly": false` so players read it; ranges first, tapped at
// the table's word, never rolled here; a row's spells from `rows[].spells` only: fs-1 … fs-3, 2026-11-02) · Cantrips
// (the class's `known` block, its own count) · Learned at level N (dec-1b: a character made above level 1 picks the
// spells its class's `learnByLevel` gives at each level from 2 to the start level). Then what Next says, the foot's hint, the spell row's words, its full
// rules, and the book the picks make. A list only: prepare, cast and Lost when hit stay in M7.
import { workOut } from '../library/formula.ts';
import { entriesInPlay } from '../library/optionGate.ts';
import { readRuleText, type RuleText } from '../library/ruleText.ts';
import { withSwaps, type ClassListOf, type Patron } from './patrons.ts';
import { optionIsOn } from './weaponSkills.ts';
import { levelNameOf, levelWord, type LevelName } from './levelNames.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

/** A library entry as creation reads it (a spell, a spell list, a table, the class). */
export interface SpellEntry {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
  packId?: string;
  /** Set when an option switches the entry off (the shared reader, of-3): a spell so marked is on no list level. */
  optionOff?: string;
}

/** A spell as the step shows it: the entry, the list level it is on, and its one line. */
export interface SpellChoice {
  id: string;
  name: string;
  level: number;
  /** The pack's blurb, else the duration and range (06, Option row blurb variant). */
  blurb: string;
  /** "Level 1 · 1 turn · 30 ft · p. 44" (the list's own word for its level where it names it, lv-1). */
  line: string;
  entry: SpellEntry | null;
  /** The list's name for the spell's level (pf-22, `levelNames`), or null: the fallback words (lv-1). */
  levelName: LevelName | null;
}

/** One row of a roll: its table, its range ("1–2"), the table's words, and the spells it gives (`rows[].spells`, fs-2). */
export interface RollRow {
  /** Unique across the step's tables: "<table id>:<row number>". */
  key: string;
  tableId: string;
  range: string;
  result: string;
  spells: SpellChoice[];
}

/**
 * One table of `firstSpells.rollTable` (an id or a list, one roll each, fs-3): its die, name and rows; `unreadable`
 * when the table isn't in what this person can read (the pack didn't mark it `"gmOnly": false`, fs-1, or no attached
 * pack has it).
 */
export type RollGroup = ({ tableId: string; die: string; name: string; rows: RollRow[]; column: string; unreadable?: false } | { tableId: string; unreadable: true }) & {
  /** Whose grant it is (cs-2): the class's, or the kindred's, added to the class's. */
  from: GrantSource;
  /** The pack's table id (`tableId` is the group's key: "kindred:<table id>" for a kindred's roll, so a kindred and a class may roll the same table). */
  table: string;
};

/** Where a first spell comes from (cs-2): the class, or the kindred (a race's `firstSpells`, added to the class's). */
export type GrantSource = 'class' | 'kindred';

export interface FirstSpellsPlan {
  classId: string;
  /** The pack's note on the class's first spells, when it has one. */
  note: string;
  /** The kindred's note on its first spells (cs-2), when it grants any and says something. */
  kindredNote: string;
  /** Whether a kindred grants any (cs-2): then each group says whose it is ("From your kindred · …", "From your class · …"). */
  fromKindred: boolean;
  /**
   * Whether the step holds glamours, runes or knacks rather than a spell book or prayers (cs-2: the step is named
   * Magic): a kindred's grant, or a class whose spellcasting is neither `book` nor `divine` (its spells are known).
   */
  magic: boolean;
  given: SpellChoice[];
  /** The kindred's given ones (cs-2), shown in their own group; empty without. */
  kindredGiven: SpellChoice[];
  choose: PickPlan | null;
  /** The rolls, one group per table in the pack's order; empty without a `rollTable`. */
  rolls: RollGroup[];
  cantrips: PickPlan | null;
  /**
   * The `known` group's heading, in the pack's words (F45, option B: the step takes the pack's word for the kind of
   * magic): the class's list's name for powers, runes or knacks ("Kinetic powers", `knownByList`); for a book or divine
   * caster's known block, the list's name for the level (lv-1, pf-22: "Glimmers"), else "Level 0".
   */
  knownTitle: string;
  /** Whether the known group is named by its list (powers, runes, knacks), not by its level. */
  knownByList: boolean;
  /** The list level the known group is offered from (0 by default, `listLevel`), and the list's name for it (lv-1). */
  knownLevel: number;
  knownName: LevelName | null;
  /**
   * The spells learned at each level from 2 up to the starting level (dec-1b, plan dec-1-creation 1b): one group per
   * level the class's `learnByLevel` names, in level order; empty at level 1 and for a class without `learnByLevel`.
   */
  learned: LearnedGroup[];
}

/** One "Learned at level N" group (dec-1b): the level, how many, from the spell levels the class casts at that level. */
export interface LearnedGroup extends PickPlan {
  level: number;
}

/** A Learned at level N group's key on the step (dec-1b): "learn:2". */
export type LearnKey = `learn:${number}`;
export const learnKey = (level: number): LearnKey => `learn:${level}`;
const learnLevelOf = (group: string): number | null => (group.startsWith('learn:') ? Number(group.slice(6)) : null);

/**
 * A group the player picks from: how many, from which spells. `count` never asks for more than the level has (bq3-15,
 * of-6): with fewer spells than the pack's count, `count` is what's there and `wanted` keeps the pack's count for the
 * group's line ("Only 1 spell at this level in your packs"); an empty level keeps its count and asks for nothing (of-2).
 */
export interface PickPlan {
  count: number;
  options: SpellChoice[];
  /** The pack's count, when the level has fewer spells than it (bq3-15); absent otherwise. */
  wanted?: number;
}

/** A pick group asking for no more than its level has (bq3-15). */
function pickPlan(count: number, options: SpellChoice[]): PickPlan {
  // An empty level keeps its count: it asks for nothing anyway (of-2, `emptyLevel`).
  return options.length === 0 || options.length >= count ? { count, options } : { count: options.length, options, wanted: count };
}

/** What the player has picked on the step: chosen ids, the tapped row of each roll (by table id), chosen cantrips. */
export interface FirstSpellsPicks {
  chosen: string[];
  rolled: Record<string, string>;
  cantrips: string[];
  /** The spells picked in each Learned at level N group (dec-1b), by level; absent without such groups. */
  learned?: Record<number, string[]>;
}

export const NO_PICKS: FirstSpellsPicks = { chosen: [], rolled: {}, cantrips: [] };

/** The readable rolls' rows, every table's together. */
export const rollRows = (plan: FirstSpellsPlan): RollRow[] => plan.rolls.flatMap((g) => (g.unreadable ? [] : g.rows));

/**
 * The step's name (cs-2): **Magic** when it holds glamours, runes or knacks (`plan.magic`), else the pack's title for
 * the step (creationGuide `spells.title`), else the app's "First spells" (the caller passes that one).
 */
export const spellsStepTitle = (plan: FirstSpellsPlan | null, title: string): string => (plan && powersOnly(plan) ? plan.knownTitle : plan?.magic ? 'Magic' : title);

/**
 * A step that holds only a class's known powers, named by their list (sp-2, 2026-11-10: "Kinetic powers"): no given,
 * picked or rolled spells, no kindred's grant, no spells learned above level 1 (dec-1b; spells, like first spells, so
 * the step is "Magic"), and a known group with the pack's word rather than "Cantrips".
 */
export const powersOnly = (plan: FirstSpellsPlan): boolean =>
  !!plan.cantrips &&
  plan.knownByList &&
  plan.given.length === 0 &&
  plan.kindredGiven.length === 0 &&
  !plan.choose &&
  plan.rolls.length === 0 &&
  plan.learned.length === 0;

/** Every given spell: the class's, then the kindred's (cs-2). */
export const allGiven = (plan: FirstSpellsPlan): SpellChoice[] => [...plan.given, ...plan.kindredGiven];

/**
 * A group's heading with its source (cs-2): "From your kindred · roll d20 · Random glamour", "From your class · …";
 * the heading alone when no kindred grants anything (nothing to tell apart).
 */
export function fromWords(plan: FirstSpellsPlan, from: GrantSource, heading: string): string {
  if (!plan.fromKindred) return heading;
  return `From your ${from}, ${heading.charAt(0).toLowerCase()}${heading.slice(1)}`;
}

/** The learned picks, every level's, in level order (dec-1b). */
export const learnedIds = (plan: FirstSpellsPlan, picks: FirstSpellsPicks): string[] => plan.learned.flatMap((g) => picks.learned?.[g.level] ?? []);

/** The rows tapped so far, one per table at most. */
const tappedRows = (plan: FirstSpellsPlan, picks: FirstSpellsPicks): RollRow[] => rollRows(plan).filter((r) => picks.rolled[r.tableId] === r.key);

/** A value that "differs by class" (07: any spell field may be an object keyed by class id), for this class or list. */
export function forClass(value: unknown, keys: readonly string[]): unknown {
  if (!isRecord(value)) return value;
  for (const key of keys) if (key in value) return value[key];
  return value;
}

const plural = (n: string, unit: string) => (n === '1' ? unit : unit.endsWith('s') ? unit : `${unit}s`);

/** A spell's duration in words, worked out at this level when it is a formula. */
export function durationWords(value: unknown, level: number): string {
  if (typeof value === 'string' || typeof value === 'number') return text(value);
  if (!isRecord(value)) return '';
  const unit = text(value.unit);
  if (value.value !== undefined) {
    const amount = text(value.value);
    return amount ? (unit ? `${amount} ${plural(amount, unit)}` : amount) : text(value.text);
  }
  if (value.roll !== undefined) return [text(value.roll), unit && plural('2', unit)].filter(Boolean).join(' ');
  const formula = text(value.formula);
  const worked = formula ? workOut(formula, level) : null;
  const amount = worked?.text ?? formula;
  return amount ? (unit ? `${amount} ${plural(amount, unit)}` : amount) : text(value.text);
}

/** The page from a spell's `source` ("p. 44"), keyed by class when it differs. */
const pageOf = (data: Record<string, unknown>, keys: readonly string[]) => text(forClass(data.source, keys));

/** The class's spell list by level, from the list's `levels`, else from each spell's `lists` (keyed by list or class id). */
export function classSpellList(classId: string, listId: string, lists: readonly SpellEntry[], spells: readonly SpellEntry[]): Map<number, string[]> {
  const list = lists.find((l) => l.packEntryId === listId);
  const levels = list && Array.isArray(list.data.levels) ? list.data.levels.filter(isRecord) : [];
  const out = new Map<number, string[]>();
  for (const l of levels) if (typeof l.level === 'number' && Array.isArray(l.spells)) out.set(l.level, l.spells.map(String));
  // Spells naming the list (or the class) with a level, not already listed.
  for (const spell of spells) {
    const on = isRecord(spell.data.lists) ? (spell.data.lists[listId] ?? spell.data.lists[classId]) : undefined;
    if (typeof on !== 'number') continue;
    const at = out.get(on) ?? [];
    if (!at.includes(spell.packEntryId)) out.set(on, [...at, spell.packEntryId]);
  }
  return out;
}

/** A spell id as the step shows it; an id the setting doesn't have keeps its id as its name. */
export function spellChoice(
  id: string,
  level: number,
  spells: readonly SpellEntry[],
  keys: readonly string[],
  atLevel: number,
  /** The list the spell is on at `level`, for its name for the level (lv-1, pf-22); none: the fallback words. */
  list: { data: Record<string, unknown> } | null = null,
): SpellChoice {
  const entry = spells.find((s) => s.packEntryId === id) ?? null;
  const d = entry?.data ?? {};
  const duration = durationWords(forClass(d.duration, keys), atLevel);
  const range = text(forClass(d.range, keys));
  const own = text(forClass(d.blurb, keys));
  const page = pageOf(d, keys);
  const levelName = levelNameOf(list, level);
  return {
    id,
    name: entry?.name ?? id,
    level,
    blurb: own || [duration, range].filter(Boolean).join(', '),
    // Without a blurb the duration and range are the blurb already: the line keeps the level and the page.
    line: [levelWord(levelName, level, 'spell'), ...(own ? [duration, range] : []), page].filter(Boolean).join(', '),
    entry,
    levelName,
  };
}

/**
 * The full rules of a spell, under headings (the entry's pop-up; M7-3's "the full rules one tap away"). Level's
 * value is the list's name for the level, else the level's number alone, "0" too (lv-1, pf-22; levelWord's 'value').
 */
export function spellHeadings(choice: SpellChoice, keys: readonly string[], atLevel: number): { label: string; text: string }[] {
  const d = choice.entry?.data ?? {};
  const out: { label: string; text: string }[] = [];
  const add = (label: string, value: string) => value && out.push({ label, text: value });
  add('Level', levelWord(choice.levelName, choice.level, 'value'));
  add('Range', text(forClass(d.range, keys)));
  add('Duration', durationWords(forClass(d.duration, keys), atLevel));
  if (d.reversible === true) add('Reversible', text(d.reversedName) ? `Yes: ${text(d.reversedName)}` : 'Yes');
  if (Array.isArray(d.saves) && d.saves.length > 0) add('Saves', d.saves.map(String).join(', '));
  add('Rules', text(forClass(d.notes, keys)) || text(forClass(d.blurb, keys)));
  return out;
}

/**
 * A spell's whole description for the Magic tab's opened spell (dec-8 B; mm-12): its notes, else its blurb, read by the
 * shared rule-text reader (pf-18: plain words, or `{ "blocks": [ … ] }` with lead-ins, lists, tables and boxes), for
 * this class or list where it differs by class; null when it has neither. Its source is the spell's page. Beside
 * `spellHeadings`, which keeps its one "Rules" string for creation's First spells and the full sheet.
 */
export function spellDescription(choice: SpellChoice, keys: readonly string[]): { text: RuleText | null; source: string } {
  const d = choice.entry?.data ?? {};
  const read = (field: unknown): RuleText | null => {
    const { value } = readRuleText(forClass(field, keys));
    return typeof value === 'string' ? value.trim() || null : value;
  };
  return { text: read(d.notes) ?? read(d.blurb), source: pageOf(d, keys) };
}

/**
 * A spell's entry in the book format (dec-10 S3, picture creation/final 20-E2): its facts as labelled lines, the spell's
 * text as the paragraph (the "Rules" heading's words, without the label), and its source for the last line.
 */
export function spellBookEntry(choice: SpellChoice, keys: readonly string[], atLevel: number): { headings: { label: string; text: string }[]; description: string[]; source: string } {
  const all = spellHeadings(choice, keys, atLevel);
  const rules = all.find((h) => h.label === 'Rules')?.text;
  return { headings: all.filter((h) => h.label !== 'Rules'), description: rules ? [rules] : [], source: pageOf(choice.entry?.data ?? {}, keys) };
}

/** The count at this level from `known.byLevel` (the highest row at or under the level); 0 without one. */
function knownCount(known: Record<string, unknown>, level: number): number {
  const rows = Array.isArray(known.byLevel) ? known.byLevel.filter(isRecord) : [];
  const row = rows.filter((r) => typeof r.level === 'number' && r.level <= level).sort((a, b) => (b.level as number) - (a.level as number))[0];
  return row && typeof row.count === 'number' && Number.isInteger(row.count) && row.count > 0 ? row.count : 0;
}

/** A table row's range: "1–2", "3"; '' without numbers. */
function rangeOf(row: Record<string, unknown>): string {
  const min = typeof row.min === 'number' ? row.min : typeof row.roll === 'number' ? row.roll : null;
  const max = typeof row.max === 'number' ? row.max : min;
  if (min === null) return text(row.key) || text(row.range);
  return max === null || max === min ? String(min) : `${min}–${max}`;
}

/** The spells a roll row gives: its `spells` (a list of ids), the only field read (07 tables; fs-2, 2026-11-02). */
const rowSpells = (row: Record<string, unknown>): string[] => (Array.isArray(row.spells) ? row.spells.map(String).filter((id) => id.trim()) : []);

/** The table ids of `firstSpells.rollTable`: one id or a list (fs-3), blanks and repeats left out. */
export function rollTableIds(value: unknown): string[] {
  const ids = Array.isArray(value) ? value.map(text) : [text(value)];
  return ids.filter((id, i, all) => id && all.indexOf(id) === i);
}

/** The level a spell sits at on any of the setting's lists (a kindred's spells are on no class list); 1 when none says. */
function anyListLevel(id: string, lists: readonly SpellEntry[], spells: readonly SpellEntry[]): number {
  for (const list of lists) {
    for (const l of Array.isArray(list.data.levels) ? list.data.levels.filter(isRecord) : []) {
      if (typeof l.level === 'number' && Array.isArray(l.spells) && l.spells.map(String).includes(id)) return l.level;
    }
  }
  const on = spells.find((s) => s.packEntryId === id)?.data.lists;
  const level = isRecord(on) ? Object.values(on).find((v) => typeof v === 'number') : undefined;
  return typeof level === 'number' ? level : 1;
}

/** The given ids of a `firstSpells` block, blanks and repeats left out. */
const givenIds = (first: Record<string, unknown>) => (Array.isArray(first.given) ? first.given.map(String) : []).filter((id, i, all) => id.trim() && all.indexOf(id) === i);

/**
 * The rows of a class's `learnByLevel` (an older `knownByLevel` read the same way, 07) from level 2 up to the starting
 * level, and never below the level the class starts casting at: one per level, counts on the same level added up.
 */
function learnRows(casting: Record<string, unknown>, level: number, fromLevel: number): { level: number; count: number }[] {
  const raw: unknown[] = Array.isArray(casting.learnByLevel) ? casting.learnByLevel : Array.isArray(casting.knownByLevel) ? casting.knownByLevel : [];
  const counts = new Map<number, number>();
  for (const row of raw.filter(isRecord)) {
    const at = row.level;
    const n = row.count;
    if (typeof at !== 'number' || !Number.isInteger(at) || at < 2 || at > level || at < fromLevel) continue;
    if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) continue;
    counts.set(at, (counts.get(at) ?? 0) + n);
  }
  return [...counts].sort(([a], [b]) => a - b).map(([at, count]) => ({ level: at, count }));
}

/**
 * The spell levels a class casts at a character level (dec-1b): those with a slot in its progression's `spellSlots`
 * (the highest row at or under the level; [2, 1] = 1st and 2nd), no higher than `maxSpellLevel`. Null when the
 * progression says nothing (the caller then offers the first spells' level).
 */
function castableLevels(klass: Record<string, unknown>, casting: Record<string, unknown>, level: number): number[] | null {
  const rows = Array.isArray(klass.progression) ? klass.progression.filter(isRecord) : [];
  const row = rows.filter((r) => typeof r.level === 'number' && r.level <= level && Array.isArray(r.spellSlots)).sort((a, b) => (b.level as number) - (a.level as number))[0];
  if (!row) return null;
  const max = typeof casting.maxSpellLevel === 'number' ? casting.maxSpellLevel : Infinity;
  const levels = (row.spellSlots as unknown[]).flatMap((n, i) => (typeof n === 'number' && n > 0 && i + 1 <= max ? [i + 1] : []));
  return levels.length > 0 ? levels : null;
}

/** One roll group per table of a `firstSpells.rollTable`, in the pack's order (fs-3); a table this person can't read is a group that says so. */
function rollGroups(rollTable: unknown, from: GrantSource, tables: readonly SpellEntry[], choice: (id: string) => SpellChoice): RollGroup[] {
  return rollTableIds(rollTable).map((table) => {
    // A kindred's roll has its own key, so a kindred and its class may roll on the same table (cs-2: an elf enchanter's two glamours).
    const tableId = from === 'kindred' ? `kindred:${table}` : table;
    const found = tables.find((t) => t.packEntryId === table);
    if (!found) return { tableId, table, from, unreadable: true };
    const rows = (Array.isArray(found.data.rows) ? found.data.rows.filter(isRecord) : []).map((row, n) => ({
      key: `${tableId}:${n}`,
      tableId,
      range: rangeOf(row),
      result: text(row.result),
      spells: rowSpells(row).map((id) => choice(id)),
    }));
    return { tableId, table, from, die: text(found.data.die), name: found.name, rows, column: resultColumn(found.data.columns) };
  });
}

/**
 * The word over a rolled table's results (dec-10 E, its book head row): the pack's own column label, the last one when
 * it names the die's column first ("d6", "Knack"); "Result" when the pack names none (nothing invented).
 */
export function resultColumn(columns: unknown): string {
  const labels = (Array.isArray(columns) ? columns : []).map((c) => text(c)).filter(Boolean);
  return labels[labels.length - 1] || 'Result';
}

/**
 * The First spells (or Magic) step for this class at this starting level, or null when there is none (cr-3, cr-13):
 * no spellcasting, neither `firstSpells` nor `known`, a `fromLevel` above the level (a divine caster casting from level 2), or nothing
 * to show at all. A kindred's `firstSpells` (cs-2: `given` and `rollTable`, the class shape) is **added to** the
 * class's, each group labelled with its source; with one the step appears even for a class that casts nothing (an elf
 * fighter). Pass the race as the character plays it (creation.ts raceAsPlayed): a kindred-class's own kindred grants
 * nothing beside it (cs-4).
 */
export function firstSpellsPlan(
  klass: SpellEntry | null,
  level: number,
  setting: { spells: readonly SpellEntry[]; lists: readonly SpellEntry[]; tables: readonly SpellEntry[]; choices: Readonly<Record<string, string>> },
  race: SpellEntry | null = null,
  /** The character's patron (December 1a; pt-5): its swaps change the class's list the picks are offered from. */
  patron: Patron | null = null,
  /** The list each class casts from: the swaps reach the classes on the list their `extends` names (the lead's ruling B). */
  classListOf: ClassListOf = () => undefined,
): FirstSpellsPlan | null {
  if (!klass) return null;
  const casting = isRecord(klass.data.spellcasting) ? klass.data.spellcasting : null;
  // A class with powers known by level and no first spells (F45, Francis's option B, 2026-11-10: the zine's
  // mental-powers and rune classes) still has its part: `known` is read standing alone, as if `firstSpells` were empty.
  const first = casting && isRecord(casting.firstSpells) ? casting.firstSpells : casting && isRecord(casting.known) ? {} : null;
  const fromLevel = casting && typeof casting.fromLevel === 'number' ? casting.fromLevel : 1;
  // The class's part: only for a caster with first spells or known powers from this level.
  const classPart = casting && first && fromLevel <= level ? { casting, first } : null;
  const kindredFirst = race && isRecord(race.data.firstSpells) ? race.data.firstSpells : null;
  const classId = klass.packEntryId;
  const listId = classPart ? text(classPart.casting.listId) : '';
  const keys = [classId, listId].filter(Boolean);
  // The levels hold only spells in play (the shared reader): one an option switches off is on no level, so a level
  // may be empty, and the step never asks for picks from it (of-2's safety net, below).
  const off = new Set(setting.spells.filter((s) => s.optionOff).map((s) => s.packEntryId));
  const inPlay = new Set(entriesInPlay(setting.spells).map((s) => s.packEntryId));
  const classList = new Map([...classSpellList(classId, listId, setting.lists, entriesInPlay(setting.spells))].map(([at, ids]) => [at, ids.filter((id) => !off.has(id))] as const));
  // A patron's swaps (pt-5): cast as the class's spells at the swap's level, whatever list or pack they come from.
  const byLevel = classPart ? withSwaps(classList, patron, classId, (id) => inPlay.has(id), classListOf).list : classList;
  const levelOf = (id: string) => [...byLevel.entries()].find(([, ids]) => ids.includes(id))?.[0] ?? anyListLevel(id, setting.lists, setting.spells);
  const classListEntry = setting.lists.find((l) => l.packEntryId === listId) ?? null;
  const choice = (id: string, at = levelOf(id)) => spellChoice(id, at, setting.spells, keys, level, classListEntry);

  const given = classPart ? givenIds(classPart.first).map((id) => choice(id)) : [];
  // Pick N from the class list's first level (the lowest level above the cantrips), the given ones left out.
  const firstLevel = Math.min(...[...byLevel.keys()].filter((l) => l >= 1), Infinity);
  const raw = classPart?.first.choose;
  const count = typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : 0;
  const choose = count > 0 ? pickPlan(count, (byLevel.get(firstLevel) ?? []).filter((id) => !given.some((g) => g.id === id)).map((id) => choice(id, firstLevel))) : null;

  // The class's rolls first, then the kindred's (cs-2: added to the class's).
  const rolls: RollGroup[] = [...(classPart ? rollGroups(classPart.first.rollTable, 'class', setting.tables, choice) : []), ...(kindredFirst ? rollGroups(kindredFirst.rollTable, 'kindred', setting.tables, choice) : [])];
  // A kindred's given spells, those the class doesn't give already.
  const kindredGiven = kindredFirst ? givenIds(kindredFirst).filter((id) => !given.some((g) => g.id === id)).map((id) => choice(id)) : [];

  // Cantrips (G-49): the class's `known` block, when its option (if any) is on, its count at this level.
  let cantrips: FirstSpellsPlan['cantrips'] = null;
  const known = classPart?.casting.known;
  if (isRecord(known) && (known.option === undefined || optionIsOn(known.option, setting.choices))) {
    const n = knownCount(known, level);
    // Any list level the class's list has (of-6, G-119: glamours or runes kept at level 1); 0 by default.
    const at = typeof known.listLevel === 'number' && Number.isInteger(known.listLevel) && known.listLevel >= 0 ? known.listLevel : 0;
    if (n > 0) cantrips = pickPlan(n, (byLevel.get(at) ?? []).map((id) => choice(id, at)));
  }

  // Learned at level N (dec-1b): each level of `learnByLevel` from 2 to this one, from the spell levels the class casts
  // at that level (the given ones left out; a spell picked elsewhere on the step is answered "Already yours").
  const learned: LearnedGroup[] = classPart
    ? learnRows(classPart.casting, level, fromLevel).map(({ level: at, count: n }) => {
        const spellLevels = castableLevels(klass.data, classPart.casting, at) ?? (Number.isFinite(firstLevel) ? [firstLevel] : []);
        const options = spellLevels.flatMap((sl) => (byLevel.get(sl) ?? []).filter((id) => !given.some((g) => g.id === id)).map((id) => choice(id, sl)));
        return { level: at, ...pickPlan(n, options.filter((o, i) => options.findIndex((x) => x.id === o.id) === i)) };
      })
    : [];

  const kindredRolls = rolls.filter((g) => g.from === 'kindred');
  const fromKindred = kindredGiven.length > 0 || kindredRolls.length > 0;
  if (given.length === 0 && !choose && rolls.length === 0 && !cantrips && kindredGiven.length === 0 && learned.length === 0) return null;
  // Glamours, runes and knacks (cs-2): a kindred's grant, or a class part that is neither a spell book nor prayers.
  const type = classPart ? text(classPart.casting.type) : '';
  const classShows = given.length > 0 || !!choose || rolls.some((g) => g.from === 'class') || !!cantrips || learned.length > 0;
  const magic = fromKindred || (classShows && type !== 'book' && type !== 'divine');
  // Powers, runes or knacks are named by their list (the pack's word); a book's or prayers' known block, and a level-0
  // known block beside first spells on any class, by the list's name for its level (lv-1, pf-22), else "Level 0".
  const listName = classListEntry?.name.trim() ?? '';
  const knownLevel = isRecord(known) && typeof known.listLevel === 'number' ? known.listLevel : 0;
  const hasFirst = !!casting && isRecord(casting.firstSpells);
  const knownByList = !!(type !== 'book' && type !== 'divine' && listName && (knownLevel > 0 || !hasFirst));
  const knownName = levelNameOf(classListEntry, knownLevel);
  const knownTitle = knownByList ? listName : levelWord(knownName, knownLevel, 'title');
  return {
    classId,
    note: classPart ? text(classPart.first.note) : '',
    kindredNote: fromKindred && kindredFirst ? text(kindredFirst.note) : '',
    fromKindred,
    magic,
    given,
    kindredGiven,
    choose,
    rolls,
    cantrips,
    knownTitle,
    knownByList,
    knownLevel,
    knownName,
    learned,
  };
}

/** The picks cleaned against the plan: ids it offers, no more than each count (a resumed or stale pick drops out). */
export function cleanPicks(plan: FirstSpellsPlan, picks: FirstSpellsPicks): FirstSpellsPicks {
  const offered = (options: SpellChoice[] | undefined, ids: string[], count: number) => ids.filter((id) => options?.some((o) => o.id === id)).slice(0, count);
  const rows = rollRows(plan);
  return {
    chosen: offered(plan.choose?.options, picks.chosen, plan.choose?.count ?? 0),
    rolled: Object.fromEntries(Object.entries(picks.rolled).filter(([tableId, key]) => rows.some((r) => r.tableId === tableId && r.key === key))),
    cantrips: offered(plan.cantrips?.options, picks.cantrips, plan.cantrips?.count ?? 0),
    // Only with Learned at level N groups (dec-1b): a level-1 character's picks are as they were.
    ...(plan.learned.length > 0 ? { learned: Object.fromEntries(plan.learned.map((g) => [g.level, offered(g.options, picks.learned?.[g.level] ?? [], g.count)])) } : {}),
  };
}

/**
 * The picks read back from a saved book (the creation review, m5b-0c slice 7: a draft reopened, or a step changed
 * from the review): the book's spells each group offers, in the book's order (bookOf writes given, picked, rolled,
 * cantrips), and the roll's row whose spells are all in the book and not already picked.
 */
export function picksFromBook(plan: FirstSpellsPlan, book: readonly string[]): FirstSpellsPicks {
  const inBook = new Set(book);
  const given = new Set(allGiven(plan).map((g) => g.id));
  const offers = (options: SpellChoice[] | undefined, count: number) => book.filter((id) => !given.has(id) && options?.some((o) => o.id === id)).slice(0, count);
  const chosen = offers(plan.choose?.options, plan.choose?.count ?? 0);
  // Each learned level's (dec-1b), in level order after the first spells: the book's spells it offers, not already taken.
  const learned: Record<number, string[]> = {};
  const claimed = new Set(chosen);
  for (const g of plan.learned) {
    const mine = book.filter((id) => !given.has(id) && !claimed.has(id) && g.options.some((o) => o.id === id)).slice(0, g.count);
    learned[g.level] = mine;
    for (const id of mine) claimed.add(id);
  }
  const cantrips = offers(plan.cantrips?.options, plan.cantrips?.count ?? 0);
  const taken = new Set([...given, ...claimed, ...cantrips]);
  // Each table's row whose spells are all in the book and not already picked; a spell one table gave counts as taken for the next.
  const rolled: Record<string, string> = {};
  for (const group of plan.rolls) {
    if (group.unreadable) continue;
    const row = group.rows.find((r) => r.spells.length > 0 && r.spells.every((s) => inBook.has(s.id)) && r.spells.some((s) => !taken.has(s.id)));
    if (!row) continue;
    rolled[group.tableId] = row.key;
    for (const s of row.spells) taken.add(s.id);
  }
  return cleanPicks(plan, { chosen, rolled, cantrips, learned });
}

/** The spell book the step writes: given, then picked, then learned by level, then each roll's in table order, then the cantrips; each spell once. */
export function bookOf(plan: FirstSpellsPlan, picks: FirstSpellsPicks): string[] {
  const rolled = tappedRows(plan, picks).flatMap((r) => r.spells.map((s) => s.id));
  return [...new Set([...allGiven(plan).map((g) => g.id), ...picks.chosen, ...learnedIds(plan, picks), ...rolled, ...picks.cantrips])];
}

/** A roll row whose every spell is already in the book from another group (or another table's roll): "already yours · roll again". */
export function rowAlreadyYours(plan: FirstSpellsPlan, picks: FirstSpellsPicks, row: RollRow): boolean {
  if (row.spells.length === 0) return false;
  const otherRolls = tappedRows(plan, picks).filter((r) => r.tableId !== row.tableId).flatMap((r) => r.spells.map((s) => s.id));
  const others = new Set([...allGiven(plan).map((g) => g.id), ...picks.chosen, ...learnedIds(plan, picks), ...picks.cantrips, ...otherRolls]);
  return row.spells.every((s) => others.has(s.id));
}

/** What a tap on a group's row answers when it can't pick: given, full ("1 of 1 picked · take one off to pick another"). Null: it picks. */
export function tapProblem(plan: FirstSpellsPlan, picks: FirstSpellsPicks, group: 'given' | 'choose' | 'roll' | 'cantrips' | LearnKey, id: string): string | null {
  if (group === 'given') return `Given by your ${plan.kindredGiven.some((s) => s.id === id) && !plan.given.some((s) => s.id === id) ? 'kindred' : 'class'}: always ${plan.magic ? 'yours' : 'in your book'}.`;
  if (group === 'roll') {
    const row = rollRows(plan).find((r) => r.key === id);
    if (!row || picks.rolled[row.tableId] === id) return null;
    if (row.spells.length === 0) return `${row.result || 'That result'} isn't among your setting's spells. Ask your GM.`;
    if (rowAlreadyYours(plan, picks, row)) return 'Already yours: roll again.';
    return null;
  }
  const at = learnLevelOf(group);
  if (at !== null) {
    // A Learned at level N group (dec-1b): the same answers as Pick N.
    const mine = picks.learned?.[at] ?? [];
    if (mine.includes(id)) return null;
    const n = plan.learned.find((g) => g.level === at)?.count ?? 0;
    if (mine.length >= n) return `${mine.length} of ${n} picked: take one off to pick another.`;
    if (bookOf(plan, { ...picks, learned: { ...picks.learned, [at]: [] } }).includes(id)) return 'Already yours: pick another.';
    return null;
  }
  const taken = group === 'choose' ? picks.chosen : picks.cantrips;
  if (taken.includes(id)) return null;
  const count = (group === 'choose' ? plan.choose?.count : plan.cantrips?.count) ?? 0;
  if (taken.length >= count) return `${taken.length} of ${count} picked: take one off to pick another.`;
  // A spell the roll or the given ones already put in the book.
  if (group === 'choose' && bookOf(plan, { ...picks, chosen: [] }).includes(id)) return 'Already yours: pick another.';
  return null;
}

/** The picks after a tap that may pick (tapProblem said null): toggles the spell, or sets / clears that table's roll row. */
export function tapped(picks: FirstSpellsPicks, group: 'choose' | 'roll' | 'cantrips' | LearnKey, id: string): FirstSpellsPicks {
  const at = learnLevelOf(group);
  if (at !== null) {
    const mine = picks.learned?.[at] ?? [];
    return { ...picks, learned: { ...picks.learned, [at]: mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id] } };
  }
  if (group === 'roll') {
    const tableId = id.slice(0, id.lastIndexOf(':'));
    const rolled = { ...picks.rolled };
    if (rolled[tableId] === id) delete rolled[tableId];
    else rolled[tableId] = id;
    return { ...picks, rolled };
  }
  const key = group === 'choose' ? 'chosen' : 'cantrips';
  const now = picks[key];
  return { ...picks, [key]: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] };
}

const spellsWord = (n: number, what: 'spell' | 'roll') => `${n} ${what}${n === 1 ? '' : 's'}`;

/** The readable rolls with rows that haven't been tapped yet, in table order. */
const rollsLeft = (plan: FirstSpellsPlan, picks: FirstSpellsPicks) =>
  plan.rolls.filter((g): g is Extract<RollGroup, { rows: RollRow[] }> => !g.unreadable && g.rows.length > 0 && !picks.rolled[g.tableId]);

/** A pick group whose list level has no spells in the campaign's packs (of-2: skipped, "No spells at this level in your packs"). */
export const emptyLevel = (group: { options: readonly SpellChoice[] }): boolean => group.options.length === 0;

/** The words an empty pick group shows (of-2, si-1). */
export const EMPTY_LEVEL_WORDS = 'No spells at this level in your packs.';

/**
 * The line a group with fewer spells than the pack's count shows (bq3-15): "Only 1 spell at this level in your packs
 * (your class gets 2): pick it." Null when the level has enough (or none: the empty line instead).
 */
export function shortLevelWords(group: PickPlan, what: 'spell' | 'power' | { level: number; name: LevelName | null } = 'spell'): string | null {
  if (group.wanted === undefined || emptyLevel(group)) return null;
  const n = group.count;
  // Powers or runes named by their list (sp-2, 2026-11-10): "Only 3 at this level in your setting."
  if (what === 'power') return `Only ${n} at this level in your setting.`;
  // A known group by its level (lv-1): the list's word for it, else "level 0 spell".
  const many = what === 'spell' ? spellsWord(n, 'spell') : levelWord(what.name, what.level, { count: n });
  return `Only ${many} at this level in your packs (your class gets ${group.wanted}): pick ${n === 1 ? 'it' : 'them'}.`;
}

/** The words the known group's short line counts in (lv-1): the list's own for powers, else the level's. */
export const knownShortWhat = (plan: FirstSpellsPlan): 'power' | { level: number; name: LevelName | null } =>
  plan.knownByList && !plan.knownName ? 'power' : { level: plan.knownLevel, name: plan.knownName };

/**
 * The known group's title (lv-1; the lead's one rule, 2026-11-14: a group title that only repeats the step's own title
 * drops the repeat): "Glimmers: pick 2", the heading alone while its level is empty; under a step titled the same
 * ("Glimmers", a list's own step), "Pick 2", named level or not. `stepTitle`: the step's title as shown.
 */
export function knownGroupTitle(plan: FirstSpellsPlan, stepTitle = ''): string {
  if (!plan.cantrips || emptyLevel(plan.cantrips)) return plan.knownTitle;
  const repeats = plan.knownTitle.trim().toLocaleLowerCase() === stepTitle.trim().toLocaleLowerCase();
  return repeats ? `Pick ${plan.cantrips.count}` : `${plan.knownTitle}: pick ${plan.cantrips.count}`;
}

/**
 * What is still to do, by kind: "1 spell, 1 roll and 2 cantrips to go" (walk fix, ruled 2026-11-12: a roll not yet
 * tapped is a roll, never a spell, so the foot agrees with Pick's "1 of 1 picked"); with only rolls left, the roll's
 * own line. Null when every count is met (cr-2).
 */
export function firstSpellsProblem(plan: FirstSpellsPlan, picks: FirstSpellsPicks): string | null {
  const left = rollsLeft(plan, picks);
  // A group with nothing to pick from (an empty list level) asks for nothing (of-2): it never blocks Next.
  // Learned at level N (dec-1b) counts as spells, like Pick N.
  const learnedLeft = plan.learned.reduce((sum, g) => sum + Math.max(0, learnedWanted(plan, picks, g) - (picks.learned?.[g.level]?.length ?? 0)), 0);
  const spellsLeft = Math.max(0, plan.choose && !emptyLevel(plan.choose) ? plan.choose.count - picks.chosen.length : 0) + learnedLeft;
  const cantripsLeft = plan.cantrips && !emptyLevel(plan.cantrips) ? plan.cantrips.count - picks.cantrips.length : 0;
  if (left.length > 0 && spellsLeft <= 0 && cantripsLeft <= 0) return `Roll ${left[0]!.die || 'the dice'} at the table, then tap what it shows`;
  // Powers or runes named by their list (F45; sp-2, 2026-11-10): the foot counts down, "4 to go"; "4 from Kinetic
  // powers" beside spells. A named level counts in the list's word ("1 glimmer to go"), an unnamed one in the
  // fallback's ("2 level 0 spells to go"; lv-1).
  const ownWord = plan.knownByList && !plan.knownName;
  if (ownWord && spellsLeft <= 0 && left.length === 0 && cantripsLeft > 0) return `${cantripsLeft} to go`;
  const knownLeft = ownWord ? `${cantripsLeft} from ${plan.knownTitle}` : levelWord(plan.knownName, plan.knownLevel, { count: cantripsLeft });
  const parts = [spellsLeft > 0 ? spellsWord(spellsLeft, 'spell') : '', left.length > 0 ? spellsWord(left.length, 'roll') : '', cantripsLeft > 0 ? knownLeft : ''].filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' and ' : ''}${parts.at(-1)!} to go`;
}

/** The foot's hint: what's still to do, else how many spells the book will hold. */
export function firstSpellsHint(plan: FirstSpellsPlan, picks: FirstSpellsPicks): string {
  const problem = firstSpellsProblem(plan, picks);
  if (problem) return problem;
  const n = bookOf(plan, picks).length;
  // Glamours, runes and knacks aren't a book (cs-2).
  return plan.magic ? `All picked: ${n} yours` : `${n} ${n === 1 ? 'spell' : 'spells'} in your book`;
}

/**
 * How many a Learned at level N group can still take (#633 review): its count, but no more than its own picks and the
 * spells at its levels not already in the book from elsewhere on the step. 0 for an empty level.
 */
export function learnedWanted(plan: FirstSpellsPlan, picks: FirstSpellsPicks, group: LearnedGroup): number {
  if (emptyLevel(group)) return 0;
  const elsewhere = new Set(bookOf(plan, { ...picks, learned: { ...(picks.learned ?? {}), [group.level]: [] } }));
  const free = group.options.filter((o) => !elsewhere.has(o.id)).length;
  return Math.min(group.count, free);
}

/** The line a Learned at level N group shows when every spell at its levels is already in the book (#633 review). */
export const LEARNED_ALL_YOURS_WORDS = 'Every spell at this level is already yours.';

/** Whether a Learned at level N group has spells but none left to learn (they're all yours from elsewhere). */
export const learnedAllYours = (plan: FirstSpellsPlan, picks: FirstSpellsPicks, group: LearnedGroup): boolean =>
  !emptyLevel(group) && learnedWanted(plan, picks, group) === 0;

/**
 * The spells a Learned at level N group lists (picture review of #633, 2026-11-12): its options less those already in the
 * book from elsewhere on the step (no pack lets a book hold a spell twice); the group's own picks stay listed to unpick.
 */
export function learnedOptions(plan: FirstSpellsPlan, picks: FirstSpellsPicks, group: LearnedGroup): SpellChoice[] {
  const elsewhere = new Set(bookOf(plan, { ...picks, learned: { ...(picks.learned ?? {}), [group.level]: [] } }));
  return group.options.filter((o) => !elsewhere.has(o.id));
}

/**
 * A learned level's heading (dec-1b; Francis's words, picture creation/final 20-E1): "Pick 1 more, for level 2"; with
 * nothing to pick there, "Learned at level 2".
 */
export const learnedTitle = (group: LearnedGroup, allYours = false): string => (emptyLevel(group) || allYours ? `Learned at level ${group.level}` : `Pick ${group.count} more, for level ${group.level}`);

/** "1 of 2 picked" for a group's heading. */
export const groupCount = (picked: number, count: number) => `${picked} of ${count} picked`;
