// The Weather sheet's logic (S10, logic half; st-3, wr-1). Invented fixtures only: the "Fen sky" table and its rows.
//   A tap on a row sends that row's lowest roll; a single-number row sends that number; a composite die's row its key.
//   No roll lands on a row the database can't place ("≤2", a label with no range, a row an earlier one overlaps).
//   The tap goes through the existing enterWeather and lands on the tapped row.
//   The current roll's row is marked.
//   The player's sheet asks for no table: only the die. The GM's sheet reads the table.
//   The effects in plain words are the weather card's own.
import { describe, expect, it, vi } from 'vitest';
import { runCommand } from '../../core/commands.ts';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { readWeather } from './modes.ts';
import { readTable, type ReadTable } from './tables.ts';
import { enterWeather } from './weatherPlay.ts';
import { currentRollFor, entryForRow, loadWeatherSheet, rowRoll, weatherEffects, weatherEntryWay, weatherTableRows } from './weatherSheet.ts';

const FEN_SKY = {
  id: 'fen-sky',
  name: 'Fen sky',
  die: 'd8',
  rows: [
    { roll: '1-2', result: 'Clear', tags: [] },
    { roll: '3–5', result: 'Drizzle', tags: ['wet'] },
    { roll: '6', result: 'Fog', tags: ['fog'] },
    { roll: '7+', result: 'Squall', tags: ['wet', 'mired'] },
  ],
};
const fenSky = (): ReadTable => readTable('fen-sky', 'Fen sky', FEN_SKY)!;

describe("a tap on a row (st-3): the row's lowest roll", () => {
  // Purpose: a tap on a row sends that row's lowest roll ("3–5" sends 3, "7+" sends 7).
  it("sends the row's lowest roll", () => {
    const base = { campaignId: 'c', expeditionId: 'x', period: 0, startsAt: 0, tableId: 'fen-sky', rolledBy: 'players' as const };
    expect(entryForRow(base, fenSky(), 0)?.roll).toBe('1');
    expect(entryForRow(base, fenSky(), 1)).toEqual({ ...base, roll: '3' });
    expect(entryForRow(base, fenSky(), 3)?.roll).toBe('7');
  });

  // Purpose: a single-number row sends that number.
  it('a single-number row sends that number', () => {
    expect(rowRoll(fenSky(), 2)).toBe('6');
    const numbers = readTable('pond', 'Pond', { die: 'd4', rows: [{ min: 1, max: 1, result: 'Still' }, { min: 2, result: 'Ripples' }, { roll: 3, result: 'Waves' }] })!;
    expect([0, 1, 2].map((i) => rowRoll(numbers, i))).toEqual(['1', '2', '3']);
  });

  // Purpose: a composite die's row sends its key ("3/7"), which is how the database reads it.
  it("a composite die's row sends its key", () => {
    const pair = readTable('reed-wind', 'Reed wind', { die: 'd4/d8', rows: [{ key: '1/1', result: 'Calm' }, { key: '3 / 7', result: 'Gusts' }] })!;
    expect(rowRoll(pair, 1)).toBe('3/7');
  });

  // Purpose: no roll is offered for a row the database can't place, so a tap never enters another row: a "≤2" row (the
  // database reads no "≤"), a label with no range, and a row whose lowest an earlier row already covers.
  it('offers no roll for a row the database cannot place', () => {
    const odd = readTable('mire-sky', 'Mire sky', {
      die: 'd6',
      rows: [{ roll: '≤2', result: 'Murk' }, { roll: '3-4', result: 'Mist' }, { roll: '4-6', result: 'Rain' }, { key: 'Storm night', result: 'Thunder' }],
    })!;
    expect(odd.rows.map((_, i) => rowRoll(odd, i))).toEqual([null, '3', null, null]);
    expect(entryForRow({ campaignId: 'c', expeditionId: 'x', period: 0, startsAt: 0, tableId: 'mire-sky', rolledBy: 'gm' }, odd, 0)).toBeNull();
    expect(rowRoll(odd, 9)).toBeNull();
  });

  // Purpose: the tap goes through the existing enterWeather, unchanged, and the database reads the tapped row from it.
  it('goes through the existing enterWeather and lands on the tapped row', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: {} });
    world.tables.library_entries.push({ id: 'e-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', weather: { tables: { any: 'fen-sky' } } } });
    world.tables.library_entries.push({ id: 'e-sky', pack_id: 'pack-fen', kind: 'table', pack_entry_id: 'fen-sky', name: 'Fen sky', data: FEN_SKY });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    world.tables.expeditions.push({ id: 'exp-1', campaign_id: campaign, ended_at: null, undone: false });
    world.signInAs(gm);
    const entry = entryForRow({ campaignId: campaign, expeditionId: 'exp-1', period: 0, startsAt: 0, tableId: 'fen-sky', rolledBy: 'players' }, fenSky(), 1)!;
    const done = await runCommand(createAppRegistry(), world.db, { id: gm, roles: { [campaign]: 'gm' } }, enterWeather, entry);
    expect(done).toMatchObject({ ok: true, value: { roll: '3', result: 'Drizzle', tags: ['wet'] } });
  });
});

describe("the GM's table: the rows and the current one", () => {
  // Purpose: the rows carry their range as printed, their words and what a tap sends; the current roll's row is marked.
  it("marks the current roll's row", () => {
    const rows = weatherTableRows(fenSky(), '4');
    expect(rows).toEqual([
      { label: '1–2', words: 'Clear', roll: '1', current: false },
      { label: '3–5', words: 'Drizzle', roll: '3', current: true },
      { label: '6', words: 'Fog', roll: '6', current: false },
      { label: '7+', words: 'Squall', roll: '7', current: false },
    ]);
    // No roll yet, or one that isn't a roll: nothing is marked. A high roll falls in the open-ended "7+" row.
    expect(weatherTableRows(fenSky(), null).some((r) => r.current)).toBe(false);
    expect(weatherTableRows(fenSky(), 'x').some((r) => r.current)).toBe(false);
    expect(weatherTableRows(fenSky(), '99').find((r) => r.current)?.label).toBe('7+');
  });

  // Purpose: the stored roll counts only for its own table; another table's roll marks nothing.
  it("the current roll is the stored weather's, for this table only", () => {
    expect(currentRollFor({ tableId: 'fen-sky', roll: '6' }, 'fen-sky')).toBe('6');
    expect(currentRollFor({ tableId: 'spring-sky', roll: '6' }, 'fen-sky')).toBeNull();
    expect(currentRollFor(null, 'fen-sky')).toBeNull();
  });
});

describe('who sees what (wr-1)', () => {
  // Purpose: the player's sheet logic asks for no table: only the die; the GM's reads the table and its rows.
  it("the player's sheet asks for no table; the GM's reads it", async () => {
    const loadTable = vi.fn(async () => fenSky());
    const loadDie = vi.fn(async () => 'd8');
    expect(weatherEntryWay(false)).toBe('number');
    const player = await loadWeatherSheet({ gm: false, tableId: 'fen-sky', currentRoll: null, loadTable, loadDie });
    expect(player).toEqual({ way: 'number', die: 'd8' });
    expect(loadTable).not.toHaveBeenCalled();
    expect(JSON.stringify(player)).not.toContain('Drizzle');

    expect(weatherEntryWay(true)).toBe('table');
    const gm = await loadWeatherSheet({ gm: true, tableId: 'fen-sky', currentRoll: '6', loadTable, loadDie });
    expect(loadTable).toHaveBeenCalledWith('fen-sky');
    expect(gm.way === 'table' && gm.rows.find((r) => r.current)?.words).toBe('Fog');
  });

  // Purpose: a table the GM's device can't find gives the GM's sheet no rows, never an error.
  it("a missing table gives the GM's sheet no rows", async () => {
    const gm = await loadWeatherSheet({ gm: true, tableId: 'gone', currentRoll: null, loadTable: async () => null, loadDie: async () => null });
    expect(gm).toEqual({ way: 'table', table: null, rows: [] });
  });
});

describe('the effects in plain words', () => {
  // Purpose: the effects are the weather card's own words from the same data: the result, then each tag in plain words.
  it("reads the card's words from the stored weather and the setting's tags", () => {
    const known = readWeather({ tables: {}, tags: { wet: { name: 'Wet', note: 'Lighting a campfire is hard' }, mired: { name: 'Mired', budget: -2 } } })!.tags;
    expect(weatherEffects({ result: 'Squall', tags: ['wet', 'mired'] }, known, 'travel points')).toEqual({
      result: 'Squall',
      lines: ['Wet, Lighting a campfire is hard', 'Mired, −2 travel points'],
    });
    expect(weatherEffects(null, known)).toBeNull();
  });
});
