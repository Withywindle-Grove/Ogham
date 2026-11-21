// Tests for the pack checker's notes from the independent re-check of pack review area 2 (2026-11-03;
// scripts/pack-links.mjs): columns a check or a terrain names that its table doesn't have, a nextTablePattern whose
// filled-in ids aren't tables, and movement written as a number. Warnings only. Every name and number is made up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';

const fen = { id: 'fen-kinds', name: 'Fen kinds', die: 'd8', columns: ['Road', 'Wild'], rows: [{ level: '1-8', results: ['Pedlars', 'Bog lurkers'] }] };
const pack = (mode, tables = [fen], extra = {}) => ({ rulesSets: [{ id: 'r', exploration: { modes: [{ id: 'roam', ...mode }] }, ...extra }], tables });

describe('columns a check or a terrain names', () => {
  // Purpose: a check's onHit.columns naming a column its table doesn't have gets a note (the app would quietly
  // open the table's first column); a column the table has gets none.
  it("notes an onHit.columns label that isn't one of the table's columns", () => {
    const notes = formatNotes(pack({ checks: [{ id: 'wander', onHit: { tableId: 'fen-kinds', columns: ['Road', 'Marsh'] } }] }));
    expect(notes).toEqual([
      'rulesSets: "r", mode "roam", check "wander": onHit.columns names "Marsh", which isn\'t a column of table "fen-kinds" (Road, Wild); the app would open its first column instead.',
    ]);
  });

  // Purpose: the same for a table among tableChoices, and nothing for a table this file doesn't hold (another pack may).
  it('checks each of tableChoices, and leaves alone a table from another pack', () => {
    const notes = formatNotes(pack({ checks: [{ id: 'wander', onHit: { tableChoices: ['fen-kinds', 'elsewhere'], columns: ['Hill'] } }] }));
    expect(notes).toEqual([
      'rulesSets: "r", mode "roam", check "wander": onHit.columns names "Hill", which isn\'t a column of table "fen-kinds" (Road, Wild); the app would open its first column instead.',
    ]);
  });

  // Purpose: a terrain's encounterColumn naming a column its encounter table doesn't have gets a note.
  it("notes a terrain's encounterColumn that isn't one of its encounter table's columns", () => {
    const notes = formatNotes(pack({ terrain: [{ id: 'marsh', name: 'Marsh', cost: 2, encounterTableId: 'fen-kinds', encounterColumn: 'Marsh' }, { id: 'lane', name: 'Lane', cost: 1, encounterTableId: 'fen-kinds', encounterColumn: 'Road' }] }));
    expect(notes).toEqual([
      'rulesSets: "r", mode "roam", terrain "marsh": encounterColumn "Marsh" isn\'t a column of table "fen-kinds" (Road, Wild); the app would open its first column instead.',
    ]);
  });

  // Purpose: a terrain with no encounter table of its own sets the column of the mode's check tables; it gets a note
  // only when none of them has that column.
  it("with no encounter table of its own, checks the column against the mode's check tables", () => {
    const checks = [{ id: 'wander', onHit: { tableId: 'fen-kinds' } }];
    expect(formatNotes(pack({ checks, terrain: [{ id: 'lane', name: 'Lane', cost: 1, encounterColumn: 'Wild' }] }))).toEqual([]);
    expect(formatNotes(pack({ checks, terrain: [{ id: 'reeds', name: 'Reeds', cost: 2, encounterColumn: 'Reeds' }] }))).toEqual([
      'rulesSets: "r", mode "roam", terrain "reeds": encounterColumn "Reeds" isn\'t a column of table "fen-kinds" (Road, Wild); the app would open its first column instead.',
    ]);
  });
});

describe("a nextTablePattern's filled-in ids", () => {
  const kinds = (results) => ({ id: 'wild-kinds', name: 'Wild kinds', die: 'd6', columns: ['Road', 'Wild'], nextTablePattern: 'wild-{result}', rows: [{ level: '1-6', results }] });
  const leaf = (id) => ({ id, name: id, die: 'd4', rows: [{ min: 1, max: 4, result: 'Mist hounds' }] });

  // Purpose: a nextTablePattern whose filled-in ids aren't tables in the pack gets a note naming them; ids that match
  // the way the app matches them (any case, a trailing "*" trimmed) get none.
  it("names the filled-in ids that aren't tables, the way the app matches them", () => {
    const notes = formatNotes({ tables: [kinds(['B-Animal', 'C-Flyer*']), leaf('wild-b-animal'), leaf('Wild-C-Flyer')] });
    expect(notes).toEqual([]);
    expect(formatNotes({ tables: [kinds(['B-Animal', 'D-Swimmer']), leaf('wild-b-animal')] })).toEqual([
      'tables: "wild-kinds": nextTablePattern "wild-{result}" fills in "wild-D-Swimmer", which isn\'t a table in this pack; that row leads nowhere (fine if another attached pack has it).',
    ]);
  });
});

describe("a row's next table by terrain (ga-2)", () => {
  // Purpose: a row's next.byTerrain or next.default naming a table the pack doesn't have gets a note; one it has gets none.
  it("notes a next table by terrain that isn't in the pack", () => {
    const folk = { id: 'folk-met', name: 'Folk met', die: 'd6', rows: [{ min: 1, max: 3, result: 'Townsfolk', next: { byTerrain: { 'lantern-town': 'town-folk', settled: 'farm-folk' }, default: 'wild-folk' } }] };
    const notes = formatNotes({ tables: [folk, { id: 'farm-folk', name: 'Farm folk', die: 'd6', rows: [{ min: 1, max: 6, result: 'Pedlars' }] }] });
    expect(notes).toEqual([
      'tables: "folk-met", row "1–3": next.byTerrain "lantern-town" names "town-folk", which isn\'t a table in this pack; in that terrain the row opens its default instead (fine if another attached pack has it).',
      'tables: "folk-met", row "1–3": next.default names "wild-folk", which isn\'t a table in this pack; elsewhere the row leads nowhere (fine if another attached pack has it).',
    ]);
  });
});

describe('movement written as a number', () => {
  // Purpose: a weight tier or an armour row whose movement is a number gets a note that the app reads it now, with
  // text preferred.
  it('notes a number-valued movement on a tier and on an armour row', () => {
    const notes = formatNotes({
      rulesSets: [{
        id: 'r',
        encumbrance: {
          slot: { baseSlots: 10, tiers: [{ label: 'Light', maxSlots: 10, effect: '', movement: 30 }, { label: 'Laden', maxSlots: 14, effect: '', movement: '20 ft' }] },
          armour: { movement: [{ armour: 'none', withoutTreasure: 40, withTreasure: '20 ft' }] },
        },
      }],
    });
    expect(notes).toEqual([
      'rulesSets: "r": encumbrance.slot.tiers "Light": movement is the number 30; the app reads it as "30", but text is preferred ("30 ft").',
      'rulesSets: "r": encumbrance.armour.movement "none": withoutTreasure is the number 40; the app reads it as "40", but text is preferred ("40 ft").',
    ]);
  });
});

describe('the sample pack for the manual check', () => {
  // Purpose: scripts/fixtures/m5b-review-area-2.fixture.json (the manual check's pack) shows exactly the four notes,
  // one of each kind, and nothing else.
  it('shows one note of each kind and no other', () => {
    const notes = formatNotes(JSON.parse(readFileSync('scripts/fixtures/m5b-review-area-2.fixture.json', 'utf8')));
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => /onHit\.columns|encounterColumn|nextTablePattern|movement is the number/.exec(n)?.[0])).toEqual(['onHit.columns', 'encounterColumn', 'nextTablePattern', 'movement is the number']);
  });
});
