// lv-1 and pf-22 (the lead, 2026-11-14): a list's name for a level shows in each of the nine places the app writes a
// level's word, with the capital rule (a capital where it starts a title or a line, as stored inside a sentence), and
// the doubling rule (on a step that is the list's own, the group is "Pick N"). Invented lists, spells and words only;
// the names are stored lower-case, as a pack keeps them mid-sentence. In plain words:
//   1. First spells' known group title: "Glimmers: pick 2";
//   2. the step's foot: "2 glimmers to go";
//   3. the group's short line: "Only 1 glimmer at this level in your packs (your class gets 2): pick it.";
//   4. a spell's own level line: "Glimmer, …";
//   5. the spell's pop-up, Level: "Glimmer";
//   6. the sheet's Magic row: "Glimmer, …";
//   7. the Spell book count: "Spell book: 1 spell, 1 glimmer";
//   8. a trait's rolled spell: "roll d3 for one glimmer", "Glimmer not rolled yet", "for your glimmer";
//   9. the trait's pop-up: "One glimmer, rolled at the table when you pick it";
//   and a list whose only level is named with its own noun reads "Pick 1" under the step's "Glimmers", never doubled.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { firstSpellsPlan, firstSpellsProblem, knownGroupTitle, knownShortWhat, rollRows, shortLevelWords, spellHeadings, spellsStepTitle, type FirstSpellsPlan } from './firstSpells.ts';
import { magicOf, tabLabel } from './magic.ts';
import { traitHeadings, traitListsOf } from './traitLists.ts';
import { entryRollPlan, rolledSpellReview, spellRollHeading } from './traitSpellRoll.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { classes: Entry[]; spells: Entry[]; spellLists: Entry[]; tables: Entry[] };
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e as Record<string, unknown> });
const GLIMMER = { one: 'glimmer', many: 'glimmers' };
// The witch's list names its level 0 (pf-22).
const lists = pack.spellLists.map((l) => entry(l.id === 'witch-list' ? { ...l, levelNames: { '0': GLIMMER } } : l));
const setting = { spells: pack.spells.map(entry), lists, tables: pack.tables.map(entry), choices: {} };
const witch = entry(pack.classes.find((c) => c.id === 'reed-witch')!);
const plan = firstSpellsPlan(witch, 1, setting)!;
const rolledOn = (p: FirstSpellsPlan, result: string) => {
  const row = rollRows(p).find((r) => r.result === result)!;
  return { [row.tableId]: row.key };
};

describe('a named level in each of the nine places (lv-1, pf-22)', () => {
  // Purpose 1: the known group is headed by the list's plural, with a capital.
  it('1. First spells’ known group title', () => {
    expect(plan.knownTitle).toBe('Glimmers');
    expect(knownGroupTitle(plan)).toBe('Glimmers: pick 2');
  });

  // Purpose 2: the foot counts the known group in the list's words, as stored inside the sentence.
  it('2. the foot', () => {
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(plan, 'Damp wick'), cantrips: [] })).toBe('2 glimmers to go');
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(plan, 'Damp wick'), cantrips: ['frog-chorus'] })).toBe('1 glimmer to go');
  });

  // Purpose 3: the short line counts in the list's singular.
  it('3. the short line', () => {
    const short = { count: 1, options: plan.cantrips!.options.slice(0, 1), wanted: 2 };
    expect(shortLevelWords(short, knownShortWhat(plan))).toBe('Only 1 glimmer at this level in your packs (your class gets 2): pick it.');
  });

  // Purpose 4 and 5: a single spell's level line and its pop-up take the singular, with a capital.
  it('4 and 5. a spell’s own level line, and its pop-up', () => {
    const chorus = plan.cantrips!.options.find((o) => o.id === 'frog-chorus')!;
    expect(chorus.line).toMatch(/^Glimmer(,|$)/);
    expect(spellHeadings(chorus, [plan.classId], 1)).toContainEqual({ label: 'Level', text: 'Glimmer' });
    // A level the list doesn't name keeps today's words.
    const firstLevel = plan.choose!.options[0]!;
    expect(firstLevel.line).toMatch(/^Level 1(,|$)/);
    expect(spellHeadings(firstLevel, [plan.classId], 1)).toContainEqual({ label: 'Level', text: '1' });
  });

  // Purpose 6 and 7: the sheet's Magic row takes the singular; the Spell book counts in the list's words.
  it('6 and 7. the sheet’s Magic row, and the Spell book count', () => {
    const magic = magicOf({ klass: witch, race: null, level: 1, book: ['glimmer', 'frog-chorus'], prepared: [], slots: [], spells: setting.spells, lists })!;
    const book = magic.tabs.find((t) => t.id === 'book')!;
    expect(book.rows.find((r) => r.key === 'frog-chorus')!.facts).toMatch(/^Glimmer(,|$)/);
    expect(tabLabel(book)).toBe('Spell book: 1 spell, 1 glimmer');
  });

  // Purpose 8 and 9: a trait's rolled spell, in its heading, its check, the review and the trait's pop-up.
  it('8 and 9. a trait’s rolled spell, and the trait’s pop-up', () => {
    const songs = { kind: 'spellList', packEntryId: 'reed-songs', name: 'Reed songs', data: { levels: [{ level: 0, spells: ['song-glow', 'song-hush', 'song-ripple'] }], levelNames: { '0': GLIMMER } } };
    const song = (id: string, name: string) => ({ kind: 'spell', packEntryId: id, name, data: { lists: { 'reed-songs': 0 } } });
    const traits = {
      kind: 'traitList',
      packEntryId: 'fen-backgrounds',
      name: 'Fen backgrounds',
      data: { die: 'd6', entries: [{ id: 'reed-apprentice', name: 'Reed apprentice', min: 1, max: 6, spells: { roll: { listId: 'reed-songs', level: 0 } } }] },
    };
    const all = [traits, songs, song('song-glow', 'Marsh glow'), song('song-hush', 'Hush'), song('song-ripple', 'Ripple')];
    const [list] = traitListsOf(all);
    const apprentice = list!.entries[0]!;
    const roll = entryRollPlan(apprentice.spellRoll, all)!;
    expect(spellRollHeading(apprentice.name, roll)).toBe('From Reed apprentice: roll d3 for one glimmer');
    expect(rolledSpellReview(roll, null)).toEqual({ text: 'Glimmer not rolled yet', strong: true, problem: 'Roll d3 at the table for your glimmer, then tap it.' });
    expect(rolledSpellReview(roll, { entryId: 'reed-apprentice', spellId: 'song-hush', roll: 2 })).toEqual({ text: 'Hush: glimmer, rolled 2 on d3', problem: null });
    expect(traitHeadings(list!, apprentice, () => undefined, roll.what)).toContainEqual({ label: 'Spell', text: 'One glimmer, rolled at the table when you pick it' });
  });
});

describe('a list whose only level is named with its own noun (no doubling)', () => {
  // A powers-only class: its list "Glimmers", whose level 1 is named "glimmer"/"glimmers".
  const glimmers = { packEntryId: 'list-glimmers', name: 'Glimmers', data: { levels: [{ level: 1, spells: ['spark', 'shimmer'] }], levelNames: { '1': GLIMMER } } as Record<string, unknown> };
  const spark = (id: string, name: string) => ({ packEntryId: id, name, data: { lists: { 'list-glimmers': 1 }, range: '30 ft' } as Record<string, unknown> });
  const fae = { packEntryId: 'fae-weaver', name: 'Fae weaver', data: { spellcasting: { listId: 'list-glimmers', type: 'known', fromLevel: 1, known: { byLevel: [{ level: 1, count: 1 }], listLevel: 1 } } } as Record<string, unknown> };
  const faePlan = firstSpellsPlan(fae, 1, { spells: [spark('spark', 'Spark'), spark('shimmer', 'Shimmer')], lists: [glimmers], tables: [], choices: {} })!;

  // Purpose: the step is the list's own ("Glimmers"), so its group reads "Pick 1", not "Glimmers: pick 1"; the count
  // and a spell's line still use the name.
  it('reads "Pick 1" under the step "Glimmers"; the count and the line keep the name', () => {
    expect(spellsStepTitle(faePlan, 'First spells')).toBe('Glimmers');
    expect(knownGroupTitle(faePlan, spellsStepTitle(faePlan, 'First spells'))).toBe('Pick 1');
    expect(firstSpellsProblem(faePlan, { chosen: [], rolled: {}, cantrips: [] })).toBe('1 glimmer to go');
    expect(faePlan.cantrips!.options[0]!.line).toMatch(/^Glimmer(,|$)/);
  });

  // Purpose (the lead, 2026-11-14: one rule): a group title that only repeats the step's own title drops the repeat,
  // with or without a name for the level: an unnamed powers list's step "Glimmers" has its group "Pick 1" too; under
  // another step title ("Magic", "First spells") the group keeps its words.
  it('a group title that only repeats the step’s title drops the repeat, named or not', () => {
    const unnamed = { ...glimmers, data: { levels: glimmers.data.levels } };
    const plain = firstSpellsPlan(fae, 1, { spells: [spark('spark', 'Spark'), spark('shimmer', 'Shimmer')], lists: [unnamed], tables: [], choices: {} })!;
    const stepTitle = spellsStepTitle(plain, 'First spells');
    expect(stepTitle).toBe('Glimmers');
    expect(knownGroupTitle(plain, stepTitle)).toBe('Pick 1');
    expect(knownGroupTitle(plain, 'Magic')).toBe('Glimmers: pick 1');
    expect(knownGroupTitle(plan, 'First spells')).toBe('Glimmers: pick 2');
  });
});

describe('the value under a "Level" label, and a line with no label (the lead\'s answer (a), 2026-11-14)', () => {
  const chorusOf = (p: FirstSpellsPlan) => p.cantrips!.options.find((o) => o.id === 'frog-chorus')!;
  const unnamedPlan = firstSpellsPlan(witch, 1, { ...setting, lists: pack.spellLists.map(entry) })!;

  // Purpose: with the list naming no level 0, the value under the pop-up's "Level" label is the number alone, "0",
  // as on the merged Magic tab.
  it('unnamed, under a label: "0"', () => {
    expect(spellHeadings(chorusOf(unnamedPlan), [unnamedPlan.classId], 1)).toContainEqual({ label: 'Level', text: '0' });
  });

  // Purpose: with the list naming level 0, the value under the label is the name's single form, with a capital.
  it('named, under a label: the single form, "Glimmer"', () => {
    expect(spellHeadings(chorusOf(plan), [plan.classId], 1)).toContainEqual({ label: 'Level', text: 'Glimmer' });
  });

  // Purpose: on a line with no label the level keeps its approved words: "Level 0" unnamed, "Glimmer" named.
  it('no label: "Level 0", or the named form', () => {
    expect(chorusOf(unnamedPlan).line).toMatch(/^Level 0(,|$)/);
    expect(chorusOf(plan).line).toMatch(/^Glimmer(,|$)/);
  });
});
