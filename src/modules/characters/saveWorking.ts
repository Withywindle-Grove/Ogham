// A save's working (plan dec-15-save-bonus, rows 1 and 2): stub for the tests-first commit; the counting follows.
import type { RollPass } from '../library/rolls.ts';
import type { SaveModifierInput } from './play.ts';

/** Where a part of a bonus comes from: the kindred, the class, a score, or the rules set's own number. */
export type SaveSourceKind = 'kindred' | 'class' | 'score' | 'rule';

/** One part of a bonus: how much (in the book's sign), and who gives it. */
export interface SavePart {
  bonus: number;
  /** "Bog folk", "Lantern Warden", "Lore"; null for a number the rules set gives itself. */
  from: string | null;
  kind: SaveSourceKind;
  /** The part beyond an "otherwise" in the same list ("+4 vs venom, +2 otherwise": 2 more vs venom). */
  more: boolean;
}

/** A counted row: one bonus that always holds, and the number after it. */
export interface CountedRow extends SavePart {
  number: number;
  /** The stop's number when the stop held this row back, else null. */
  held: number | null;
}

/** A bonus that holds at times on this save: its condition, its parts (one row for one condition), the number then. */
export interface AtTimesRow {
  condition: string;
  parts: SavePart[];
  bonus: number;
  number: number;
  held: number | null;
}

/** A bonus every save has at times (`saveModifiers`): the entry, its parts, the number then. */
export interface SharedRow {
  id: string;
  name: string;
  appliesWhen: string;
  parts: SavePart[];
  bonus: number;
  number: number;
  held: number | null;
}

/** A save's working: the class's number, each counted row, the figure, and what holds at times. */
export interface SaveWorking {
  key: string;
  die: string;
  sides: number;
  pass: RollPass;
  base: number;
  className: string | null;
  counted: CountedRow[];
  figure: number;
  atTimes: AtTimesRow[];
  shared: SharedRow[];
  stops: { easy: number; hard: number | null };
}

/** Where the number stops (row 2): the easy end, and the hard end (none: the worked number). */
export interface SaveStops {
  easy?: number;
  hard?: number | null;
}

export interface SaveWorkingInput extends SaveModifierInput {
  stops?: SaveStops;
}

export function saveWorking(saveKey: string, input: SaveWorkingInput): SaveWorking | null {
  void saveKey;
  void input;
  return null;
}
