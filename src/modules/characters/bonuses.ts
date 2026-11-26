// The kindred's and class's own bonuses (cs-7, ruled 2026-11-03; the creation survey's PR 5): AC bonuses counted in
// the AC fill and its breakdown when their condition holds, and save bonuses shown beside the saves. Pure: from the
// race as the class plays it (a kindred-class's own fields replace its kindred's, cs-4) and the class at a level.
//
// Pack shapes read (07, the survey's fields):
//  - a race's or class's `acBonus`: a whole number, or `{ value, when? }` with `when` in words ("unarmoured or Light
//    armour"). The app reads armour words in `when` (unarmoured, light, medium, heavy armour, joined by "or" or
//    commas); a `when` it can't read ("vs Large") is a situational bonus, named in the breakdown and not counted;
//  - a class's progression row `acBonus` (by level, the latest row at or below the character's level);
//  - a race's or class's `saveBonus`: a whole number, `{ bonus | value, vs? | when?, saves? }`, or a list of them.
//    Shown beside each save it names (all saves when it names none) as "+2 to the roll" (bq-8, 2026-11-03). Ruled
//    2026-11-25 (plan dec-15-save-bonus): one that always holds is counted into the save's number and one at times
//    gives its own; saveWorking.ts does that counting, and the screens read it from the plan's batch B on. Until
//    then these words stay beside the number, not added in.
import { readTraitNote, type RuleTextBlocks } from '../library/ruleText.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** How heavily a character is armoured, as an AC bonus's condition reads it. */
export type ArmourState = 'none' | 'light' | 'medium' | 'heavy';

/** An AC bonus from the kindred or the class: who gives it, how much, and its condition in the pack's words. */
export interface AcBonus {
  /** "Thistlekin", "Friar at level 3". */
  source: string;
  value: number;
  /** The pack's words ("unarmoured or Light armour"), or null when it always counts. */
  when: string | null;
}

/**
 * The armour states a `when` names ("unarmoured or Light armour" → none, light), or null when any part of it isn't
 * about armour ("vs Large", "when wading"): then the bonus is the table's to count.
 */
export function readArmourWhen(when: string): ArmourState[] | null {
  const parts = when
    .toLowerCase()
    .replace(/[.;]/g, ' ')
    .split(/,|\bor\b/)
    .map((p) => p.replace(/\b(when|while|if|in|wearing|only|is|are)\b/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const states: ArmourState[] = [];
  for (const part of parts) {
    if (/^(unarmou?red|no armou?r|not armou?red|without armou?r)$/.test(part)) states.push('none');
    else {
      const found = /^(light|medium|heavy)(?: armou?r)?$/.exec(part);
      if (!found) return null;
      states.push(found[1] as ArmourState);
    }
  }
  return [...new Set(states)];
}

/** An `acBonus` field as a bonus: a number, or `{ value, when? }`; null when it gives nothing. */
function bonusOf(field: unknown, source: string): AcBonus | null {
  const value = whole(field) ?? (isRecord(field) ? whole(field.value) ?? whole(field.bonus) : null);
  if (value === null || value === 0) return null;
  const when = isRecord(field) ? text(field.when) : '';
  return { source, value, when: when || null };
}

/** The class's progression row at a level: the latest at or below it. */
function rowAt(klass: Record<string, unknown> | null, level: number): Record<string, unknown> | null {
  const rows = (Array.isArray(klass?.progression) ? klass.progression : []).filter(isRecord);
  return rows.filter((r) => typeof r.level === 'number' && r.level <= level).sort((a, b) => (b.level as number) - (a.level as number))[0] ?? null;
}

/**
 * The AC bonuses a character has from its kindred and class (cs-7): the race's `acBonus` (as the class plays it, so
 * a kindred-class's replaces its kindred's), the class's own `acBonus`, and the class's progression `acBonus` at this
 * level. In that order; none that are 0.
 */
export function acBonusesOf(race: Record<string, unknown> | null, klass: Record<string, unknown> | null, level: number): AcBonus[] {
  const raceName = text(race?.name) || 'Your kindred';
  const className = text(klass?.name) || 'Your class';
  const out: AcBonus[] = [];
  const fromRace = bonusOf(race?.acBonus, raceName);
  if (fromRace) out.push(fromRace);
  const fromClass = bonusOf(klass?.acBonus, className);
  if (fromClass) out.push(fromClass);
  const byLevel = bonusOf(rowAt(klass, level)?.acBonus, `${className} at level ${level}`);
  if (byLevel) out.push(byLevel);
  return out;
}

/**
 * The armour state of what's worn: none with no armour; else the armour's `type` (its own, or the chosen base's for
 * magic armour); null when the armour doesn't say how heavy it is.
 */
export function armourStateOf(armour: { armour: unknown; chosenBase?: { armour: unknown } | null } | undefined): ArmourState | null {
  if (!armour) return 'none';
  const typeOf = (block: unknown) => (isRecord(block) ? text(block.type).toLowerCase() : '');
  const type = typeOf(armour.armour) || typeOf(armour.chosenBase?.armour);
  return type === 'light' || type === 'medium' || type === 'heavy' ? type : null;
}

/** Whether a bonus counts now: always without a condition; an armour condition by what's worn; never a situational one. */
export function acBonusCounts(bonus: AcBonus, state: ArmourState | null): 'counts' | 'not-now' | 'unknown' | 'at-the-table' {
  if (bonus.when === null) return 'counts';
  const states = readArmourWhen(bonus.when);
  if (states === null) return 'at-the-table';
  if (state === null) return 'unknown';
  return states.includes(state) ? 'counts' : 'not-now';
}

/** A save bonus as the pack gives it: how much, against what (or null for every roll), and which saves (or all). */
interface SaveBonus {
  bonus: number;
  against: string | null;
  saves: string[] | null;
}

function saveBonusesOf(field: unknown): SaveBonus[] {
  const list = Array.isArray(field) ? field : field === undefined || field === null ? [] : [field];
  return list.flatMap((entry): SaveBonus[] => {
    const bonus = whole(entry) ?? (isRecord(entry) ? whole(entry.bonus) ?? whole(entry.value) : null);
    if (bonus === null || bonus === 0) return [];
    const against = isRecord(entry) ? text(entry.vs) || text(entry.against) || text(entry.when) : '';
    const saves = isRecord(entry) && Array.isArray(entry.saves) ? entry.saves.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : null;
    return [{ bonus, against: against || null, saves: saves && saves.length > 0 ? saves : null }];
  });
}

/** Whether a save bonus's condition is the "otherwise" of its list ("all other", "others"): it always holds. */
export const isOtherwise = (against: string | null) => against !== null && /^(all )?others?$/i.test(against);

/** "+4 to the roll vs fungal spores", "+2 to the roll" (no condition), "+2 to the roll otherwise" ("vs all other"). */
function saveWords(b: SaveBonus): string {
  if (!b.against) return `${signed(b.bonus)} to the roll`;
  if (isOtherwise(b.against)) return `${signed(b.bonus)} to the roll otherwise`;
  return `${signed(b.bonus)} to the roll vs ${b.against.replace(/^vs\.? /i, '')}`;
}

/**
 * What an entry's `saveBonus` says beside each save (cs-7), by fill name ("saves.D" → "+4 to the roll vs poison;
 * +2 to the roll otherwise"): every save in `saveKeys` unless the bonus names its saves.
 */
export function saveBonusNotes(entry: Record<string, unknown> | null, saveKeys: readonly string[]): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const b of saveBonusesOf(entry?.saveBonus)) {
    for (const key of b.saves ?? saveKeys) {
      const name = `saves.${key}`;
      notes[name] = notes[name] ? `${notes[name]}; ${saveWords(b)}` : saveWords(b);
    }
  }
  return notes;
}

/**
 * An entry's `saveBonus` that reaches one save, as numbers (cs-7; the save's "Modifiers", plan dec-player-figure-sheet,
 * the lead's ruling on ⚑ 1): each non-zero bonus that names this save, or names none (then every save), with what it
 * is against. The same reading as `saveBonusNotes`.
 */
export function saveBonusesOn(entry: Record<string, unknown> | null, saveKey: string): { bonus: number; against: string | null }[] {
  return saveBonusesOf(entry?.saveBonus)
    .filter((b) => !b.saves || b.saves.includes(saveKey))
    .map((b) => ({ bonus: b.bonus, against: b.against }));
}

/** What a save bonus is against, as a Modifiers line's lead: "Vs poison", "Otherwise", "To the roll" (none named). */
export function saveBonusLead(against: string | null): string {
  if (!against) return 'To the roll';
  if (isOtherwise(against)) return 'Otherwise';
  return `Vs ${against.replace(/^vs\.? /i, '')}`;
}

/** Two note maps as one: the same figure's notes joined with "; ". */
export function joinNotes(...maps: readonly Readonly<Record<string, string>>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const map of maps) for (const [name, note] of Object.entries(map)) out[name] = out[name] ? `${out[name]}; ${note}` : note;
  return out;
}

/** A trait of the kindred or the class, for the sheet's Traits section (cs-7). */
export interface Trait {
  key: string;
  name: string;
  /** What it does, as words (a chip, a row, a line): a note in blocks as its plain words (tfb-5). */
  note: string;
  /** The note when the pack writes it in pf-18's blocks (tfb-5): its entry sets them out one by one. Absent for plain words. */
  noteBlocks?: RuleTextBlocks;
  from: 'kindred' | 'class';
  /** The kindred's or class's name. */
  sourceName: string;
  /** The entry's page ("p. 12"), else its kindred's or class's. */
  source: string;
  /** The level it starts at, when later than 1: its entry's When line reads "At level 4" (of-5). */
  fromLevel: number | null;
  kind: 'advantage' | 'disadvantage';
  /** It carries an `option` (shown only while that option is on): the Traits section groups it under "From options" (tc-1). */
  fromOption: boolean;
}

/**
 * Every kindred and class trait (cs-7: "a traits section exists on the full sheet, every kindred and class trait,
 * each opening its entry"): the race's `abilities` as the class plays it, then the class's, in the pack's order.
 * `isOn` says whether a trait's option is on (optionGate.ts): a trait with an `option` that's off is left out.
 */
export function traitsOf(race: Record<string, unknown> | null, klass: Record<string, unknown> | null, isOn: (trait: Record<string, unknown>) => boolean): Trait[] {
  const read = (owner: Record<string, unknown> | null, from: Trait['from']): Trait[] =>
    (Array.isArray(owner?.abilities) ? owner.abilities : []).filter(isRecord).flatMap((a, n) => {
      const name = text(a.name);
      if (!name || !isOn(a)) return [];
      const note = readTraitNote(a.note);
      return [
        {
          key: `${from}:${n}`,
          name,
          note: note.words || text(a.notes) || text(a.blurb),
          // A note in blocks (tfb-5): its entry sets them out; everywhere else reads `note`, its words. Blocks with no
          // words (a table named by its id alone) draw nothing, so the entry falls back with the rows.
          ...(note.blocks && note.words ? { noteBlocks: note.blocks } : {}),
          from,
          sourceName: text(owner?.name),
          source: text(a.source) || text(owner?.source),
          fromLevel: whole(a.fromLevel),
          kind: a.kind === 'disadvantage' ? 'disadvantage' : 'advantage',
          fromOption: a.option !== undefined || a.onlyWithOption !== undefined,
        },
      ];
    });
  return [...read(race, 'kindred'), ...read(klass, 'class')];
}
