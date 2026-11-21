// The ability modifier table's columns as words (gate walk 2026-11-05, bug 3; Design's shape, Francis 2026-11-05).
// A rules set's `abilityModifierColumns: { <column>: "value" }` marks the columns a book prints as plain figures
// ("loyalty 7": label first, no sign); every other column is a modifier ("+1 melee"), the default, so a pack without
// the key reads as before. A modifier of zero isn't shown (an average score lists only what it changes); a value is
// always shown, zero included. A text cell is shown as written, after its column's words. One reader for every place
// a score's row shows: the Scores step's tiles (`modifierWords`) and the sheet's ability pop-up (`abilityLines`).

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type ColumnKind = 'value' | 'modifier';

/** Each column the rules sets mark (`abilityModifierColumns`), a later rules set's mark over an earlier one's. */
export function columnKinds(rulesSets: readonly Record<string, unknown>[]): Record<string, ColumnKind> {
  const kinds: Record<string, ColumnKind> = {};
  for (const rules of rulesSets) {
    if (!isRecord(rules.abilityModifierColumns)) continue;
    for (const [column, kind] of Object.entries(rules.abilityModifierColumns)) kinds[column] = kind === 'value' ? 'value' : 'modifier';
  }
  return kinds;
}

/** One cell of a score's row to show: its column, and its number (a modifier or a value) or its text. */
export interface ModifierCell {
  column: string;
  kind: ColumnKind | 'text';
  /** The number or the text, as the pack has it. */
  value: number | string;
}

/** A score's row as the cells to show, in the row's order: zero modifiers, empty text and other shapes left out. */
export function modifierCells(row: unknown, kinds: Readonly<Record<string, ColumnKind>>): ModifierCell[] {
  if (!isRecord(row)) return [];
  return Object.entries(row).flatMap(([column, value]): ModifierCell[] => {
    if (column === 'range') return [];
    if (typeof value === 'number') {
      const kind = kinds[column] ?? 'modifier';
      return kind === 'modifier' && value === 0 ? [] : [{ column, kind, value }];
    }
    return typeof value === 'string' && value.trim() !== '' ? [{ column, kind: 'text', value: value.trim() }] : [];
  });
}

/** A number with its sign: "+1", "−2". */
export const signedNumber = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
