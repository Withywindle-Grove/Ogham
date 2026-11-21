// B15's split-party rule (b15f-6, Francis 2026-11-20: "No, group A only"): while the party is split, a magic item's
// eye names the item only on lines held in the group being shown the piece, or by someone an earlier show during a
// split was shown to (by character, never by group number). The database enforces it
// (supabase/tests/p2p-b15-item-truth.test.ts, 8 and 10); this is the GM's side, which passes only those lines and names
// only their holders in the toast.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../core/events.ts';
import { heldLinesOf, partySplit, type SplitRule } from './itemTruth.ts';

const event = (id: string, request: string, extra: Partial<LogEvent> = {}): LogEvent => ({
  id, seq: Number(id.replace(/\D/g, '')), type: 'find.give', level: 'simple', actorUserId: 'gm', targetTable: 'inventory_lines', targetId: `line-${id}`, before: null, after: {}, fiat: false,
  reason: null, revertsEventId: null, requestId: request, createdAt: '2026-11-20T10:00:00Z', ...extra,
});
const find = (to: string | null) => JSON.stringify({ find: { to, placeId: 'wreck', rows: ['2:thing'] } });

// Three sends of the hooded lantern (thing row 2) from the Wreck: to Wren, to Ash and to the party stash.
const events = [
  event('e1', 'r1', { reason: find('wren') }),
  event('e2', 'r2', { reason: find('ash') }),
  event('e3', 'r3', { reason: find(null) }),
];
const holders = new Map<string, string | null>([['line-e1', 'wren'], ['line-e2', 'ash'], ['line-e3', null]]);
// Wren is in group 1, Ash in group 2.
const groupOf = new Map([['wren', 1], ['ash', 2]]);
const split = (group: number, shownTo: string[] = []): SplitRule => ({ holders, groupOf, group, shownTo: new Set(shownTo) });

describe("a magic item's eye while the party is split (b15f-6)", () => {
  // Purpose: with the party one group, the eye names the item wherever it is held, as before (nothing changes).
  it('names every line when the party is one group', () => {
    expect(heldLinesOf(events, 'wreck', 2)).toEqual(['line-e1', 'line-e2', 'line-e3']);
    expect(heldLinesOf(events, 'wreck', 2, null)).toEqual(['line-e1', 'line-e2', 'line-e3']);
  });

  // Purpose: shown to group 1 only, the eye names Wren's line (group 1) and not Ash's (group 2), nor the party stash's,
  // which no group holds: hidden stays hidden.
  it('names only the lines held in a group the piece is shown to', () => {
    expect(heldLinesOf(events, 'wreck', 2, split(1))).toEqual(['line-e1']);
    expect(heldLinesOf(events, 'wreck', 2, split(2))).toEqual(['line-e2']);
  });

  // Purpose: once Ash has been shown the piece too (a show to group 2 during this split), Ash's line is named by the
  // eye on group 1 as well.
  it('names a line in the other group once that group is shown the piece too', () => {
    expect(heldLinesOf(events, 'wreck', 2, split(1, ['ash']))).toEqual(['line-e1', 'line-e2']);
  });

  // Purpose: an earlier show is matched by whom it reached, never by group number: a show that reached someone who
  // was group 2 in an earlier split names nothing of Ash's, now in group 2 (the third fix's review, finding 3).
  it('ignores an old show to a group number someone else had', () => {
    expect(heldLinesOf(events, 'wreck', 2, split(1, ['once-in-group-2']))).toEqual(['line-e1']);
  });

  // Purpose: a line no longer there, or held by someone in no group, is never named while split.
  it('leaves out a line no longer there and a holder in no group', () => {
    const gone: SplitRule = { holders: new Map([['line-e2', 'stranger']]), groupOf, group: 1, shownTo: new Set() };
    expect(heldLinesOf(events, 'wreck', 2, gone)).toEqual([]);
  });

  // Purpose: the party counts as split only with more than one group among the characters and hirelings in play, as the
  // database counts it; someone left alone in a group while not in play (dead, or not approved) splits nothing.
  it('counts the party split only by those in play', () => {
    expect(partySplit(groupOf, new Set(['wren', 'ash']))).toBe(true);
    expect(partySplit(groupOf, new Set(['wren']))).toBe(false);
    expect(partySplit(new Map([['wren', 1], ['ash', 1]]), new Set(['wren', 'ash']))).toBe(false);
    expect(partySplit(new Map(), new Set())).toBe(false);
  });
});
