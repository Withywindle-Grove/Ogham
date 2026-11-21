// A gate on several choices (of-12, design/rulings/m5b-options-format-2-2026-11-03.md): `option` as a list and
// comma-separated `byOption` keys, read the same by every reader that takes an option spec. Invented entries.
import { describe, expect, it } from 'vitest';
import { optionSpecOf } from '../expedition/modes.ts';
import { layoutHints, traitListsOf } from '../characters/traitLists.ts';
import { optionIsOn } from '../characters/weaponSkills.ts';
import { byOptionKeyOn, entriesInPlay, fieldsAddedBy, fieldsOff, optionGate, optionSpecOn, specParts } from './optionGate.ts';
import { entryOptionOn, resolveRules } from './options.ts';
import { raceInPlay, raceOptionNotes } from './raceOptions.ts';

const spark = ['sparks=common', 'sparks=rare', 'sparks=relics'];

describe('option as a list (of-12)', () => {
  // Purpose: an entry whose option is a list exists while any of its choices is the campaign's, and only then.
  it('exists while any listed choice is chosen', () => {
    const lance = { kind: 'item', data: { option: spark } };
    for (const choice of ['common', 'rare', 'relics']) expect(optionGate(lance, { sparks: choice }).inPlay).toBe(true);
    const off = optionGate(lance, { sparks: 'none' });
    expect(off.inPlay).toBe(false);
    expect(off.offBy).toBe('sparks=common,sparks=rare,sparks=relics');
    expect(optionGate(lance, {}).inPlay).toBe(false);
  });

  // Purpose: a choice added later isn't swept in (no "not equal" form): only the choices listed count.
  it('a choice not listed keeps the entry out', () => {
    expect(optionSpecOn(spark, { sparks: 'everywhere' })).toBe(false);
  });

  // Purpose: the list's parts may name different options and use either spelling; an empty list gates nothing.
  it('reads every part, and an empty list is no gate', () => {
    expect(optionSpecOn(['moss-roads', 'sparks:rare'], { sparks: 'rare' })).toBe(true);
    expect(optionSpecOn(['moss-roads', 'sparks:rare'], { 'moss-roads': 'on' })).toBe(true);
    expect(optionSpecOn([], {})).toBe(true);
    expect(optionSpecOn([' ', 7], {})).toBe(true);
    expect(specParts(['sparks=rare', 'moss-roads'])).toEqual([{ option: 'sparks', choice: 'rare' }, { option: 'moss-roads', choice: '' }]);
  });

  // Purpose: the older readers that take an entry's option (creation's classes and kits) agree with the shared one.
  it('entryOptionOn and the setting lists agree', () => {
    expect(entryOptionOn({ option: spark }, { sparks: 'rare' })).toBe(true);
    expect(entryOptionOn({ onlyWithOption: spark }, { sparks: 'none' })).toBe(false);
    const entries = [{ optionOff: optionGate({ kind: 'item', data: { option: spark } }, { sparks: 'none' }).offBy }, {}];
    expect(entriesInPlay(entries)).toHaveLength(1);
  });

  // Purpose: a sheet field or trait list behind a list is hidden only while none of its choices is made (of-9), and
  // the option's row still names the field it adds.
  it('sheet fields and trait lists take a list too', () => {
    const entries = [
      { kind: 'fieldTemplate', packEntryId: 'sheet', name: 'Sheet', data: { fields: [{ key: 'spark-mark', label: 'Spark mark', option: ['sparks=rare', 'sparks=relics'] }] } },
      { kind: 'traitList', packEntryId: 'spark-signs', name: 'Spark signs', data: { option: ['sparks=rare'], entries: [{ name: 'Blue' }] } },
    ];
    expect(fieldsOff(entries, { sparks: 'rare' }).has('spark-mark')).toBe(false);
    expect(fieldsOff(entries, { sparks: 'common' }).has('spark-mark')).toBe(true);
    expect(fieldsAddedBy(entries, 'sparks')).toEqual(['Spark mark']);
    expect(traitListsOf(entries)[0]!.option).toBe('sparks=rare');
    expect(layoutHints(entries).get('spark-mark')?.option).toBe('sparks=rare,sparks=relics');
  });

  // Purpose: a rule that must name its option (weapon skills) and an exploration part read a list as any of them.
  it('weapon skills and exploration parts read a list', () => {
    expect(optionIsOn(['sparks=rare'], { sparks: 'rare' })).toBe(true);
    expect(optionIsOn([], { sparks: 'rare' })).toBe(false);
    const spec = optionSpecOf({ option: ['sparks=rare', 'sparks=relics'] });
    expect(spec).toBe('sparks:rare,sparks:relics');
    expect(optionSpecOn(spec, { sparks: 'relics' })).toBe(true);
  });
});

describe('byOption keys listing several choices (of-12)', () => {
  // Purpose: a comma key's fields apply under any of its choices, and not under another.
  it("an entry's comma key applies under any of its choices", () => {
    const lance = { kind: 'item', data: { cost: 300, byOption: { 'sparks=rare,sparks=relics': { cost: null, found: true } } } };
    expect(optionGate(lance, { sparks: 'relics' }).data).toEqual({ found: true });
    expect(optionGate(lance, { sparks: 'rare' }).data).toEqual({ found: true });
    expect(optionGate(lance, { sparks: 'common' }).data).toEqual({ cost: 300 });
  });

  // Purpose: a byOption key must name a choice in every part (07: "<option>=<choice>"); one that doesn't is never on.
  it('a key with a part naming no choice is never on', () => {
    expect(byOptionKeyOn('sparks=rare,moss-roads', { sparks: 'rare' })).toBe(false);
    expect(byOptionKeyOn('sparks=rare, sparks=relics', { sparks: 'relics' })).toBe(true);
    expect(byOptionKeyOn('', {})).toBe(false);
  });

  // Purpose: a rules set's comma key (in a section or at the top) applies under any of its choices.
  it("a rules set's comma key applies", () => {
    const rules = { light: { torchTurns: 6, byOption: { 'sparks=rare,sparks=relics': { torchTurns: 4 } } } };
    expect((resolveRules(rules, { sparks: 'relics' }).light as { torchTurns: number }).torchTurns).toBe(4);
    expect((resolveRules(rules, { sparks: 'common' }).light as { torchTurns: number }).torchTurns).toBe(6);
  });

  // Purpose: a race's comma key applies under any of its choices, and the checker reads each part.
  it("a race's comma key applies and is checked part by part", () => {
    const race = { name: 'Moss folk', abilities: [], byOption: { 'sparks=rare,sparks=relics': { abilities: [{ name: 'Spark sense' }] } } };
    expect((raceInPlay(race, { sparks: 'rare' }).abilities as unknown[]).length).toBe(1);
    expect((raceInPlay(race, { sparks: 'common' }).abilities as unknown[]).length).toBe(0);
    const option = { kind: 'option', packEntryId: 'sparks', data: { choices: [{ id: 'common' }, { id: 'rare' }, { id: 'relics' }] } };
    expect(raceOptionNotes([option, { kind: 'race', packEntryId: 'moss-folk', data: race }])).toEqual([]);
    const typo = { ...race, byOption: { 'sparks=rare,sparks=relix': {} } };
    expect(raceOptionNotes([option, { kind: 'race', packEntryId: 'moss-folk', data: typo }])).toEqual(['races: "moss-folk": byOption "sparks=rare,sparks=relix": "relix" isn\'t one of that option\'s choices.']);
    const bare = { ...race, byOption: { 'sparks=rare,moss-roads': {} } };
    expect(raceOptionNotes([option, { kind: 'race', packEntryId: 'moss-folk', data: bare }])).toEqual(['races: "moss-folk": byOption "sparks=rare,moss-roads" should be written "<option>=<choice>".']);
  });
});
