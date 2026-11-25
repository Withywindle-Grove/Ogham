// B15's eye on a magic item's piece, the GM's side: which lines it names. A name revealed is revealed to everyone
// (Francis, 2026-11-21, replacing b15f-6), so the eye names the item wherever it went, whoever holds it and whichever
// group they are in. The database's side: supabase/tests/p2p-b15-item-truth.test.ts (8 and 9).
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../core/events.ts';
import { heldLinesOf } from './itemTruth.ts';

const event = (id: string, request: string, extra: Partial<LogEvent> = {}): LogEvent => ({
  id, seq: Number(id.replace(/\D/g, '')), type: 'find.give', level: 'simple', actorUserId: 'gm', targetTable: 'inventory_lines', targetId: `line-${id}`, before: null, after: {}, fiat: false,
  reason: null, revertsEventId: null, requestId: request, createdAt: '2026-11-20T10:00:00Z', ...extra,
});
const find = (to: string | null, placeId = 'wreck') => JSON.stringify({ find: { to, placeId, rows: ['2:thing'] } });

// Three sends of the hooded lantern (thing row 2) from the Wreck: to Wren (group 1), to Ash (group 2) and to the stash.
const events = [
  event('e1', 'r1', { reason: find('wren') }),
  event('e2', 'r2', { reason: find('ash') }),
  event('e3', 'r3', { reason: find(null) }),
];

describe("a magic item's eye names the item wherever it went", () => {
  // Purpose: the eye names every line the thing went to, a character's pack in either group and the party stash alike:
  // once revealed, the name is everyone's, the party split or not.
  it('names every line the thing went to, whoever holds it', () => {
    expect(heldLinesOf(events, 'wreck', 2)).toEqual(['line-e1', 'line-e2', 'line-e3']);
  });

  // Purpose: a send that was undone, a send from another place and another thing row name nothing.
  it('leaves out an undone send, another place and another thing', () => {
    const more = [
      ...events,
      event('e4', 'r4', { type: 'find.give', targetId: null, revertsEventId: 'e2', requestId: 'r5' }),
      event('e6', 'r6', { reason: find('wren', 'cove') }),
    ];
    expect(heldLinesOf(more, 'wreck', 2)).toEqual(['line-e1', 'line-e3']);
    expect(heldLinesOf(events, 'wreck', 1)).toEqual([]);
  });
});
