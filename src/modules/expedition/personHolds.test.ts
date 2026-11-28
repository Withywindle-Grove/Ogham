// dec5-gaps piece F (#192; G-228, dg-10 to dg-16, dg-19): what a person carries, read from her pack's `holds` and the
// GM's log (dg-12: never stored). Seam 1, pure functions. Invented names only (Mother Sedge, Wren, The Customs Shed).
//   Purpose:
//   1. A `holds` line is read as written: its item (`itemId`, or `itemRef` with its pack dropped), `qty` 1 when left
//      out or not a whole number of 1 or more, and its note; an item no attached pack has is counted, never named.
//   2. The person is found by her id, her own pack first; an item is found in her pack first, then in the packs' order.
//   3. Held or sent, from the GM's log at every place: the latest send of a key wins, a send taken back marks nothing.
//   4. The words: the Carries line in its three states, a sent row, "Sent before", the toast and the missing line.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../core/events.ts';
import { sentHeld } from './findSend.ts';
import {
  carriesWords,
  heldSentWords,
  heldStates,
  heldTakenBackWords,
  heldThingWords,
  missingWords,
  personHolds,
  personOf,
  sentBeforeWords,
  sentHereWords,
  type HoldsEntry,
} from './personHolds.ts';

const ADV = 'pack-adventure';
const RULES = 'pack-rules';
const item = (packId: string, id: string, name: string): HoldsEntry => ({ packId, kind: 'item', packEntryId: id, name, data: {}, entryId: `lib-${packId}-${id}` });
const sedge = (holds: unknown, packId = ADV): HoldsEntry => ({ packId, kind: 'npc', packEntryId: 'mother-sedge', name: 'Mother Sedge', data: { holds } });
const ENTRIES: HoldsEntry[] = [
  item(ADV, 'wardens-lantern', 'Warden’s lantern'),
  item(ADV, 'iron-key', 'Iron key'),
  item(RULES, 'oil-flask', 'Oil flask'),
  item(RULES, 'iron-key', 'Iron key (rules)'),
];
const ORDER = [ADV, RULES];
const nameOf = (id: string) => (id === 'actor-wren' ? 'Wren' : 'someone');

describe('1. reading a person’s holds (dg-10, dg-15)', () => {
  // Purpose: each line keeps its item, its count (1 when left out) and the book's note; an itemRef loses its pack.
  it('reads each line as written, an itemRef by its bare id and a left-out qty as 1', () => {
    const holds = personHolds(
      sedge([
        { itemId: 'wardens-lantern', note: 'A lantern on a pole' },
        { itemRef: 'river-rules:oil-flask', qty: 999, note: 'In a crate under the desk' },
      ]),
      ENTRIES,
      ORDER,
    );
    expect(holds).toEqual({
      personId: 'mother-sedge',
      things: [
        { key: 'held:mother-sedge:wardens-lantern', itemId: 'wardens-lantern', name: 'Warden’s lantern', qty: 1, note: 'A lantern on a pole', libraryEntryId: `lib-${ADV}-wardens-lantern` },
        { key: 'held:mother-sedge:oil-flask', itemId: 'oil-flask', name: 'Oil flask', qty: 999, note: 'In a crate under the desk', libraryEntryId: `lib-${RULES}-oil-flask` },
      ],
      missing: 0,
    });
  });

  // Purpose: a qty that isn't a whole number of 1 or more reads as 1 (the checker warns on it), never 0 or a fraction.
  it('reads a qty that is not a whole number of 1 or more as 1', () => {
    const holds = personHolds(sedge([{ itemId: 'iron-key', qty: 0 }, { itemId: 'wardens-lantern', qty: 2.5 }]), ENTRIES, ORDER);
    expect(holds?.things.map((t) => t.qty)).toEqual([1, 1]);
  });

  // Purpose: an item no attached pack has is counted, not named (finding 6), and so is a line with no usable id.
  it('counts an item no attached pack has, and a line with no item, without naming either', () => {
    const holds = personHolds(sedge([{ itemId: 'iron-key' }, { itemId: 'mf-moon-bell' }, { note: 'no item' }, 'a bare string']), ENTRIES, ORDER);
    expect(holds?.things.map((t) => t.itemId)).toEqual(['iron-key']);
    expect(holds?.missing).toBe(3);
    expect(JSON.stringify(holds)).not.toContain('mf-moon-bell');
  });

  // Purpose: a person with no holds, or an empty list, carries nothing: her piece stays as today.
  it('gives nothing for a person who holds nothing', () => {
    expect(personHolds(sedge(undefined), ENTRIES, ORDER)).toBeNull();
    expect(personHolds(sedge([]), ENTRIES, ORDER)).toBeNull();
    expect(personHolds(sedge('a lantern'), ENTRIES, ORDER)).toBeNull();
  });

  // Purpose: the same item listed twice on one person is one thing (one key), the first line kept.
  it('keeps one row for an item listed twice on her', () => {
    const holds = personHolds(sedge([{ itemId: 'iron-key', note: 'At her neck' }, { itemId: 'iron-key', note: 'Again' }]), ENTRIES, ORDER);
    expect(holds?.things.map((t) => t.note)).toEqual(['At her neck']);
  });
});

describe('2. finding her and her things', () => {
  // Purpose: the person is found by her id in her own pack first; an item in her pack first, then in the packs' order.
  it('finds her in the place’s pack first, and an item in her pack before the others', () => {
    const other = { ...sedge([{ itemId: 'wardens-lantern' }], RULES), name: 'Another Sedge' };
    const found = personOf([other, sedge([{ itemId: 'iron-key' }]), ...ENTRIES], 'mother-sedge', ORDER, ADV);
    expect(found?.name).toBe('Mother Sedge');
    expect(personOf(ENTRIES, 'mother-sedge', ORDER, ADV)).toBeNull();
    // Her pack's iron key, not the rules pack's, though both are attached.
    expect(personHolds(found!, ENTRIES, ORDER)?.things[0]?.name).toBe('Iron key');
  });
});

describe('3. held or sent, from the GM’s log (dg-12)', () => {
  const send = (id: string, to: string | null, placeId: string, key: string): LogEvent => ({
    id, seq: Number(id.replace(/\D/g, '')), type: 'find.give', level: 'simple', actorUserId: 'gm', targetTable: 'places', targetId: placeId, before: null, after: {}, fiat: false,
    reason: JSON.stringify({ find: { to, placeId, rows: [key] } }), revertsEventId: null, requestId: `r-${id}`, createdAt: '2026-11-28T10:00:00Z',
  });
  const undo = (id: string, of: string): LogEvent => ({ ...send(id, null, 'shed', 'x'), type: 'find.undo', reason: null, revertsEventId: of });
  const holds = personHolds(sedge([{ itemId: 'wardens-lantern' }, { itemId: 'iron-key' }]), ENTRIES, ORDER)!;

  // Purpose: a send at any place marks the thing sent; the latest send wins; a send taken back marks nothing.
  it('marks a thing sent wherever it was sent, the latest send winning, a taken-back send marking nothing', () => {
    const events = [
      send('e1', 'actor-wren', 'shed', 'held:mother-sedge:wardens-lantern'),
      send('e2', null, 'watch-house', 'held:mother-sedge:iron-key'),
      undo('e3', 'e2'),
      send('e4', 'actor-ash', 'watch-house', 'held:mother-sedge:wardens-lantern'),
    ];
    const states = heldStates(holds, sentHeld(events));
    expect(states.map((s) => [s.itemId, s.sent?.to ?? 'held', s.sent?.placeId ?? null])).toEqual([
      ['wardens-lantern', 'actor-ash', 'watch-house'],
      ['iron-key', 'held', null],
    ]);
  });

  // Purpose: another person's send of the same item doesn't mark hers (the key names the person).
  it('leaves her thing held when someone else gave the same item', () => {
    const states = heldStates(holds, sentHeld([send('e1', 'actor-wren', 'shed', 'held:old-harl:iron-key')]));
    expect(states.every((s) => s.sent === null)).toBe(true);
  });
});

describe('4. the words (page 50)', () => {
  const holds = personHolds(sedge([{ itemId: 'wardens-lantern' }, { itemId: 'iron-key' }]), ENTRIES, ORDER)!;
  const sentTo = (to: string | null) => ({ to, placeId: 'shed', eventId: 'e1', seq: 1 });

  // Purpose: the Carries line lists what she holds; a thing sent follows as its own sentence; all sent, "nothing now".
  it('says the Carries line in its three states', () => {
    expect(carriesWords(heldStates(holds, new Map()), nameOf)).toEqual({ lead: 'Carries:', rest: 'warden’s lantern, iron key.' });
    expect(carriesWords(heldStates(holds, new Map([['held:mother-sedge:wardens-lantern', sentTo('actor-wren')]])), nameOf)).toEqual({
      lead: 'Carries:',
      rest: 'iron key. Warden’s lantern sent to Wren.',
    });
    const all = new Map([
      ['held:mother-sedge:wardens-lantern', sentTo('actor-wren')],
      ['held:mother-sedge:iron-key', sentTo(null)],
    ]);
    expect(carriesWords(heldStates(holds, all), nameOf)).toEqual({ lead: 'Carries', rest: 'nothing now.' });
  });

  // Purpose: a count reads "×999" on its row and in the line, sent whole.
  it('names a count with ×, in the row and in the line', () => {
    const many = personHolds(sedge([{ itemRef: 'river-rules:oil-flask', qty: 999 }]), ENTRIES, ORDER)!;
    expect(heldThingWords(many.things[0]!)).toBe('Oil flask ×999');
    expect(carriesWords(heldStates(many, new Map()), nameOf).rest).toBe('oil flask ×999.');
  });

  // Purpose: a sent row says where it went; a send at another place says where and to whom under "Sent before".
  it('says where a thing went, here and at another place', () => {
    expect(sentHereWords('actor-wren', nameOf)).toBe('Sent to Wren.');
    expect(sentHereWords(null, nameOf)).toBe('Sent to the party stash.');
    expect(sentBeforeWords(holds.things[0]!, 'actor-wren', nameOf, '4. The Customs Shed')).toBe('Sent before: Warden’s lantern, to Wren, at 4. The Customs Shed.');
    expect(sentBeforeWords(holds.things[1]!, null, nameOf, null)).toBe('Sent before: Iron key, to the party stash.');
  });

  // Purpose: the toast after a send, and after Take it back, name the thing and who has it.
  it('says the send’s toast and Take it back’s toast', () => {
    expect(heldSentWords(holds.things[0]!, 'actor-wren', nameOf)).toBe('Warden’s lantern sent to Wren.');
    expect(heldSentWords(holds.things[1]!, null, nameOf)).toBe('Iron key sent to the party stash.');
    expect(heldTakenBackWords(holds.things[0]!, 'actor-wren', nameOf)).toBe('Taken back from Wren: warden’s lantern.');
  });

  // Purpose: a thing not in the packs is a quiet line with no id (finding 6); two or more are counted.
  it('says how many things are not in the packs, with no id', () => {
    expect(missingWords(1)).toBe('One thing she carries isn’t in your packs.');
    expect(missingWords(3)).toBe('3 things she carries aren’t in your packs.');
    expect(missingWords(0)).toBeNull();
  });
});
