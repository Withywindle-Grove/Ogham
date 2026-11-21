// Guided creation's choices (docs/05, 07 "Creation methods"; ruled 2026-10-25). Invented setting throughout.
import { describe, expect, it } from 'vitest';
import { readPackJson } from '../library/packFile.ts';
import { abilityBlurb, abilityDescription, abilityKeys, abilityNote, abilityNames, adjustmentText, classLevelCap, classesFor, classRace, creationMethods, defaultRace, holdsAbility, kindredAndClassNamed, kindredAndClassWords, methodsToPick, raceStep, readScore, unmet, withRace } from './creation.ts';

const option = {
  packEntryId: 'kin-and-calling',
  data: {
    ruleKey: 'creation-method',
    default: 'either',
    choices: [
      { id: 'classic', name: 'Calling is kin', races: 'none' },
      { id: 'split', name: 'Kin and calling', races: 'required' },
      { id: 'either', name: "Player's choice", methods: ['classic', 'split'] },
    ],
  },
};
const warden = { packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { creationMethods: ['classic', 'split'], requirements: {} } };
const reedling = { packEntryId: 'reedling', name: 'Reedling', data: { creationMethods: ['classic'], requirements: { DEX: 9 } } };
const bogMage = { packEntryId: 'bog-mage', name: 'Bog mage', data: { creationMethods: ['split'], requirements: { INT: 13 } } };
const marshFolk = { packEntryId: 'marsh-folk', name: 'Marsh folk', data: { requirements: { CON: 9 }, abilityModifiers: { DEX: 1, CON: -1 }, classMaxLevels: { 'lantern-warden': 8, 'bog-mage': 6 }, npcOnlyClasses: ['bog-mage'] } };
const riverKin = { packEntryId: 'river-kin', name: 'River kin', data: { classMaxLevels: 'any level' } };
const scores = { STR: 10, INT: 14, WIS: 9, DEX: 8, CON: 12, CHA: 11 };

describe('the creation method', () => {
  it("reads the campaign's choice, and a player's-choice method offers the methods it names", () => {
    const methods = creationMethods([option], () => undefined);
    expect(methods?.chosen.id).toBe('either');
    expect(methodsToPick(methods).map((m) => m.id)).toEqual(['classic', 'split']);
    const split = creationMethods([option], () => 'split');
    expect(methodsToPick(split).map((m) => m.id)).toEqual(['split']);
    expect(creationMethods([], () => undefined)).toBeNull();
  });

  it('the race step: none when the class is the race or the setting has no races; required or optional otherwise', () => {
    const all = creationMethods([option], () => undefined)!.all;
    const by = (id: string) => all.find((m) => m.id === id)!;
    expect(raceStep(by('classic'), [marshFolk])).toBe('none');
    expect(raceStep(by('split'), [marshFolk])).toBe('required');
    expect(raceStep(by('split'), [])).toBe('none');
    // Optional only when the setting names a default race; otherwise required (ruled 2026-10-26).
    expect(raceStep(by('either'), [marshFolk], true)).toBe('optional');
    expect(raceStep(null, [marshFolk], true)).toBe('optional');
    expect(raceStep(by('either'), [marshFolk])).toBe('required');
    expect(raceStep(null, [marshFolk])).toBe('required');
    expect(raceStep(by('classic'), [marshFolk], true)).toBe('none');
  });

  it("the default race is the last rules set's defaultRace, when it's one of the races", () => {
    const races = [{ packEntryId: 'marsh-folk' }, { packEntryId: 'river-kin' }];
    expect(defaultRace([{ defaultRace: 'marsh-folk' }, { defaultRace: 'river-kin' }], races)?.packEntryId).toBe('river-kin');
    expect(defaultRace([{ defaultRace: 'marsh-folk' }, {}], races)?.packEntryId).toBe('marsh-folk');
    expect(defaultRace([{ defaultRace: 'hill-folk' }], races)).toBeNull();
    expect(defaultRace([], races)).toBeNull();
  });
});

describe('races and classes offered', () => {
  it('a race with an empty class-limit table allows every class (it used to allow none)', () => {
    const plainFolk = { packEntryId: 'plain-folk', name: 'Plain folk', data: { classMaxLevels: {} } };
    const warden = { packEntryId: 'lantern-warden', name: 'Lantern Warden', data: {} };
    expect(classesFor([warden], null, plainFolk, {}).map((o) => o.entry.packEntryId)).toEqual(['lantern-warden']);
  });

  it("a race's fixed changes apply to the scores", () => {
    expect(withRace(scores, marshFolk)).toMatchObject({ DEX: 9, CON: 11 });
    expect(withRace(scores, null)).toEqual(scores);
  });

  it('classes follow the method, the race (its class list and NPC-only classes), and requirements after the race', () => {
    const all = creationMethods([option], () => undefined)!.all;
    const classic = all.find((m) => m.id === 'classic')!;
    const split = all.find((m) => m.id === 'split')!;
    const names = (offered: ReturnType<typeof classesFor>) => offered.map((o) => [o.entry.name, o.reason]);
    expect(names(classesFor([warden, reedling, bogMage], classic, null, scores))).toEqual([
      ['Lantern Warden', null],
      ['Reedling', 'Needs DEX 9'],
    ]);
    // Marsh folk: DEX 8 + 1 = 9 meets the need, but Reedling isn't on its list and the Bog mage is NPC-only.
    expect(names(classesFor([warden, reedling, bogMage], split, marshFolk, withRace(scores, marshFolk)))).toEqual([['Lantern Warden', null]]);
    // A race whose class list isn't a list allows every class the method does.
    expect(names(classesFor([warden, bogMage], split, riverKin, scores))).toEqual([
      ['Bog mage', null],
      ['Lantern Warden', null],
    ]);
  });

  it('requirements name the first score missed; scores are whole numbers 1–99', () => {
    expect(unmet({ STR: 9, INT: 13 }, { STR: 9, INT: 12 })).toBe('Needs INT 13');
    expect(unmet(undefined, scores)).toBeNull();
    expect([readScore('14'), readScore(' 3 '), readScore('0'), readScore('100'), readScore('1.5'), readScore('')]).toEqual([14, 3, null, null, null, null]);
  });

  it('a campaign field holds an ability by its key, or the key "Use this sheet layout" made from it', () => {
    expect([holdsAbility('STR', 'STR'), holdsAbility('str', 'STR'), holdsAbility('strength', 'STR'), holdsAbility('saver', 'saveR')]).toEqual([true, true, false, true]);
  });

  it("reads the setting's ability keys and adjustment text, top rules set first", () => {
    const rules = [{ abilities: ['STR', 'DEX'], abilityAdjustment: 'Lower one to raise another.' }, { abilities: ['MIGHT', 'WIT'] }];
    expect(abilityKeys(rules)).toEqual(['MIGHT', 'WIT']);
    expect(adjustmentText(rules)).toBe('Lower one to raise another.');
  });

  // Ruled 2026-10-29 (B10): the class's own race id, never a race named like the class.
  it("with no race picked (the class is the race), the race is the one the class names; without one, none (no name guessing)", () => {
    const races = [
      { packEntryId: 'marsh-folk', name: 'Marsh folk' },
      { packEntryId: 'reed-kin', name: 'Reed kin' },
    ];
    expect(classRace({ name: 'Reed kin', race: 'marsh-folk' }, races)?.packEntryId).toBe('marsh-folk');
    // A class named like a race, with no race of its own, isn't guessed to be it.
    expect(classRace({ name: 'Reed kin' }, races)).toBeNull();
    expect(classRace({ name: 'Lantern Warden', race: 'cloud-folk' }, races)).toBeNull();
    expect(classRace(null, races)).toBeNull();
  });

  // Ruled 2026-10-29: the blurb is the first line of the ability's pop-up.
  it("gives an ability's one-line blurb from the top rules set that has one, and nothing when none does", () => {
    const rules = [{ abilities: [{ key: 'MIGHT', name: 'Might', blurb: 'Old words.' }, 'WIT'] }, { abilities: [{ key: 'MIGHT', name: 'Might', blurb: ' Lifting and shoving. ' }, { key: 'WIT', name: 'Wits', blurb: '' }] }];
    expect(abilityBlurb(rules, 'MIGHT')).toBe('Lifting and shoving.');
    expect(abilityBlurb(rules, 'WIT')).toBe('');
    expect(abilityBlurb(rules, 'LUCK')).toBe('');
    expect(abilityBlurb([], 'MIGHT')).toBe('');
  });

  it("names an ability from the setting: short where people glance, long where they read; a plain key is both (N3, N23)", () => {
    const named = abilityNames([{ abilities: [{ key: 'MIGHT', name: 'Might of arm' }, 'WIT'] }, { abilities: [{ key: 'WIT', name: 'Wits', short: 'WT' }] }]);
    expect(named('MIGHT')).toEqual({ short: 'MIGHT', long: 'Might of arm' });
    expect(named('WIT')).toEqual({ short: 'WT', long: 'Wits' });
    expect(named('LUCK')).toEqual({ short: 'LUCK', long: 'LUCK' });
  });

  // Ruled 2026-10-29 (B6): the GM's label, then the setting's name, then the key.
  it("a GM's own label on the ability's field wins everywhere; a label that only repeats the key or the setting's names doesn't", () => {
    const rules = [{ abilities: [{ key: 'MIGHT', name: 'Might of arm', short: 'MGT' }, 'WIT', 'LUCK'] }];
    const fields = [
      { key: 'MIGHT', label: 'Brawn' },
      { key: 'WIT', label: 'wit' },
      { key: 'LUCK', label: 'Fortune', hidden: true },
    ];
    const named = abilityNames(rules, fields);
    expect(named('MIGHT')).toEqual({ short: 'Brawn', long: 'Brawn' });
    expect(named('WIT')).toEqual({ short: 'WIT', long: 'WIT' });
    // A hidden field doesn't name it.
    expect(named('LUCK')).toEqual({ short: 'LUCK', long: 'LUCK' });
    // A layout's field that repeats the setting's names leaves them be: short on tiles, long in pop-ups.
    expect(abilityNames(rules, [{ key: 'MIGHT', label: 'mgt' }])('MIGHT')).toEqual({ short: 'MGT', long: 'Might of arm' });
    expect(abilityNames(rules, [{ key: 'MIGHT', label: 'Might of arm' }])('MIGHT')).toEqual({ short: 'MGT', long: 'Might of arm' });
  });
});

describe('the import preview', () => {
  it('warns when a choice requires a race and the pack has none, and when methods name unknown choices', () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Fen Rules' },
        options: [{ id: 'kin', name: 'Kin', ruleKey: 'creation-method', default: 'split', choices: [{ id: 'split', races: 'required' }, { id: 'any', methods: ['split', 'odd'] }] }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.warnings).toEqual([
      expect.stringMatching(/choice "split": says a race is required, but this pack has no races/),
      expect.stringMatching(/choice "any": methods names "odd"/),
    ]);
  });
});

describe('a class level cap (B21: a fixed starting level is capped at it)', () => {
  const klass = (maxLevel?: number) => ({ packEntryId: 'lantern-warden', name: 'Lantern Warden', data: maxLevel ? { maxLevel } : {} }); // words: names
  const race = (cap?: number) => ({ packEntryId: 'marsh-folk', name: 'Marsh folk', data: cap ? { classMaxLevels: { 'lantern-warden': cap } } : {} }); // words: names
  it("is the class's highest level, lowered by the race's limit for it; null when neither says", () => {
    expect(classLevelCap(klass(10), null)).toBe(10);
    expect(classLevelCap(klass(10), race(6))).toBe(6);
    expect(classLevelCap(klass(), race(6))).toBe(6);
    expect(classLevelCap(klass(), race())).toBeNull();
  });
});

// Purpose (cw-11): the ability pop-up reads the pack's plain-words `description` first, else its `blurb`; the rules note
// comes from `abilityModifierNotes`; '' when the pack has none.

describe('an ability explained (cw-11)', () => {
  const rules = [{ abilities: [{ key: 'MUS', name: 'Muscle', blurb: 'Lifting and hitting.', description: 'Muscle is raw strength: how hard you hit and what you can lift.' }, { key: 'WIT', name: 'Wit', blurb: 'Reading and tongues.' }, { key: 'LORE' }], abilityModifierNotes: { MUS: 'Melee: added to hits and damage up close.' } }];
  it('the description first, else the blurb, else nothing', () => {
    expect(abilityDescription(rules, 'MUS')).toBe('Muscle is raw strength: how hard you hit and what you can lift.');
    expect(abilityDescription(rules, 'WIT')).toBe('Reading and tongues.');
    expect(abilityDescription(rules, 'LORE')).toBe('');
  });
  it('the rules note, when the setting has one', () => {
    expect(abilityNote(rules, 'MUS')).toBe('Melee: added to hits and damage up close.');
    expect(abilityNote(rules, 'WIT')).toBe('');
  });
});

// Purpose (F49, dec-1c): the review's kindred-and-class line names a kindred-class named as its kindred once.
describe('the review line for kindred and class', () => {
  it('names a kindred-class named as its kindred once, and both otherwise', () => {
    expect(kindredAndClassWords('Fen elf', 'Fen Elf')).toBe('Fen Elf');
    expect(kindredAndClassWords('Bog folk', 'Lantern Warden')).toBe('Bog folk Lantern Warden');
    expect(kindredAndClassWords(null, 'Mire Stalker')).toBe('Mire Stalker');
  });
});

// Purpose (dec-1d on 1c): the review's one-line kindred and class adds each name's source only to a name with a
// namesake in another pack, and decides on the bare names whether the kindred is read, so a kindred-class with a
// source still reads its name once ("Fen Elf (from Fen rules)", never "Fen elf (from Fen rules) Fen Elf").
describe('the review line for kindred and class, with sources (sn-1)', () => {
  type E = { name: string; twin?: string };
  const from = (entry: E) => (entry.twin ? ` (from ${entry.twin})` : '');

  it('adds the source to a twin class, and to nothing else', () => {
    expect(kindredAndClassNamed<E>({ name: 'Bog folk' }, { name: 'Lantern Warden', twin: 'Fen rules' }, from)).toBe('Bog folk Lantern Warden (from Fen rules)');
  });

  it('leaves the line as it was when nothing has a namesake', () => {
    expect(kindredAndClassNamed<E>({ name: 'Bog folk' }, { name: 'Lantern Warden' }, from)).toBe('Bog folk Lantern Warden');
    expect(kindredAndClassNamed<E>(null, { name: 'Mire Stalker' }, from)).toBe('Mire Stalker');
  });

  it('reads a kindred-class named as its kindred once, with its source', () => {
    expect(kindredAndClassNamed<E>({ name: 'Fen elf', twin: 'Fen rules' }, { name: 'Fen Elf', twin: 'Fen rules' }, from)).toBe('Fen Elf (from Fen rules)');
  });

  it('gives a twin kindred and a twin class each their own source', () => {
    expect(kindredAndClassNamed<E>({ name: 'Bog folk', twin: 'Mire zine' }, { name: 'Lantern Warden', twin: 'Fen rules' }, from)).toBe('Bog folk (from Mire zine) Lantern Warden (from Fen rules)');
  });
});
