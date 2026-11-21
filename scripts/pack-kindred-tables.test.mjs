// The pack checker on a kindred's creation tables (scripts/pack-format.mjs; 07 "The survey's fields";
// design/rulings/m5b-0c-creation-survey-2026-11-03.md cs-1), on invented snippets. Every name is invented.
import { describe, expect, it } from 'vitest';
import { CREATION_STEPS, formatCounts, formatNotes } from './pack-format.mjs';

const shared = (id, extra = {}) => ({ id, name: id, die: 'd2', gmOnly: false, rows: [{ min: 1, max: 1, result: 'One' }, { min: 2, max: 2, result: 'Two' }], ...extra });
const pack = (tables, race) => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'glen', name: 'Glen sample', version: '0.1', kind: 'setting' },
  tables,
  races: [{ id: 'moss-kin', name: 'Moss kin', ...race }],
});
const notesOf = (file) => formatNotes(file).filter((n) => n.startsWith('races:'));

describe("a kindred's creation tables (cs-1)", () => {
  it('a kindred pointing at shared tables, with a two-column name table and its dice, has nothing to say and is counted', () => {
    const names = shared('moss-names', { columns: ['First name', 'Surname'], rows: [{ min: 1, max: 2, result: 'Fern · Dewdrop', cells: ['Fern', 'Dewdrop'] }] });
    const file = pack([names, shared('moss-trinkets'), shared('moss-looks'), shared('moss-growth')], {
      tables: { names: 'moss-names', trinket: 'moss-trinkets', details: ['moss-looks'], growth: 'moss-growth' },
      age: '3d6 years',
      height: '2 ft + 1d6 in',
    });
    expect(notesOf(file)).toEqual([]);
    expect(formatCounts(file)['races with creation tables']).toBe(1);
  });

  it("a table players can't read is named: creation couldn't show it", () => {
    expect(notesOf(pack([shared('moss-looks', { gmOnly: undefined })], { tables: { details: ['moss-looks'] } }))).toEqual([
      'races: "moss-kin": tables.details "moss-looks" is a table players can\'t read; write "gmOnly": false on the table so creation can show it.',
    ]);
  });

  it('an unknown table, an unknown key and a details that is not a list are each named', () => {
    expect(notesOf(pack([], { tables: { trinket: 'nowhere', details: 'moss-looks', hair: 'x' } }))).toEqual([
      'races: "moss-kin": tables.hair isn\'t read (names, trinket, details, growth).',
      'races: "moss-kin": tables.details should be a list of table ids.',
      'races: "moss-kin": tables.trinket "nowhere" isn\'t a table in this pack (fine if another attached pack has it, marked "gmOnly": false).',
    ]);
  });

  it("a name table's row without a cell for each column is named", () => {
    const names = shared('moss-names', { columns: ['First name', 'Surname'], rows: [{ min: 1, max: 2, result: 'Fern' }] });
    expect(notesOf(pack([names], { tables: { names: 'moss-names' } }))).toEqual([
      'races: "moss-kin": tables.names "moss-names": 1 row without one cell per column (2); the Name roll taps a cell in each column.',
    ]);
  });

  it('a pack may name the Details step in creationGuide and creation.require', () => {
    expect(CREATION_STEPS).toContain('details');
  });
});

// Creation slots on a table's uses and a name table's join (ct-5, ct-7, design/rulings/m5b-creation-tables-2026-11-06.md).
describe("a table's creation slot and join (ct-5, ct-7)", () => {
  const kit = (tables, meta = {}) => ({ format: 'tabletop-pack', formatVersion: 2, meta: { id: 'table-kit', name: 'Table Kit', version: '0.1', kind: 'homebrew', ...meta }, tables });
  const tableNotes = (file) => formatNotes(file).filter((n) => n.startsWith('tables:'));

  it('creation-slot tables players can read, with a text join, have nothing to say and are counted', () => {
    const file = kit([
      shared('fen-names', { uses: ['creation.names'], join: '', columns: ['First half', 'Second half'], rows: [{ min: 1, max: 2, cells: ['Adder', 'ley'] }] }),
      shared('quirks', { uses: 'creation.details' }),
      shared('pocket-finds', { uses: ['treasure', 'creation.trinket'] }),
    ]);
    expect(tableNotes(file)).toEqual([]);
    expect(formatCounts(file)['tables offered at creation']).toBe(3);
  });

  it("a creation-slot table players can't read is named: creation couldn't show it", () => {
    expect(tableNotes(kit([shared('quirks', { uses: ['creation.details'], gmOnly: undefined })]))).toEqual([
      'tables: "quirks": creation.details offers it at creation, but players can\'t read it; write "gmOnly": false on the table.',
    ]);
  });

  it('an unknown use is named, with the creation slots when it looks like one; a use the pack declares is known', () => {
    expect(tableNotes(kit([shared('quirks', { uses: ['creation', 'bog.smells'] })]))).toEqual([
      'tables: "quirks": use "creation" isn\'t in the table uses registry or meta.tableUses; it\'s filed under Other. The creation slots are creation.names, creation.details, creation.trinket.',
      'tables: "quirks": use "bog.smells" isn\'t in the table uses registry or meta.tableUses; it\'s filed under Other.',
    ]);
    expect(tableNotes(kit([shared('smells', { uses: ['places.bog-smells', 'encounters.reaction'] })], { tableUses: [{ path: 'places.bog-smells', name: 'Bog smells', group: 'Places' }] }))).toEqual([]);
  });

  // G-203: forRaces binds a creation-slot table to kindreds; an id the pack doesn't have is a note, never an error.
  it('forRaces naming a race the pack lacks is a note; on a table with no creation slot, or not a list of ids, it is named', () => {
    const withRace = (tables) => ({ ...kit(tables), races: [{ id: 'otter-kin', name: 'Otter kin' }] });
    expect(tableNotes(withRace([shared('otter-names', { uses: ['creation.names'], forRaces: ['otter-kin'] })]))).toEqual([]);
    expect(tableNotes(kit([shared('otter-names', { uses: ['creation.names'], forRaces: ['otter-kin'] })]))).toEqual([
      'tables: "otter-names": forRaces "otter-kin" isn\'t a race in this pack (fine if another attached pack has it).',
    ]);
    expect(tableNotes(withRace([shared('otter-smells', { uses: ['places.dressing'], forRaces: 'otter-kin' })]))).toEqual([
      'tables: "otter-smells": forRaces is read only on a table with a creation slot (creation.names, creation.details, creation.trinket).',
    ]);
    expect(tableNotes(withRace([shared('otter-names', { uses: ['creation.names'], forRaces: [3] })]))).toEqual(['tables: "otter-names": forRaces should be a list of race ids.']);
  });

  // R3-2: a table's rollPrompt is the pack's own first line in its sheet; words are fine, anything else is named.
  it('a rollPrompt in words is accepted; one that is not words is named', () => {
    expect(tableNotes(kit([shared('fen-names', { uses: ['creation.names'], rollPrompt: 'Roll d6 twice: a reed name, then a pool name.' })]))).toEqual([]);
    expect(tableNotes(kit([shared('fen-names', { uses: ['creation.names'], rollPrompt: 4 })]))).toEqual([
      `tables: "fen-names": rollPrompt should be words ("Roll d20 twice: a first name, then a house name"); the app's own line is shown instead.`,
    ]);
  });

  it('a join that is not text is named', () => {
    expect(tableNotes(kit([shared('fen-names', { uses: ['creation.names'], join: 0 })]))).toEqual([
      'tables: "fen-names": join should be the words between name columns ("" for two halves of one word, " " for a space); a space is read instead.',
    ]);
  });
});
