// Party groups, worked out (M5 step 8; ruled 2026-10-30, DG14; docs/05 "Splitting the party"): each character and
// hireling is in one group, by number. Group 1 is the party; a split adds Group 2, 3, … With no split there is
// exactly one group, the party, and the app looks as it did before. Pure: no database. The expedition module keeps
// the groups (src/modules/expedition/groupPlay.ts); this lives in core because the log's words use it.

/** The party's number: everyone's group until someone splits off. */
export const PARTY = 1;

export interface PartyGroup {
  number: number;
  /** Its characters and hirelings, in the order given (by name). */
  ids: string[];
}

/** Which group each character is in (by actor id); anyone missing is with the party. */
export type GroupOf = ReadonlyMap<string, number>;

export const groupOf = (members: GroupOf, id: string): number => members.get(id) ?? PARTY;

/** The groups someone is in (empty groups aren't shown), by number; with no one at all, just the party, empty. */
export function groupsOf(members: GroupOf, marchers: readonly string[]): PartyGroup[] {
  const groups = new Map<number, string[]>();
  for (const id of marchers) {
    const at = groupOf(members, id);
    groups.set(at, [...(groups.get(at) ?? []), id]);
  }
  if (groups.size === 0) return [{ number: PARTY, ids: [] }];
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([number, ids]) => ({ number, ids }));
}

/** "Group 2". */
export const groupName = (number: number): string => `Group ${number}`;

/** The party has split: more than one group has someone in it. */
export const isSplit = (groups: readonly PartyGroup[]): boolean => groups.length > 1;

/**
 * A log line's words for a change of group (party.chooseGroup, party.joinUp), from its changes (each a member row's
 * id, which is the character's, and its group before and after). `name` gives a character's name.
 */
export function groupWords(
  type: 'party.chooseGroup' | 'party.joinUp',
  changes: readonly { id: string | null; before: number | null; after: number | null }[],
  name: (id: string) => string,
): string {
  const first = changes[0];
  // The split ended in this action: with one group left the database puts everyone back in the party, so someone
  // changes group twice in it (a hireling following its player changes once, like its player).
  const ids = changes.map((c) => c.id);
  const together = ids.some((id, i) => id !== null && ids.indexOf(id) !== i);
  if (type === 'party.joinUp') {
    const from = first?.before ?? null;
    const into = changes.find((c) => c.before === from)?.after ?? null;
    const base = from !== null && into !== null && !together ? `joined up ${groupName(from)} with ${groupName(into)}` : 'joined up the groups';
    return together ? `${base}: the party is together again` : base;
  }
  if (!first?.id || first.after === null) return 'changed the groups';
  const who = name(first.id);
  return together ? `put ${who} with the others: the party is together again` : `put ${who} in ${groupName(first.after)}`;
}
