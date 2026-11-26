// A player's Where to? as rows and words (plan dec-9-the-players-scene, row P2; mc-36, mc-36a, d5-1, d5-2; page 18,
// PL1, PL4c, PL9). Invented places and ways only. What it checks, in plain words:
//   * one row a destination: two links to one shown place are one row with both links' buttons;
//   * the named rows in the order of their names, a number in its own order, then each far end not yet explored as a
//     row of its own (nothing tells two of them apart), called by its way's own name;
//   * only the asked group's ways; a link that gives no time has no row (nothing to choose on it);
//   * each button carries the way's word, its time and its `by`, read for its picture (p2p-30);
//   * the tap's pop-up words (PL4c), the stale row's words (PL9) and the mode's count now ("turn 14").
import { describe, expect, it } from 'vitest';
import type { WayOn } from '../library/waysOn.ts';
import type { Mode } from './modes.ts';
import { playersDestinationsOf, stepNowOf, unexploredTitle, WHERE_TO_WORDS, wayTapWords } from './playersWays.ts';

const way = (by: string, name: string, value: number, unit = 'turn') => ({ by, name, value, unit });
const link = (routeId: string, to: { placeId: string; name: string } | null, ways: WayOn['ways'], groupNumber = 1): WayOn => ({ groupNumber, routeId, to, number: null, elsewhere: false, ways });
const WRECK = { placeId: 'place-wreck', name: 'The Wreck' };
const STAIR = { placeId: 'place-stair', name: '10 The Stair' };
const SHED = { placeId: 'place-shed', name: '2 The Shed' };

describe("a player's Where to? rows", () => {
  it('two links to one shown place are one row, with every way of both as its buttons', () => {
    const rows = playersDestinationsOf([link('r1', WRECK, [way('row', 'Rowing', 1)]), link('r2', WRECK, [way('swim', 'Swimming', 3)])], 1);
    expect(rows).toEqual([
      {
        id: 'place-wreck',
        name: 'The Wreck',
        explored: true,
        ways: [
          { key: 'r1|row', word: 'Rowing', time: '1 turn', by: 'row' },
          { key: 'r2|swim', word: 'Swimming', time: '3 turns', by: 'swim' },
        ],
      },
    ]);
  });

  it('puts the named rows in the order of their names, "2" before "10", and the unexplored ones after, each its own row', () => {
    const rows = playersDestinationsOf(
      [link('r1', null, [way('walk', 'Walking', 2)]), link('r2', STAIR, [way('climb', 'Climbing', 999)]), link('r3', null, [way('walk', 'Walking', 4)]), link('r4', SHED, [way('walk', 'Walking', 1)])],
      1,
    );
    expect(rows.map((r) => [r.name, r.explored])).toEqual([
      ['2 The Shed', true],
      ['10 The Stair', true],
      ['Walking', false],
      ['Walking', false],
    ]);
    expect(rows[2]!.id).toBe('r1');
    expect(rows[1]!.ways[0]!.time).toBe('999 turns');
  });

  it("lists only the asked group's ways, and leaves out a link that gives no time", () => {
    const rows = playersDestinationsOf([link('r1', WRECK, [way('row', 'Rowing', 1)], 2), link('r2', SHED, [])], 1);
    expect(rows).toEqual([]);
  });

  it('says Move on the button of a link that gives one amount and names no way, with no picture to read', () => {
    const [row] = playersDestinationsOf([link('r1', WRECK, [way('', '', 2)])], 1);
    expect(row!.ways).toEqual([{ key: 'r1|', word: 'Move', time: '2 turns', by: '' }]);
  });

  it("calls a row not yet explored by its way's own name, several joined, or Another way", () => {
    expect(unexploredTitle([way('row', 'Rowing', 1), way('swim', 'Swimming', 3)])).toBe('Rowing or swimming');
    expect(unexploredTitle([way('', '', 2)])).toBe('Another way');
  });
});

describe("a player's Where to? words", () => {
  it("titles a tap's pop-up with where and how, and says the GM moves the party (PL4c)", () => {
    expect(wayTapWords({ name: 'The Wreck', explored: true }, { word: 'Rowing', time: '1 turn' })).toEqual({ title: 'To the Wreck, rowing', time: '1 turn.', words: 'Your GM moves the party. Say where you want to go.' });
    expect(wayTapWords({ name: 'Walking', explored: false }, { word: 'Walking', time: '2 turns' }).title).toBe('Walking');
  });

  it('says when a kept list was read, where the count is known (PL9)', () => {
    expect(WHERE_TO_WORDS.stale('turn 13')).toBe('The ways didn’t refresh. These are as they were at turn 13.');
    expect(WHERE_TO_WORDS.stale(null)).toBe('The ways didn’t refresh. These are as they were when last read.');
  });

  it("gives the mode's count now as the heading says it, and none for a mode counted in parts of the day", () => {
    const units = { round: 10, turn: 600, hour: 3600, day: 86400, week: 604800 };
    const dungeon = { id: 'dungeon', name: 'Dungeon', step: { value: 1, unit: 'turn' } } as Mode;
    expect(stepNowOf(dungeon, { startedAt: 0 }, 600 * 13, units)).toBe('turn 14');
    expect(stepNowOf({ ...dungeon, step: { value: 1, unit: 'partOfDay' } } as Mode, { startedAt: 0 }, 0, units)).toBeNull();
    expect(stepNowOf(null, { startedAt: 0 }, 0, units)).toBeNull();
  });
});
