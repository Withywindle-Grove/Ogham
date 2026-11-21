// First spells (M5b step 0c, slice 4; cr-13), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json.
// Every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import {
  resultColumn,
  NO_PICKS,
  bookOf,
  classSpellList,
  cleanPicks,
  durationWords,
  emptyLevel,
  EMPTY_LEVEL_WORDS,
  picksFromBook,
  powersOnly,
  firstSpellsHint,
  firstSpellsPlan,
  firstSpellsProblem,
  rollRows,
  rollTableIds,
  rowAlreadyYours,
  shortLevelWords,
  knownShortWhat,
  spellBookEntry,
  spellDescription,
  spellHeadings,
  type SpellChoice,
  spellsStepTitle,
  tapProblem,
  tapped,
  type FirstSpellsPicks,
  type FirstSpellsPlan,
} from './firstSpells.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { classes: Entry[]; spells: Entry[]; spellLists: Entry[]; tables: Entry[] };
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e as Record<string, unknown> });
const klass = (id: string) => entry(pack.classes.find((c) => c.id === id)!);
const setting = { spells: pack.spells.map(entry), lists: pack.spellLists.map(entry), tables: pack.tables.map(entry), choices: {} };
// A player reads only the tables the pack marks `"gmOnly": false` (fs-1): the same setting with the GM's tables left out.
const asPlayer = { ...setting, tables: setting.tables.filter((t) => t.data.gmOnly === false) };
const witchPlan = () => firstSpellsPlan(klass('reed-witch'), 1, setting)!;
const ids = (list: { id: string }[] | undefined) => (list ?? []).map((s) => s.id);
const rows = (plan: FirstSpellsPlan) => rollRows(plan);
const rolledOn = (plan: FirstSpellsPlan, result: string) => {
  const row = rows(plan).find((r) => r.result === result)!;
  return { [row.tableId]: row.key };
};

describe('whether the step exists (cr-3, cr-13)', () => {
  it('a divine caster whose spells come from level 2 has no step at level 1, and has one at level 2 only if there is something to show', () => {
    expect(firstSpellsPlan(klass('marsh-chaplain'), 1, setting)).toBeNull();
    // At level 2 its firstSpells gives nothing (given: []), so still no step: First spells is for creation only.
    expect(firstSpellsPlan(klass('marsh-chaplain'), 2, setting)).toBeNull();
  });

  it('a class with no spellcasting has no step', () => {
    expect(firstSpellsPlan(klass('lantern-warden'), 1, setting)).toBeNull();
    expect(firstSpellsPlan(null, 1, setting)).toBeNull();
  });

  // Narrowed by F45's option B (2026-11-10): a `known` block alone now gives the step, so "no step" needs neither.
  it('a caster with neither a firstSpells block nor a known block has no step', () => {
    const k = klass('reed-witch');
    const without = { ...k, data: { ...k.data, spellcasting: { ...(k.data.spellcasting as object), firstSpells: undefined, known: undefined } } };
    expect(firstSpellsPlan(without, 1, setting)).toBeNull();
  });
});

// F45, Francis's option B (2026-11-10, design/notes/gate-m5b-rewalk-2026-11-10.md; plans/after-m5b-gate.md): the step
// reads a class's `known` powers whether or not the class has `firstSpells`. Invented: an Ember Listener knows powers
// from its list "Ember whispers" by level, kept at list level 1, with no first spells and no spellcasting type.
describe('known powers standing alone (F45, option B)', () => {
  const emberList = { packEntryId: 'ember-list', name: 'Ember whispers', data: { levels: [{ level: 1, spells: ['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick'] }] } };
  const withEmber = { ...setting, lists: [...setting.lists, emberList] };
  const listener = (known: Record<string, unknown> = { byLevel: [{ level: 1, count: 2 }, { level: 3, count: 3 }], memorise: 'all', listLevel: 1 }, extra: Record<string, unknown> = {}) => ({
    packEntryId: 'ember-listener',
    name: 'Ember Listener',
    data: { spellcasting: { listId: 'ember-list', fromLevel: 1, known, ...extra } },
  });

  it('a class with powers known by level and no firstSpells gets the step, offering its count from its list level', () => {
    const plan = firstSpellsPlan(listener(), 1, withEmber)!;
    expect(plan).not.toBeNull();
    expect(plan.cantrips?.count).toBe(2);
    expect(ids(plan.cantrips?.options)).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick']);
    // Nothing else: no given, no pick, no roll.
    expect([plan.given.length, plan.choose, plan.rolls.length]).toEqual([0, null, 0]);
    // A higher starting level asks for that level's count.
    expect(firstSpellsPlan(listener(), 3, withEmber)!.cantrips?.count).toBe(3);
  });

  it("the step takes the pack's word: the group carries the list's name, not Cantrips", () => {
    const plan = firstSpellsPlan(listener(), 1, withEmber)!;
    expect(plan.magic).toBe(true);
    expect(plan.knownTitle).toBe('Ember whispers');
    expect(firstSpellsHint(plan, { ...NO_PICKS, cantrips: ['glimmer', 'mire-grip'] })).toBe('All picked: 2 yours');
    expect(bookOf(plan, { ...NO_PICKS, cantrips: ['glimmer', 'mire-grip'] })).toEqual(['glimmer', 'mire-grip']);
  });

  // sp-2 (2026-11-10): the step is named after the powers, not "Magic".
  it('a step holding only known powers is named after the powers, while a kindred grant or first spells beside them keep "Magic"', () => {
    expect(spellsStepTitle(firstSpellsPlan(listener(), 1, withEmber)!, 'First spells')).toBe('Ember whispers');
    const withFirst = firstSpellsPlan(listener({ byLevel: [{ level: 1, count: 1 }], listLevel: 1 }, { firstSpells: { given: ['damp-wick'] } }), 1, withEmber)!;
    expect(spellsStepTitle(withFirst, 'First spells')).toBe('Magic');
  });

  // sp-2: the foot counts down as powers are picked.
  it('the foot counts down: "3 to go", then "2 to go", then "1 to go"', () => {
    const plan = firstSpellsPlan(listener(), 3, withEmber)!;
    expect(firstSpellsProblem(plan, NO_PICKS)).toBe('3 to go');
    expect(firstSpellsProblem(plan, { ...NO_PICKS, cantrips: ['glimmer'] })).toBe('2 to go');
    expect(firstSpellsProblem(plan, { ...NO_PICKS, cantrips: ['glimmer', 'mire-grip'] })).toBe('1 to go');
  });

  // sp-2: a level with fewer powers than the class may know says so in the setting's terms.
  it('a short level of powers reads "Only 3 at this level in your setting."', () => {
    const thin = { ...withEmber, lists: [...setting.lists, { ...emberList, data: { levels: [{ level: 1, spells: ['glimmer', 'reed-whisper', 'mire-grip'] }] } }] };
    const plan = firstSpellsPlan(listener({ byLevel: [{ level: 1, count: 4 }], listLevel: 1 }), 1, thin)!;
    expect(shortLevelWords(plan.cantrips!, 'power')).toBe('Only 3 at this level in your setting.');
  });

  // lv-1: the app writes no word of its own for the level: "Level 0", the list naming none.
  it("a book caster's known block is named by its level: Level 0", () => {
    expect(witchPlan().knownTitle).toBe('Level 0');
    expect(firstSpellsProblem(witchPlan(), { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(witchPlan(), 'Damp wick'), cantrips: [] })).toBe('2 level 0 spells to go');
  });

  // Review nit 1: a typeless class with first spells and a level-0 known block has cantrips, not its list's name.
  it('a class that is neither book nor divine names a level-0 known block beside its first spells by its level', () => {
    const k = listener({ byLevel: [{ level: 1, count: 1 }], listLevel: 0 }, { firstSpells: { choose: 1 } });
    const withLevels = { ...withEmber, lists: [...setting.lists, { ...emberList, data: { levels: [{ level: 0, spells: ['frog-chorus'] }, { level: 1, spells: ['glimmer', 'reed-whisper'] }] } }] };
    const plan = firstSpellsPlan(k, 1, withLevels)!;
    expect(ids(plan.cantrips?.options)).toEqual(['frog-chorus']);
    expect(plan.knownTitle).toBe('Level 0');
    // Known-only at level 0 is still its list's word (no first spells to sit beside).
    expect(firstSpellsPlan(listener({ byLevel: [{ level: 1, count: 1 }], listLevel: 0 }), 1, withLevels)!.knownTitle).toBe('Ember whispers');
  });

  it('known powers still wait for the level they come from, and a count of 0 at this level gives no step', () => {
    expect(firstSpellsPlan(listener(undefined, { fromLevel: 2 }), 1, withEmber)).toBeNull();
    expect(firstSpellsPlan(listener({ byLevel: [{ level: 2, count: 1 }], listLevel: 1 }), 1, withEmber)).toBeNull();
  });

  it('known powers behind an option that is off give no step', () => {
    const gated = listener({ byLevel: [{ level: 1, count: 2 }], listLevel: 1, option: 'ember-rule' });
    expect(firstSpellsPlan(gated, 1, withEmber)).toBeNull();
    expect(firstSpellsPlan(gated, 1, { ...withEmber, choices: { 'ember-rule': 'on' } })!.cantrips?.count).toBe(2);
  });
});

describe('the groups (cr-13)', () => {
  it('the book caster gets Given, Pick 2 (the class list’s level 1 without the given one), the roll and the cantrips', () => {
    const plan = witchPlan();
    expect(ids(plan.given)).toEqual(['glimmer']);
    expect(plan.choose?.count).toBe(2);
    expect(ids(plan.choose?.options)).toEqual(['reed-whisper', 'mire-grip', 'damp-wick']);
    expect(plan.rolls.map((g) => (g.unreadable ? 'unreadable' : `${g.die} ${g.name}`))).toEqual(['d4 First whispers']);
    expect(rows(plan).map((r) => `${r.range} ${r.result}`)).toEqual(['1 Reed whisper', '2 Mire grip', '3 Damp wick', '4 Glimmer']);
    expect(plan.cantrips?.count).toBe(2);
    expect(ids(plan.cantrips?.options)).toEqual(['frog-chorus', 'dry-boots', 'knot-charm']);
  });

  it('a spell row shows the blurb and a line with the level, duration, range and page', () => {
    const grip = witchPlan().choose!.options.find((o) => o.id === 'mire-grip')!;
    expect(grip.blurb).toBe('The bog holds one foe fast.');
    expect(grip.line).toBe('Level 1, 3 rounds, 30 ft, Fen rules p. 41');
    const chorus = witchPlan().cantrips!.options[0]!;
    expect(chorus.line.startsWith('Level 0')).toBe(true);
  });

  it('a spell without a blurb shows its duration and range instead (06, blurb variant)', () => {
    const plan = firstSpellsPlan(klass('reed-witch'), 1, { ...setting, spells: setting.spells.map((s) => ({ ...s, data: { ...s.data, blurb: undefined } })) })!;
    expect(plan.choose!.options[0]!.blurb).toBe('1 turn, 60 ft');
  });

  it('the full rules show the level, range, duration, saves and the rules text', () => {
    const grip = witchPlan().choose!.options.find((o) => o.id === 'mire-grip')!;
    expect(spellHeadings(grip, ['reed-witch', 'witch-list'], 1)).toEqual([
      { label: 'Level', text: '1' },
      { label: 'Range', text: '30 ft' },
      { label: 'Duration', text: '3 rounds' },
      { label: 'Saves', text: 'mire' },
      { label: 'Rules', text: 'One foe in range is held fast by the mud until it breaks free.' },
    ]);
  });

  it('in the book format the rules text is the paragraph, the facts labelled lines, and the source the last line', () => {
    // Purpose: a spell's entry in creation reads as the book prints it (dec-10 S3, E2): Level, Range, Duration and
    // Saves as labelled lines, then the spell's text as a paragraph (no "Rules" label), the book and page last.
    const grip = witchPlan().choose!.options.find((o) => o.id === 'mire-grip')!;
    expect(spellBookEntry(grip, ['reed-witch', 'witch-list'], 1)).toEqual({
      headings: [
        { label: 'Level', text: '1' },
        { label: 'Range', text: '30 ft' },
        { label: 'Duration', text: '3 rounds' },
        { label: 'Saves', text: 'mire' },
      ],
      description: ['One foe in range is held fast by the mud until it breaks free.'],
      source: 'Fen rules p. 41',
    });
  });

  it('cantrips gated by an option appear only when the option is on', () => {
    const k = klass('reed-witch');
    const casting = k.data.spellcasting as Record<string, unknown>;
    const gated = { ...k, data: { ...k.data, spellcasting: { ...casting, known: { ...(casting.known as object), option: 'fen-cantrips' } } } };
    expect(firstSpellsPlan(gated, 1, setting)!.cantrips).toBeNull();
    expect(firstSpellsPlan(gated, 1, { ...setting, choices: { 'fen-cantrips': 'on' } })!.cantrips?.count).toBe(2);
  });

  // of-2's safety net: the cantrips' option is on but no attached pack puts a spell at their level (the overlay that
  // would is missing): the group is there with nothing to pick, and Next isn't held up by it.
  it('an empty cantrip level asks for nothing: no options, and Next is not held up by it', () => {
    const k = klass('reed-witch');
    const casting = k.data.spellcasting as Record<string, unknown>;
    const atEmpty = { ...k, data: { ...k.data, spellcasting: { ...casting, known: { ...(casting.known as object), listLevel: 7 } } } };
    const plan = firstSpellsPlan(atEmpty, 1, setting)!;
    expect(plan.cantrips).toEqual({ count: 2, options: [] });
    expect(emptyLevel(plan.cantrips!)).toBe(true);
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(plan, 'Damp wick'), cantrips: [] })).toBeNull();
    expect(EMPTY_LEVEL_WORDS).toBe('No spells at this level in your packs.');
  });

  // of-2 through the shared reader: a spell an option switches off is on no level; every first-level spell off leaves
  // the Pick group empty, and it asks for nothing either (only the roll is left).
  it('a spell switched off by its option is on no level, and an emptied Pick group asks for nothing', () => {
    const offIds = new Set(['reed-whisper', 'mire-grip', 'damp-wick']);
    const marked = { ...setting, spells: setting.spells.map((s) => (offIds.has(s.packEntryId) ? { ...s, optionOff: 'fen-old-words=on' } : s)) };
    const plan = firstSpellsPlan(klass('reed-witch'), 1, marked)!;
    expect(plan.choose).toEqual({ count: 2, options: [] });
    expect(firstSpellsProblem(plan, { chosen: [], rolled: {}, cantrips: ['frog-chorus', 'dry-boots'] })).toBe('Roll d4 at the table, then tap what it shows');
    const one = firstSpellsPlan(klass('reed-witch'), 1, { ...setting, spells: setting.spells.map((s) => (s.packEntryId === 'mire-grip' ? { ...s, optionOff: 'fen-old-words=on' } : s)) })!;
    expect(ids(one.choose?.options)).toEqual(['reed-whisper', 'damp-wick']);
  });

  // of-6 (G-119): `known.listLevel` names any list level; glamours or runes kept at level 1 are offered from there.
  it('known spells come from any list level the class names (listLevel 1)', () => {
    const k = klass('reed-witch');
    const casting = k.data.spellcasting as Record<string, unknown>;
    const atOne = { ...k, data: { ...k.data, spellcasting: { ...casting, known: { ...(casting.known as object), listLevel: 1 } } } };
    expect(ids(firstSpellsPlan(atOne, 1, setting)!.cantrips?.options)).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick']);
    // A listLevel that isn't a level number reads as the default, 0.
    const odd = { ...k, data: { ...k.data, spellcasting: { ...casting, known: { ...(casting.known as object), listLevel: -1 } } } };
    expect(ids(firstSpellsPlan(odd, 1, setting)!.cantrips?.options)).toEqual(['frog-chorus', 'dry-boots', 'knot-charm']);
  });

  // bq3-15: a level with some spells but fewer than the count asks for what's there, says so, and doesn't hold Next up.
  it('a level with fewer spells than the count asks for what is there', () => {
    const offIds = new Set(['reed-whisper', 'mire-grip']);
    const thin = { ...setting, spells: setting.spells.map((s) => (offIds.has(s.packEntryId) || s.packEntryId === 'dry-boots' || s.packEntryId === 'knot-charm' ? { ...s, optionOff: 'fen-old-words=on' } : s)) };
    const plan = firstSpellsPlan(klass('reed-witch'), 1, thin)!;
    expect(plan.choose).toMatchObject({ count: 1, wanted: 2 });
    expect(ids(plan.choose?.options)).toEqual(['damp-wick']);
    expect(plan.cantrips).toMatchObject({ count: 1, wanted: 2 });
    expect(shortLevelWords(plan.choose!)).toBe('Only 1 spell at this level in your packs (your class gets 2): pick it.');
    expect(shortLevelWords(plan.cantrips!, knownShortWhat(plan))).toBe('Only 1 level 0 spell at this level in your packs (your class gets 2): pick it.');
    const row = rollRows(plan).find((r) => r.result === 'Glimmer')!;
    expect(firstSpellsProblem(plan, { chosen: [], rolled: { [row.tableId]: row.key }, cantrips: [] })).toBe('1 spell and 1 level 0 spell to go');
    const done = { chosen: ['damp-wick'], rolled: { [row.tableId]: row.key }, cantrips: ['frog-chorus'] };
    expect(firstSpellsProblem(plan, done)).toBeNull();
    // A second pick from a short level is refused like a full count.
    expect(tapProblem(plan, { ...done, chosen: ['damp-wick'] }, 'choose', 'other')).toBe('1 of 1 picked: take one off to pick another.');
  });

  // bq3-15: a level with enough spells has no short line; an empty one keeps of-2's words instead.
  it('no short line when the level has enough, or none', () => {
    const plan = witchPlan();
    expect(plan.choose?.wanted).toBeUndefined();
    expect(shortLevelWords(plan.choose!)).toBeNull();
    expect(shortLevelWords({ count: 2, options: [] })).toBeNull();
  });

  it('the list is read from the spells’ own `lists` when the spell list has no levels', () => {
    const bare = setting.lists.map((l) => ({ ...l, data: { ...l.data, levels: undefined } }));
    expect(classSpellList('reed-witch', 'witch-list', bare, setting.spells).get(1)).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick']);
  });

  it('a duration written as a formula is worked out at the level, and {value, unit} reads as words', () => {
    expect(durationWords({ value: 2, unit: 'turn' }, 1)).toBe('2 turns');
    expect(durationWords({ formula: 'level', unit: 'round' }, 3)).toBe('3 rounds');
    expect(durationWords('instant', 1)).toBe('instant');
  });

  it("a player sees the ranges of the class's table, marked gmOnly: false (fs-1), and no other table", () => {
    const plan = firstSpellsPlan(klass('reed-witch'), 1, asPlayer)!;
    expect(plan.rolls.map((g) => g.tableId)).toEqual(['first-whispers']);
    expect(rows(plan).map((r) => r.range)).toEqual(['1', '2', '3', '4']);
    // The GM's tables aren't in what a player reads at all (the stone kin's shared creation tables, cs-1, are).
    expect(asPlayer.tables.map((t) => t.packEntryId).filter((id) => !id.startsWith('stone-kin-'))).toEqual(['first-whispers', 'first-charms']);
  });

  it("when the pack doesn't share the table (no gmOnly: false), the roll is marked unreadable, not dropped, and Next doesn't wait for it", () => {
    const plan = firstSpellsPlan(klass('reed-witch'), 1, { ...setting, tables: [] })!;
    expect(plan.rolls).toEqual([{ unreadable: true, tableId: 'first-whispers', table: 'first-whispers', from: 'class' }]);
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: {}, cantrips: ['frog-chorus', 'dry-boots'] })).toBeNull();
  });

  it('a table row naming a whole book (`spells`) gives every spell in it', () => {
    const table = { packEntryId: 'first-whispers', name: 'Books', data: { die: 'd2', rows: [{ min: 1, max: 2, result: 'Wet folio', spells: ['reed-whisper', 'damp-wick'] }] } };
    const plan = firstSpellsPlan(klass('reed-witch'), 1, { ...setting, tables: [table] })!;
    expect(ids(rows(plan)[0]!.spells)).toEqual(['reed-whisper', 'damp-wick']);
    expect(rows(plan)[0]!.range).toBe('1–2');
  });

  it("a row's spells come from `spells` only (fs-2): a `spellId` or a matching name gives nothing", () => {
    const table = {
      packEntryId: 'first-whispers',
      name: 'Old shape',
      data: { die: 'd2', rows: [{ min: 1, max: 1, result: 'Reed whisper', spellId: 'reed-whisper' }, { min: 2, max: 2, result: 'Mire grip' }] },
    };
    const plan = firstSpellsPlan(klass('reed-witch'), 1, { ...setting, tables: [table] })!;
    expect(rows(plan).map((r) => ids(r.spells))).toEqual([[], []]);
    expect(tapProblem(plan, NO_PICKS, 'roll', rows(plan)[1]!.key)).toBe("Mire grip isn't among your setting's spells. Ask your GM.");
  });

  it('rollTable as an id or a list (fs-3): two tables give two groups, in the list’s order, one roll each', () => {
    expect(rollTableIds('first-whispers')).toEqual(['first-whispers']);
    expect(rollTableIds(['first-whispers', 'first-charms', 'first-whispers', ''])).toEqual(['first-whispers', 'first-charms']);
    expect(rollTableIds(undefined)).toEqual([]);
    const plan = firstSpellsPlan(klass('fen-cantor'), 1, asPlayer)!;
    expect(plan.rolls.map((g) => (g.unreadable ? 'unreadable' : `${g.die}, ${g.name}`))).toEqual(['d4, First whispers', 'd2, First charms']);
    expect(firstSpellsProblem(plan, NO_PICKS)).toBe('Roll d4 at the table, then tap what it shows');
    const one = tapped(NO_PICKS, 'roll', rows(plan).find((r) => r.result === 'Reed whisper')!.key);
    expect(firstSpellsProblem(plan, one)).toBe('Roll d2 at the table, then tap what it shows');
    const both = tapped(one, 'roll', rows(plan).find((r) => r.result === 'Light and dark')!.key);
    expect(firstSpellsProblem(plan, both)).toBeNull();
    expect(bookOf(plan, both)).toEqual(['reed-whisper', 'glimmer', 'damp-wick']);
    // A second table's row whose spells the first roll already gave is a duplicate there too.
    const grip = tapped(NO_PICKS, 'roll', rows(plan).find((r) => r.tableId === 'first-whispers' && r.result === 'Mire grip')!.key);
    expect(tapProblem(plan, grip, 'roll', rows(plan).find((r) => r.tableId === 'first-charms' && r.result === 'Mire grip')!.key)).toBe('Already yours: roll again.');
    // Read back from the book, each table finds its row.
    expect(picksFromBook(plan, bookOf(plan, both))).toEqual(both);
  });
});

describe('picking (cr-13; mockup creation/05)', () => {
  it('a given spell answers "given by your class" and stays in the book', () => {
    expect(tapProblem(witchPlan(), NO_PICKS, 'given', 'glimmer')).toBe('Given by your class: always in your book.');
    expect(bookOf(witchPlan(), NO_PICKS)).toEqual(['glimmer']);
  });

  it('a pick past the count says "2 of 2 picked: take one off to pick another"', () => {
    const picks: FirstSpellsPicks = { ...NO_PICKS, chosen: ['reed-whisper', 'mire-grip'] };
    expect(tapProblem(witchPlan(), picks, 'choose', 'damp-wick')).toBe('2 of 2 picked: take one off to pick another.');
    // Unpicking is always allowed.
    expect(tapProblem(witchPlan(), picks, 'choose', 'mire-grip')).toBeNull();
    expect(tapped(picks, 'choose', 'mire-grip').chosen).toEqual(['reed-whisper']);
  });

  it('a duplicate roll says "already yours: roll again"', () => {
    const plan = witchPlan();
    const glimmerRow = rows(plan).find((r) => r.result === 'Glimmer')!;
    expect(rowAlreadyYours(plan, NO_PICKS, glimmerRow)).toBe(true);
    expect(tapProblem(plan, NO_PICKS, 'roll', glimmerRow.key)).toBe('Already yours: roll again.');
    // A spell picked in Pick N makes its roll row a duplicate too.
    const whisperRow = rows(plan).find((r) => r.result === 'Reed whisper')!;
    expect(tapProblem(plan, { ...NO_PICKS, chosen: ['reed-whisper'] }, 'roll', whisperRow.key)).toBe('Already yours: roll again.');
    expect(tapProblem(plan, NO_PICKS, 'roll', whisperRow.key)).toBeNull();
  });

  it('a spell the roll already gave says "already yours" in Pick N', () => {
    const plan = witchPlan();
    expect(tapProblem(plan, { ...NO_PICKS, rolled: rolledOn(plan, 'Mire grip') }, 'choose', 'mire-grip')).toBe('Already yours: pick another.');
  });

  it('a roll is one tapped row per table; a second tap clears it', () => {
    const first = tapped(NO_PICKS, 'roll', 'first-whispers:1');
    expect(first.rolled).toEqual({ 'first-whispers': 'first-whispers:1' });
    expect(tapped(first, 'roll', 'first-whispers:2').rolled).toEqual({ 'first-whispers': 'first-whispers:2' });
    expect(tapped(first, 'roll', 'first-whispers:1').rolled).toEqual({});
  });
});

describe('Next and the book (cr-2, cr-13)', () => {
  // Changed by the walk fix (ruled 2026-11-12): a roll not yet tapped is named as a roll, not counted as a spell.
  it('Next says what is left: spells, rolls and cantrips together, then the roll on its own', () => {
    const plan = witchPlan();
    expect(firstSpellsProblem(plan, NO_PICKS)).toBe('2 spells, 1 roll and 2 level 0 spells to go');
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: {}, cantrips: ['frog-chorus'] })).toBe('1 roll and 1 level 0 spell to go');
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: {}, cantrips: ['frog-chorus', 'dry-boots'] })).toBe('Roll d4 at the table, then tap what it shows');
  });

  it('with every count met, the hint names the book’s size and the book holds each spell once, in order', () => {
    const plan = witchPlan();
    const picks = { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(plan, 'Damp wick'), cantrips: ['frog-chorus', 'dry-boots'] };
    expect(firstSpellsProblem(plan, picks)).toBeNull();
    expect(bookOf(plan, picks)).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick', 'frog-chorus', 'dry-boots']);
    expect(firstSpellsHint(plan, picks)).toBe('6 spells in your book');
  });

  it('the picks are read back from a saved book, so a draft reopened from the review shows what was picked', () => {
    const plan = witchPlan();
    const picks = { chosen: ['reed-whisper', 'mire-grip'], rolled: rolledOn(plan, 'Damp wick'), cantrips: ['frog-chorus', 'dry-boots'] };
    expect(picksFromBook(plan, bookOf(plan, picks))).toEqual(picks);
    expect(picksFromBook(plan, [])).toEqual(NO_PICKS);
    // A spell no longer offered drops out.
    expect(picksFromBook(plan, ['glimmer', 'gone', 'mire-grip'])).toEqual({ chosen: ['mire-grip'], rolled: {}, cantrips: [] });
  });

  it('picks the plan no longer offers drop out (a stale or resumed pick)', () => {
    expect(cleanPicks(witchPlan(), { chosen: ['gone', 'mire-grip', 'reed-whisper', 'damp-wick'], rolled: { 'first-whispers': 'first-whispers:99' }, cantrips: [] })).toEqual({ chosen: ['mire-grip', 'reed-whisper'], rolled: {}, cantrips: [] });
  });

  it('a given-only class (nothing to pick) is ready at once', () => {
    const k = klass('reed-witch');
    const casting = k.data.spellcasting as Record<string, unknown>;
    const givenOnly = { ...k, data: { ...k.data, spellcasting: { ...casting, firstSpells: { given: ['glimmer', 'mire-grip'] }, known: undefined } } };
    const plan = firstSpellsPlan(givenOnly, 1, setting)!;
    expect(firstSpellsProblem(plan, NO_PICKS)).toBeNull();
    expect(firstSpellsHint(plan, NO_PICKS)).toBe('2 spells in your book');
  });
});

describe("the foot names what's left by kind (walk fix, ruled 2026-11-12)", () => {
  // Purpose: with Pick 2 done, the roll not tapped and no cantrips yet, the foot says "1 roll and 2 cantrips to go", not "1 spell", so it agrees with Pick's "2 of 2 picked".
  it('Pick done, one roll open, cantrips 0 of 2: "1 roll and 2 cantrips to go"', () => {
    const plan = firstSpellsPlan(klass('reed-witch'), 1, setting)!;
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper', 'mire-grip'], rolled: {}, cantrips: [] })).toBe('1 roll and 2 level 0 spells to go');
  });

  // Purpose: spells, rolls and cantrips still to do are each named, in that order, joined as a list ("1 spell, 1 roll and 1 cantrip to go"), and rolls count in the plural.
  it('spells, rolls and cantrips are named apart, in that order', () => {
    const plan = firstSpellsPlan(klass('reed-witch'), 1, setting)!;
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper'], rolled: {}, cantrips: ['frog-chorus'] })).toBe('1 spell, 1 roll and 1 level 0 spell to go');
    expect(firstSpellsProblem(plan, { chosen: ['reed-whisper'], rolled: {}, cantrips: ['frog-chorus', 'dry-boots'] })).toBe('1 spell and 1 roll to go');
    expect(firstSpellsProblem(plan, NO_PICKS)).toBe('2 spells, 1 roll and 2 level 0 spells to go');
    // Two tables not yet tapped, beside cantrips: "2 rolls".
    const cantor = firstSpellsPlan(klass('fen-cantor'), 1, { ...setting, tables: setting.tables.filter((t) => t.data.gmOnly === false) })!;
    const withCantrips = { ...cantor, cantrips: firstSpellsPlan(klass('reed-witch'), 1, setting)!.cantrips };
    expect(firstSpellsProblem(withCantrips, NO_PICKS)).toBe('2 rolls and 2 level 0 spells to go');
  });
});

// Review of #611 (the lead's fault): a known-only class whose `learnByLevel` gives spells above level 1 (dec-1b). The
// learned spells are spells, so the step holds more than the powers: sp-2's rule for powers beside first spells applies,
// "Magic", never the powers' own step.
describe('known powers with spells learned above level 1', () => {
  const emberList = { packEntryId: 'ember-list', name: 'Ember whispers', data: { levels: [{ level: 1, spells: ['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick'] }] } };
  const withEmber = { ...setting, lists: [...setting.lists, emberList] };
  const learner = {
    packEntryId: 'ember-listener',
    name: 'Ember Listener',
    data: { spellcasting: { listId: 'ember-list', fromLevel: 1, known: { byLevel: [{ level: 1, count: 2 }], listLevel: 1 }, learnByLevel: [{ level: 2, count: 1 }] } },
  };

  // Purpose: a known-only class made at level 2 with a Learned at level 2 group gets a step named "Magic", not after its
  // powers, so the learned spells never sit inside the known-powers step.
  it('names the step "Magic", not after the powers, when it also holds learned spells', () => {
    const plan = firstSpellsPlan(learner, 2, withEmber)!;
    expect(plan.learned.length).toBe(1);
    expect(plan.knownTitle).toBe('Ember whispers');
    expect(powersOnly(plan)).toBe(false);
    expect(spellsStepTitle(plan, 'First spells')).toBe('Magic');
  });

  // Purpose: at level 1 (no learned group) the same class's step is still named after its powers (sp-2 unchanged).
  it('keeps the powers\' own step at level 1', () => {
    expect(spellsStepTitle(firstSpellsPlan(learner, 1, withEmber)!, 'First spells')).toBe('Ember whispers');
  });
});

// Review of #611: a known-only class whose `listId` names no list in the campaign's packs. Pinned as it is today, not
// ruled: the group falls back to "Cantrips", the step to "Magic", and the group has nothing to offer.
describe('known powers whose list is not found (today)', () => {
  const lost = { packEntryId: 'ember-listener', name: 'Ember Listener', data: { spellcasting: { listId: 'no-such-list', fromLevel: 1, known: { byLevel: [{ level: 1, count: 2 }], listLevel: 1 } } } };

  // Purpose: with no list to name it by, the known group reads by its level ("Level 1", lv-1) and the step "Magic"; the
  // group is an empty level.
  it('falls back to "Magic" with a group named by its level that has nothing to pick', () => {
    const plan = firstSpellsPlan(lost, 1, setting)!;
    expect(plan.knownTitle).toBe('Level 1');
    expect(spellsStepTitle(plan, 'First spells')).toBe('Magic');
    expect(plan.cantrips && emptyLevel(plan.cantrips)).toBe(true);
  });
});

describe("a rolled table's column word (dec-10 E)", () => {
  it("is the pack's own last column label, else Result: nothing invented", () => {
    // Purpose: the book head row names the results' column in the pack's words ("Knack"), skipping the die's column the
    // pack names first; a table with no labels says "Result".
    expect(resultColumn(['d6', 'Knack'])).toBe('Knack');
    expect(resultColumn(['Spell'])).toBe('Spell');
    expect(resultColumn(undefined)).toBe('Result');
    expect(resultColumn(['', '  '])).toBe('Result');
  });
});

// The Magic tab's opened spell reads its whole description (dec-8 B; mm-12). Invented spells only. In plain words:
//   * notes set out in blocks are read as the book sets them out, every block in order;
//   * notes in plain words stay words;
//   * without notes the blurb is the description; with neither there is none;
//   * notes that differ by class are read for this class;
//   * notes that read to nothing fall back to the blurb;
//   * the source is the spell's page; spellHeadings keeps its one "Rules" string as before.
describe('a spell’s whole description (the Magic tab, mm-12)', () => {
  const spell = (data: Record<string, unknown>): SpellChoice => ({ id: 'bog-lantern', name: 'Bog lantern', level: 1, blurb: '', line: '', entry: { packEntryId: 'bog-lantern', name: 'Bog lantern', data }, levelName: null });

  it('notes in blocks are read as the book sets them out, in order', () => {
    const notes = { blocks: [{ p: 'A green lantern hangs in the air.' }, { lead: 'Snuffed', text: 'Water puts it out.' }, { list: ['It sheds no heat.', 'It drifts with the caster.'] }] };
    expect(spellDescription(spell({ notes, source: 'Fen rules p. 7' }), [])).toEqual({
      text: {
        blocks: [
          { kind: 'p', text: 'A green lantern hangs in the air.' },
          { kind: 'lead', lead: 'Snuffed', text: 'Water puts it out.' },
          { kind: 'list', items: ['It sheds no heat.', 'It drifts with the caster.'], numbered: false },
        ],
      },
      source: 'Fen rules p. 7',
    });
  });

  it('plain-words notes stay words; without notes the blurb; with neither, none', () => {
    expect(spellDescription(spell({ notes: 'A green lantern hangs in the air.' }), []).text).toBe('A green lantern hangs in the air.');
    expect(spellDescription(spell({ blurb: 'A floating green light.' }), []).text).toBe('A floating green light.');
    expect(spellDescription(spell({ notes: '   ', range: '30 ft' }), [])).toEqual({ text: null, source: '' });
  });

  it('notes that differ by class are read for this class', () => {
    const notes = { 'reed-witch': 'The witch’s lantern is green.', 'fen-warden': { blocks: [{ p: 'The warden’s lantern is gold.' }] } };
    expect(spellDescription(spell({ notes }), ['reed-witch']).text).toBe('The witch’s lantern is green.');
    expect(spellDescription(spell({ notes }), ['fen-warden']).text).toEqual({ blocks: [{ kind: 'p', text: 'The warden’s lantern is gold.' }] });
  });

  it('notes that read to nothing fall back to the blurb', () => {
    expect(spellDescription(spell({ notes: { blocks: [{ p: '' }] }, blurb: 'A floating green light.' }), []).text).toBe('A floating green light.');
  });

  it('spellHeadings is unchanged: the notes are still its one "Rules" string', () => {
    const choice = spell({ notes: 'A green lantern hangs in the air.' });
    expect(spellHeadings(choice, [], 1).find((h) => h.label === 'Rules')).toEqual({ label: 'Rules', text: 'A green lantern hangs in the air.' });
  });
});
