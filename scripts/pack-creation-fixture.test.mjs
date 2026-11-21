// The invented creation fixture pack (scripts/fixtures/m5b-creation.fixture.json; M5b step 0c, slice 1) against the
// pack checker's creation-rules checks (scripts/pack-creation.mjs, the pack session's #255): every creation rule as
// data, clean, so the app's creation steps can be tested on it before the real packs land. Every name is invented.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { creationCounts, creationNotes } from './pack-creation.mjs';
import { formatNotes } from './pack-format.mjs';

const fixture = 'scripts/fixtures/m5b-creation.fixture.json';
const sample = () => JSON.parse(readFileSync(fixture, 'utf8'));

describe('the invented creation fixture pack', () => {
  it('writes every creation rule as data and gets no note from the checker', () => {
    expect(creationNotes(sample())).toEqual([]);
    expect(formatNotes(sample())).toEqual([]);
  });

  it('holds a scores block, the trade as data, a languages list, a hidden alignment, tagged abilities and fill marks', () => {
    expect(creationCounts(sample())).toMatchObject({
      'rules sets with scores': 1,
      'rules sets with ability adjustment as data': 1,
      'rules sets with a languages list': 1,
      'rules sets hiding alignment': 1,
      'sheet fields with fill': 8,
    });
  });

  it('holds a hit-points re-roll behind an option, and a no-shop setting with given gear through byOption (follow-up A)', () => {
    expect(creationCounts(sample())).toMatchObject({
      'rules sets with a hit-points re-roll': 1,
      'rules sets with starting equipment': 1,
      'rules sets without a shop (some or all of the time)': 1,
    });
    const rules = sample().rulesSets[0];
    expect(rules.hitPoints).toMatchObject({ startMinimum: 1, minimumPerDie: 1, reroll: { atMost: 2, option: 'fen-second-wind' } });
    expect(rules.byOption['fen-market=off']).toEqual({ startingGear: { shop: false }, startingEquipment: ['rope-reed', 'storm-lantern'] });
  });

  it('runs inside npm run pack:check with no notes, no warnings and nothing left out', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', fixture], { encoding: 'utf8' });
    expect(out).toMatch(/rules sets with scores: 1/);
    expect(out).not.toMatch(/Format notes|Good to know|Left out|The editor would ask/);
  });

  it('a copy without the scores block gets the one note the Scores step needs', () => {
    const pack = sample();
    delete pack.rulesSets[0].scores;
    expect(creationNotes(pack)).toEqual([expect.stringMatching(/scores/)]);
  });

  // First spells from a table (design/rulings/m5b-0c-first-spells-table-2026-11-02.md, fs-1 … fs-3).
  it("a roll table a player can't read (no gmOnly: false) is named: the step can't show it", () => {
    const pack = sample();
    delete pack.tables.find((t) => t.id === 'first-whispers').gmOnly;
    expect(formatNotes(pack)).toEqual([
      'classes: "reed-witch": firstSpells.rollTable "first-whispers" is a table players can\'t read; write "gmOnly": false on the table so the First spells step can show it.',
      'classes: "fen-cantor": firstSpells.rollTable "first-whispers" is a table players can\'t read; write "gmOnly": false on the table so the First spells step can show it.',
    ]);
  });

  it('a roll table row without spells warns, with the count', () => {
    const pack = sample();
    const table = pack.tables.find((t) => t.id === 'first-charms');
    delete table.rows[0].spells;
    table.rows[1].spellId = table.rows[1].spells[0];
    delete table.rows[1].spells;
    expect(formatNotes(pack)).toEqual(['classes: "fen-cantor": firstSpells.rollTable "first-charms": 2 rows without spells (a list of spell ids); the step reads nothing else.']);
  });

  it('rollTable takes one id or a list; anything else gets the shape note', () => {
    const pack = sample();
    pack.classes.find((c) => c.id === 'fen-cantor').spellcasting.firstSpells.rollTable = { table: 'first-charms' };
    expect(formatNotes(pack)).toEqual([
      'classes: "fen-cantor": spellcasting.firstSpells should be { choose?: <number>, given?: [spell ids], rollTable?: <table id> | [<table ids>] } (at least one).',
    ]);
    const missing = sample();
    missing.classes.find((c) => c.id === 'reed-witch').spellcasting.firstSpells.rollTable = 'first-omens';
    expect(formatNotes(missing)).toEqual(['classes: "reed-witch": firstSpells.rollTable "first-omens" isn\'t a table in this pack (fine if another attached pack has it, marked "gmOnly": false).']);
  });
});
