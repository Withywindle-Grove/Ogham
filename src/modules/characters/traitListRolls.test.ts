// A trait list rolled more than once (07 `rolls` and `distinct`, pf-16, ruled 2026-11-13). Invented content only.
//   Purpose: `rolls` is read as a whole number of 1 or more (absent or odd: 1) and `distinct` as true only; a list
//   rolled twice takes two picks, a tap past two says so; with `distinct` a second take of a picked entry is refused,
//   without it the same entry may be taken twice; the field keeps the picks joined, reads them back, and a single pick
//   saved before still reads as one; the sheet's words name every pick; the gear of every pick is granted together.
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './fields.ts';
import { addTraitOther, pickedGearEntry, pickedTraitAbilities, tapTraitPick, traitCountLine, traitListsOf, traitLookup, traitPicksOf, traitPicksProblem, traitPicksOnce, traitSteps, traitValues, takesLabel, takesSpoken, takesTicks } from './traitLists.ts';

const field = (key: string, from: string): FieldDefinition => ({ id: key, campaignId: 'c1', key, label: key, type: 'list', choices: [], group: '', order: 0, showOnCard: false, hidden: false, fill: null, required: false, from });

const marks = (data: Record<string, unknown>) =>
  traitListsOf([
    {
      kind: 'traitList',
      packEntryId: 'mire-marks',
      name: 'Mire marks',
      data: {
        die: 'd4',
        entries: [
          { id: 'heron', name: 'Heron feather', min: 1, max: 2, items: [{ name: 'Grey quill' }], money: 3, abilities: [{ name: 'Wade quietly' }] },
          { id: 'eel', name: 'Eel scale', min: 3, max: 4, items: [{ name: 'Slick charm' }], money: 2, abilities: [{ name: 'Slip free' }] },
        ],
        ...data,
      },
    },
  ])[0]!;

describe('reading rolls and distinct', () => {
  // Purpose: a whole number of 1 or more is kept; absent, 0, a word or a fraction read as 1; distinct only when true.
  it('reads rolls (absent or odd: 1) and distinct', () => {
    expect(marks({ rolls: 2, distinct: true })).toMatchObject({ rolls: 2, distinct: true });
    expect(marks({})).toMatchObject({ rolls: 1, distinct: false });
    for (const odd of [0, -1, 'two', 1.5]) expect(marks({ rolls: odd }).rolls).toBe(1);
    expect(marks({ distinct: 'yes' }).distinct).toBe(false);
  });
});

describe('two picks on a list rolled twice', () => {
  // Purpose: N = 2 asks for two: the count line says "1 of 2 picked", Next says how many are left, a third tap is refused.
  it('asks for two, and a tap past two says so', () => {
    const list = marks({ rolls: 2 });
    const one = tapTraitPick(list, [], 'heron');
    expect(one).toEqual({ picks: [{ entryId: 'heron' }] });
    const picks = 'picks' in one ? one.picks : [];
    expect(traitCountLine(list, picks)).toBe('1 of 2 picked');
    expect(traitPicksProblem(list, picks, true)).toBe('Pick 1 more, or Decide later.');
    expect(traitPicksProblem(list, picks, false)).toBe('Pick 1 more to go on.');
    const two = [...picks, { entryId: 'eel' }];
    expect(traitPicksProblem(list, two, true)).toBeNull();
    expect(addTraitOther(list, two, 'Frog bone', '')).toEqual({ problem: '2 of 2 picked: take one off to pick another.' });
    expect(tapTraitPick(marks({ rolls: 3 }), [{ entryId: 'heron' }, { entryId: 'eel' }, { other: 'Frog bone', note: '' }], 'eel')).toEqual({ picks: [{ entryId: 'heron' }, { other: 'Frog bone', note: '' }] });
  });

  // Purpose: with distinct, a result already picked is refused in the "Already yours" words; a typed repeat too.
  it('distinct refuses a repeat', () => {
    const list = marks({ rolls: 2, distinct: true });
    expect(tapTraitPick(list, [{ entryId: 'heron' }], 'heron')).toEqual({ problem: 'Already yours: roll again.' });
    expect(addTraitOther(list, [{ entryId: 'heron' }], 'heron feather', '')).toEqual({ problem: 'heron feather is already yours.' });
    // Without a die, the words say to pick another.
    expect(tapTraitPick({ ...list, die: '' }, [{ entryId: 'heron' }], 'heron')).toEqual({ problem: 'Already yours: pick another.' });
  });

  // Purpose: a typed Other… on a list rolled more than once can never split into two picks: a semicolon in its name or
  // note is refused in plain words; on a list rolled once it is kept as typed (that field is never split).
  it('refuses a semicolon in a typed entry on a list rolled more than once', () => {
    const problem = { problem: "A name or note can't hold a semicolon on this list. Use a comma instead." };
    expect(addTraitOther(marks({ rolls: 2 }), [], 'Frog bone', 'from a well; dry')).toEqual(problem);
    expect(addTraitOther(marks({ rolls: 2 }), [], 'Frog; bone', '')).toEqual(problem);
    expect(addTraitOther(marks({}), [], 'Frog bone', 'from a well; dry')).toEqual({ picks: [{ other: 'Frog bone', note: 'from a well; dry' }] });
  });

  // Purpose: without distinct, the same entry may be taken twice; with both taken, a tap on it takes one off.
  it('without distinct a repeat is allowed', () => {
    const list = marks({ rolls: 2 });
    expect(tapTraitPick(list, [{ entryId: 'heron' }], 'heron')).toEqual({ picks: [{ entryId: 'heron' }, { entryId: 'heron' }] });
    expect(tapTraitPick(list, [{ entryId: 'heron' }, { entryId: 'heron' }], 'heron')).toEqual({ picks: [{ entryId: 'heron' }] });
  });

  // Purpose: an entry taken more than once shows one tick for each take, with no cap and never a number ("Picked ✓✓",
  // "Picked ✓✓✓", six ticks for six), and is heard as "picked twice", then "picked 3 times".
  it('names the takes mark, one tick a take, and its spoken words', () => {
    expect(takesLabel(1)).toBe('Picked ✓');
    expect(takesLabel(2)).toBe('Picked ✓✓');
    expect(takesLabel(3)).toBe('Picked ✓✓✓');
    expect(takesLabel(6)).toBe('Picked ✓✓✓✓✓✓');
    expect(takesLabel(6)).not.toMatch(/\d/);
    expect(takesSpoken(2)).toBe('picked twice');
    expect(takesSpoken(3)).toBe('picked 3 times');
  });

  // Purpose (#671 review): one take or fewer is heard as plain "picked", and the ticks the button and the foot line
  // share are one a take, at least one.
  it('says "picked" for one take or fewer, and counts the shared ticks', () => {
    expect(takesSpoken(1)).toBe('picked');
    expect(takesSpoken(0)).toBe('picked');
    expect(takesTicks(1)).toBe('✓');
    expect(takesTicks(0)).toBe('✓');
    expect(takesTicks(4)).toBe('✓✓✓✓');
  });

  // Purpose: the foot line's picks name each entry once, in the order first picked, with how many times it was taken;
  // a typed entry is its own, even with the same name typed twice.
  it('counts each entry once for the foot line', () => {
    const list = marks({ rolls: 4 });
    expect(traitPicksOnce(list, [{ entryId: 'heron' }, { entryId: 'eel' }, { entryId: 'heron' }, { other: 'Frog bone', note: '' }])).toEqual([
      { name: 'Heron feather', takes: 2 },
      { name: 'Eel scale', takes: 1 },
      { name: 'Frog bone', takes: 1 },
    ]);
    expect(traitPicksOnce(list, [{ other: 'Frog bone', note: '' }, { other: 'Frog bone', note: '' }])).toHaveLength(2);
    expect(traitPicksOnce(list, [])).toEqual([]);
  });

  // Purpose: a list rolled once keeps today's toggle: a tap picks or unpicks, another tap replaces.
  it('a list rolled once still toggles one pick', () => {
    const list = marks({});
    expect(tapTraitPick(list, [{ entryId: 'heron' }], 'eel')).toEqual({ picks: [{ entryId: 'eel' }] });
    expect(tapTraitPick(list, [{ entryId: 'heron' }], 'heron')).toEqual({ picks: [] });
    expect(traitCountLine(list, [])).toBeNull();
  });
});

describe('what the field keeps', () => {
  // Purpose: the field keeps both picks (ids joined), reads them back, the sheet names both, and a saved single pick
  // still reads as one, on a list rolled once and on one now rolled twice.
  it('keeps N picks, reads them back, and an old single pick still reads as one', () => {
    const list = marks({ rolls: 2 });
    const [step] = traitSteps([field('mark', 'mire-marks')], [list]);
    const value = traitValues(step!, [{ entryId: 'heron' }, { other: 'Frog bone', note: 'from a well' }]);
    expect(value).toBe('heron; Frog bone — from a well');
    expect(traitPicksOf(step!, value)).toEqual([{ entryId: 'heron' }, { other: 'Frog bone', note: 'from a well' }]);
    expect(traitLookup([list])(step!.field, 'heron; eel')).toBe('Heron feather, Eel scale');
    // Saved before: one entry's id, on the list rolled twice and on one rolled once.
    expect(traitPicksOf(step!, 'eel')).toEqual([{ entryId: 'eel' }]);
    const [once] = traitSteps([field('mark', 'mire-marks')], [marks({})]);
    expect(traitPicksOf(once!, 'eel')).toEqual([{ entryId: 'eel' }]);
    expect(traitPicksOf(once!, 'Owl; Frog — odd')).toEqual([{ other: 'Owl; Frog', note: 'odd' }]);
    expect(traitLookup([marks({})])(step!.field, 'eel')).toBe('Eel scale');
  });

  // Purpose: every pick's powers join the sheet, and the gear and coins of both picks are granted together.
  it("grants every pick's powers, gear and coins", () => {
    const list = marks({ rolls: 2 });
    const steps = traitSteps([field('mark', 'mire-marks')], [list]);
    expect(pickedTraitAbilities(steps, { mark: 'heron; eel' }).map((a) => a.name)).toEqual(['Wade quietly', 'Slip free']);
    const gear = pickedGearEntry(list, [{ entryId: 'heron' }, { entryId: 'eel' }]);
    expect(gear?.items.map((i) => i.name)).toEqual(['Grey quill', 'Slick charm']);
    expect(gear?.money).toBe(5);
    expect(pickedGearEntry(list, [{ other: 'Frog bone', note: '' }])).toBeNull();
  });
});
