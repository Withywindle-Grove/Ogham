// The players' place card's data and words (plan dec-9-the-players-scene, P4; p4s-1, p4s-2, p4s-4, rp-7, p2p-24).
// Pure parts only; the database's own rule is tested in supabase/tests/p4-players-place-card.test.ts. Invented words.
import { describe, expect, it } from 'vitest';
import type { TimeUnits } from './clock.ts';
import { bookFormat, numbered, readPlaceCards, readSharedKnowledge, rulesByPlace, rulesRowLine, sharedCount, sharedLine, sharedStep, sharedWithLine, shareOf, type KnowledgeShare } from './placeKnowledge.ts';

const units = { turn: 600, round: 10, hour: 3600, day: 86400 } as unknown as TimeUnits;
const turns = { startedAt: 3600, step: { value: 1, unit: 'turn' }, units };

describe('the "Shared, turn N." words', () => {
  // Purpose: a section shared during the expedition says the turn it was shared in, counted as the strip counts it; one
  // shared before the expedition began, or with no step known, says "Shared." alone.
  it('names the turn within the expedition, and nothing more outside it', () => {
    const step = sharedStep(3600 + 600 * 8, turns);
    expect(step).toMatch(/^turn \d+$/);
    expect(sharedLine(3600 + 600 * 8, turns)).toBe(`Shared, ${step}.`);
    expect(sharedLine(100, turns)).toBe('Shared.');
    expect(sharedLine(5000, null)).toBe('Shared.');
  });

  // Purpose: the GM's line (frame 7b) says with whom: "the players", or the group's name when the party is split; and
  // the sheet's foot counts the shared sections, "1 of 3 sections shared.", one section in the singular.
  it("gives the GM's line and the foot's count", () => {
    expect(sharedWithLine(100, null)).toBe('Shared with the players.');
    expect(sharedWithLine(100, null, 'Group 2')).toBe('Shared with Group 2.');
    expect(sharedWithLine(3600 + 600 * 8, turns)).toBe(`Shared with the players, ${sharedStep(3600 + 600 * 8, turns)}.`);
    expect(sharedCount(1, 3)).toBe('1 of 3 sections shared.');
    expect(sharedCount(0, 1)).toBe('0 of 1 section shared.');
  });

  // Purpose: a share counts only while shared, for its own group, place and section: a share taken back, another
  // group's, or another section's is not this one's.
  it('finds a share only while it is shared, for its own group, place and section', () => {
    const shares: KnowledgeShare[] = [
      { group: 1, packId: 'p', entryId: 'the-jetty', sectionAt: 0, shared: true, sharedClock: 10 },
      { group: 1, packId: 'p', entryId: 'the-jetty', sectionAt: 1, shared: false, sharedClock: 10 },
      { group: 2, packId: 'p', entryId: 'the-jetty', sectionAt: 2, shared: true, sharedClock: 10 },
    ];
    const at = (group: number, sectionAt: number) => ({ group, packId: 'p', entryId: 'the-jetty', sectionAt });
    expect(shareOf(shares, at(1, 0))?.sharedClock).toBe(10);
    expect(shareOf(shares, at(1, 1))).toBeNull();
    expect(shareOf(shares, at(1, 2))).toBeNull();
    expect(shareOf(shares, at(2, 2))).not.toBeNull();
  });
});

describe("a player's card, read", () => {
  // Purpose: the read's rows become one card a group: the place's number and name, the trail top first, the Area's
  // heading only where the read sends it, the other known places in the read's order; a group with no 'here' row has
  // no card, so a stray row can't make one.
  it('builds one card a group from the rows', () => {
    const cards = readPlaceCards([
      { group_number: 1, kind: 'known', at: 2, place_id: 'q3', key: '3', name: 'The Breakwater' },
      { group_number: 1, kind: 'here', at: 0, place_id: 'q1', key: '1', name: 'The Jetty' },
      { group_number: 1, kind: 'trail', at: 2, name: 'The Drowned Harbour' },
      { group_number: 1, kind: 'trail', at: 1, name: 'Saltwick Island' },
      { group_number: 1, kind: 'area', at: 0, name: 'The Drowned Harbour' },
      { group_number: 1, kind: 'known', at: 1, place_id: 'q2', key: '2', name: 'The Wreck' },
      { group_number: 2, kind: 'trail', at: 1, name: 'Saltwick Island' },
    ]);
    expect([...cards.keys()]).toEqual([1]);
    const card = cards.get(1)!;
    expect(numbered(card.here)).toBe('1. The Jetty');
    expect(card.trail).toEqual(['Saltwick Island', 'The Drowned Harbour']);
    expect(card.area).toBe('The Drowned Harbour');
    expect(card.known.map(numbered)).toEqual(['2. The Wreck', '3. The Breakwater']);
  });

  // Purpose: with no Area shown the card has no heading (no stand-in), and a place with no number reads its name alone.
  it('keeps no heading for an Area never shown, and a name with no number as it is', () => {
    const card = readPlaceCards([{ group_number: 1, kind: 'here', at: 0, place_id: 'q1', key: '', name: 'Along the piles' }]).get(1)!;
    expect(card.area).toBeNull();
    expect(card.trail).toEqual([]);
    expect(numbered(card.here)).toBe('Along the piles');
  });

  // Purpose: a shared section is read by the Knowledge sheet's own reader: plain words as paragraphs' words, blocks as
  // blocks; its heading and clock kept.
  it('reads a shared section as the Knowledge sheet reads one', () => {
    const [plain, blocks] = readSharedKnowledge([
      { group_number: 1, share_id: 's1', place_name: 'The Jetty', heading: 'What everyone knows', body: 'The harbour silted in a winter.', shared_clock: 9 },
      { group_number: 1, share_id: 's2', place_name: 'The Jetty', heading: 'The cargo', body: { blocks: [{ list: ['Marsh salt'] }] }, shared_clock: 12 },
    ]);
    expect(plain).toMatchObject({ id: 's1', placeName: 'The Jetty', sharedClock: 9, section: { heading: 'What everyone knows', text: 'The harbour silted in a winter.', blocks: null } });
    expect(blocks!.section.blocks).toEqual([{ kind: 'list', items: ['Marsh salt'] }]);
  });
});

describe('the Rules row (rp-7)', () => {
  const rule = (placeName: string, name: string) => ({ placeName, name });
  // Purpose: no rule, no row; one rule, its name; several of one place, a bare count; a second shown place's rules,
  // "3 here, 1 of Saltwick Island", the place the party is at first whatever the read's order.
  it('says one name, a bare count, or the count of each place', () => {
    expect(rulesRowLine([], 'The Jetty')).toBeNull();
    expect(rulesRowLine([rule('The Jetty', 'The tide')], 'The Jetty')).toBe('The tide');
    expect(rulesRowLine([rule('The Jetty', 'A'), rule('The Jetty', 'B'), rule('The Jetty', 'C')], 'The Jetty')).toBe('3 rules');
    const two = [rule('Saltwick Island', 'Weather on the island'), rule('The Jetty', 'A'), rule('The Jetty', 'B'), rule('The Jetty', 'C')];
    expect(rulesRowLine(two, 'The Jetty')).toBe('3 here, 1 of Saltwick Island');
    expect(rulesByPlace(two, 'The Jetty').map(([place, list]) => [place, list.length])).toEqual([
      ['The Jetty', 3],
      ['Saltwick Island', 1],
    ]);
  });
});

describe("a known place's pieces in the book's format (p4s-4, p2p-24)", () => {
  // Purpose: the description comes first, then the others in the order first shown, each piece once however many visits
  // showed it.
  it('puts the description first and keeps each piece once', () => {
    const pieces = [
      { id: 'b', kind: 'clue', text: 'Fresh rope.', lead: 'Mooring ring' },
      { id: 'a', kind: 'description', text: 'Black piles.', lead: '' },
      { id: 'b', kind: 'clue', text: 'Fresh rope.', lead: 'Mooring ring' },
      { id: 'c', kind: 'hazard', text: 'Iron rungs.', lead: 'Ladder' },
    ];
    expect(bookFormat(pieces).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
