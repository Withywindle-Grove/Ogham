// A kindred's creation tables, pure (cs-1; kindredTables.ts), and creation.redo taking the trinket with its kindred
// (redo.ts). Invented snippets; every name and number is invented.
import { describe, expect, it } from 'vitest';
import { cleanDetails, detailLines, usualDiceLine, usualOf, detailsEmpty, detailsOf, detailsStepExists, fromLabel, kindredTables, nameColumns, nameFrom, nameTablesOf, physicalOf, rowFor, shortTableName, trinketOf, DETAILS_KEY } from './kindredTables.ts';
import { redoRecord } from './redo.ts';

const table = (id: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ packEntryId: id, name: `Moss kin ${id}`, data: { die: 'd4', rows, ...extra } });
const looks = table('looks', [{ min: 1, max: 2, result: 'Green ears' }, { min: 3, max: 4, result: 'Bark skin' }]);
const names = table('names', [{ min: 1, max: 1, result: 'Fern, Dewdrop', cells: ['Fern', 'Dewdrop'] }, { min: 2, max: 2, result: 'Ash, Puddle', cells: ['Ash', 'Puddle'] }], { columns: ['First name', 'Surname'] });
const trinkets = table('trinkets', Array.from({ length: 15 }, (_, n) => ({ min: n * 2 + 1, max: n * 2 + 2, result: `Thing ${n + 1}` })), { die: 'd30' });
const moss = { name: 'Moss kin', data: { tables: { names: 'names', trinket: 'trinkets', details: ['looks', 'gone'], growth: 'missing' }, age: '2d6 years', weight: '' } };

describe('the tables a kindred points at (cs-1)', () => {
  it('reads names, trinket and details from the tables in play; an id with no table is left out', () => {
    const found = kindredTables(moss, [looks, names, trinkets]);
    expect(found.names?.columns).toEqual(['First name', 'Surname']);
    expect(found.trinket?.rows).toHaveLength(15);
    expect(found.details.map((t) => t.id)).toEqual(['looks']);
    expect(found.growth).toBeNull();
  });

  it('a table switched off by an option (not in play) is not offered; a kindred without tables has none', () => {
    expect(kindredTables(moss, [names]).details).toEqual([]);
    expect(kindredTables({ data: {} }, [looks, names])).toEqual({ names: null, trinket: null, details: [], growth: null });
  });

  it('the Details step exists for detail tables, a growth, or age, height and weight dice alone; not for nothing', () => {
    const none = kindredTables({ data: {} }, []);
    expect(detailsStepExists({ data: { age: '1d6 years' } }, none)).toBe(true);
    expect(detailsStepExists({ data: {} }, none)).toBe(false);
    expect(physicalOf(moss)).toEqual([{ key: 'age', label: 'Age', dice: '2d6 years' }]);
  });
});

describe('rolls and names', () => {
  it('a typed roll lands on the row covering it; a number on no row lands nowhere', () => {
    const found = kindredTables(moss, [trinkets]).trinket!;
    expect(found.rows[rowFor(found, 11)]!.text).toBe('Thing 6');
    expect(rowFor(found, 31)).toBe(-1);
  });

  it('a name is made from a cell tapped in each column, in column order; a one-column table is its rows', () => {
    const found = kindredTables(moss, [names]).names!;
    expect(nameColumns(found).map((c) => [c.heading, c.cells.map((x) => x.text)])).toEqual([
      ['First name', ['Fern', 'Ash']],
      ['Surname', ['Dewdrop', 'Puddle']],
    ]);
    expect(nameFrom(['Ash', 'Dewdrop'])).toBe('Ash Dewdrop');
    expect(nameFrom([undefined, 'Puddle'])).toBe('Puddle');
    const plain = kindredTables({ data: { tables: { names: 'plain' } } }, [table('plain', [{ min: 1, max: 4, result: 'Moss' }])]).names!;
    expect(nameColumns(plain)).toEqual([{ heading: 'Name', cells: [{ row: 0, text: 'Moss' }] }]);
  });

  it("a detail table's name drops the kindred's in front", () => {
    expect(shortTableName('Moss kin looks', 'Moss kin')).toBe('Looks');
    expect(shortTableName('Looks', 'Moss kin')).toBe('Looks');
  });
});

describe('the details as kept on the fields', () => {
  it('round-trip: blanks dropped, words trimmed; nothing filled is empty', () => {
    const saved = cleanDetails({ tables: { looks: ' Green ears ', manner: '' }, age: ' 12 years ', height: '', growth: ['', 'Lichen'] });
    expect(saved).toEqual({ tables: { looks: 'Green ears' }, age: '12 years', growth: ['Lichen'] });
    expect(detailsOf({ [DETAILS_KEY]: saved, LORE: 13 })).toEqual(saved);
    expect(detailsEmpty({ tables: { looks: '  ' }, age: '' })).toBe(true);
    expect(detailsOf({})).toEqual({ tables: {} });
  });

  it("the review's and sheet's lines follow the step's order; a table the kindred no longer has isn't shown", () => {
    const found = kindredTables(moss, [looks]);
    const lines = detailLines({ tables: { looks: 'Bark skin', 'old-table': 'Kept but hidden' }, age: '12 years' }, found, physicalOf(moss), 'Moss kin');
    expect(lines).toEqual([
      { key: 'looks', label: 'Looks', value: 'Bark skin' },
      { key: 'age', label: 'Age', value: '12 years' },
    ]);
  });
});

describe('the trinket and a change of kindred (creation.redo)', () => {
  const creation = { bought: [{ label: 'Fen kit', price: 0, lines: [{ id: 'line-kit', qty: 1 }] }], trinket: { tableId: 'trinkets', text: 'Thing 6', lineId: 'line-trinket', rolled: 11 } };
  const choice = { classRef: 'warden', raceRef: 'stone-kin', method: null, rolled: {}, scores: {} };

  it('the trinket record is read back, with the number rolled', () => {
    expect(trinketOf(creation)).toEqual({ tableId: 'trinkets', text: 'Thing 6', lineId: 'line-trinket', rolled: 11 });
    expect(trinketOf({ trinket: { tableId: 'x' } })).toBeNull();
  });

  it('a new kindred takes the trinket out with the kit; a new class alone keeps it', () => {
    const raceChange = redoRecord(creation, choice, true, true);
    expect(raceChange.lines).toEqual(['line-kit', 'line-trinket']);
    expect(raceChange.creation.trinket).toBeUndefined();
    const classChange = redoRecord(creation, choice, true, false);
    expect(classChange.lines).toEqual(['line-kit']);
    expect(classChange.creation.trinket).toEqual(creation.trinket);
  });
});

// Creation tables from any attached pack (ct-3 … ct-7, design/rulings/m5b-creation-tables-2026-11-06.md, G-201, G-192):
// an invented "Table Kit" homebrew pack with "Fen names" (first and second halves of one word), "Quirks" and "Pocket
// finds", and a second pack lower in the GM's order offering names too.
describe('creation tables from any attached pack (ct-3 … ct-7)', () => {
  const kit = (id: string, uses: unknown, extra: Record<string, unknown> = {}, packId = 'table-kit') => ({ ...table(id, [{ min: 1, max: 4, result: `${id} row`, cells: ['Adder', 'ley'] }], { uses, gmOnly: false, ...extra }), name: id, packId });
  const fenNames = kit('Fen names', ['creation.names'], { columns: ['First half', 'Second half'], join: '' });
  const quirks = kit('Quirks', 'creation.details');
  const finds = kit('Pocket finds', ['treasure', 'creation.trinket']);
  const otherNames = kit('Marsh names', ['creation.names'], {}, 'marsh-pack');
  const packs = [
    { packId: 'table-kit', name: 'Table Kit' },
    { packId: 'marsh-pack', name: 'Marsh pack' },
  ];

  it("a race with no tables of its own is offered an attached pack's names, details and trinket, each marked optional with its pack", () => {
    const found = kindredTables({ data: {} }, [fenNames, quirks, finds], packs);
    expect([found.names?.name, found.trinket?.name, found.details.map((t) => t.name)]).toEqual(['Fen names', 'Pocket finds', ['Quirks']]);
    expect([found.names, found.trinket, ...found.details].map((t) => fromLabel(t!))).toEqual(['Optional, from Table Kit', 'Optional, from Table Kit', 'Optional, from Table Kit']);
    expect(found.growth).toBeNull();
  });

  it("a race with its own names keeps them (no label) and still gets the pack's details; its own details win whole", () => {
    const found = kindredTables({ data: { tables: { names: 'names' } } }, [names, fenNames, quirks], packs);
    expect(found.names?.id).toBe('names');
    expect(fromLabel(found.names!)).toBeUndefined();
    expect(found.details.map((t) => t.name)).toEqual(['Quirks']);
    expect(kindredTables(moss, [looks, quirks], packs).details.map((t) => t.id)).toEqual(['looks']);
  });

  // G-203 (ruled 2026-11-07, a): an overlay pack binds a slot table to kindreds with `forRaces`.
  describe('a slot table bound to kindreds (forRaces, G-203)', () => {
    const otter = { packEntryId: 'otter-kin', data: {} };
    const otterNames = kit('Otter names', ['creation.names'], { forRaces: ['otter-kin'] }, 'marsh-pack');
    const otterLooks = kit('Otter looks', 'creation.details', { forRaces: 'otter-kin' }, 'marsh-pack');
    const heronNames = kit('Heron names', ['creation.names'], { forRaces: ['heron-kin'] });

    // Purpose: a table bound to this kindred beats the unbound offers, slot by slot, even from a pack lower in the GM's
    // order, and says where it's from; slots it doesn't bind still take the unbound offer.
    it('a bound table beats an unbound one per slot, marked optional with its pack', () => {
      const found = kindredTables(otter, [fenNames, quirks, finds, otterNames, otterLooks], packs);
      expect(found.names?.name).toBe('Otter names');
      expect(fromLabel(found.names!)).toBe('Optional, from Marsh pack');
      expect(found.moreNames).toBeUndefined();
      expect(found.details.map((t) => t.name)).toEqual(['Otter looks']);
      expect(found.trinket?.name).toBe('Pocket finds');
      expect(fromLabel(found.trinket!)).toBe('Optional, from Table Kit');
    });

    // Purpose: a table bound to another kindred is never offered, not even as the unbound fallback.
    it('a table bound to another kindred is ignored', () => {
      expect(kindredTables(otter, [heronNames], packs).names).toBeNull();
      expect(kindredTables(otter, [heronNames, fenNames], packs).names?.name).toBe('Fen names');
      expect(kindredTables({ packEntryId: 'heron-kin', data: {} }, [heronNames, fenNames], packs).names?.name).toBe('Heron names');
    });

    // Purpose (Design, 2026-11-07): the kindred's own tables and the bound ones both show, its own first and unmarked,
    // the bound ones after as "Optional, from <pack>"; the unbound offers stay out; one trinket, its own.
    it('the kindred’s own tables come first and the bound ones follow, optional; the unbound ones stay out', () => {
      const ownTrinket = { ...trinkets, packEntryId: 'own-trinket' };
      const otterFinds = kit('Otter finds', 'creation.trinket', { forRaces: ['otter-kin'] }, 'marsh-pack');
      const found = kindredTables({ packEntryId: 'otter-kin', data: { tables: { names: 'names', details: ['looks'], trinket: 'own-trinket' } } }, [names, looks, ownTrinket, otterNames, otterLooks, otterFinds, fenNames, quirks], packs);
      expect(nameTablesOf(found).map((t) => [t.id, fromLabel(t) ?? null])).toEqual([
        ['names', null],
        ['Otter names', 'Optional, from Marsh pack'],
      ]);
      expect(found.details.map((t) => [t.id, fromLabel(t) ?? null])).toEqual([
        ['looks', null],
        ['Otter looks', 'Optional, from Marsh pack'],
      ]);
      expect(found.trinket?.id).toBe('own-trinket');
    });
  });

  it("two packs offering one slot: the higher in the GM's order wins; a table in no attached pack, or with no slot, isn't offered", () => {
    expect(kindredTables({ data: {} }, [otherNames, fenNames], packs).names?.name).toBe('Fen names');
    expect(kindredTables({ data: {} }, [otherNames, fenNames], [...packs].reverse()).names?.name).toBe('Marsh names');
    expect(kindredTables({ data: {} }, [{ ...fenNames, packId: 'gone' }, kit('Plain', ['treasure'])], packs)).toEqual({ names: null, trinket: null, details: [], growth: null });
  });

  it("a pack offering several name tables (first names and surnames) offers them all, in its order; a kindred's own names still win alone (after-test A5)", () => {
    const heron = kit('Heron first names', ['creation.names']);
    const surnames = kit('Fen surnames', ['people.names', 'creation.names']);
    const found = kindredTables({ data: {} }, [heron, fenNames, surnames], packs);
    expect(nameTablesOf(found).map((t) => t.name)).toEqual(['Heron first names', 'Fen names', 'Fen surnames']);
    expect(nameTablesOf(found).map((t) => fromLabel(t))).toEqual(['Optional, from Table Kit', 'Optional, from Table Kit', 'Optional, from Table Kit']);
    const own = kindredTables({ data: { tables: { names: 'names' } } }, [names, heron, surnames], packs);
    expect(nameTablesOf(own).map((t) => t.id)).toEqual(['names']);
    expect(nameTablesOf(kindredTables({ data: {} }, [quirks], packs))).toEqual([]);
  });

  it('without a race, nothing is offered (creation has no kindred to roll for yet)', () => {
    expect(kindredTables(null, [fenNames], packs).names).toBeNull();
  });

  it('a two-column name table with join "" gives one word; without join, a space; a join that is not text reads as a space', () => {
    const found = kindredTables({ data: {} }, [fenNames], packs).names!;
    expect(nameFrom(['Adder', 'ley'], found.join)).toBe('Adderley');
    expect(kindredTables({ data: {} }, [kit('Fen names', ['creation.names'])], packs).names!.join).toBe(' ');
    expect(kindredTables({ data: {} }, [kit('Fen names', ['creation.names'], { join: 3 })], packs).names!.join).toBe(' ');
    expect(nameFrom(['Adder', 'ley'])).toBe('Adder ley');
  });

  it('with join "", printed halves lose one hyphen at each seam ("Adder-" + "-bald" is "Adderbald"); a cell without one is kept', () => {
    expect(nameFrom(['Adder-', '-bald'], '')).toBe('Adderbald');
    expect(nameFrom(['Adder-', 'ley'], '')).toBe('Adderley');
    expect(nameFrom(['Rush', '-wick'], '')).toBe('Rushwick');
    expect(nameFrom(['Adder--', '--bald'], '')).toBe('Adder--bald');
    expect(nameFrom(['-Adder-'], '')).toBe('-Adder-');
    expect(nameFrom(['Adder-', '-bald'], ' ')).toBe('Adder- -bald');
  });
});

// Purpose (final drafts D, the plan's ⚑ 2): each Body card names its own dice, built from the pack's usual and never
// from its words; a part with a base and no dice says the unit only. The average flag survives a save and a read,
// and goes with a value that's cleared; the review says it in words.
describe('the Body cards (final drafts D)', () => {
  const race = (usual: Record<string, unknown>) => ({ data: { usual } });
  // D4 (dec-10 D, cs-8): the unit is said once, beside the stepper, so the line names the dice alone (a height's dice
  // keep their inches, as its base is in feet); a part with no dice says nothing after "Average".
  it('reads each card’s dice line from the usual', () => {
    expect(usualDiceLine('age', usualOf(race({ age: { base: 18, dice: '1d6', unit: 'years' } }), 'age')!)).toBe('1d6 + 18');
    expect(usualDiceLine('height', usualOf(race({ height: { base: 60, dice: '2d6', unit: 'in' } }), 'height')!)).toBe('5 ft + 2d6 in');
    expect(usualDiceLine('weight', usualOf(race({ weight: { base: 120, dice: '2d6', times: 5, unit: 'lb' } }), 'weight')!)).toBe('2d6 × 5 + 120');
    expect(usualDiceLine('age', usualOf(race({ age: { base: 30, unit: 'years' } }), 'age')!)).toBe('');
    expect(usualDiceLine('height', usualOf(race({ height: { variants: [{ label: 'Tall', base: 64, dice: '2d6' }, { label: 'Short', base: 48, dice: '1d6' }], unit: 'in' } }), 'height')!)).toBe('Tall: 5 ft 4 in + 2d6 in; Short: 4 ft + 1d6 in');
  });

  it('keeps the average flag through a save, drops it with the value, and says it on the review', () => {
    const saved = cleanDetails({ tables: {}, age: '21', weight: '', averaged: ['age', 'weight'] });
    expect(saved).toEqual({ tables: {}, age: '21', averaged: ['age'] });
    expect(detailsOf({ [DETAILS_KEY]: saved })).toEqual(saved);
    const lines = detailLines(saved, { names: [], trinket: null, details: [], growth: null } as never, [{ key: 'age', label: 'Age' }]);
    expect(lines).toEqual([{ key: 'age', label: 'Age', value: '21, the average, not rolled' }]);
  });
});
