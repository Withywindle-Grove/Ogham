// What magic's three screens show, as data (magicView.ts; ahead of dec-8 pieces B, C and D). Invented spells and
// powers: Marsh light, Reed whisper, Thorn dart, Mend lantern; a Lantern Warden's Bird friend.
import { describe, expect, it } from 'vitest';
import { castKey } from './magicState.ts';
import { chooseOneFewer, chooseOneMore, countSpells, magicTabLevels, pinnedSpellBlocks, prepareView, refillUses, restRows, type RestCharacter } from './magicView.ts';
import type { PreparedSpell } from './playState.ts';

const p = (spell: string, level: number, times = 1): PreparedSpell[] => Array.from({ length: times }, () => ({ spell, level }));
const pack = new Set(['marsh-light', 'reed-whisper', 'thorn-dart', 'mend-lantern']);

describe('the Magic tab (piece B; mm-1)', () => {
  // Purpose: a spell prepared three times with one cast is one row with three dots as picture 04 draws them, the two
  // left filled first and the cast one hollow last, Cast still offered.
  it('one row, three dots, the cast one last, Cast still offered', () => {
    const [level] = magicTabLevels({ prepared: p('marsh-light', 1, 3), spellsCast: { [castKey(1, 'marsh-light')]: 1 } }, [3], pack);
    expect(level).toEqual({
      level: 1,
      slots: 3,
      rows: [{ spell: 'marsh-light', level: 1, inPack: true, times: 3, cast: 1, left: 2, dots: [false, false, true], offersCast: true, spent: false }],
    });
  });

  // Purpose: every casting cast: the row is spent (crossed out, "cast") and offers no Cast.
  it('all cast: spent, no Cast', () => {
    const row = magicTabLevels({ prepared: p('marsh-light', 1, 2), spellsCast: { [castKey(1, 'marsh-light')]: 2 } }, [2])[0]!.rows[0]!;
    expect([row.left, row.dots, row.offersCast, row.spent]).toEqual([0, [true, true], false, true]);
  });

  // Purpose: a spell prepared once has no dots (mm-1), cast or not.
  it('prepared once: no dots', () => {
    const fresh = magicTabLevels({ prepared: p('reed-whisper', 2), spellsCast: {} }, [2, 1])[0]!.rows[0]!;
    expect([fresh.dots, fresh.offersCast, fresh.spent]).toEqual([[], true, false]);
    const cast = magicTabLevels({ prepared: p('reed-whisper', 2), spellsCast: { [castKey(2, 'reed-whisper')]: 1 } }, [2, 1])[0]!.rows[0]!;
    expect([cast.dots, cast.offersCast, cast.spent]).toEqual([[], false, true]);
  });

  // Purpose: nothing ready is an empty list, not an error.
  it('nothing ready: an empty list', () => {
    expect(magicTabLevels({ prepared: [], spellsCast: {} }, [2, 1])).toEqual([]);
    expect(magicTabLevels({ prepared: [], spellsCast: { [castKey(1, 'marsh-light')]: 3 } }, [])).toEqual([]);
  });

  // Purpose: two levels come lowest first, each with its slots a day; within a level the rows keep the state's order.
  it('two levels in order, rows in the order prepared', () => {
    const levels = magicTabLevels({ prepared: [...p('reed-whisper', 2), ...p('thorn-dart', 1), ...p('marsh-light', 1, 2)], spellsCast: {} }, [2, 1]);
    expect(levels.map((l) => [l.level, l.slots, l.rows.map((r) => r.spell)])).toEqual([
      [1, 2, ['thorn-dart', 'marsh-light']],
      [2, 1, ['reed-whisper']],
    ]);
  });

  // Purpose: messy data: a spell the pack no longer has stays listed by its id; a ready spell at a level with no slots
  // reads 0 slots; a count of 99 castings is drawn as 99 dots; a stale cast count above the times reads all spent.
  it('messy data never throws', () => {
    const levels = magicTabLevels(
      { prepared: [...p('drowned-bell', 1), ...p('marsh-light', 4, 99)], spellsCast: { [castKey(1, 'drowned-bell')]: 7, [castKey(4, 'marsh-light')]: 0 } },
      [1],
      pack,
    );
    expect(levels[0]!.rows[0]).toMatchObject({ spell: 'drowned-bell', inPack: false, times: 1, cast: 1, spent: true });
    expect(levels[1]).toMatchObject({ level: 4, slots: 0 });
    expect(levels[1]!.rows[0]!.dots.length).toBe(99);
    expect(levels[1]!.rows[0]).toMatchObject({ cast: 0, left: 99, offersCast: true });
  });
});

describe('Prepare (piece C; mp-1 to mp-4, mm-4)', () => {
  const book = new Map<number, string[]>([
    [1, ['marsh-light', 'thorn-dart', 'mend-lantern']],
    [2, ['reed-whisper']],
  ]);

  // Purpose: a full level and an empty one: slots, chosen, empty, full; + may not add on the full level (the pop-up),
  // − may take away only what is chosen; the foot's empty count and the full levels.
  it('a full level and an empty one', () => {
    const view = prepareView({ prepared: [], chosen: p('marsh-light', 1, 2) }, [2, 1], book, pack);
    expect(view.levels.map((l) => [l.level, l.slots, l.chosen, l.empty, l.full])).toEqual([
      [1, 2, 2, 0, true],
      [2, 1, 0, 1, false],
    ]);
    expect(view.levels[0]!.steps).toEqual([
      { spell: 'marsh-light', inPack: true, count: 2, mayAdd: false, mayRemove: true },
      { spell: 'thorn-dart', inPack: true, count: 0, mayAdd: false, mayRemove: false },
      { spell: 'mend-lantern', inPack: true, count: 0, mayAdd: false, mayRemove: false },
    ]);
    expect(view.levels[1]!.steps).toEqual([{ spell: 'reed-whisper', inPack: true, count: 0, mayAdd: true, mayRemove: false }]);
    expect([view.empty, view.fullLevels]).toEqual([1, [1]]);
  });

  // Purpose: the stepper's + adds one while there's room and refuses (null) on a full level; − never goes below nought.
  it('a count cannot go below nought, and + stops at a full level', () => {
    expect(chooseOneFewer([], 'marsh-light', 1)).toEqual([]);
    expect(chooseOneFewer(p('thorn-dart', 1), 'marsh-light', 1)).toEqual(p('thorn-dart', 1));
    expect(chooseOneFewer([...p('marsh-light', 1, 2), ...p('thorn-dart', 1)], 'marsh-light', 1)).toEqual([...p('marsh-light', 1), ...p('thorn-dart', 1)]);
    expect(chooseOneMore(p('marsh-light', 1), 'thorn-dart', 1, [2])).toEqual([...p('marsh-light', 1), ...p('thorn-dart', 1)]);
    expect(chooseOneMore(p('marsh-light', 1, 2), 'thorn-dart', 1, [2])).toBeNull();
    expect(chooseOneMore([], 'reed-whisper', 2, [2])).toBeNull();
  });

  // Purpose: + goes through preparedProblem, so a list already holding a spell beyond the slots refuses one more even
  // where its own level has room (the command would refuse that list too).
  it('+ refuses while the list holds a spell beyond the slots', () => {
    expect(chooseOneMore(p('reed-whisper', 3), 'marsh-light', 1, [2])).toBeNull();
    expect(chooseOneMore(p('marsh-light', 1), 'marsh-light', 1, [2])).toEqual(p('marsh-light', 1, 2));
  });

  // Purpose: Same as yesterday has nothing to offer when nothing was ready yesterday (a first morning).
  it('Same as yesterday with nothing ready', () => {
    const view = prepareView({ prepared: [], chosen: null }, [2, 1], book);
    expect(view.sameAsYesterday).toEqual({ offers: false, would: [], fits: true });
    expect(view.chosenForRest).toEqual([]);
  });

  // Purpose: Same as yesterday offers today's ready set (as stored) and says whether it fits the slots now.
  it('Same as yesterday offers today’s ready set, and says if it no longer fits', () => {
    const ready = [...p('marsh-light', 1, 2), ...p('reed-whisper', 2)];
    expect(prepareView({ prepared: ready, chosen: [] }, [2, 1], book).sameAsYesterday).toEqual({
      offers: true,
      would: [{ spell: 'marsh-light', level: 1, count: 2 }, { spell: 'reed-whisper', level: 2, count: 1 }],
      fits: true,
    });
    expect(prepareView({ prepared: ready, chosen: [] }, [2], book).sameAsYesterday.fits).toBe(false);
  });

  // Purpose: what is chosen for the next rest and what is ready today are returned apart, and whether they differ.
  it('chosen and ready differing, told apart', () => {
    const view = prepareView({ prepared: [...p('marsh-light', 1, 2), ...p('reed-whisper', 2)], chosen: [...p('thorn-dart', 1), ...p('marsh-light', 1)] }, [2, 1], book);
    expect(view.readyToday).toEqual([{ spell: 'marsh-light', level: 1, count: 2 }, { spell: 'reed-whisper', level: 2, count: 1 }]);
    expect(view.chosenForRest).toEqual([{ spell: 'thorn-dart', level: 1, count: 1 }, { spell: 'marsh-light', level: 1, count: 1 }]);
    expect([view.chosenIsNew, view.chosenDiffers]).toEqual([true, true]);
  });

  // Purpose: with nothing chosen anew, the steppers count today's ready set (the next rest brings it back, mm-5) and
  // the two read the same; the view says no choice has been made.
  it('nothing chosen anew: the steppers show today’s ready set', () => {
    const view = prepareView({ prepared: p('marsh-light', 1, 2), chosen: null }, [2, 1], book);
    expect(view.levels[0]!.steps[0]!.count).toBe(2);
    expect([view.chosenIsNew, view.chosenDiffers]).toEqual([false, false]);
  });

  // Purpose: messy data: a chosen spell gone from the book or the pack keeps its stepper by its id; a level with no
  // slots isn't a level here, its chosen spells listed apart; counts of 0 slots and 99 slots.
  it('messy data never throws', () => {
    const view = prepareView({ prepared: [], chosen: [...p('drowned-bell', 1), ...p('reed-whisper', 3)] }, [99, 0], book, pack);
    expect(view.levels.map((l) => l.level)).toEqual([1]);
    expect(view.levels[0]!.steps[0]).toEqual({ spell: 'drowned-bell', inPack: false, count: 1, mayAdd: true, mayRemove: true });
    expect(view.levels[0]!.empty).toBe(98);
    expect(view.beyond).toEqual([{ spell: 'reed-whisper', level: 3, count: 1 }]);
    expect(prepareView({ prepared: [], chosen: null }, [], new Map()).levels).toEqual([]);
  });

  // Purpose: a list counted keeps the order first listed ("Mire lamp ×2, Reed whisper").
  it('counts a list in the order first listed', () => {
    expect(countSpells([...p('marsh-light', 1), ...p('reed-whisper', 2), ...p('marsh-light', 1)])).toEqual([
      { spell: 'marsh-light', level: 1, count: 2 },
      { spell: 'reed-whisper', level: 2, count: 1 },
    ]);
  });
});

describe('the rest prompt (piece D; mp-5)', () => {
  const none = { prepared: [], chosen: null, spellsCast: {}, usesSpent: {} };
  const wren: RestCharacter = {
    id: 'wren',
    play: { prepared: [...p('marsh-light', 1, 2), ...p('reed-whisper', 2)], chosen: p('thorn-dart', 1), spellsCast: { [castKey(1, 'marsh-light')]: 2 }, usesSpent: {} },
    slots: [2, 1],
    powers: [],
  };
  const pike: RestCharacter = { id: 'pike', play: { ...none, usesSpent: { 'Bird friend': 1 } }, slots: [], powers: [{ name: 'Bird friend', uses: 1, refill: 'rest' }] };
  const moss: RestCharacter = { id: 'moss', play: none, slots: [], powers: [{ name: 'Steady hand', uses: 2, refill: 'day' }] };

  // Purpose: a caster and a non-caster with a once-a-rest power are listed, with what a tick does; a character with
  // neither (only a once-a-day power) is not.
  it('lists a caster and a once-a-rest power, not a character with neither', () => {
    expect(restRows([wren, pike, moss])).toEqual([
      { characterId: 'wren', caster: true, becomeReady: [{ spell: 'thorn-dart', level: 1, count: 1 }], castsCleared: { '1:marsh-light': 2 }, usesBack: [] },
      { characterId: 'pike', caster: false, becomeReady: [], castsCleared: {}, usesBack: [{ name: 'Bird friend', uses: 1, spent: 1 }] },
    ]);
  });

  // Purpose: a caster with nothing chosen anew gets today's ready set back (mm-5); one with slots but nothing ready is still a caster.
  it('a caster with nothing chosen gets today’s set back; slots alone make a caster', () => {
    const rows = restRows([{ ...wren, play: { ...wren.play, chosen: null } }, { id: 'alder', play: none, slots: [3], powers: [] }]);
    expect(rows[0]!.becomeReady).toEqual([{ spell: 'marsh-light', level: 1, count: 2 }, { spell: 'reed-whisper', level: 2, count: 1 }]);
    expect(rows[1]).toEqual({ characterId: 'alder', caster: true, becomeReady: [], castsCleared: {}, usesBack: [] });
  });

  // Purpose: a day's uses refill at the new day for a character who did not rest; a rest's uses don't without a rest.
  it('a day’s uses come back at the new day without a rest', () => {
    const powers = [{ name: 'Steady hand', uses: 2, refill: 'day' }, { name: 'Bird friend', uses: 1, refill: 'rest' }];
    expect(refillUses({ 'Steady hand': 2, 'Bird friend': 1 }, powers, { rested: false, newDay: true })).toEqual({ 'Bird friend': 1 });
    expect(refillUses({ 'Steady hand': 2, 'Bird friend': 1 }, powers, { rested: true, newDay: false })).toEqual({ 'Steady hand': 2 });
  });

  // Purpose: a weekly use (and a yearly one, once ever, a fight's, an unknown word) is left alone at a rest and a new day.
  it('a weekly use is left alone', () => {
    const powers = ['week', 'year', 'ever', 'fight', 'adventure', ''].map((refill, i) => ({ name: `Power ${i}`, uses: 1, refill }));
    const spent = Object.fromEntries(powers.map((power) => [power.name, 1]));
    expect(refillUses(spent, powers, { rested: true, newDay: true })).toEqual(spent);
  });

  // Purpose: messy data: a spent count for a power no longer held is kept; uses of 0 aren't a rest row; 99 uses read as given.
  it('messy data never throws', () => {
    expect(refillUses({ Gone: 3 }, [], { rested: true, newDay: true })).toEqual({ Gone: 3 });
    expect(restRows([{ id: 'reed', play: none, slots: [0], powers: [{ name: 'Nothing', uses: 0, refill: 'rest' }] }])).toEqual([]);
    expect(restRows([{ id: 'reed', play: { ...none, usesSpent: { Many: 120 } }, slots: [], powers: [{ name: 'Many', uses: 99, refill: ' Rest ' }] }])[0]!.usesBack).toEqual([
      { name: 'Many', uses: 99, spent: 99 },
    ]);
  });
});

describe("Prepare's list in order (dec-8 answers 1 and 3; mp-1)", () => {
  // A level of four spells, as a class list or a spell book gives them; slots [3] at level 1.
  const list = new Map<number, string[]>([[1, ['marsh-light', 'thorn-dart', 'mend-lantern', 'reed-whisper']]]);
  const at = (view: ReturnType<typeof prepareView>) => view.levels[0]!;
  const order = (view: ReturnType<typeof prepareView>) => at(view).steps.map((s) => [s.spell, s.count, s.folded ?? false]);

  // Purpose: a caster who chooses from the whole class list sees the chosen spells first, in the order chosen, then
  // the rest in the list's order, each marked as under the fold, and the level counts the folded ones.
  it('the whole list: chosen first in the order chosen, the rest folded and counted', () => {
    const view = prepareView({ prepared: [], chosen: [...p('mend-lantern', 1), ...p('marsh-light', 1, 2)] }, [3], list, pack, { wholeList: true });
    expect(order(view)).toEqual([
      ['mend-lantern', 1, false],
      ['marsh-light', 2, false],
      ['thorn-dart', 0, true],
      ['reed-whisper', 0, true],
    ]);
    expect(at(view).folded).toBe(2);
  });

  // Purpose: a caster with a spell book sees the same order, with nothing folded.
  it('a spell book: the same order, nothing folded', () => {
    const view = prepareView({ prepared: [], chosen: [...p('mend-lantern', 1), ...p('marsh-light', 1, 2)] }, [3], list, pack);
    expect(order(view)).toEqual([
      ['mend-lantern', 1, false],
      ['marsh-light', 2, false],
      ['thorn-dart', 0, false],
      ['reed-whisper', 0, false],
    ]);
    expect(at(view).folded).toBe(0);
    expect(at(prepareView({ prepared: [], chosen: p('mend-lantern', 1) }, [3], list, pack, { wholeList: false })).folded).toBe(0);
  });

  // Purpose: with nothing chosen, every spell is in the list's order; for the whole-list caster all are folded and the
  // level's count says so.
  it('nothing chosen: the list order; all folded for the whole-list caster', () => {
    const whole = prepareView({ prepared: [], chosen: [] }, [3], list, pack, { wholeList: true });
    expect(order(whole).map(([s]) => s)).toEqual(['marsh-light', 'thorn-dart', 'mend-lantern', 'reed-whisper']);
    expect(at(whole).steps.every((s) => s.folded === true)).toBe(true);
    expect(at(whole).folded).toBe(4);
    const book = prepareView({ prepared: [], chosen: [] }, [3], list, pack);
    expect(order(book).map(([s]) => s)).toEqual(['marsh-light', 'thorn-dart', 'mend-lantern', 'reed-whisper']);
    expect(at(book).folded).toBe(0);
  });

  // Purpose: choosing one more of a folded spell (the stepper's +) moves it among the chosen, last in the order chosen,
  // on the next read; the fold holds one fewer.
  it('one more of a folded spell moves it among the chosen on the next read', () => {
    const chosen = p('mend-lantern', 1);
    const before = prepareView({ prepared: [], chosen }, [3], list, pack, { wholeList: true });
    expect(at(before).steps.find((s) => s.spell === 'reed-whisper')!.folded).toBe(true);
    const more = chooseOneMore(chosen, 'reed-whisper', 1, [3])!;
    const after = prepareView({ prepared: [], chosen: more }, [3], list, pack, { wholeList: true });
    expect(order(after)).toEqual([
      ['mend-lantern', 1, false],
      ['reed-whisper', 1, false],
      ['marsh-light', 0, true],
      ['thorn-dart', 0, true],
    ]);
    expect([at(before).folded, at(after).folded]).toEqual([3, 2]);
  });

  // Purpose: messy data: a chosen spell no longer among the candidates stays in the chosen part, in its place in the
  // order chosen, by its id, and is never folded.
  it('a chosen spell gone from the list stays among the chosen, in its place, by its id', () => {
    const view = prepareView({ prepared: [], chosen: [...p('thorn-dart', 1), ...p('drowned-bell', 1), ...p('marsh-light', 1)] }, [3], list, pack, { wholeList: true });
    expect(order(view)).toEqual([
      ['thorn-dart', 1, false],
      ['drowned-bell', 1, false],
      ['marsh-light', 1, false],
      ['mend-lantern', 0, true],
      ['reed-whisper', 0, true],
    ]);
    expect(at(view).steps[1]).toEqual({ spell: 'drowned-bell', inPack: false, count: 1, mayAdd: false, mayRemove: true });
  });
});

describe('the pinned spells At hand (Player sitting piece 2; pss-5, psb-5, psb-6)', () => {
  const pin = (key: string) => ({ kind: 'spell' as const, key });
  const book = (...ids: string[]) => (id: string) => ids.includes(id);

  // Purpose: a pinned spell ready today is one block in the pins' order, with its castings left and the level Cast spends.
  it('ready spells: one block each, in the pins order, with what is left', () => {
    const play = { prepared: [...p('marsh-light', 1, 2), ...p('hush', 1)], spellsCast: { [castKey(1, 'marsh-light')]: 1 } };
    expect(pinnedSpellBlocks([pin('hush'), pin('marsh-light')], play, book())).toEqual([
      { spell: 'hush', ready: true, level: 1, times: 1, left: 1, castLevel: 1 },
      { spell: 'marsh-light', ready: true, level: 1, times: 2, left: 1, castLevel: 1 },
    ]);
  });

  // Purpose: with every casting spent the block stays, with none left and no level to spend ("Memorized, 0 of 2 left").
  it('none left: the block stays, nothing to spend', () => {
    const play = { prepared: p('marsh-light', 1, 2), spellsCast: { [castKey(1, 'marsh-light')]: 2 } };
    expect(pinnedSpellBlocks([pin('marsh-light')], play, book())).toEqual([{ spell: 'marsh-light', ready: true, level: 1, times: 2, left: 0, castLevel: null }]);
  });

  // Purpose: a pinned spell in the book but not ready today keeps its block, not ready (psb-5); one that has left the
  // book is ignored, and a trait pin is not a spell block.
  it('in the book, not ready: kept; gone from the book: ignored; traits: not here', () => {
    const play = { prepared: [], spellsCast: {} };
    const pins = [{ kind: 'trait' as const, key: 'Bird friend' }, pin('gone-spell'), pin('thorn-dart')];
    expect(pinnedSpellBlocks(pins, play, book('thorn-dart'))).toEqual([{ spell: 'thorn-dart', ready: false, level: null, times: 0, left: 0, castLevel: null }]);
  });

  // Purpose: a spell ready at two levels is one block counting both, and Cast spends the lowest level with a casting
  // left, as the Magic tab's first row for it would (psb-6).
  it('ready at two levels: one block; Cast spends the lowest level still left', () => {
    const play = { prepared: [...p('reed-whisper', 1), ...p('reed-whisper', 2, 2)], spellsCast: { [castKey(1, 'reed-whisper')]: 1 } };
    expect(pinnedSpellBlocks([pin('reed-whisper')], play, book())).toEqual([{ spell: 'reed-whisper', ready: true, level: 1, times: 3, left: 2, castLevel: 2 }]);
  });
});
