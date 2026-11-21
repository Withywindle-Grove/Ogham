// A spell level's word (lv-1, Francis 2026-11-14; pf-22, the lead 2026-11-14). The app writes no word of its own for
// a level ("Cantrips" is gone): a spell list may name its levels, `levelNames`, a map from a level to `{ one, many }`
// (`"levelNames": { "0": { "one": "Glimmer", "many": "Glimmers" } }`), and an add-on may name a level on another
// pack's list with an ordinary patch (`levelNames.0`), so the list is read as the setting has it, after patches (the
// pack highest in the stack wins, as for any patch). Where the list gives no name, the approved fallback words: "Level
// 0" and its kin at level 0; at levels 1 and up, the words the app always wrote. Every place that writes a level's word
// goes through `levelWord`: First spells' group title, foot and short line, a spell's own level line and its pop-up,
// the sheet's Magic rows and the Spell book count, and a trait's rolled spell.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A list's word for one of its levels: `one` for a single spell, `many` for a heading and for several. */
export interface LevelName {
  one: string;
  many: string;
}

/** The name a list gives one of its levels (its `levelNames`, both words given), or null: the fallback words apply. */
export function levelNameOf(list: { data: Record<string, unknown> } | null | undefined, level: number): LevelName | null {
  const names = list && isRecord(list.data.levelNames) ? list.data.levelNames : null;
  const entry = names ? names[String(level)] : undefined;
  if (!isRecord(entry)) return null;
  const one = words(entry.one);
  const many = words(entry.many);
  return one && many ? { one, many } : null;
}

/**
 * How a level's word is used:
 *   'title'  a heading, the group of a level ("Glimmers: pick 2"; "Level 0");
 *   'spell'  a single spell's own level line ("Glimmer, 3 turns"; "Level 0", "Level 1");
 *   'value'  the value under a pop-up's "Level" label: the name's single form, else the number alone ("Glimmer"; "0", "1"; the lead, 2026-11-14, so the Magic tab and creation agree);
 *   'aSpell' one spell in a sentence ("roll for one Glimmer"; "level 0 spell", "level 1 spell");
 *   { count } several to pick or still to do ("2 Glimmers"; "2 level 0 spells");
 *   { inBook } how many the Spell book holds ("3 Glimmers"; "3 at level 0").
 */
export type LevelUse = 'title' | 'spell' | 'value' | 'aSpell' | { count: number } | { inBook: number };

/**
 * The words with a capital first letter (lv-1): a pack stores a level's names as the book prints them mid-sentence
 * ("lesser glimmer"), so a name that starts a title or a line takes one; inside a sentence it stays as stored.
 */
export const startCapital = (text: string): string => (text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text);

/**
 * A level's word for its use: the list's name for it where it gives one (with a capital where it starts a title or a
 * line), else the approved fallback (lv-1).
 */
export function levelWord(name: LevelName | null, level: number, use: LevelUse): string {
  if (typeof use === 'object') {
    const n = 'count' in use ? use.count : use.inBook;
    if (name) return `${n} ${n === 1 ? name.one : name.many}`;
    return 'count' in use ? `${n} level ${level} ${n === 1 ? 'spell' : 'spells'}` : `${n} at level ${level}`;
  }
  if (name) return use === 'aSpell' ? name.one : startCapital(use === 'title' ? name.many : name.one);
  if (use === 'aSpell') return `level ${level} spell`;
  if (use === 'value') return String(level);
  return `Level ${level}`;
}
