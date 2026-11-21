// The one option reader (of-3, of-9, of-10), on invented entries: always runs (the real packs are checked in
// optionsAudit.realPacks.test.ts, locally).
import { describe, expect, it } from 'vitest';
import { applyByOption, entriesInPlay, fieldForCharacter, fieldsAddedBy, fieldsFor, fieldsInPlay, fieldsOff, fieldsOffFor, mergeOver, optionGate, optionSpecOn, specOptions } from './optionGate.ts';
import { entryOptionOn, resolveRules } from './options.ts';

describe('optionSpecOn: one way to read an option spec', () => {
  // Purpose: every spelling the packs use ("id", "id=choice", "id:choice") reads the same, and no spec is on.
  it('reads every spelling the same way', () => {
    const choices = { 'lantern-oil': 'on', 'bog-roads': 'sunken' };
    expect(optionSpecOn('', choices)).toBe(true);
    expect(optionSpecOn(undefined, choices)).toBe(true);
    expect(optionSpecOn('lantern-oil', choices)).toBe(true);
    expect(optionSpecOn('lantern-oil=on', choices)).toBe(true);
    expect(optionSpecOn(' bog-roads = sunken ', choices)).toBe(true);
    expect(optionSpecOn('bog-roads:sunken', choices)).toBe(true);
    expect(optionSpecOn('bog-roads=dry', choices)).toBe(false);
    expect(optionSpecOn('bog-roads', choices)).toBe(false);
  });

  // Purpose: an entry tied to an option the campaign doesn't have never appears.
  it('an option the campaign does not have is off', () => {
    expect(optionSpecOn('reed-boats', {})).toBe(false);
    expect(specOptions('reed-boats=on')).toEqual(['reed-boats']);
  });

  // Purpose: the older reader (creation's classes and kits) now gives exactly the shared reader's answer.
  it('entryOptionOn agrees with the shared reader', () => {
    const choices = { 'reed-boats': 'on' };
    for (const data of [{}, { option: 'reed-boats' }, { onlyWithOption: 'reed-boats:off' }, { option: 'reed-boats=on', onlyWithOption: 'x' }]) {
      expect(entryOptionOn(data, choices)).toBe(optionGate({ kind: 'item', data }, choices).inPlay);
    }
  });
});

describe('optionGate: does this entry exist, and what are its fields now', () => {
  const musket = { kind: 'item', data: { option: 'powder-age=wheel', cost: 40, byOption: { 'powder-age=flint': { cost: 25 } } } };

  // Purpose: an item behind an option's choice exists only for that choice (of-3), and says what turned it off.
  it('an entry exists only while its option is on', () => {
    expect(optionGate(musket, { 'powder-age': 'wheel' }).inPlay).toBe(true);
    const off = optionGate(musket, { 'powder-age': 'none' });
    expect(off.inPlay).toBe(false);
    expect(off.offBy).toBe('powder-age=wheel');
  });

  // Purpose: an entry's fields follow the campaign's choice (byOption on any entry, of-3), and byOption itself goes.
  it("an entry's byOption gives its fields under the choice", () => {
    const klass = { kind: 'class', data: { name: 'Lantern Warden', armourAllowed: { types: ['light'] }, byOption: { 'heavy-coats=on': { armourAllowed: { types: ['light', 'heavy'] } } } } };
    expect(optionGate(klass, { 'heavy-coats': 'on' }).data.armourAllowed).toEqual({ types: ['light', 'heavy'] });
    const plain = optionGate(klass, { 'heavy-coats': 'off' }).data;
    expect(plain.armourAllowed).toEqual({ types: ['light'] });
    expect(plain.byOption).toBeUndefined();
  });

  // Purpose: a choice that sets a section to null removes it, so every screen treats it as absent (of-10).
  it('a null section in byOption is off', () => {
    const kit = { kind: 'startingKit', data: { items: ['rope'], morale: { note: 'x' }, byOption: { 'calm-crew=on': { morale: null } } } };
    expect('morale' in optionGate(kit, { 'calm-crew': 'on' }).data).toBe(false);
    expect(optionGate(kit, { 'calm-crew': 'off' }).data.morale).toEqual({ note: 'x' });
    expect(mergeOver({ a: { b: 1, c: 2 } }, { a: { b: null } })).toEqual({ a: { c: 2 } });
  });

  // Purpose: a rules set's null section is off too, at the top and inside a section (the same rule as entries).
  it("a rules set's null section is off", () => {
    const rules = { morale: { note: 'x' }, death: { at: 0, dying: { startAt: 0 } }, byOption: { 'calm-crew=on': { morale: null } } };
    expect('morale' in resolveRules(rules, { 'calm-crew': 'on' })).toBe(false);
    expect(resolveRules(rules, { 'calm-crew': 'off' }).morale).toEqual({ note: 'x' });
    const inner = { death: { at: 0, dying: { startAt: 0 }, byOption: { 'quick-end=on': { dying: null } } } };
    expect(resolveRules(inner, { 'quick-end': 'on' }).death).toEqual({ at: 0 });
  });

  // Purpose: a class's optional weapons count only while their option is on (the audit's arcane staves row).
  it("a class's optional weapons go when their option is off", () => {
    const klass = { kind: 'class', data: { weaponsAllowed: { mode: 'list', ids: ['dagger'], optional: { ids: ['staff'], option: 'warden-staves' } } } };
    expect(optionGate(klass, { 'warden-staves': 'on' }).data.weaponsAllowed).toEqual(klass.data.weaponsAllowed);
    expect(optionGate(klass, { 'warden-staves': 'off' }).data.weaponsAllowed).toEqual({ mode: 'list', ids: ['dagger'] });
  });

  // Purpose: races and rules sets keep their own byOption reading, so the generic merge never runs on them twice.
  it('races, rules sets and options are left to their own readers', () => {
    for (const kind of ['race', 'rulesSet', 'option']) {
      const entry = { kind, data: { byOption: { 'x=on': { a: 1 } } } };
      expect(optionGate(entry, { x: 'on' }).data).toBe(entry.data);
    }
  });

  // Purpose: an entry with nothing to resolve comes back as the same object (no needless copies on every read).
  it('an entry with no option and no byOption is the same object', () => {
    const entry = { kind: 'spell', data: { level: 1 } };
    expect(optionGate(entry, {}).data).toBe(entry.data);
    expect(applyByOption(entry.data, undefined, {})).toBe(entry.data);
  });

  // Purpose: a byOption key that names no choice ("lantern-oil") is never applied (only "<option>=<choice>" keys are).
  it('a byOption key without a choice is not applied', () => {
    expect(applyByOption({ a: 1 }, { 'lantern-oil': { a: 2 } }, { 'lantern-oil': 'on' })).toEqual({ a: 1 });
  });

  // Purpose: lists keep only the entries in play; marked entries stay findable by id for what characters already have.
  it('entriesInPlay drops the entries an option switched off', () => {
    const entries = [{ id: 'a' }, { id: 'b', optionOff: 'powder-age=wheel' }, { id: 'c', optionOff: '' }];
    expect(entriesInPlay(entries).map((e) => e.id)).toEqual(['a', 'c']);
  });
});

describe('sheet fields behind an option (of-9)', () => {
  const entries = [
    { kind: 'traitList', packEntryId: 'reed-trades', data: { option: 'reed-trades' }, optionOff: 'reed-trades' },
    {
      kind: 'fieldTemplate',
      packEntryId: 'sheet',
      data: {
        fields: [
          { key: 'name', label: 'Name' },
          { key: 'moonMark', label: 'Moon mark', option: 'moon-marks=on' },
          { key: 'trade', label: 'Reed trade', from: 'reed-trades' },
        ],
      },
    },
  ];

  // Purpose: a field whose option is off, or that reads from a list switched off, is hidden; the rest stay in order.
  // Each key is held as the layout writes it and as "Use this sheet layout" makes it (gate check 59).
  it('hides fields whose option is off', () => {
    const off = fieldsOff(entries, { 'moon-marks': 'off' });
    expect([...off].sort()).toEqual(['moonMark', 'moonmark', 'trade']);
    const defs = [{ key: 'name' }, { key: 'moonMark' }, { key: 'trade' }, { key: 'notes' }];
    expect(fieldsInPlay(defs, off).map((f) => f.key)).toEqual(['name', 'notes']);
    expect(fieldsOff(entries, { 'moon-marks': 'on' }).has('moonMark')).toBe(false);
  });

  // Purpose: no layouts (a freeform campaign) hides nothing.
  it('hides nothing without layouts', () => {
    expect(fieldsInPlay([{ key: 'a' }], fieldsOff([], {}))).toEqual([{ key: 'a' }]);
    expect(fieldsInPlay([{ key: 'a' }], undefined)).toEqual([{ key: 'a' }]);
  });

  // Purpose: the option's row in Rules can say which field it adds, by its label.
  it('names the fields an option adds', () => {
    expect(fieldsAddedBy(entries, 'moon-marks')).toEqual(['Moon mark']);
    expect(fieldsAddedBy(entries, 'reed-trades')).toEqual(['Reed trade']);
    expect(fieldsAddedBy(entries, 'lantern-oil')).toEqual([]);
  });
});

describe('fields for some classes or kindreds (cs-3, forClasses, forRaces)', () => {
  const layout = {
    kind: 'fieldTemplate',
    packEntryId: 'fen-sheet',
    data: {
      fields: [
        { key: 'oath', label: 'Oath', forClasses: ['lantern-warden'] },
        { key: 'reedMark', label: 'Reed mark', forRaces: 'stone-kin' },
        { key: 'moonMark', label: 'Moon mark', option: 'moon-marks' },
        { key: 'motto', label: 'Motto' },
      ],
    },
  };

  // Purpose: the layouts' forClasses and forRaces are read by key (one word as a list of one); a field naming neither isn't listed.
  it('reads who each field is for', () => {
    const gates = fieldsFor([layout]);
    expect(gates.get('oath')).toEqual({ classes: ['lantern-warden'], races: [] });
    expect(gates.get('reedMark')).toEqual({ classes: [], races: ['stone-kin'] });
    expect(gates.has('motto')).toBe(false);
    expect(fieldsFor([{ ...layout, optionOff: 'moon-marks' }]).size).toBe(0);
  });

  // Purpose: a field applies only to the listed classes and kindreds; a class or kindred not picked yet hides nothing.
  it('judges a field for one character', () => {
    const gate = { classes: ['lantern-warden'], races: [] };
    expect(fieldForCharacter(gate, { classRef: 'lantern-warden', raceRef: 'bog-folk' })).toBe(true);
    expect(fieldForCharacter(gate, { classRef: 'reed-witch', raceRef: 'bog-folk' })).toBe(false);
    expect(fieldForCharacter(gate, { classRef: null, raceRef: null })).toBe(true);
    expect(fieldForCharacter(gate, null)).toBe(true);
    expect(fieldForCharacter({ classes: [], races: ['stone-kin'] }, { classRef: 'reed-witch', raceRef: 'bog-folk' })).toBe(false);
  });

  // Purpose: the fields hidden for a character are those whose option is off and those not for them, read by fieldsInPlay.
  it('hides option-off fields and fields not for the character in one set', () => {
    const setting = { fieldsOff: fieldsOff([layout], {}), fieldsFor: fieldsFor([layout]) };
    const off = fieldsOffFor(setting, { classRef: 'reed-witch', raceRef: 'bog-folk' });
    expect([...(off ?? [])].sort()).toEqual(['moonMark', 'moonmark', 'oath', 'reedMark', 'reedmark']);
    const defs = ['oath', 'reedMark', 'moonMark', 'motto'].map((key) => ({ key }));
    expect(fieldsInPlay(defs, fieldsOffFor(setting, { classRef: 'lantern-warden', raceRef: 'stone-kin' })).map((f) => f.key)).toEqual(['oath', 'reedMark', 'motto']);
    // No character yet: only the option's.
    expect(fieldsOffFor(setting, null)).toBe(setting.fieldsOff);
  });
});
