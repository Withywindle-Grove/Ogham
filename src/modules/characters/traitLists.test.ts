// Trait lists at creation (M5b step 0b part B; the ruling of 2026-11-01 §4). Invented content only.
//   Purpose: the setting's trait lists are read from its entries (a list with no entries makes no step); one step per
//   list a visible sheet field points at, in the fields' order, once per list; a list with a die shows each entry's
//   range first; the why-line is the list's notes, else the pack's, else the app's; `creation.require` names "traits"
//   or the list's id; a saved value shows as the entry's name when the setting has it, else as saved.
//   On the shell (m5b-0c slice 6, cr-17): a list whose option is off makes no step (the list's own `option` or the
//   field's); a per-race field ("backgrounds-{race}") takes the character's race's list, and none without a race; a list
//   that leaves the race out makes no step; an entry's gear is read; a pick keeps the entry's id in a list field and its
//   name in a text field; Other… keeps "Name — note" and reads back.
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './fields.ts';
import { layoutHints, optionSpecOn, traitHeadings, traitListsOf, traitLookup, traitPickLine, traitPickOf, traitRange, traitRequired, traitRowName, pickedTraitAbilities, traitHelp, traitLines, traitSteps, traitValue } from './traitLists.ts';

const field = (key: string, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  id: key,
  campaignId: 'c1',
  key,
  label: key,
  type: 'list',
  choices: [],
  group: '',
  order: 0,
  showOnCard: false,
  hidden: false,
  fill: null,
  required: false,
  from: null,
  ...extra,
});

const entry = (id: string, data: Record<string, unknown>) => ({ kind: 'traitList', packEntryId: id, name: String(data.name ?? id), data });

const backgrounds = entry('fen-backgrounds', {
  name: 'Fen backgrounds',
  die: 'd6',
  notes: 'Where they come from.',
  entries: [
    { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.', notes: 'Long notes.' },
    { id: 'reed-cutter', name: 'Reed cutter', min: 4, max: 6 },
    'not an entry',
  ],
});
const signs = entry('signs', { name: 'Signs', entries: [{ id: 'heron', name: 'Heron' }] });

describe('reading the setting\'s trait lists', () => {
  it('reads each list with its die, notes and entries, and leaves out a list with nothing to pick', () => {
    const lists = traitListsOf([backgrounds, signs, entry('empty', { name: 'Empty', entries: [] }), { kind: 'class', packEntryId: 'x', name: 'X', data: {} }]);
    expect(lists.map((l) => l.id)).toEqual(['fen-backgrounds', 'signs']);
    expect(lists[0]).toMatchObject({ die: 'd6', notes: 'Where they come from.' });
    expect(lists[0]!.entries).toEqual([
      { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.', notes: 'Long notes.', source: '', items: [] },
      { id: 'reed-cutter', name: 'Reed cutter', min: null, max: null, blurb: '', notes: '', source: '', items: [] },
    ].map((e, n) => (n === 1 ? { ...e, min: 4, max: 6 } : e)));
    expect(lists[1]).toMatchObject({ die: '', notes: '' });
  });
});

describe('the steps the sheet fields make', () => {
  it('one per visible list field whose list the setting has, in the fields\' order, once per list', () => {
    const lists = traitListsOf([backgrounds, signs]);
    const fields = [
      field('sign', { from: 'signs', order: 0 }),
      field('background', { from: 'fen-backgrounds', order: 1 }),
      field('background_2', { from: 'fen-backgrounds', order: 2 }),
      field('hidden_sign', { from: 'signs', hidden: true }),
      field('kin', { from: 'kin-list' }),
      field('alignment', { choices: ['Lawful', 'Chaotic'] }),
      field('notes', { type: 'text', from: 'signs' }),
    ];
    const steps = traitSteps(fields, lists);
    expect(steps.map((s) => [s.id, s.field.key])).toEqual([
      ['signs', 'sign'],
      ['fen-backgrounds', 'background'],
    ]);
  });

  it('with no list field, or no list in the setting, there is no step', () => {
    expect(traitSteps([field('background', { from: 'fen-backgrounds' })], [])).toEqual([]);
    expect(traitSteps([field('alignment', { choices: ['Lawful'] })], traitListsOf([backgrounds]))).toEqual([]);
  });
});

describe('what the step shows', () => {
  const [list] = traitListsOf([backgrounds]);
  const [plain] = traitListsOf([signs]);

  it('with a die, each row shows its range first and the roll line is there; without one, neither', () => {
    expect(traitRange(list!.entries[0]!)).toBe('1–3');
    expect(traitRange({ id: 'x', name: 'X', min: 4, max: 4, blurb: '', notes: '', source: '', items: [] })).toBe('4');
    expect(traitRange({ id: 'x', name: 'X', min: null, max: null, blurb: '', notes: '', source: '', items: [] })).toBe('');
    expect(traitRowName(list!, list!.entries[0]!)).toBe('1–3: Eel catcher');
    expect(traitRowName(plain!, plain!.entries[0]!)).toBe('Heron');
  });

  // Help me choose explains only the current step's list (ct3-8; retest 4 T5: keyed by the step and its list): the
  // list's own help, else the app's words naming the list, so two lists never share one text.
  it('Help me choose is the list\'s own help, else the app\'s trait-list help naming the list', () => {
    expect(traitHelp({ ...plain!, help: 'The list says.' })).toBe('The list says.');
    expect(traitHelp(plain!)).toMatch(new RegExp(`^${plain!.name}: pick the one that fits your character\\.`));
    expect(traitHelp(list!)).toMatch(new RegExp(`^${list!.name}: roll `));
    expect(traitHelp(plain!)).not.toBe(traitHelp({ ...plain!, name: 'Heron signs' }));
    expect(traitListsOf([{ ...signs, data: { ...signs.data, help: '  Read the sky.  ' } }])[0]!.help).toBe('Read the sky.');
  });

  // Purpose (ct-9; retest 4 S1; Design on #570): a list with a die always names it, in the step's Roll row (the glyph
  // beside it), never in the line; the line is the list's own notes, never another list's or the step's.
  it("the line is the list's own notes; a die is named in the Roll row with the list's own die, never the line", () => {
    expect(traitLines(list!)).toEqual({ why: 'Where they come from.', roll: 'Roll 1d6 at the table, then tap the row, or pick one.' });
    // Notes that already name the die are the Roll row's words ("1d6" or a bare "d6"); another die's name doesn't count.
    expect(traitLines({ ...list!, notes: 'Roll 1d6 at the table, then tap the range — or pick one.' })).toEqual({ why: '', roll: 'Roll 1d6 at the table, then tap the range — or pick one.' });
    expect(traitLines({ ...list!, notes: 'Throw a d6.' })).toEqual({ why: '', roll: 'Throw a d6.' });
    expect(traitLines({ ...list!, notes: 'Throw a d66.' })).toEqual({ why: 'Throw a d66.', roll: 'Roll 1d6 at the table, then tap the row, or pick one.' });
    expect(traitLines({ ...list!, die: '2d6', notes: '' })).toEqual({ why: '', roll: 'Roll 2d6 at the table, then tap the row, or pick one.' });
    expect(traitLines({ ...plain!, notes: 'Under which sky.' })).toEqual({ why: 'Under which sky.', roll: null });
    expect(traitLines(plain!)).toEqual({ why: 'Pick one.', roll: null });
  });

  it('the pack requires the step by naming "traits" or the list\'s id', () => {
    expect(traitRequired(new Set(['traits']), 'signs')).toBe(true);
    expect(traitRequired(new Set(['signs']), 'signs')).toBe(true);
    expect(traitRequired(new Set(['languages']), 'signs')).toBe(false);
  });

  it('a saved value shows as the entry\'s name when the setting has it, else as saved', () => {
    const lookup = traitLookup(traitListsOf([backgrounds]));
    expect(lookup(field('background', { from: 'fen-backgrounds' }), 'eel-catcher')).toBe('Eel catcher');
    expect(lookup(field('background', { from: 'fen-backgrounds' }), 'typed before')).toBeNull();
    expect(lookup(field('sign', { from: 'signs' }), 'heron')).toBeNull();
  });
});

describe('trait lists on the creation step shell (cr-17)', () => {
  const bog = entry('fen-backgrounds-bog-folk', { name: 'Bog folk backgrounds', die: 'd6', entries: [{ id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.', notes: 'Starts with a knife.', items: [{ itemId: 'eel-knife' }, { itemId: 'rope', qty: 2 }, { qty: 1 }] }] });
  const stone = entry('fen-backgrounds-stone-kin', { name: 'Stone kin backgrounds', entries: [{ id: 'mason', name: 'Causeway mason' }] });
  const omens = entry('fen-omens', { name: 'Birth omens', option: 'fen-omens', excludeRaces: ['stone-kin'], entries: [{ id: 'heron', name: 'Heron at dawn' }] });
  const lists = traitListsOf([bog, stone, omens]);
  const template = (fields: Record<string, unknown>[]) => ({ kind: 'fieldTemplate', data: { fields } });
  const layout = layoutHints([template([{ key: 'background', from: 'fen-backgrounds-{race}' }, { key: 'omen', from: 'fen-omens', option: 'fen-omens' }, { key: 'trade', option: 'trades=on' }])]);
  const fields = [field('background', { type: 'text' }), field('omen', { from: 'fen-omens', order: 1 })];

  it("an option-gated list is absent when its option is off, and there when it's on", () => {
    expect(traitSteps(fields, lists, { layout, raceId: 'bog-folk', choices: { 'fen-omens': 'off' } }).map((s) => s.id)).toEqual(['fen-backgrounds-bog-folk']);
    expect(traitSteps(fields, lists, { layout, raceId: 'bog-folk', choices: { 'fen-omens': 'on' } }).map((s) => s.id)).toEqual(['fen-backgrounds-bog-folk', 'fen-omens']);
    // The field's option alone gates it too ("trades=on"), and so does the list's alone.
    expect(optionSpecOn('trades=on', { trades: 'off' })).toBe(false);
    expect(optionSpecOn('trades=on', { trades: 'on' })).toBe(true);
    expect(optionSpecOn('', {})).toBe(true);
    expect(traitSteps([field('omen', { from: 'fen-omens' })], lists, { choices: { 'fen-omens': 'off' } })).toEqual([]);
  });

  it("a per-race field takes the character's race's list, keeps the entry's name, and makes no step without a race", () => {
    const [mine] = traitSteps(fields, lists, { layout, raceId: 'stone-kin', choices: { 'fen-omens': 'on' } });
    expect(mine).toMatchObject({ id: 'fen-backgrounds-stone-kin', keeps: 'name' });
    expect(traitSteps(fields, lists, { layout, raceId: null, choices: {} })).toEqual([]);
    expect(traitValue(mine!, { entryId: 'mason' })).toBe('Causeway mason');
  });

  it('a list that leaves out the race makes no step for it', () => {
    expect(traitSteps(fields, lists, { layout, raceId: 'stone-kin', choices: { 'fen-omens': 'on' } }).map((s) => s.id)).toEqual(['fen-backgrounds-stone-kin']);
  });

  it("an entry's gear is read (a line with no item is left out), and its pop-up names it", () => {
    const eel = lists[0]!.entries[0]!;
    expect(eel.items).toEqual([{ itemId: 'eel-knife', qty: 1 }, { itemId: 'rope', qty: 2 }]);
    expect(traitHeadings(lists[0]!, eel, (id) => (id === 'eel-knife' ? 'Eel knife' : undefined))).toEqual([
      { label: 'Roll', text: '1–3 on d6' },
      { label: 'In short', text: 'Knows the channels.' },
      { label: 'Rules', text: 'Starts with a knife.' },
      { label: 'Starts with', text: 'Eel knife, rope ×2, added to your pack when picked' },
    ]);
    expect(traitPickLine(lists[0]!)).toBe('Roll 1d6 at the table, then tap the row, or pick one.');
    expect(traitPickLine(lists[1]!)).toBeNull();
  });

  it('a list field keeps the id; Other… keeps "Name — note"; both read back', () => {
    const [omen] = traitSteps([field('omen', { from: 'fen-omens' })], lists, {});
    expect(omen!.keeps).toBe('id');
    expect(traitValue(omen!, { entryId: 'heron' })).toBe('heron');
    expect(traitValue(omen!, { other: 'Owl at noon', note: 'a strange child' })).toBe('Owl at noon — a strange child');
    expect(traitValue(omen!, { other: 'Owl at noon', note: '' })).toBe('Owl at noon');
    expect(traitPickOf(omen!, 'heron')).toEqual({ entryId: 'heron' });
    expect(traitPickOf(omen!, 'Heron at dawn')).toEqual({ entryId: 'heron' });
    expect(traitPickOf(omen!, 'Owl at noon — a strange child')).toEqual({ other: 'Owl at noon', note: 'a strange child' });
    expect(traitPickOf(omen!, '')).toBeNull();
  });
});

// Purpose (creation survey PR 4; rc-2, rc-3, cs-6): an entry's coins are read (a whole number; dice kept apart, not
// added), a `{ name }` line is a one-off and `units` counts single pieces; the entry pop-up says all three.
describe("trait-list entries' money, one-offs and part-bundles", () => {
  it('reads money, a one-off by name and units, and the headings say them', () => {
    const [list] = traitListsOf([
      entry('fen-backgrounds', {
        entries: [
          { id: 'eel-merchant', name: 'Eel merchant', money: 50, items: [{ itemId: 'reed-darts', units: 10 }, { name: 'Ledger of debts' }] },
          { id: 'mire-gambler', name: 'Mire gambler', money: '2d6' },
        ],
      }),
    ]);
    const [merchant, gambler] = list!.entries;
    expect(merchant).toMatchObject({ money: 50, items: [{ itemId: 'reed-darts', qty: 1, units: 10 }, { itemId: '', qty: 1, name: 'Ledger of debts' }] });
    expect(gambler).toMatchObject({ moneyDice: '2d6' });
    expect(gambler!.money).toBeUndefined();
    const heads = traitHeadings(list!, merchant!, (id) => (id === 'reed-darts' ? 'Reed darts' : undefined));
    expect(heads).toContainEqual({ label: 'Starts with', text: 'Reed darts (10), Ledger of debts, added to your pack when picked' });
    expect(heads).toContainEqual({ label: 'Money', text: 'Adds 50 to your starting money' });
    expect(traitHeadings(list!, gambler!, () => undefined)).toContainEqual({ label: 'Money', text: 'Roll 2d6 at the table: your GM adds it to your starting money' });
  });
});

describe("a trait-list entry's powers (G-213, retest 4 T9)", () => {
  const herons = entry('herons', {
    name: 'Heron signs',
    entries: [
      { id: 'grey', name: 'Grey heron', abilities: [{ name: 'Still water', note: 'Unseen.', uses: { count: 2, per: 'day' }, spellId: 'reed-lamp' }, { name: 'Patience', notes: 'Waits.' }, { name: 'Steady flame', uses: { count: 1, per: 'day' } }, { note: 'No name' }, { name: 'Odd', uses: { count: 0 } }] },
      { id: 'night', name: 'Night heron' },
    ],
  });
  const lists = traitListsOf([herons]);
  const steps = traitSteps([field('sign', { from: 'herons' })], lists);

  // Purpose: an entry's abilities are read in the classes' shape; a nameless one is left out, uses only when over 0.
  it('reads the abilities', () => {
    expect(lists[0]!.entries[0]!.abilities).toEqual([
      { name: 'Still water', note: 'Unseen.', uses: { count: 2, per: 'day' }, spellId: 'reed-lamp' },
      { name: 'Patience', note: 'Waits.' },
      { name: 'Steady flame', note: '', uses: { count: 1, per: 'day' } },
      { name: 'Odd', note: '' },
    ]);
    expect(lists[0]!.entries[1]!.abilities).toBeUndefined();
  });

  // Purpose: only the picked entry's powers count; one with uses named like a class or race power stays there.
  it("gives the picked entry's powers, a class power named alike left with the class", () => {
    expect(pickedTraitAbilities(steps, { sign: 'grey' }, new Set(['Steady flame'])).map((a) => a.name)).toEqual(['Still water', 'Patience', 'Odd']);
    expect(pickedTraitAbilities(steps, { sign: 'Grey heron' }).map((a) => a.name)).toEqual(['Still water', 'Patience', 'Steady flame', 'Odd']);
    expect(pickedTraitAbilities(steps, { sign: 'night' })).toEqual([]);
    expect(pickedTraitAbilities(steps, {})).toEqual([]);
  });
});
