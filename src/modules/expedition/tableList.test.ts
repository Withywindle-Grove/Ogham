// The Which table? list and the candidates a hit offers (M5b step g3; docs/05 "Encounter tables, full screen", M5 gate
// B2; "Which table a hit rolls", D12). Invented tables only.
//   The list order is pins, then D12's order with the suggestion first, then the rest; each table once.
//   A pin that is also a candidate keeps its pin's place and says both.
//   A table the setting rules don't have is left out of the list and named apart.
//   A hit's candidates follow D12: the place's default, the terrain's (wanderChance checks only), the region's, a
//   special season's swap, then the check's own; a lost check offers only its own.
//   The tag and Explore's row read as the mockup does.
//   A table's description and a row's stat block are read from the pack.
import { describe, expect, it } from 'vitest';
import { checkPrompt, type TableCandidate } from './checks.ts';
import { readCheck, readExploration, type Terrain } from './modes.ts';
import { tablesRowWords, tableTag, whichTables } from './tableList.ts';
import * as tableListModule from './tableList.ts';
import { placeCheckOf } from './placeRules.ts';
import { readTable } from './tables.ts';

const known = (id: string) => !id.startsWith('lost-');
const cand = (tableId: string, why: TableCandidate['why'], season: string | null = null): TableCandidate => ({ tableId, why, season });

describe('Which table? (B2)', () => {
  it('lists pins, then the candidates with the likely one first, then the rest, each table once', () => {
    const { rows, missing } = whichTables({
      pins: ['lower-abbey'],
      candidates: [cand('abbey', 'place'), cand('marsh', 'terrain'), cand('level-two', 'check')],
      rest: ['marsh', 'wild-day', 'road'],
      known,
    });
    expect(rows.map((r) => [r.tableId, r.pinned, r.likely, r.why])).toEqual([
      ['lower-abbey', true, false, null],
      ['abbey', false, true, 'this place'],
      ['marsh', false, false, 'this terrain'],
      ['level-two', false, false, 'this check'],
      ['wild-day', false, false, null],
      ['road', false, false, null],
    ]);
    expect(missing).toEqual([]);
  });

  it('a pinned candidate stays with the pins and says both; the likely one is the first the setting has', () => {
    const { rows, missing } = whichTables({ pins: ['marsh'], candidates: [cand('lost-abbey', 'place'), cand('marsh', 'terrain')], known });
    expect(rows).toEqual([{ tableId: 'marsh', pinned: true, likely: true, why: 'this terrain' }]);
    expect(tableTag(rows[0]!, 'd8')).toBe('pinned, likely, this terrain, d8');
    expect(missing).toEqual(['lost-abbey']);
  });

  it("a special season's swap is named by the season", () => {
    const { rows } = whichTables({ pins: [], candidates: [cand('mist-things', 'season', 'mistwane')], known, seasonName: (id) => (id === 'mistwane' ? 'Mistwane' : id) });
    expect(tableTag(rows[0]!, 'd6')).toBe('likely, Mistwane, d6');
  });

  it("Explore's row reads the likely table and the pins", () => {
    expect(tablesRowWords('Abbey', 1)).toBe('Abbey likely, 1 pinned');
    expect(tablesRowWords(null, 2)).toBe('2 pinned');
    expect(tablesRowWords('Marsh', 0)).toBe('Marsh likely');
    expect(tablesRowWords(null, 0)).toBe('');
  });
});

describe("a hit's candidates (D12)", () => {
  const rules = readExploration([
    {
      id: 'fen',
      name: 'Fen',
      exploration: { modes: [{ id: 'wade', name: 'Wading', step: { value: 1, unit: 'day' }, procedure: [], checks: [] }] },
      wildEncounters: { regionalTables: { Saltmarsh: 'salt-things' } },
    },
  ]);
  const terrain: Terrain = { id: 'reeds', name: 'Reeds', cost: null, searchCost: null, lostChance: [1], wanderChance: [1, 2], mounts: null, vehicles: null, classId: null, encounterTableId: 'reed-things', encounterColumn: 'Wild', note: null };
  const seasons = [{ id: 'mistwane', name: 'Mistwane', weatherTableId: null, weatherFrom: null, encounterSwap: { chance: { die: 'd6', on: [1] }, tableId: 'mist-things' }, effects: null }];

  it("follow D12's order: place, terrain, region, season's swap, then the check's own", () => {
    const check = readCheck({ id: 'wander', name: 'Wandering beasts', byTerrain: true, terrainChance: 'wanderChance', onHit: { tableChoices: ['beasts-near', 'beasts-far'], regionTables: true } })!;
    const plan = checkPrompt(check, 'encounter', rules, { terrain, region: 'Saltmarsh', specialSeasons: seasons, placeTableId: 'abbey' }).hit;
    expect(plan.candidates.map((c) => `${c.tableId}:${c.why}`)).toEqual(['abbey:place', 'reed-things:terrain', 'salt-things:region', 'mist-things:season', 'beasts-near:check', 'beasts-far:check']);
    expect(plan.column).toBe('Wild');
  });

  it("a lost check offers only its own table; a lostChance check never the terrain's", () => {
    const lost = readCheck({ id: 'astray', name: 'Astray', byTerrain: true, terrainChance: 'lostChance', onHit: { tableId: 'astray-result' } })!;
    const plan = checkPrompt(lost, 'lost', rules, { terrain, placeTableId: 'abbey' }).hit;
    expect(plan.candidates).toEqual([{ tableId: 'astray-result', why: 'check', season: null }]);
  });
});

describe('what a table says about itself (07, G-44)', () => {
  it("keeps the table's description and a row's stat block", () => {
    const t = readTable('abbey', 'Abbey', { die: 'd6', description: 'The abbey above ground.', rows: [{ min: 1, max: 1, result: 'Drowned acolytes', count: '1d4', statBlockId: 'drowned-acolyte' }] })!;
    expect(t.description).toBe('The abbey above ground.');
    expect(t.rows[0]).toMatchObject({ statBlockId: 'drowned-acolyte', note: null, count: '1d4' });
  });
});

describe("a place's own table in Explore's row (the tables-row fault, scene-point-to-point 2026-11-18)", () => {
  // Purpose: at a place whose own check names a table, that table leads the candidates and is the suggestion, wherever it was gathered among the mode's own tables, so Explore's row names it and not the mode's.
  it("the place's table leads and is the likely one, though the mode's tables were gathered first", () => {
    const { rows, missing } = whichTables({
      pins: [],
      candidates: [cand('cellars-one', 'check'), cand('cellars-two', 'check'), cand('on-the-water', 'place')],
      known,
    });
    expect(rows.map((r) => [r.tableId, r.likely, r.why])).toEqual([
      ['on-the-water', true, 'this place'],
      ['cellars-one', false, 'this check'],
      ['cellars-two', false, 'this check'],
    ]);
    expect(missing).toEqual([]);
  });

  // Purpose: a pinned table of the mode's keeps its pin's place at the top, but the suggestion is still the place's own table, not the pinned one.
  it("a pinned table of the mode's stays first, and the place's table is still the likely one", () => {
    const { rows } = whichTables({ pins: ['cellars-one'], candidates: [cand('cellars-one', 'check'), cand('on-the-water', 'place')], known });
    expect(rows.map((r) => [r.tableId, r.pinned, r.likely, r.why])).toEqual([
      ['cellars-one', true, false, 'this check'],
      ['on-the-water', false, true, 'this place'],
    ]);
  });
});

describe("the scene's candidates at a place with its own check (the tables-row fault; the review of pull request 1001)", () => {
  // Purpose: a place's own check that stands in for the mode's has its table gathered as this place's, after the mode's and the GM's own, and the list then leads with it as the suggestion.
  it("a place's check that stands in has its table gathered as the place's, and the list leads with it", () => {
    // Reached by name: sceneCandidatesOf did not exist when this test was written (tests first, bq-6).
    const gather = (tableListModule as unknown as Record<string, (input: Record<string, unknown>) => TableCandidate[]>).sceneCandidatesOf!;
    const harbour = { packId: 'pack-reed', entryId: 'drowned-harbour', name: 'The Drowned Harbour', data: { encounterCheck: { name: 'Encounters on the water', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'on-the-water' } } } };
    const found = gather({ mode: [cand('cellars-one', 'check')], own: ['bell-buoy'], place: placeCheckOf([harbour], []), rules: null });
    expect(found).toEqual([cand('cellars-one', 'check'), cand('bell-buoy', 'check'), cand('on-the-water', 'place')]);
    expect(whichTables({ pins: [], candidates: found, known }).rows.map((r) => [r.tableId, r.likely, r.why])).toEqual([
      ['on-the-water', true, 'this place'],
      ['cellars-one', false, 'this check'],
      ['bell-buoy', false, 'this check'],
    ]);
  });

  // Purpose: a place's check that does not stand in (the GM switched it off, or it does not replace the scheduled check), or no place's check at all, leaves the gathered list exactly as it was.
  it("a place's check not in force, or none, leaves the list as it was", () => {
    // Reached by name: sceneCandidatesOf did not exist when this test was written (tests first, bq-6).
    const gather = (tableListModule as unknown as Record<string, (input: Record<string, unknown>) => TableCandidate[]>).sceneCandidatesOf!;
    const check = { name: 'Encounters on the water', when: 'eachMove', chance: { die: 'd6', on: [1] }, onHit: { tableId: 'on-the-water' } };
    const standsIn = { packId: 'pack-reed', entryId: 'drowned-harbour', name: 'The Drowned Harbour', data: { encounterCheck: { ...check, replacesScheduled: true } } };
    const beside = { packId: 'pack-reed', entryId: 'drowned-harbour', name: 'The Drowned Harbour', data: { encounterCheck: check } };
    const asItWas = [cand('cellars-one', 'check'), cand('bell-buoy', 'check')];
    const switchedOff = placeCheckOf([standsIn], [{ packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'encounterCheck', which: 'inForce', value: false }]);
    expect(switchedOff?.inForce).toBe(false);
    expect(gather({ mode: [cand('cellars-one', 'check')], own: ['bell-buoy'], place: switchedOff, rules: null })).toEqual(asItWas);
    const notReplacing = placeCheckOf([beside], []);
    expect(notReplacing?.inForce).toBe(false);
    expect(gather({ mode: [cand('cellars-one', 'check')], own: ['bell-buoy'], place: notReplacing, rules: null })).toEqual(asItWas);
    expect(gather({ mode: [cand('cellars-one', 'check')], own: ['bell-buoy'], place: null, rules: null })).toEqual(asItWas);
  });

  // Purpose: when the place's check names a table the mode also names, it is one row, the place's, and it is the suggestion.
  it("a table the mode names too is one row, the place's", () => {
    // Reached by name: sceneCandidatesOf did not exist when this test was written (tests first, bq-6).
    const gather = (tableListModule as unknown as Record<string, (input: Record<string, unknown>) => TableCandidate[]>).sceneCandidatesOf!;
    const harbour = { packId: 'pack-reed', entryId: 'drowned-harbour', name: 'The Drowned Harbour', data: { encounterCheck: { name: 'Encounters on the water', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'on-the-water' } } } };
    const found = gather({ mode: [cand('cellars-one', 'check'), cand('on-the-water', 'check')], own: [], place: placeCheckOf([harbour], []), rules: null });
    expect(found).toEqual([cand('cellars-one', 'check'), cand('on-the-water', 'place')]);
    expect(whichTables({ pins: [], candidates: found, known }).rows.map((r) => [r.tableId, r.likely, r.why])).toEqual([
      ['on-the-water', true, 'this place'],
      ['cellars-one', false, 'this check'],
    ]);
  });

  // Purpose: the check counts when a parent region owns it and the place the party stands at has none of its own.
  it("a check owned by a parent region counts at a place inside it", () => {
    // Reached by name: sceneCandidatesOf did not exist when this test was written (tests first, bq-6).
    const gather = (tableListModule as unknown as Record<string, (input: Record<string, unknown>) => TableCandidate[]>).sceneCandidatesOf!;
    const jetty = { packId: 'pack-reed', entryId: 'the-jetty', name: 'The jetty', data: { type: 'site' } };
    const island = { packId: 'pack-reed', entryId: 'saltwick-island', name: 'Saltwick Island', data: { type: 'region', encounterCheck: { name: 'Island encounters', replacesScheduled: true, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'island-things' } } } };
    const place = placeCheckOf([jetty, island], []);
    expect(place?.owner.entryId).toBe('saltwick-island');
    expect(gather({ mode: [cand('cellars-one', 'check')], own: [], place, rules: null })).toEqual([cand('cellars-one', 'check'), cand('island-things', 'place')]);
  });
});
