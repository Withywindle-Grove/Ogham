/**
 * A pack item's play blocks as the pack has them now (gate finding F27, 2026-11-10, option 1). A carried line keeps
 * its own copy of its item (inventory.ts), so a key a pack update added inside `weapon` or `armour` (a weapon's
 * `modes`, a `range`) never reached an item already owned: the copy's block replaced the entry's whole. Here the
 * entry's block is read first and the line's own block laid over it key by key (one level in), so the entry's new
 * keys come through and the line's own keys still win. Reading only: nothing is written back to the line.
 *
 * Except a few keys that always follow the pack (fp-1, ruled 2026-11-10, ENTRY_ALWAYS): a weapon's modes, range, magic
 * bonus and bonus against a foe are read from the current entry (one its weapon block no longer has is dropped from
 * the item too), so a pack's correction reaches a
 * weapon already owned (a launcher whose old copy still carried a mode's toHit counted a magic arrow twice). Nobody
 * edits these keys (the item edit writes top-level fields only; the chosen mode is the line's `mode_id`), so nothing a
 * person chose is lost.
 *
 * Not done (a design ruling after the gate, "option 2", the wider rule): a value the pack corrects on any other key
 * the line already has (a damage die) still doesn't reach the item, because the line's key wins.
 */

/** The blocks merged key by key; every other key is the line's alone, as before. */
export const PLAY_BLOCKS = ['weapon', 'armour'] as const;

/** Keys inside a block that always come from the entry's block when it has one (fp-1); the list is the ruling's, closed. */
export const ENTRY_ALWAYS: Readonly<Record<string, readonly string[]>> = { weapon: ['modes', 'range', 'magicBonus', 'bonusVs'] };

/** Two JSON-like values are the same, key order aside (so an unchanged key doesn't count as taken from the entry). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
}

/**
 * Keys inside a block that stay the line's own copy only: `armour.baseArmour` (magic armour's base choices) is
 * checked by the database against the line's own item_data (verify_base_armour), as pickBase and Waiting for you
 * read it, so an entry's new base choices must not make AC ask for a base the pick would then refuse (review of #596).
 */
const LINE_ONLY: Readonly<Record<string, readonly string[]>> = { armour: ['baseArmour'] };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The entry's block without the keys that stay the line's own; null when nothing is left. */
function entryBlock(block: string, theirs: Record<string, unknown>): Record<string, unknown> | null {
  const skip = LINE_ONLY[block] ?? [];
  const kept = skip.some((key) => key in theirs) ? Object.fromEntries(Object.entries(theirs).filter(([key]) => !skip.includes(key))) : theirs;
  return Object.keys(kept).length > 0 ? kept : null;
}

export interface WithEntryBlocks {
  /** The line's details with the entry's blocks under its own; the very same object when nothing came through. */
  details: Record<string, unknown>;
  /**
   * The paths that came from the entry ("weapon.modes"; a whole block the line hasn't: "armour"): new keys, and the
   * ENTRY_ALWAYS keys whose value the entry's replaced or dropped (fp-1).
   */
  fromEntry: string[];
}

/**
 * The line's details with the current entry's `weapon` and `armour` blocks under its own, key by key. A line
 * without the block takes the entry's whole; a line whose block isn't an object (or an entry whose isn't) keeps its
 * own. The ENTRY_ALWAYS keys are the entry's (fp-1): its value over the line's when they differ, and gone when the
 * entry's block (which it has) no longer has the key.
 * `armour.baseArmour` is never taken from the entry (LINE_ONLY). No entry (a one-off, or one removed from the
 * pack): the line's copy as it is.
 */
export function withEntryBlocks(details: Record<string, unknown>, entryData: Record<string, unknown> | null | undefined): WithEntryBlocks {
  if (!entryData) return { details, fromEntry: [] };
  let out = details;
  const fromEntry: string[] = [];
  for (const block of PLAY_BLOCKS) {
    const whole = entryData[block];
    if (!isObject(whole)) continue;
    const theirs = entryBlock(block, whole) ?? {};
    const mine = details[block];
    if (!(block in details)) {
      if (Object.keys(theirs).length === 0) continue;
      out = { ...out, [block]: theirs };
      fromEntry.push(block);
      continue;
    }
    if (!isObject(mine)) continue;
    const always = ENTRY_ALWAYS[block] ?? [];
    const added = Object.keys(theirs).filter((key) => !(key in mine));
    const corrected = always.filter((key) => key in mine && key in theirs && !same(mine[key], theirs[key]));
    // A key the entry's block no longer has is dropped from the item too (fp-1: read from the current entry).
    const dropped = always.filter((key) => key in mine && !(key in theirs));
    if (added.length === 0 && corrected.length === 0 && dropped.length === 0) continue;
    const forced = Object.fromEntries(corrected.map((key) => [key, theirs[key]]));
    const merged: Record<string, unknown> = { ...theirs, ...mine, ...forced };
    for (const key of dropped) delete merged[key];
    out = { ...out, [block]: merged };
    fromEntry.push(...[...added, ...corrected, ...dropped].map((key) => `${block}.${key}`));
  }
  return { details: out, fromEntry };
}

/** Whether a figure's path ("weapon.range.long") lies under one of the paths that came from the entry. */
export const cameFromEntry = (path: string, fromEntry: readonly string[]): boolean => fromEntry.some((p) => path === p || path.startsWith(`${p}.`));
