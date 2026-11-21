// The in-app editor's model: which fields each kind has, reading and writing them into the pack format, and
// checking an entry before it's saved. Invented content only.
import { describe, expect, it } from 'vitest';
import { checkEntry, EDITABLE, fieldsOf, keptAsIs, namesToIds, newEntryId, readMoney, readTags, setAt, showMoney, valueAt } from './editor.ts';

describe('the editor model', () => {
  it('covers every kind: 7a, 7b, and tables, treasure types, rules sets, optional rules, hooks and sheet layouts (7c)', () => {
    expect(EDITABLE).toEqual([
      'item', 'statBlock', 'condition', 'lightType', 'xpTable',
      'class', 'race', 'spell', 'spellList', 'startingKit',
      'table', 'treasureType', 'rulesSet', 'option', 'hook', 'fieldTemplate',
    ]);
    expect(fieldsOf('item').map((f) => f.key)).toContain('container.capacityCoin');
  });

  it('reads and writes nested keys, removing empty values and keeping everything else', () => {
    const data = { id: 'sack', name: 'Sack', homebrewNote: 'kept', container: { capacityCoin: 200 } };
    expect(valueAt(data, 'container.capacityCoin')).toBe(200);
    expect(setAt(data, 'container.capacitySlots', 4)).toEqual({ ...data, container: { capacityCoin: 200, capacitySlots: 4 } });
    expect(setAt(data, 'container.capacityCoin', undefined)).toEqual({ id: 'sack', name: 'Sack', homebrewNote: 'kept' });
    expect(setAt(data, 'notes', '')).toEqual(data);
    expect(data.container).toEqual({ capacityCoin: 200 });
  });

  it('money reads as "1 gp, 5 sp" and back', () => {
    expect(readMoney('1 gp, 5 sp')).toEqual({ gp: 1, sp: 5 });
    expect(readMoney('  ')).toBeUndefined();
    expect(readMoney('a few coins')).toBeNull();
    expect(showMoney({ gp: 1, sp: 5 })).toBe('1 gp, 5 sp');
  });

  it('tags read from a comma list', () => {
    expect(readTags('swamp, river,, ')).toEqual(['swamp', 'river']);
    expect(readTags('')).toBeUndefined();
  });

  it('a new entry gets an id from its name, different from any already used for that kind', () => {
    expect(newEntryId('Bog Lurker!', new Set())).toBe('bog-lurker');
    expect(newEntryId('Bog lurker', new Set(['bog-lurker', 'bog-lurker-2']))).toBe('bog-lurker-3');
    expect(newEntryId('Éclair', new Set())).toBe('eclair');
    expect(newEntryId('!!!', new Set())).toBe('entry');
  });

  it('checks an entry: a name, whole numbers where needed, readable formulas, complete rows', () => {
    expect(checkEntry('statBlock', { id: 'bog-lurker', name: 'Bog lurker', hpAverage: 13 })).toEqual([]);
    expect(checkEntry('statBlock', { id: 'bog-lurker', name: ' ' })).toEqual(['Give it a name.']);
    expect(checkEntry('condition', { id: 'dazed', name: 'Dazed', defaultRounds: 1.5 })).toEqual(['Rounds by default must be a whole number.']);
    expect(checkEntry('lightType', { id: 'glow', name: 'Glow', duration: { formula: '2 + strength' } })).toEqual([
      'Lasts must be a whole number or a formula using level (like 2 + level).',
    ]);
    expect(checkEntry('lightType', { id: 'glow', name: 'Glow', duration: { formula: '2 + level' } })).toEqual([]);
    expect(checkEntry('xpTable', { id: 'xp', name: 'XP', levels: [{ level: 2 }] })).toEqual(['Levels, row 1: XP is missing.']);
    expect(checkEntry('item', { id: 'Bad Id', name: 'Rope' })).toEqual(['The id must be lowercase letters, digits and dashes.']);
    expect(checkEntry('item', { id: 'rope', name: 'Rope', value: 'a few coins' })).toEqual(['Value should look like 1 gp, 5 sp.']);
    expect(checkEntry('item', { id: 'rope', name: 'Rope', value: { gp: 1 } })).toEqual([]);
  });

  it('names typed for linked entries become their ids; an unknown name says so', () => {
    const spells = [
      { kind: 'spell' as const, packEntryId: 'glimmer', name: 'Glimmer', data: {} },
      { kind: 'spell' as const, packEntryId: 'mire-light', name: 'Mire light', data: {} },
    ];
    expect(namesToIds('glimmer, Mire Light', 'spell', spells)).toEqual({ ids: ['glimmer', 'mire-light'], unknown: [] });
    expect(namesToIds('Glimmer, Fog', 'spell', spells)).toEqual({ ids: ['glimmer'], unknown: ['Fog'] });
    expect(namesToIds(' ', 'spell', spells)).toEqual({ ids: [], unknown: [] });
  });

  it('tells which parts a form doesn’t show, so they’re kept as they are', () => {
    expect(keptAsIs('class', { id: 'w', name: 'W', hitDie: 'd8', progression: [{ level: 2, xp: 2000 }], weaponsAllowed: { mode: 'any' }, fields: { a: 1 } })).toEqual(['progression', 'weapons allowed']);
    expect(keptAsIs('spell', { id: 's', name: 'S', range: { 'lantern-warden': '30 ft' } })).toEqual(['range (differs by class)']);
  });

  it('checks the 7b kinds: whole numbers in maps, durations, and lists of linked entries', () => {
    expect(checkEntry('race', { id: 'marsh-folk', name: 'Marsh folk', abilityMods: { DEX: 1 }, classes: { 'lantern-warden': 8 } })).toEqual([]);
    expect(checkEntry('race', { id: 'marsh-folk', name: 'Marsh folk', abilityMods: { DEX: 'one' } })).toEqual(['Ability changes: DEX must be a whole number.']);
    expect(checkEntry('race', { id: 'marsh-folk', name: 'Marsh folk', classes: { 'lantern-warden': 'any' } })).toEqual(['Classes it can be: each needs a whole number.']);
    expect(checkEntry('spell', { id: 'glimmer', name: 'Glimmer', duration: { formula: '2 + level', unit: 'turn' } })).toEqual([]);
    expect(checkEntry('spell', { id: 'glimmer', name: 'Glimmer', duration: { value: 'long', unit: 'turn' } })).toEqual([
      'Duration must be a whole number or a formula using level (like 2 + level).',
    ]);
    expect(checkEntry('spellList', { id: 'l', name: 'Warden spells', levels: [{ level: 1, spells: ['glimmer'] }] })).toEqual([]);
    expect(checkEntry('spellList', { id: 'l', name: 'Warden spells', levels: [{ level: 1, spells: 'Glimmer, Fog' }] })).toEqual([
      'Levels, row 1: Spells has a name that isn’t in these setting rules.',
    ]);
    expect(checkEntry('startingKit', { id: 'k', name: 'Kit', classIds: 'Warden', items: [{ itemId: 'rope', qty: 1 }] })).toEqual([
      'For classes has a name that isn’t in these setting rules.',
    ]);
  });

  it('a table’s rows depend on its kind: ranges for a plain table, keys for a lookup, kept as they are for a matrix', () => {
    const columns = (data: Record<string, unknown>) => fieldsOf('table', data).find((f) => f.key === 'rows');
    expect(columns({ id: 't', die: 'd6' })).toMatchObject({ columns: [{ key: 'min' }, { key: 'max' }, { key: 'result' }, { key: 'count' }, { key: 'statBlockId' }] });
    expect(columns({ id: 't', kind: 'lookup' })).toMatchObject({ columns: [{ key: 'key' }, { key: 'value' }] });
    expect(columns({ id: 't', kind: 'matrix' })).toBeUndefined();
    expect(keptAsIs('table', { id: 't', name: 'Hits', kind: 'matrix', rows: [{ level: '1', results: ['10'] }], columns: ['AC 0'] })).toEqual(['kind', 'rows', 'columns']);
  });

  it('checks tables: a result on every row, ranges optional', () => {
    expect(checkEntry('table', { id: 't', name: 'Surprise', die: 'd6', rows: [{ min: 1, max: 2, result: 'Surprised' }, { result: 'Calm' }] })).toEqual([]);
    expect(checkEntry('table', { id: 't', name: 'Surprise', die: 'd6', rows: [{ min: 1, max: 2 }] })).toEqual(['Rows, row 1: Result is missing.']);
  });

  it('a treasure type, a hook or a sheet layout needs no name (a letter or id will do)', () => {
    expect(checkEntry('treasureType', { id: 'tt-k', letter: 'K', entries: [{ chance: 40, amount: '2d6 coins' }] })).toEqual([]);
    expect(checkEntry('hook', { id: 'h1', kind: 'warn', when: 'equip', message: 'Heavy.' })).toEqual([]);
    expect(checkEntry('fieldTemplate', { id: 'six', fields: [{ key: 'STR', label: 'STR', showOnCard: true }] })).toEqual([]);
  });

  it('an optional rule’s default must be one of its choices, and choice ids must be valid', () => {
    const rule = { id: 'oil', name: 'Lanterns need oil', default: 'on', changeLater: 'warn', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] };
    expect(checkEntry('option', rule)).toEqual([]);
    expect(checkEntry('option', { ...rule, default: 'maybe' })).toEqual(['The default must be one of its choices.']);
    expect(checkEntry('option', { ...rule, choices: [{ id: 'On!', name: 'Yes' }, { id: 'off', name: 'No' }], default: 'On!' })).toEqual(['Choices, row 1: the id must be lowercase letters, digits and dashes.']);
    expect(checkEntry('option', { ...rule, choices: [] })).toEqual(['Give it at least two choices.']);
  });

  it('a rules set’s form covers time, currencies and starting money; everything else is kept', () => {
    expect(checkEntry('rulesSet', { id: 'house', name: 'House rules', time: { roundSeconds: 6, turnMinutes: 10 }, currency: [{ key: 'gp', label: 'Gold', valueInBase: 1, countsForWeight: true }] })).toEqual([]);
    expect(keptAsIs('rulesSet', { id: 'house', name: 'House rules', time: { roundSeconds: 6 }, encumbrance: { mode: 'coin' }, xp: { split: 'even' } })).toEqual(['encumbrance', 'xp']);
  });

  it('accepts what real packs hold: empty values as null, text where a number could be, values per class, abilities without levels', () => {
    expect(checkEntry('lightType', { id: 'candle', name: 'Candle', duration: 'permanent', warnAt: null })).toEqual([]);
    expect(checkEntry('condition', { id: 'asleep', name: 'Asleep', defaultRounds: null })).toEqual([]);
    expect(checkEntry('spell', { id: 's', name: 'Ward', duration: { 'lantern-warden': { value: 6, unit: 'turn' }, 'reed-witch': { formula: 'level', unit: 'turn' } } })).toEqual([]);
    expect(keptAsIs('spell', { id: 's', name: 'Ward', duration: { 'lantern-warden': { value: 6, unit: 'turn' } } })).toEqual(['duration (differs by class)']);
    expect(checkEntry('class', { id: 'w', name: 'Warden', abilities: [{ name: 'Lamp lore', note: 'Knows flames.' }, { name: 'Wick sense' }] })).toEqual([]);
    expect(checkEntry('xpTable', { id: 'warden-xp', levels: [{ level: 2, xp: 2000 }] })).toEqual([]);
    expect(checkEntry('table', { id: 't', name: 'Lookup', kind: 'lookup', rows: [{ key: 'a', values: ['1', '2'] }] })).toEqual([]);
  });
});

