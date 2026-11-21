// The pack checker on a kindred's grants and a kindred-class (scripts/pack-format.mjs; 07 "The survey's fields";
// design/rulings/m5b-0c-creation-survey-2026-11-03.md cs-2, cs-4), on invented snippets. Every name is invented.
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';

const pack = (races, extra = {}) => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'glen', name: 'Glen sample', version: '0.1', kind: 'setting' },
  items: [{ id: 'reed-flute', name: 'Reed flute' }],
  tables: [
    { id: 'moss-knacks', name: 'Moss knacks', die: 'd2', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Hum', spells: ['hum'] }, { min: 2, max: 2, result: 'Hush', spells: ['hush'] }] },
    { id: 'glen-secrets', name: 'Glen secrets', die: 'd2', rows: [{ min: 1, max: 2, result: 'Hum', spells: ['hum'] }] },
  ],
  races,
  ...extra,
});
const notesOf = (file) => formatNotes(file).filter((n) => n.startsWith('races:') || n.includes('replacesRaceTraits'));

describe("a kindred's grants (cs-2)", () => {
  it('a kindred rolling on a shared table and giving a known item has nothing to say', () => {
    expect(notesOf(pack([{ id: 'moss-kin', name: 'Moss kin', firstSpells: { rollTable: 'moss-knacks', note: 'One knack.' }, startingItems: ['reed-flute'] }]))).toEqual([]);
  });

  it("a kindred's roll on a table players can't read is named, as a class's is", () => {
    expect(notesOf(pack([{ id: 'moss-kin', name: 'Moss kin', firstSpells: { rollTable: 'glen-secrets' } }]))).toEqual([
      'races: "moss-kin": firstSpells.rollTable "glen-secrets" is a table players can\'t read; write "gmOnly": false on the table so the First spells step can show it.',
    ]);
  });

  it("a kindred's choose isn't read (it has no spell list), and a bad shape or an unknown item is named", () => {
    expect(notesOf(pack([{ id: 'moss-kin', name: 'Moss kin', firstSpells: { choose: 1, given: ['hum'] }, startingItems: ['reed-pipe'] }]))).toEqual([
      'races: "moss-kin": firstSpells.choose isn\'t read: a kindred has no spell list to pick from. Use rollTable (a shared table; "rolled or chosen" is a tap either way) or given.',
      'races: "moss-kin": startingItems names "reed-pipe", which isn\'t an item in this pack (fine if another attached pack has it).',
    ]);
    expect(notesOf(pack([{ id: 'moss-kin', name: 'Moss kin', firstSpells: { note: 'Something.' }, startingItems: 'reed-flute' }]))).toEqual([
      'races: "moss-kin": firstSpells should be { given?: [spell ids], rollTable?: <table id> | [<table ids>], note? } (at least one).',
      'races: "moss-kin": startingItems should be a list of item ids, like ["reed-flute"].',
    ]);
  });
});

describe('a kindred-class (cs-4)', () => {
  it('replacesRaceTraits must be true or false', () => {
    const file = pack([{ id: 'moss-kin', name: 'Moss kin' }], { classes: [{ id: 'moss-kin-calling', name: 'Moss-kin', race: 'moss-kin', replacesRaceTraits: 'yes' }] });
    expect(notesOf(file)).toEqual(["classes: \"moss-kin-calling\": replacesRaceTraits should be true or false (a kindred-class replaces its kindred's traits unless it says false)."]);
  });
});
