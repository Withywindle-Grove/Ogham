// Creation's Kindred and Class rows in alphabetical order (cs-38, Francis 2026-11-13;
// docs/design/rulings/dec-creation-order-and-closed-patrons-2026-11-13.md): by the name shown, ignoring capitals,
// whatever pack each comes from; a name with a bracket sorts by its whole text ("Human" before "Human (…)"); two of one
// name sit together, the campaign's stack order deciding between them. Only what those two steps show is sorted: the
// lists they are built from keep their order.

/**
 * The rows in alphabetical order, as a new list. `packOrder` is the campaign's packs in stack order (`stackOrder`),
 * by pack id: it decides between two rows of one name; a row from a pack not in it comes after, and a tie left after
 * that keeps the order given.
 */
export function alphabetical<T extends { name: string; packId?: string }>(rows: readonly T[], packOrder: readonly string[] = []): T[] {
  const rank = (row: T) => {
    const at = row.packId === undefined ? -1 : packOrder.indexOf(row.packId);
    return at < 0 ? packOrder.length : at;
  };
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' }) || rank(a) - rank(b));
}
