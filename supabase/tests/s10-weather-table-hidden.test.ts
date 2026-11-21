// S10, the Weather sheet (wr-1, docs/design/rulings/dec-scene-whole-2026-11-14.md): a player who rolls the weather
// enters the number and never sees the weather table. The database keeps it from players today, by every road a
// device can read from; this pins that. TEST project only; invented weather.
//   A player reads no weather table: not from library_entries, not from campaign_library (the paged read), not from
//   weather_die (the die alone), not from the stored weather (its own result and tags alone), not from the log (a
//   weather table written and changed in the campaign's own homebrew, the only library entries the log keeps: the
//   GM's log holds its rows, the player's none).
//   The GM reads the table (the GM's sheet draws it, st-3).
//   To do, by the lead's answer (2026-11-14): a weather table a pack itself opens to players with "gmOnly": false is
//   readable by them under fs-1 (the read rule's one exception for tables). No rule changes: a pack that opens a table
//   has chosen to, no weather table in the campaign's packs is opened (the pack session checked every pack), and the
//   player's sheet logic never loads the table, which is what wr-1 asks.
// Not run by the cloud session that wrote it (no database there): CI's database job or the Builder runs it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { enterWeather, loadWeatherDie } from '../../src/modules/expedition/weatherPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  packId = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Reed weather' }).select('id').single()).id as string;
  must(
    await world.admin
      .from('library_entries')
      .insert([
        {
          pack_id: packId,
          kind: 'rulesSet',
          pack_entry_id: 'reed-weather',
          name: 'Reed weather',
          data: { id: 'reed-weather', name: 'Reed weather', weather: { tables: { any: 'reed-sky' }, tags: { wet: { name: 'Wet', note: 'Fires are hard to light' } } } },
        },
        {
          pack_id: packId,
          kind: 'table',
          pack_entry_id: 'reed-sky',
          name: 'Reed sky',
          data: { id: 'reed-sky', name: 'Reed sky', die: 'd6', rows: [{ min: 1, max: 2, result: 'Drizzle', tags: ['wet'] }, { min: 3, max: 4, result: 'Heron fog' }, { roll: '5-6', result: 'Lantern-clear' }] },
        },
      ])
      .select('id'),
  );
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

/** A fresh campaign with the world's GM and a player, the weather pack, and an expedition under way. */
async function freshExpedition() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Still Pool', created_by: world.gm.id, settings: { weatherRolledBy: 'players' } }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaign.id, pack_id: packId, option_choices: {}, priority: 1 }).select());
  const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: campaign.id, mode: 'wilderness' }).select().single());
  return { campaignId: campaign.id as string, expeditionId: expedition.id as string };
}

/** Whether any of the table's rows' words show up in what was read. */
const holdsRows = (read: unknown) => /Heron fog|Lantern-clear/.test(JSON.stringify(read ?? null));

describe('a player gets no weather table (wr-1)', () => {
  // Purpose: by every road a device reads from, a player is sent nothing of the weather table's rows, after a weather
  // roll as before it; the GM reads the table.
  it('reads no weather table by any road; the GM reads it', async () => {
    const x = await freshExpedition();
    // The player rolls 1: the stored weather is that row's result and tags, nothing of the other rows.
    const player = await userOf(world.playerA);
    const entered = await runCommand(registry, asDb(world.playerA), player, enterWeather, {
      campaignId: x.campaignId,
      expeditionId: x.expeditionId,
      period: 0,
      startsAt: 0,
      tableId: 'reed-sky',
      roll: '1',
      rolledBy: 'players',
    });
    expect(entered).toMatchObject({ ok: true, value: { result: 'Drizzle', tags: ['wet'] } });

    // 1. library_entries, read directly.
    expect(must(await world.playerA.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', packId).eq('kind', 'table'))).toEqual([]);
    // 2. campaign_library, the paged read every screen's setting rules come through.
    const page = must(await world.playerA.db.rpc('campaign_library', { campaign: x.campaignId })) as { kind: string; pack_entry_id: string }[];
    expect(page.some((e) => e.kind === 'table')).toBe(false);
    expect(page.some((e) => e.pack_entry_id === 'reed-weather')).toBe(true);
    expect(holdsRows(page)).toBe(false);
    // 3. weather_die: the die alone.
    expect(await loadWeatherDie(asDb(world.playerA), x.campaignId, 'reed-sky')).toBe('d6');
    // 4. The stored weather: its own result and tags alone.
    const rolls = must(await world.playerA.db.from('weather_rolls').select('*').eq('campaign_id', x.campaignId));
    expect(rolls).toHaveLength(1);
    expect(holdsRows(rolls)).toBe(false);
    // 5. The log. A library entry is logged only in a campaign's own homebrew (private.log_change: library packs belong
    // to no campaign), so the road is a weather table written and changed in the campaign's homebrew while attached:
    // the GM's log holds its rows (so the change was logged), the player's none.
    const homebrew = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, campaign_id: x.campaignId, name: 'Still pool homebrew', kind: 'homebrew' }).select('id').single()).id as string;
    must(await world.admin.from('campaign_packs').insert({ campaign_id: x.campaignId, pack_id: homebrew, option_choices: {}, priority: 100 }).select());
    const sky = { id: 'reed-sky', name: 'Reed sky', die: 'd6', rows: [{ min: 1, max: 2, result: 'Drizzle' }, { min: 3, max: 4, result: 'Heron fog' }, { roll: '5-6', result: 'Lantern-clear' }] };
    const copy = must(await world.admin.from('library_entries').insert({ pack_id: homebrew, kind: 'table', pack_entry_id: 'reed-sky', name: 'Reed sky', data: sky }).select('id').single()).id as string;
    must(await world.admin.from('library_entries').update({ data: { ...sky, rows: [...sky.rows.slice(0, 2), { roll: '5-6', result: 'Lantern-clear at dusk' }] } }).eq('id', copy).select('id'));
    const gmLog = must(await world.gm.db.from('events').select('*').eq('campaign_id', x.campaignId).eq('target_table', 'library_entries'));
    expect(gmLog.length).toBeGreaterThan(0);
    expect(holdsRows(gmLog)).toBe(true);
    const events = must(await world.playerA.db.from('events').select('*').eq('campaign_id', x.campaignId));
    expect(holdsRows(events)).toBe(false);

    // The GM reads the table, for the GM's sheet (st-3).
    const gmTable = must(await world.gm.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', packId).eq('kind', 'table'));
    expect(gmTable.map((e) => e.pack_entry_id)).toEqual(['reed-sky']);
    expect(holdsRows(gmTable)).toBe(true);
  }, 120_000);

  // To do, kept by the lead's answer (2026-11-14): a pack may open a table to players with "gmOnly": false (fs-1, the
  // read rule's one exception for tables, in the library read rule and campaign_library), and a weather table opened
  // that way is readable by players, through campaign_library onto every player's device. No rule changes: a pack
  // that opens a table has chosen to; no weather table in the campaign's packs is opened (the pack session checked
  // every pack); and the player's sheet logic never loads the table, which is what wr-1 asks.
  it.todo('a weather table a pack opens with "gmOnly": false (the pack\'s choice, fs-1; no rule change, the lead 2026-11-14)');
});
