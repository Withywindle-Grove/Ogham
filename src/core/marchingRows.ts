// Marching order, worked out (M5 step 8; docs/05 "Expeditions, time and light"; ruled M5-6, 2026-10-25): a column of
// rows, front to back, each holding 1–3 characters side by side. Pure: no database. The expedition module keeps it
// (src/modules/expedition/marchingPlay.ts); it lives in core because the log's words use it (core never imports a module).

/** Front to back; each row 1–3 character ids. */
export type Rows = string[][];

/** The most characters side by side in one row. */
export const ROW_MAX = 3;

/** Rows as stored, read leniently: anything that isn't a list of lists of ids is left out, and no id comes twice. */
export function readRows(value: unknown): Rows {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const ids = row.filter((id): id is string => typeof id === 'string' && !seen.has(id) && !!seen.add(id)).slice(0, ROW_MAX);
    return ids.length > 0 ? [ids] : [];
  });
}

/**
 * The order as it shows for this party: who is no longer in it is left out (rows they leave empty go), and who
 * isn't in it yet (a newly approved character, a new hireling) joins at the back, each in a row of their own, in the
 * order given.
 */
export function arrange(rows: Rows, party: readonly string[]): Rows {
  const here = new Set(party);
  const kept = readRows(rows)
    .map((row) => row.filter((id) => here.has(id)))
    .filter((row) => row.length > 0);
  const placed = new Set(kept.flat());
  return [...kept, ...party.filter((id) => !placed.has(id)).map((id) => [id])];
}

/** The rows with the row at `from` moved to `to` (hold to drag). */
export function moveRow(rows: Rows, from: number, to: number): Rows {
  const next = rows.map((row) => [...row]);
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row!);
  return next;
}

/** Which row a character is in (-1 when they aren't). */
export const rowOf = (rows: Rows, id: string): number => rows.findIndex((row) => row.includes(id));

/**
 * The character steps beside the row ahead (or, from the front row, the row behind): null when there's no such row,
 * and 'full' when it already holds 3. A row they leave empty goes.
 */
export function joinRow(rows: Rows, id: string, way: 'ahead' | 'behind'): Rows | null | 'full' {
  const at = rowOf(rows, id);
  const target = way === 'ahead' ? at - 1 : at + 1;
  if (at === -1 || target < 0 || target >= rows.length) return null;
  if (rows[target]!.length >= ROW_MAX) return 'full';
  const next = rows.map((row, i) => (i === target ? [...row, id] : row.filter((other) => other !== id)));
  return next.filter((row) => row.length > 0);
}

/** The character steps out into a row of their own, just behind the row they shared; null when they're alone already. */
export function ownRow(rows: Rows, id: string): Rows | null {
  const at = rowOf(rows, id);
  if (at === -1 || rows[at]!.length < 2) return null;
  const next = rows.map((row, i) => (i === at ? row.filter((other) => other !== id) : [...row]));
  next.splice(at + 1, 0, [id]);
  return next;
}

export const sameRows = (a: Rows, b: Rows): boolean => JSON.stringify(a) === JSON.stringify(b);

/** "Ash", "Ash and Wren", "Ash, Wren and Moss". */
export function namesWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "to the front", "to the back", "to row 3". */
const placeWords = (index: number, count: number) => (index === 0 ? 'to the front' : index === count - 1 ? 'to the back' : `to row ${index + 1}`);

/**
 * What a change to the order did, in words for the toast and the log ("moved Ash to the front", "put Ash beside
 * Wren", "gave Ash a row of their own"), or "changed the marching order" when it's more than one step. Characters
 * missing from `before` (they joined since it was saved) count as at its back, as the order shows them.
 */
export function moveWords(before: Rows, after: Rows, name: (id: string) => string): string {
  const party = after.flat();
  const was = arrange(before, party);
  const fallback = 'changed the marching order';
  if (sameRows(was, after)) return fallback;
  const key = (row: string[]) => [...row].sort().join(',');
  // One row moved: the same rows in another order, and taking that row out of both leaves them the same.
  if (was.length === after.length && [...was.map(key)].sort().join('|') === [...after.map(key)].sort().join('|')) {
    for (let to = 0; to < after.length; to += 1) {
      const from = was.findIndex((row) => key(row) === key(after[to]!));
      if (from !== to && sameRows(moveRow(was, from, to), after)) return `moved ${namesWords(after[to]!.map(name))} ${placeWords(to, after.length)}`;
    }
    return fallback;
  }
  // One character joined another row, or stepped into a row of their own.
  for (const id of party) {
    const ahead = joinRow(was, id, 'ahead');
    const behind = joinRow(was, id, 'behind');
    for (const joined of [ahead, behind]) {
      if (Array.isArray(joined) && sameRows(joined, after)) {
        const beside = after[rowOf(after, id)]!.filter((other) => other !== id);
        return `put ${name(id)} beside ${namesWords(beside.map(name))}`;
      }
    }
    const alone = ownRow(was, id);
    if (alone && sameRows(alone, after)) return `gave ${name(id)} a row of their own`;
  }
  return fallback;
}
