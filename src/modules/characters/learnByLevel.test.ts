// Spells learned above level 1, at creation (December step 1b; plan docs/plans/dec-1-creation.md, 1b), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json with a learnByLevel, spell slots and one 2nd-level
// spell added here. Every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { NO_PICKS, bookOf, cleanPicks, firstSpellsHint, firstSpellsPlan, firstSpellsProblem, learnKey, learnedAllYours, learnedOptions, learnedTitle, learnedWanted, picksFromBook, tapProblem, tapped, type FirstSpellsPicks } from './firstSpells.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { classes: Entry[]; spells: Entry[]; spellLists: Entry[]; tables: Entry[] };
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e as Record<string, unknown> });

// One 2nd-level spell on the witch's list, so a level-3 witch has something new to learn, and one more 1st-level
// spell, so a witch whose first spells took every 1st-level one has one left to learn.
const heron: Entry = { id: 'heron-patience', name: "Heron's patience", lists: { 'witch-list': 2 }, blurb: 'Stand still as a heron for an hour.' };
const lily: Entry = { id: 'lily-lamp', name: 'Lily lamp', lists: { 'witch-list': 1 }, blurb: 'A pale glow on still water.' };
const lists = pack.spellLists.map((l) =>
  l.id === 'witch-list' ? { ...l, levels: [...(l.levels as { level: number; spells: string[] }[]), { level: 2, spells: ['heron-patience'] }] } : l,
);
const setting = { spells: [...pack.spells, heron, lily].map(entry), lists: lists.map(entry), tables: pack.tables.map(entry), choices: {} };

/** The fixture's class with these spellcasting fields added (and spell slots by level). */
function withCasting(id: string, casting: Record<string, unknown>, slots = true) {
  const k = pack.classes.find((c) => c.id === id)!;
  return entry({
    ...k,
    spellcasting: { ...(k.spellcasting as object), ...casting },
    ...(slots ? { progression: [{ level: 1, spellSlots: [1] }, { level: 2, spellSlots: [2] }, { level: 3, spellSlots: [2, 1] }] } : {}),
  });
}
const witch = () => withCasting('reed-witch', { learnByLevel: [{ level: 2, count: 1 }, { level: 3, count: 1 }, { level: 4, count: 2 }] });
const ids = (list: { id: string }[] | undefined) => (list ?? []).map((s) => s.id);
const level1Spells = ['reed-whisper', 'mire-grip', 'damp-wick', 'lily-lamp'];

describe('the Learned at level N groups (dec-1b)', () => {
  // Purpose: a book caster made at level 2 gets one more group after the first spells: one pick, from the spell levels it casts at level 2 (only the 1st).
  it('a level-2 book caster gets one group, "Pick 1 more, for level 2", from the 1st-level spells', () => {
    const plan = firstSpellsPlan(witch(), 2, setting)!;
    expect(plan.learned.map((g) => ({ level: g.level, count: g.count }))).toEqual([{ level: 2, count: 1 }]);
    expect(learnedTitle(plan.learned[0]!)).toBe('Pick 1 more, for level 2');
    // The given spell (Glimmer) is always in the book: it isn't offered again.
    expect(ids(plan.learned[0]!.options)).toEqual(level1Spells);
    expect(plan.learned[0]!.options.every((o) => o.level === 1)).toBe(true);
    // The first spells' groups are as at level 1.
    expect(plan.choose?.count).toBe(2);
    expect(ids(plan.given)).toEqual(['glimmer']);
  });

  // Purpose: a book caster made at level 3 gets a group for each of levels 2 and 3; level 3's offers the 2nd-level spell its new slot casts.
  it('a level-3 book caster gets two groups; the level-3 one offers 1st- and 2nd-level spells', () => {
    const plan = firstSpellsPlan(witch(), 3, setting)!;
    expect(plan.learned.map((g) => learnedTitle(g))).toEqual(['Pick 1 more, for level 2', 'Pick 1 more, for level 3']);
    expect(ids(plan.learned[0]!.options)).toEqual(level1Spells);
    expect(ids(plan.learned[1]!.options)).toEqual([...level1Spells, 'heron-patience']);
    expect(plan.learned[1]!.options.find((o) => o.id === 'heron-patience')!.line.startsWith('Level 2')).toBe(true);
  });

  // Purpose: at level 1 nothing changes: the plan is the one a class without learnByLevel gets.
  it('a level-1 caster is unchanged: no learned group, the same plan as without learnByLevel', () => {
    const plain = withCasting('reed-witch', {});
    const plan = firstSpellsPlan(witch(), 1, setting)!;
    expect(plan.learned).toEqual([]);
    expect(plan).toEqual(firstSpellsPlan(plain, 1, setting));
    // The picks read back from a book carry nothing new.
    expect(picksFromBook(plan, ['glimmer', 'reed-whisper'])).toEqual({ chosen: ['reed-whisper'], rolled: {}, cantrips: [] });
  });

  // Purpose: a class without learnByLevel made above level 1 still gets only its first spells.
  it('a class without learnByLevel at level 3 gets no learned group', () => {
    const plan = firstSpellsPlan(withCasting('reed-witch', {}), 3, setting)!;
    expect(plan.learned).toEqual([]);
    expect(plan.choose?.count).toBe(2);
  });

  // Purpose: a prayer caster with nothing to choose still has no step, at any level.
  it('a divine caster with nothing to choose has no step', () => {
    expect(firstSpellsPlan(entry(pack.classes.find((c) => c.id === 'marsh-chaplain')!), 2, setting)).toBeNull();
    expect(firstSpellsPlan(entry(pack.classes.find((c) => c.id === 'marsh-chaplain')!), 3, setting)).toBeNull();
  });

  // Purpose: a class whose casting starts at level 2 with no first spells (given: []) gets the step at level 2 for its learned spell alone, and none at level 1.
  it('a caster from level 2 with no first spells gets the step for its learned spell only', () => {
    const late = withCasting('reed-witch', { fromLevel: 2, firstSpells: { given: [] }, known: undefined, learnByLevel: [{ level: 2, count: 1 }] });
    expect(firstSpellsPlan(late, 1, setting)).toBeNull();
    const plan = firstSpellsPlan(late, 2, setting)!;
    expect(plan.choose).toBeNull();
    expect(plan.learned.map((g) => g.level)).toEqual([2]);
    expect(ids(plan.learned[0]!.options)).toEqual(['glimmer', ...level1Spells]);
    expect(plan.magic).toBe(false);
  });

  // Purpose: without spell slots in the progression, a learned group offers the first spells' level; maxSpellLevel caps the slots.
  it('without spell slots the group offers the first level; maxSpellLevel caps what slots offer', () => {
    const noSlots = withCasting('reed-witch', { learnByLevel: [{ level: 3, count: 1 }] }, false);
    expect(ids(firstSpellsPlan(noSlots, 3, setting)!.learned[0]!.options)).toEqual(level1Spells);
    const capped = withCasting('reed-witch', { maxSpellLevel: 1, learnByLevel: [{ level: 3, count: 1 }] });
    expect(ids(firstSpellsPlan(capped, 3, setting)!.learned[0]!.options)).toEqual(level1Spells);
  });

  // Purpose: an older pack's knownByLevel is read as learnByLevel (07).
  it('reads an older knownByLevel as learnByLevel', () => {
    const old = withCasting('reed-witch', { knownByLevel: [{ level: 2, count: 1 }] });
    expect(firstSpellsPlan(old, 2, setting)!.learned.map((g) => g.count)).toEqual([1]);
  });
});

describe('picking learned spells (dec-1b)', () => {
  const plan = firstSpellsPlan(witch(), 3, setting)!;
  const done: FirstSpellsPicks = { chosen: ['reed-whisper', 'mire-grip'], rolled: { 'first-whispers': 'first-whispers:2' }, cantrips: ['frog-chorus', 'knot-charm'] };

  // Purpose: Next waits for the learned picks, counted as spells, like Pick N.
  it('counts the learned picks still to make, and the book takes them after the first spells', () => {
    expect(firstSpellsProblem(plan, done)).toBe('2 spells to go');
    let picks = tapped(done, learnKey(2), 'lily-lamp');
    expect(firstSpellsProblem(plan, picks)).toBe('1 spell to go');
    picks = tapped(picks, learnKey(3), 'heron-patience');
    expect(firstSpellsProblem(plan, picks)).toBeNull();
    expect(firstSpellsHint(plan, picks)).toBe('8 spells in your book');
    expect(bookOf(plan, picks)).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'lily-lamp', 'heron-patience', 'damp-wick', 'frog-chorus', 'knot-charm']);
  });

  // Purpose: a full group, and a spell already picked elsewhere on the step, are explained, as on Pick N.
  it('a full group and a spell already yours are explained', () => {
    const picks = tapped(done, learnKey(2), 'lily-lamp');
    expect(tapProblem(plan, picks, learnKey(2), 'heron-patience')).toBe('1 of 1 picked: take one off to pick another.');
    // Picked in Pick 2, rolled, or learned at level 2: already in the book.
    expect(tapProblem(plan, picks, learnKey(3), 'mire-grip')).toBe('Already yours: pick another.');
    expect(tapProblem(plan, picks, learnKey(3), 'damp-wick')).toBe('Already yours: pick another.');
    expect(tapProblem(plan, picks, learnKey(3), 'lily-lamp')).toBe('Already yours: pick another.');
    // And from the first spells' side: a spell learned at level 2 can't be picked again in Pick 2.
    expect(tapProblem(plan, { ...picks, chosen: ['reed-whisper'] }, 'choose', 'lily-lamp')).toBe('Already yours: pick another.');
    // Unpicking is a tap on a picked row.
    expect(tapProblem(plan, picks, learnKey(2), 'lily-lamp')).toBeNull();
    expect(tapped(picks, learnKey(2), 'lily-lamp').learned?.[2]).toEqual([]);
  });

  // Purpose: the review and a reopened draft read the learned picks back from the saved book, each in its level's group.
  it('reads the learned picks back from the book', () => {
    const picks = tapped(tapped(NO_PICKS, learnKey(2), 'lily-lamp'), learnKey(3), 'heron-patience');
    const full = { ...done, learned: picks.learned };
    const back = picksFromBook(plan, bookOf(plan, full));
    expect(back.learned).toEqual({ 2: ['lily-lamp'], 3: ['heron-patience'] });
    expect(back.rolled).toEqual({ 'first-whispers': 'first-whispers:2' });
    expect(back.chosen).toEqual(['reed-whisper', 'mire-grip']);
    expect(firstSpellsProblem(plan, back)).toBeNull();
    // A stale pick (not offered at that level) drops out.
    expect(cleanPicks(plan, { ...full, learned: { 2: ['heron-patience'] } }).learned).toEqual({ 2: [], 3: [] });
  });

  // Purpose (#633 review): when the first spells already took every spell a learned level offers, the group asks for
  // nothing more and says so; with fewer free than its count, it asks only for those, so Next and To finish can clear.
  it('a learned level whose spells are all yours already asks for nothing, and one with fewer free asks only for those', () => {
    const two = (keep: string[]) => ({ ...setting, lists: lists.map((l) => (l.id === 'witch-list' ? { ...l, levels: (l.levels as { level: number; spells: string[] }[]).map((lv) => (lv.level === 1 ? { ...lv, spells: keep } : lv)) } : l)).map(entry), spells: setting.spells.filter((e) => keep.includes(e.packEntryId) || (e.data.lists as Record<string, number> | undefined)?.['witch-list'] !== 1) });
    const tight = firstSpellsPlan(withCasting('reed-witch', { learnByLevel: [{ level: 2, count: 1 }] }), 2, two(['reed-whisper', 'mire-grip']))!;
    const picks: FirstSpellsPicks = { ...NO_PICKS, chosen: ['reed-whisper', 'mire-grip'] };
    const group = tight.learned[0]!;
    expect(learnedWanted(tight, picks, group)).toBe(0);
    expect(learnedAllYours(tight, picks, group)).toBe(true);
    // Purpose (#633 picture review): with every spell already yours, nothing is listed to pick and the title asks for none.
    expect(learnedOptions(tight, picks, group)).toEqual([]);
    expect(learnedTitle(group, true)).toBe('Learned at level 2');
    // The rest of the step (its roll, its cantrips) asks what it asked without the learned level: nothing more.
    const plain = (keep: string[]) => firstSpellsPlan(withCasting('reed-witch', {}), 2, two(keep))!;
    expect(firstSpellsProblem(tight, picks)).toBe(firstSpellsProblem(plain(['reed-whisper', 'mire-grip']), picks));
    // Two to learn, one free: one is asked for, and picking it leaves only what the rest of the step asks.
    const short = firstSpellsPlan(withCasting('reed-witch', { learnByLevel: [{ level: 2, count: 2 }] }), 2, two(['reed-whisper', 'mire-grip', 'damp-wick']))!;
    expect(learnedWanted(short, picks, short.learned[0]!)).toBe(1);
    // Purpose (#633 picture review): a spell the book already holds isn't offered again; the group's own pick stays listed to unpick.
    expect(learnedOptions(short, picks, short.learned[0]!).map((o) => o.id)).toEqual(['damp-wick']);
    expect(learnedOptions(short, { ...picks, learned: { 2: ['damp-wick'] } }, short.learned[0]!).map((o) => o.id)).toEqual(['damp-wick']);
    expect(firstSpellsProblem(short, picks)).not.toBe(firstSpellsProblem(plain(['reed-whisper', 'mire-grip', 'damp-wick']), picks));
    expect(firstSpellsProblem(short, { ...picks, learned: { 2: ['damp-wick'] } })).toBe(firstSpellsProblem(plain(['reed-whisper', 'mire-grip', 'damp-wick']), picks));
  });
});
