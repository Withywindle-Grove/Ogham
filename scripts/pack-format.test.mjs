// Tests for the pack checker's format checks of the M7 and M7b parts (scripts/pack-format.mjs; docs/07,
// "Characters, XP and spells"), on an invented pack (scripts/fixtures/m7-format.fixture.json) and invented snippets.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extendsNotes, formatCounts, formatNotes, levelNamesNotes, shortLabelNotes } from './pack-format.mjs';

const fixture = 'scripts/fixtures/m7-format.fixture.json';
const sample = () => JSON.parse(readFileSync(fixture, 'utf8'));

describe('the pack format checks (M7 parts)', () => {
  it('finds nothing wrong with a pack that writes every new part the way 07 says', () => {
    // The one note is about meta.proposedExtensions: "spells[].blurb" is now part of the format.
    expect(formatNotes(sample())).toEqual([
      'meta.proposedExtensions lists "spells[].blurb", which is now part of the format (07); it can come off the list.',
    ]);
  });

  it('counts the new parts a pack holds', () => {
    expect(formatCounts(sample())).toEqual({
      'trait lists': 1,
      'rules sets with scores': 1,
      blurbs: 4,
      'abilities with uses': 2,
      'rules sets with creationGuide': 1,
      'classes with spellcasting.recover': 1,
      'rules sets with scores': 1,
    });
  });

  it('says when a blurb is too long, not words, or only repeats the name', () => {
    const pack = { spells: [
      { id: 'a', name: 'Glimmer', blurb: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen' },
      { id: 'b', name: 'Mist', blurb: 3 },
      { id: 'c', name: 'Fog', blurb: 'fog' },
    ] };
    const notes = formatNotes(pack);
    expect(notes[0]).toMatch(/spells: "a": blurb has 15 words/);
    expect(notes[1]).toMatch(/spells: "b": blurb should be one line of words/);
    expect(notes[2]).toMatch(/spells: "c": blurb only repeats the name/);
  });

  it('checks ability uses: per must name when they come back, and refill is the old name', () => {
    const pack = { classes: [{ id: 'k', name: 'K', abilities: [
      { name: 'Never back', uses: { count: 2 } },
      { name: 'Odd', uses: { count: 1, per: 'moon' } },
      { name: 'Old', uses: 1, refill: 'rest' },
      { name: 'Bad levels', uses: { byLevel: [{ level: 1 }], per: 'day' } },
    ] }] };
    const notes = formatNotes(pack);
    expect(notes).toContain('classes: "k", ability "Never back": uses has no per; the uses would never come back. Write per: day, rest, fight, week, turn, year, ever.');
    expect(notes).toContain('classes: "k", ability "Odd": uses.per "moon" isn\'t one of day, rest, fight, week, turn, year, ever.');
    expect(notes).toContain('classes: "k", ability "Old": "refill" is the old name; write uses.per (day, rest, fight, week, turn, year, ever).');
    expect(notes).toContain('classes: "k", ability "Old": uses should be { count, per } or { byLevel, per }; a bare number doesn\'t say when the uses come back.');
    expect(notes.some((n) => /Bad levels.*byLevel should be a list/.test(n))).toBe(true);
  });

  it('checks spellcasting.recover, creation steps and the levelling setting', () => {
    const pack = {
      classes: [{ id: 'k', name: 'K', spellcasting: { recover: 'nap' } }],
      rulesSets: [{ id: 'r', creationGuide: { horoscope: 'Why' , gear: { why: 7 } }, creation: { require: ['gear', 'pets'] }, levelUp: { when: 'often' } }],
    };
    const notes = formatNotes(pack);
    expect(notes).toContain('classes: "k": spellcasting.recover "nap" isn\'t one of rest, restAndStudy, prayer.');
    expect(notes.some((n) => /creationGuide names "horoscope"/.test(n))).toBe(true);
    expect(notes).toContain('rulesSets: "r": creationGuide.gear.why should be words.');
    expect(notes.some((n) => /creation.require names "pets"/.test(n))).toBe(true);
    expect(notes).toContain('rulesSets: "r": levelUp.when "often" isn\'t one of downtime, anyTime.');
  });

  it('checks treasure XP is written as xp.treasure.perGp', () => {
    const notes = formatNotes({ rulesSets: [{ id: 'r', xp: { treasureXpPerGp: 1, treasure: 'yes', rounding: 'sideways' } }] });
    expect(notes).toEqual([
      'rulesSets: "r": xp.treasure should be { perGp: <number>, note? } (0 means treasure gives no XP).',
      'rulesSets: "r": xp.treasureXpPerGp: the format reads xp.treasure.perGp; write it there.',
      'rulesSets: "r": xp.rounding "sideways" isn\'t one of nearest, down, up.',
    ]);
  });

  it('checks trait lists: ids, names, entries, roll ranges, and help as text (a list\'s own Help me choose words)', () => {
    const notes = formatNotes({ traitLists: [
      { id: 'signs', name: 'Signs', entries: [{ id: 'heron', name: 'Heron', min: 1, max: 2 }] },
      { id: 'kin', name: 'Kin', die: 'd6', entries: [{ id: 'x', name: 'X', min: 4, max: 2 }, { id: 'x', name: 'Y' }] },
      { id: 'empty', name: 'Empty', entries: [] },
      { id: 'helped', name: 'Helped', help: 'Pick the one with a story.', entries: [{ id: 'a', name: 'A' }] },
      { id: 'badhelp', name: 'Bad help', help: 3, entries: [{ id: 'a', name: 'A' }] },
    ] });
    expect(notes).toEqual([
      'traitLists: "signs", "heron" has a roll range but the list has no die.',
      'traitLists: "kin", "x": min and max should be whole numbers, min no more than max.',
      'traitLists: "kin", "x" appears twice.',
      'traitLists: "empty" has no entries.',
      'traitLists: "badhelp": help should be text (the list\'s Help me choose words).',
    ]);
  });

  // of-7 (G-120): `distinct` on a trait list is true or false.
  it('checks a trait list\'s distinct is true or false', () => {
    const lists = (distinct) => ({ traitLists: [{ id: 'gifts', name: 'Gifts', die: 'd4', distinct, entries: [{ id: 'a', name: 'A', min: 1, max: 4 }] }] });
    expect(formatNotes(lists(true))).toEqual([]);
    expect(formatNotes(lists(false))).toEqual([]);
    expect(formatNotes(lists('yes'))).toEqual(['traitLists: "gifts": distinct should be true or false (true: rolled more than once, the results differ).']);
  });

  // pf-16 (ruled 2026-11-13): `rolls` is how many times a character rolls or picks on the list; a whole number of 1 or
  // more is accepted, anything else (0, a word) is named.
  it("accepts a trait list's rolls of 2 and names 0 and \"two\"", () => {
    const lists = (rolls) => ({ traitLists: [{ id: 'gifts', name: 'Gifts', die: 'd4', rolls, distinct: true, entries: [{ id: 'a', name: 'A', min: 1, max: 4 }] }] });
    expect(formatNotes(lists(2))).toEqual([]);
    expect(formatNotes(lists(0))).toEqual(['traitLists: "gifts": rolls should be a whole number of 1 or more (how many times a character rolls or picks on the list), not 0.']);
    expect(formatNotes(lists('two'))).toEqual(['traitLists: "gifts": rolls should be a whole number of 1 or more (how many times a character rolls or picks on the list), not "two".']);
  });

  it('never throws on odd input', () => {
    expect(formatNotes(null)).toEqual([]);
    expect(formatNotes({ classes: 'no', traitLists: [7], rulesSets: [{ creation: 5 }] })).toEqual([
      'traitLists: entry 1 isn\'t a list entry.',
      'rulesSets: "(no id)": creation should be { require: [step names] }.',
    ]);
  });

  it('runs inside npm run pack:check on the invented pack', () => {
    const out = execFileSync(process.execPath, ['scripts/check-pack.mjs', fixture], { encoding: 'utf8' });
    expect(out).toMatch(/Format parts the app reads from M5 and M7/);
    expect(out).toMatch(/trait lists: 1/);
    expect(out).not.toMatch(/"traitLists" isn't a part/);
  });
});

// Short labels for choices (07, tf-3): a 2–3 choice option needs `short` on each choice to show side by side.
describe('short labels for choices (tf-3)', () => {
  it('notes a 2 or 3 choice option with a long name and no short label; short names (On, Off) and 4 choices pass', () => {
    const choice = (id, short) => (short ? { id, name: id, short } : { id, name: id });
    const file = {
      options: [
        { id: 'ties', name: 'Ties', choices: [choice('again', 'Roll again'), choice('both sides at the same time')] },
        { id: 'oil', name: 'Oil', choices: [choice('on', 'On'), choice('off', 'Off')] },
        { id: 'four', name: 'Four', choices: [choice('a'), choice('b'), choice('c'), choice('d')] },
      ],
    };
    expect(shortLabelNotes(file)).toEqual([
      'options: "ties" has 2 choices, some long and without a short label (choices[].short, about 14 letters); the Rules row shows them side by side only with one.',
    ]);
  });
});

// of-1 (07): `extends` joins a base option's choices; `ruleKey` makes a rival rule; both on one option is a mistake.
describe('an option that extends another (of-1)', () => {
  // Purpose: pack:check warns on an option carrying both extends and ruleKey, and says nothing about either alone.
  it('notes an option with both extends and ruleKey; extends alone or ruleKey alone pass', () => {
    const file = {
      options: [
        { id: 'reed-counts', name: 'Item counts', extends: 'carry', ruleKey: 'encumbrance', choices: [{ id: 'counts', name: 'Counts' }] },
        { id: 'reed-bundles', name: 'Bundles', extends: 'carry', choices: [{ id: 'bundles', name: 'Bundles' }] },
        { id: 'carry', name: 'Carry', ruleKey: 'encumbrance', choices: [{ id: 'none', name: 'None' }] },
      ],
    };
    expect(extendsNotes(file)).toEqual([
      'options: "reed-counts" has both extends and ruleKey; extends joins its choices to the base option (one option), ruleKey makes it a rival rule. Keep one (07, of-1).',
    ]);
    expect(formatNotes(file)).toContain(extendsNotes(file)[0]);
  });

  // Purpose (pf-22, lv-1): a spell list's levelNames is checked: a key that isn't a whole number of 0 or more, and an
  // entry without both `one` and `many`, are each a note; a well-made map says nothing.
  it('notes a levelNames key that is not a whole number of 0 or more, and an entry missing one or many', () => {
    const file = {
      spellLists: [
        { id: 'list-fen', name: 'Fen spells', levelNames: { '0': { one: 'glimmer', many: 'glimmers' }, '2': { one: 'Deep rite', many: 'Deep rites' } } },
        { id: 'list-odd', name: 'Odd spells', levelNames: { first: { one: 'a', many: 'b' }, '-1': { one: 'a', many: 'b' }, '1.5': { one: 'a', many: 'b' }, '3': { one: 'Wisp' }, '4': 'Wisps' } },
        { id: 'list-bad', name: 'Bad spells', levelNames: ['glimmer'] },
      ],
    };
    // A map's whole-number keys come first, in order (JavaScript's own order for an object's keys).
    expect(levelNamesNotes(file)).toEqual([
      'spellLists: "list-odd" levelNames "3" needs both "one" (one spell) and "many" (a heading, several); without both the app writes "Level 3".',
      'spellLists: "list-odd" levelNames "4" needs both "one" (one spell) and "many" (a heading, several); without both the app writes "Level 4".',
      'spellLists: "list-odd" levelNames has the key "first", which isn\'t a spell level (a whole number, 0 or more); the app never shows it.',
      'spellLists: "list-odd" levelNames has the key "-1", which isn\'t a spell level (a whole number, 0 or more); the app never shows it.',
      'spellLists: "list-odd" levelNames has the key "1.5", which isn\'t a spell level (a whole number, 0 or more); the app never shows it.',
      'spellLists: "list-bad" levelNames should be a map from a level to { one, many } (pf-22); the app reads nothing from it.',
    ]);
    expect(formatNotes(file)).toContain(levelNamesNotes(file)[0]);
  });
});
