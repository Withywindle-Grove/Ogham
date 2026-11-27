// A player's Where to? as rows and words (plan dec-9-the-players-scene, row P2; mc-36, mc-36a, d5-1, d5-2; page 18,
// PL1, PL4c, PL9). Invented places and ways only. What it checks, in plain words:
//   * one row a destination: two links to one shown place are one row with both links' buttons;
//   * each far end not yet explored a row of its own (nothing tells two of them apart), "N. Unexplored" or
//     "Unexplored", its way under it ("Rowing or swimming."; sf-9, N3);
//   * rows in number order: no number first, then 0, 1, 2 … 10, 11 (sf-9, F22);
//   * two Areas give two headings, "Elsewhere" last; one Area gives none (sf-9, WT1 B and C, ⚑ 8);
//   * only the asked group's ways; a link that gives no time has no row (nothing to choose on it);
//   * each button carries the way's word, its time and its `by`, read for its picture (p2p-30);
//   * the tap's pop-up words (PL4c), the stale row's words (PL9) and the mode's count now ("turn 14").
import { describe, expect, it } from 'vitest';
import type { WayOn } from '../library/waysOn.ts';
import type { Mode } from './modes.ts';
import { playersDestinationsOf, stepNowOf, unexploredWayLine, WHERE_TO_WORDS, wayTapWords } from './playersWays.ts';

const way = (by: string, name: string, value: number, unit = 'turn') => ({ by, name, value, unit });
const link = (routeId: string, to: { placeId: string; name: string } | null, ways: WayOn['ways'], groupNumber = 1, over: Partial<WayOn> = {}): WayOn => ({ groupNumber, routeId, to, number: null, elsewhere: false, areaName: null, ways, ...over });
const at = (number: string | null, areaName: string | null = null, elsewhere = false): Partial<WayOn> => ({ number, areaName, elsewhere });
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
        number: null,
        explored: true,
        wayLine: null,
        area: null,
        ways: [
          { key: 'r1|row', word: 'Rowing', time: '1 turn', by: 'row' },
          { key: 'r2|swim', word: 'Swimming', time: '3 turns', by: 'swim' },
        ],
      },
    ]);
  });

  it('with no numbers sent, puts the named rows in the order of their names, "2" before "10", and the unexplored ones after, each its own row', () => {
    const rows = playersDestinationsOf(
      [link('r1', null, [way('walk', 'Walking', 2)]), link('r2', STAIR, [way('climb', 'Climbing', 999)]), link('r3', null, [way('walk', 'Walking', 4)]), link('r4', SHED, [way('walk', 'Walking', 1)])],
      1,
    );
    expect(rows.map((r) => [r.name, r.explored])).toEqual([
      ['2 The Shed', true],
      ['10 The Stair', true],
      ['Unexplored', false],
      ['Unexplored', false],
    ]);
    expect(rows[2]!.id).toBe('r1');
    expect(rows[1]!.ways[0]!.time).toBe('999 turns');
  });

  // Purpose (sf-9, F22; WT1): every row in number order, a row with no number first, then 0, 1, 2 … 10, 11, explored or
  // not; a number is a number, not a word ("2" before "10").
  it('sorts the rows with no number first, then 0, 1, 2 … 10, 11', () => {
    const rows = playersDestinationsOf(
      [
        link('r11', null, [way('row', 'Rowing', 1)], 1, at('11')),
        link('r2', WRECK, [way('row', 'Rowing', 1)], 1, at('2')),
        link('r10', null, [way('row', 'Rowing', 1)], 1, at('10')),
        link('rnone', null, [way('walk', 'Walking', 2)], 1, at(null)),
        link('r0', null, [way('row', 'Rowing', 1)], 1, at('0')),
        link('r1', null, [way('swim', 'Swimming', 3)], 1, at('1')),
      ],
      1,
    );
    expect(rows.map((r) => r.number)).toEqual([null, '0', '1', '2', '10', '11']);
    expect(rows.map((r) => r.name)).toEqual(['Unexplored', 'Unexplored', 'Unexplored', 'The Wreck', 'Unexplored', 'Unexplored']);
  });

  // Purpose (sf-9, WT1 B; ⚑ 8, sf-19): where the ways lead into two Areas, each row carries its Area's heading, the
  // Areas in the order their first row comes and "Elsewhere" last; a row under "Elsewhere" has no number.
  it('gives two Areas two headings, Elsewhere last, and no number under Elsewhere', () => {
    const rows = playersDestinationsOf(
      [
        link('r-out', null, [way('row', 'Rowing', 1)], 1, at(null, null, true)),
        link('r10', null, [way('row', 'Rowing', 1)], 1, at('10', 'The Mere')),
        link('r3', WRECK, [way('row', 'Rowing', 1)], 1, at('3', 'The Mere')),
        link('r7', null, [way('walk', 'Walking', 2)], 1, at('7', 'The Reed Beds')),
      ],
      1,
    );
    expect(rows.map((r) => [r.area, r.number, r.name])).toEqual([
      ['The Mere', '3', 'The Wreck'],
      ['The Mere', '10', 'Unexplored'],
      ['The Reed Beds', '7', 'Unexplored'],
      ['Elsewhere', null, 'Unexplored'],
    ]);
  });

  // Purpose (sf-9, WT1 B): one known Area and the ways that lead elsewhere are two headings, as drawn.
  it('heads the rows of the one known Area and those under Elsewhere', () => {
    const rows = playersDestinationsOf([link('r2', null, [way('row', 'Rowing', 1)], 1, at('2', 'The Mere')), link('r-out', null, [way('row', 'Rowing', 1)], 1, at(null, null, true))], 1);
    expect(rows.map((r) => r.area)).toEqual(['The Mere', 'Elsewhere']);
  });

  // Purpose (sf-9, WT1 C): one Area only, the usual case: no heading at all; nor when every way leads elsewhere.
  it('gives one Area no heading', () => {
    const one = playersDestinationsOf([link('r1', WRECK, [way('row', 'Rowing', 1)], 1, at('1', 'The Mere')), link('r2', null, [way('row', 'Rowing', 1)], 1, at('2', 'The Mere'))], 1);
    expect(one.map((r) => r.area)).toEqual([null, null]);
    const allOut = playersDestinationsOf([link('r1', null, [way('row', 'Rowing', 1)], 1, at(null, null, true)), link('r2', null, [way('walk', 'Walking', 2)], 1, at(null, null, true))], 1);
    expect(allOut.map((r) => r.area)).toEqual([null, null]);
  });

  // Purpose (#122's ⚑ 3, as built): rows whose Area was given no players' name stand first, under no heading, so no
  // name the read did not send is drawn; an Area called "Elsewhere" is still its own heading.
  it('puts rows of an Area with no players’ name first, under no heading', () => {
    const rows = playersDestinationsOf(
      [link('r5', null, [way('row', 'Rowing', 1)], 1, at('5', 'Elsewhere')), link('r2', null, [way('row', 'Rowing', 1)], 1, at('2', null)), link('r-out', null, [way('row', 'Rowing', 1)], 1, at(null, null, true))],
      1,
    );
    expect(rows.map((r) => [r.number, r.area])).toEqual([
      ['2', null],
      ['5', 'Elsewhere'],
      [null, 'Elsewhere'],
    ]);
    expect(rows[1]!.id).toBe('r5');
  });

  it("lists only the asked group's ways, and leaves out a link that gives no time", () => {
    const rows = playersDestinationsOf([link('r1', WRECK, [way('row', 'Rowing', 1)], 2), link('r2', SHED, [])], 1);
    expect(rows).toEqual([]);
  });

  it('says Move on the button of a link that gives one amount and names no way, with no picture to read', () => {
    const [row] = playersDestinationsOf([link('r1', WRECK, [way('', '', 2)])], 1);
    expect(row!.ways).toEqual([{ key: 'r1|', word: 'Move', time: '2 turns', by: '' }]);
  });

  // Purpose (sf-9, N3; WT1 B and C): a row not explored reads "Unexplored" after its number, if any, with its way under
  // it as a sentence ("Rowing or swimming."), so it says no less than the old row named by its way.
  it('titles a row not explored "Unexplored" and puts its way under it as words', () => {
    const [row] = playersDestinationsOf([link('r4', null, [way('row', 'Rowing', 1), way('swim', 'Swimming', 3)], 1, at('4', 'The Mere'))], 1);
    expect([row!.number, row!.name, row!.wayLine, row!.explored]).toEqual(['4', 'Unexplored', 'Rowing or swimming.', false]);
    expect(unexploredWayLine([way('walk', 'Walking', 2)])).toBe('Walking.');
    expect(unexploredWayLine([way('', '', 2)])).toBe('Another way.');
    expect(WHERE_TO_WORDS.unexplored).toBe('Unexplored');
    expect(WHERE_TO_WORDS.elsewhere).toBe('Elsewhere');
  });
});

describe("a player's Where to? words", () => {
  it("titles a tap's pop-up with where and how, and says the GM moves the party (PL4c)", () => {
    expect(wayTapWords({ name: 'The Wreck', explored: true }, { word: 'Rowing', time: '1 turn' })).toEqual({ title: 'To the Wreck, rowing', time: '1 turn.', words: 'Your GM moves the party. Say where you want to go.' });
    expect(wayTapWords({ name: 'Unexplored', explored: false }, { word: 'Walking', time: '2 turns' }).title).toBe('Walking');
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
