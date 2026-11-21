// The full sheet's Magic section (sr-4, sheet plan build order 3; mockup sheet/01 "4 · Magic · A"). Pure: whether the
// character has any magic, the spells a day by level (pips, never "1, 0, 0, 0, 0, 0"), and one tab per kind of magic
// the character has: the Spell book (a `book` caster's), Prepared (a caster with slots), and each other list the
// character's spells sit on, under the list's own name (the pack's words for its glamours, runes or knacks).
// Reading only: Cast and Prepare on the sheet stay in M7.
import { durationWords, forClass, spellChoice, type SpellChoice, type SpellEntry } from './firstSpells.ts';
import type { PreparedSpell } from './playState.ts';
import { levelNameOf, levelWord } from './levelNames.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

/** One spell on a tab: what the row shows and the entry it opens. */
export interface MagicRow {
  /** Unique within its tab. */
  key: string;
  name: string;
  /** "Level 1 · 3 turns · 40 ft" (the list's word for the level where it names it, else "Level 0" at level 0; lv-1). */
  facts: string;
  /** Given by the class or the kindred at creation (the mockup's "given" tag). */
  given: boolean;
  /** How many times it is prepared (Prepared only; 1 elsewhere): "×2" beside the name. */
  times: number;
  /** The spell as creation reads it, for its entry (`spellHeadings`). */
  choice: SpellChoice;
  /** The class and list ids its fields may be keyed by (07: any spell field may differ by class). */
  keys: string[];
}

export interface MagicTab {
  id: string;
  /** "Spell book", "Prepared", or the list's name ("Glamours"). */
  title: string;
  rows: MagicRow[];
  /** What an empty tab says. */
  empty: string;
}

export interface Magic {
  /** Spells a day by spell level, only the levels with any (level 1 first); `title` is the level's words (lv-1). */
  perDay: { level: number; count: number; title: string }[];
  tabs: MagicTab[];
}

/** The ids a `firstSpells` block gives outright. */
const givenOf = (first: unknown): string[] => (isRecord(first) && Array.isArray(first.given) ? first.given.map(String) : []);

/**
 * The level a spell sits at on a list (its `levels`, else the spell's own `lists`), or null when it isn't on it. On
 * the class's own list a spell's `lists` may name the class instead of the list (as creation's `classSpellList` reads
 * it; F41: cantrips keyed by class showed as "Level 1").
 */
function levelOn(list: SpellEntry, id: string, spell: SpellEntry | undefined, classId = ''): number | null {
  for (const l of Array.isArray(list.data.levels) ? list.data.levels.filter(isRecord) : []) {
    if (typeof l.level === 'number' && Array.isArray(l.spells) && l.spells.map(String).includes(id)) return l.level;
  }
  const on = spell && isRecord(spell.data.lists) ? (spell.data.lists[list.packEntryId] ?? (classId ? spell.data.lists[classId] : undefined)) : undefined;
  return typeof on === 'number' ? on : null;
}

/**
 * The Magic section for a character, or null for one with no magic (sr-4: "only for characters with any magic"). Any
 * magic: spells in the book (written by First spells, the kindred's glamours included), anything prepared, a spell
 * slot at this level, a class that casts from this level, or a kindred that grants spells.
 */
export function magicOf(input: {
  klass: SpellEntry | null;
  /** The kindred as the character plays it (a kindred-class's own kindred grants nothing beside it, cs-4). */
  race: SpellEntry | null;
  level: number;
  /** The spell book's ids (`spellBookOf`). */
  book: readonly string[];
  prepared: readonly PreparedSpell[];
  /** Spells a day by level (`slotsOf`): index 0 is level 1. */
  slots: readonly number[];
  spells: readonly SpellEntry[];
  /** The setting's spell lists, in the packs' order. */
  lists: readonly SpellEntry[];
}): Magic | null {
  const { klass, race, level, book, prepared, slots, spells, lists } = input;
  const casting = klass && isRecord(klass.data.spellcasting) ? klass.data.spellcasting : null;
  const fromLevel = casting && typeof casting.fromLevel === 'number' ? casting.fromLevel : 1;
  const castsNow = !!casting && fromLevel <= level;
  const kindredGrants = !!race && isRecord(race.data.firstSpells);
  const classList = casting ? lists.find((l) => l.packEntryId === text(casting.listId)) : undefined;
  // A level's words, as the Magic tab heads it (lv-1, pf-22): the class's list's plural where it names the level.
  const perDay = slots.flatMap((count, i) => (count > 0 ? [{ level: i + 1, count, title: levelWord(levelNameOf(classList, i + 1), i + 1, 'title') }] : []));
  if (book.length === 0 && prepared.length === 0 && perDay.length === 0 && !castsNow && !kindredGrants) return null;

  const classId = klass?.packEntryId ?? '';
  const type = casting ? text(casting.type) : '';
  // The class's list first, then every other in the packs' order: a spell goes to the first that has it.
  const ordered = [...(classList ? [classList] : []), ...lists.filter((l) => l !== classList)];
  const given = new Set([...(casting ? givenOf(casting.firstSpells) : []), ...(race ? givenOf(race.data.firstSpells) : [])]);
  const spellOf = (id: string) => spells.find((s) => s.packEntryId === id);
  const rowOf = (id: string, list: SpellEntry | undefined, at: number, key = id): MagicRow => {
    const keys = [classId, list?.packEntryId ?? ''].filter(Boolean);
    const choice = spellChoice(id, at, spells, keys, level, list ?? null);
    const d = choice.entry?.data ?? {};
    // The level (one spell: the list's `one` for it, lv-1), then its duration and range: "Level 1 · 3 turns · 40 ft".
    const facts = [levelWord(choice.levelName, at, 'spell'), durationWords(forClass(d.duration, keys), level), text(forClass(d.range, keys))].filter(Boolean).join(', ');
    return { key, name: choice.name, facts, given: given.has(id), times: 1, choice, keys };
  };

  // Each spell of the book on its tab: a book caster's own list is the Spell book; any other list is its own tab.
  const bookTab = type === 'book';
  const byList = new Map<string, { list: SpellEntry | undefined; rows: { row: MagicRow; at: number; n: number }[] }>();
  book.forEach((id, n) => {
    const spell = spellOf(id);
    let list: SpellEntry | undefined;
    let at: number | null = null;
    for (const l of ordered) {
      at = levelOn(l, id, spell, l === classList ? classId : '');
      if (at !== null) {
        list = l;
        break;
      }
    }
    // No list for the class in the packs: a spell keyed to the class still has its level there (creation's reading).
    const byClass = !classList && classId && spell && isRecord(spell.data.lists) ? spell.data.lists[classId] : undefined;
    if (at === null && typeof byClass === 'number') at = byClass;
    // A spell on no list: in a book caster's book, else with the other magic.
    const tabId = list && !(bookTab && list === classList) ? `list:${list.packEntryId}` : bookTab ? 'book' : 'other';
    const group = byList.get(tabId) ?? { list, rows: [] };
    group.rows.push({ row: rowOf(id, list, at ?? 1), at: at ?? 1, n });
    byList.set(tabId, group);
  });
  const sorted = (rows: { row: MagicRow; at: number; n: number }[]) => [...rows].sort((a, b) => a.at - b.at || a.n - b.n).map((r) => r.row);

  const tabs: MagicTab[] = [];
  if (bookTab && castsNow) tabs.push({ id: 'book', title: 'Spell book', rows: sorted(byList.get('book')?.rows ?? []), empty: 'No spells in your book yet.' });
  if (perDay.length > 0 || prepared.length > 0) {
    // Prepared, by level; the same spell twice is one row, "×2".
    const counted = new Map<string, { spell: string; level: number; count: number; n: number }>();
    prepared.forEach((p, n) => {
      const key = `${p.level}:${p.spell}`;
      const had = counted.get(key);
      counted.set(key, had ? { ...had, count: had.count + 1 } : { spell: p.spell, level: p.level, count: 1, n });
    });
    const rows = [...counted.values()]
      .sort((a, b) => a.level - b.level || a.n - b.n)
      // No "given" here: what's prepared today, not where it came from.
      .map((p) => ({ ...rowOf(p.spell, classList, p.level, `${p.level}:${p.spell}`), given: false, times: p.count }));
    tabs.push({ id: 'prepared', title: 'Prepared', rows, empty: 'Nothing prepared yet.' });
  }
  // A known-magic class (glamours, knacks: neither a book nor prayers) always has its list's tab, empty or not.
  const knownClassList = castsNow && classList && type !== 'book' && type !== 'divine' ? classList : undefined;
  for (const list of ordered) {
    const id = `list:${list.packEntryId}`;
    const group = byList.get(id);
    if (!group && list !== knownClassList) continue;
    tabs.push({ id, title: list.name, rows: sorted(group?.rows ?? []), empty: `No ${list.name.toLowerCase()} yet.` });
  }
  if (byList.has('other')) tabs.push({ id: 'other', title: 'Other magic', rows: sorted(byList.get('other')!.rows), empty: '' });
  return { perDay, tabs };
}

/** A tab's label: "Spell book: 4" (Prepared counts a spell prepared twice as 2; no middle dot, plan m5b-players-screens-standard D). */
export function tabLabel(tab: MagicTab): string {
  // The Spell book counts its level-0 spells apart (sp-1, 2026-11-10), in the list's word for the level (lv-1):
  // "Spell book: 1 spell, 3 glimmers", else "Spell book: 1 spell, 3 at level 0".
  const zero = tab.id === 'book' ? tab.rows.filter((r) => r.choice.level === 0) : [];
  if (zero.length > 0) {
    const spells = tab.rows.length - zero.length;
    const name = zero.find((r) => r.choice.levelName)?.choice.levelName ?? null;
    const words = [spells > 0 ? `${spells} ${spells === 1 ? 'spell' : 'spells'}` : '', levelWord(name, 0, { inBook: zero.length })].filter(Boolean);
    return `${tab.title}: ${words.join(', ')}`;
  }
  return `${tab.title}: ${tab.rows.reduce((sum, r) => sum + r.times, 0)}`;
}


/**
 * The Magic section beside the play column (mp-21; dec-8 B): no Prepared tab, since the Magic tab shows the same
 * spells one column away; it opens on the next tab (a book caster's Spell book). Opened on its own, the sheet keeps it.
 * Null when nothing would be left (spells ready, but no slots a day and no other kind): no empty section.
 */
export function besidePlayColumn(magic: Magic): Magic | null {
  const tabs = magic.tabs.filter((t) => t.id !== 'prepared');
  return tabs.length === 0 && magic.perDay.length === 0 ? null : { ...magic, tabs };
}
