// M5b: the players' weather roll (supabase/migrations/20261031090000_m5b_weather_roll.sql; ruled 2026-10-30: D1,
// S2-1, A8–A12; docs/03 "Weather roll", 05 "Seasons, weather and the calendar"). TEST project only; invented weather.
//   A player enters the roll while players roll it; the database reads the row (its result and tags), so a device
//   can't send its own result, and everyone in the campaign reads it. The first entry counts. A player can never read
//   another table through it; weather_die tells players what to roll and nothing else. With "Weather rolled by: GM"
//   only the GM's entry is taken. The entrant can undo it while the toast could show (the record stays, marked
//   undone); nobody else but the GM can, and after that only the GM changes it, logged as a correction with the fiat
//   seal; the GM's change blocks the entrant's undo, and undoing the change puts the first result back.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { correctWeather, enterWeather, loadWeather, loadWeatherDie, type WeatherRolledBy } from '../../src/modules/expedition/weatherPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  packId = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen weather' }).select('id').single()).id as string;
  must(
    await world.admin
      .from('library_entries')
      .insert([
        {
          pack_id: packId,
          kind: 'rulesSet',
          pack_entry_id: 'fen-weather',
          name: 'Fen weather',
          data: { id: 'fen-weather', name: 'Fen weather', weather: { tables: { any: 'fen-sky' }, tags: { wet: { name: 'Wet', note: 'Fires are hard to light' }, mired: { name: 'Mired', budget: -2 } } } },
        },
        {
          pack_id: packId,
          kind: 'table',
          pack_entry_id: 'fen-sky',
          name: 'Fen sky',
          data: { id: 'fen-sky', name: 'Fen sky', die: 'd6', rows: [{ min: 1, max: 2, result: 'Drizzle', tags: ['wet'] }, { min: 3, max: 4, result: 'Sucking mud', tags: ['wet', 'mired'] }, { roll: '5-6', result: 'Clear skies' }] },
        },
        // Not a weather table: an encounter table no player may read, through the weather or otherwise.
        { pack_id: packId, kind: 'table', pack_entry_id: 'bog-things', name: 'Bog things', data: { id: 'bog-things', name: 'Bog things', die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurkers' }] } },
      ])
      .select('id'),
  );
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

/** A fresh campaign with the world's GM and both players, the weather pack, "Weather rolled by" as given, and an expedition under way. */
async function freshExpedition(rolledBy: WeatherRolledBy = 'players') {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Lantern Road', created_by: world.gm.id, settings: { weatherRolledBy: rolledBy } }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaign.id, pack_id: packId, option_choices: {}, priority: 1 }).select());
  const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: campaign.id, mode: 'wilderness' }).select().single());
  return { campaignId: campaign.id as string, expeditionId: expedition.id as string };
}

const entry = (x: { campaignId: string; expeditionId: string }, roll: string, rolledBy: WeatherRolledBy = 'players', tableId = 'fen-sky', period = 0) => ({
  campaignId: x.campaignId,
  expeditionId: x.expeditionId,
  period,
  startsAt: 0,
  tableId,
  roll,
  rolledBy,
});

async function undoNewest(person: Person, campaignId: string, type: string) {
  const [event] = must(await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1));
  // Run straight through, skipping the app's own check, so the database decides.
  return undoChange.run(asDb(person), await userOf(person), { campaignId, eventId: event!.id as string, authorUserId: (event!.actor_user_id as string | null) ?? null });
}

describe("the players' weather roll (M5b)", () => {
  it('a player enters the roll; the database reads the row, and everyone in the campaign reads the result and its tags', async () => {
    const x = await freshExpedition();
    const done = await as(world.playerA, enterWeather, entry(x, '3'));
    expect(done.ok && done.value).toMatchObject({ result: 'Sucking mud', tags: ['wet', 'mired'], enteredBy: world.playerA.id, roll: '3' });
    for (const person of [world.gm, world.playerA, world.playerB]) {
      expect(await loadWeather(asDb(person), x.expeditionId, 0)).toMatchObject({ result: 'Sucking mud', tags: ['wet', 'mired'] });
    }
    // A range written as text ("5-6") reads the same way.
    const other = await freshExpedition();
    const clear = await as(world.playerB, enterWeather, entry(other, '6'));
    expect(clear.ok && clear.value.result).toBe('Clear skies');
    // Logged as the player's, for everyone.
    const [event] = must(await world.playerB.db.from('events').select('type, actor_user_id, level').eq('campaign_id', x.campaignId).eq('type', 'weather.enter'));
    expect(event).toMatchObject({ actor_user_id: world.playerA.id, level: 'simple' });
  });

  it("a device can't send its own result: the database reads it from the table", async () => {
    const x = await freshExpedition();
    const row = must(
      await world.playerA.db
        .from('weather_rolls')
        .insert({ campaign_id: x.campaignId, expedition_id: x.expeditionId, period: 0, table_id: 'fen-sky', roll: '1', result: 'Glorious sunshine', tags: ['sunny'] })
        .select()
        .single(),
    );
    expect(row).toMatchObject({ result: 'Drizzle', tags: ['wet'], entered_by: world.playerA.id });
  });

  it('the first entry counts: a second one for the same step is refused in plain words', async () => {
    const x = await freshExpedition();
    expect((await as(world.playerA, enterWeather, entry(x, '1'))).ok).toBe(true);
    const second = await as(world.playerB, enterWeather, entry(x, '6'));
    expect(second.ok).toBe(false);
    expect(!second.ok && second.message).toBe("Someone entered the weather first. It's on the card now.");
    const gmToo = await as(world.gm, enterWeather, entry(x, '6'));
    expect(gmToo.ok).toBe(false);
    expect((await loadWeather(asDb(world.gm), x.expeditionId, 0))?.result).toBe('Drizzle');
    // The next step's weather is its own, once the clock reaches it (a player enters only the step under way).
    expect((await world.gm.db.rpc('set_clock', { campaign: x.campaignId, to_seconds: 86_400 })).error).toBeNull();
    expect((await as(world.playerB, enterWeather, entry(x, '6', 'players', 'fen-sky', 1))).ok).toBe(true);
  });

  it("a player can never read another table through the weather roll, and weather_die gives only a weather table's die", async () => {
    const x = await freshExpedition();
    const sneaky = await as(world.playerA, enterWeather, entry(x, '3', 'players', 'bog-things'));
    expect(sneaky.ok).toBe(false);
    expect(!sneaky.ok && sneaky.message).toBe("That isn't one of the setting's weather tables.");
    expect(must(await world.admin.from('weather_rolls').select('id').eq('expedition_id', x.expeditionId))).toEqual([]);
    expect(await loadWeatherDie(asDb(world.playerA), x.campaignId, 'fen-sky')).toBe('d6');
    expect(await loadWeatherDie(asDb(world.playerA), x.campaignId, 'bog-things')).toBeNull();
    // The tables themselves stay the GM's.
    expect(must(await world.playerA.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'table'))).toEqual([]);
    // An outsider gets nothing.
    expect((await world.outsider.db.rpc('weather_die', { campaign: x.campaignId, table_id: 'fen-sky' })).error).not.toBeNull();
    expect(must(await world.outsider.db.from('weather_rolls').select('id').eq('campaign_id', x.campaignId))).toEqual([]);
  });

  it('a roll no row has is refused, plainly; an expedition must be under way', async () => {
    const x = await freshExpedition();
    const off = await as(world.playerA, enterWeather, entry(x, '9'));
    expect(!off.ok && off.message).toBe('No row of the weather table has 9. Check the roll.');
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('id', x.expeditionId).select());
    const ended = await as(world.playerA, enterWeather, entry(x, '2'));
    expect(!ended.ok && ended.message).toBe('The weather is entered while an expedition is under way.');
  });

  it('with "Weather rolled by: GM" a player\'s entry is refused, and the GM\'s is taken', async () => {
    const x = await freshExpedition('gm');
    // Skipping the app's own check, so the database decides.
    const refused = await enterWeather.run(asDb(world.playerA), await userOf(world.playerA), entry(x, '2', 'gm'));
    expect(refused.ok).toBe(false);
    expect((await as(world.gm, enterWeather, entry(x, '2', 'gm'))).ok).toBe(true);
  });

  it('the entrant undoes their entry from the toast: the record stays, marked undone; another player cannot', async () => {
    const x = await freshExpedition();
    expect((await as(world.playerA, enterWeather, entry(x, '1'))).ok).toBe(true);
    expect((await undoNewest(world.playerB, x.campaignId, 'weather.enter')).ok).toBe(false);
    expect((await undoNewest(world.playerA, x.campaignId, 'weather.enter')).ok).toBe(true);
    expect(await loadWeather(asDb(world.playerB), x.expeditionId, 0)).toBeNull();
    expect(must(await world.admin.from('weather_rolls').select('undone').eq('expedition_id', x.expeditionId))).toEqual([{ undone: true }]);
    // Due again: anyone may enter it now.
    expect((await as(world.playerB, enterWeather, entry(x, '6'))).ok).toBe(true);
  });

  it('a player cannot change the weather once it is in, even their own entry', async () => {
    const x = await freshExpedition();
    const done = await as(world.playerA, enterWeather, entry(x, '1'));
    if (!done.ok) throw new Error(done.message);
    const changed = await world.playerA.db.from('weather_rolls').update({ roll: '6', undone: true }).eq('id', done.value.id).select();
    expect(changed.error).not.toBeNull();
    const byFunction = await correctWeather.run(asDb(world.playerA), await userOf(world.playerA), { campaignId: x.campaignId, weather: done.value, tableId: 'fen-sky', roll: '6' });
    expect(byFunction.ok).toBe(false);
    expect((await loadWeather(asDb(world.gm), x.expeditionId, 0))?.result).toBe('Drizzle');
  });

  it("the GM changes it any time, logged as a correction (fiat); that blocks the entrant's undo, and undoing the change puts the first result back", async () => {
    const x = await freshExpedition();
    const done = await as(world.playerA, enterWeather, entry(x, '1'));
    if (!done.ok) throw new Error(done.message);
    const changed = await as(world.gm, correctWeather, { campaignId: x.campaignId, weather: done.value, tableId: 'fen-sky', roll: '5' });
    expect(changed.ok && changed.value).toMatchObject({ result: 'Clear skies', tags: [], correctedBy: world.gm.id, enteredBy: world.playerA.id });
    const [event] = must(await world.playerA.db.from('events').select('fiat, level').eq('campaign_id', x.campaignId).eq('type', 'weather.correct'));
    expect(event).toMatchObject({ fiat: true, level: 'simple' });
    expect((await undoNewest(world.playerA, x.campaignId, 'weather.enter')).ok).toBe(false);
    expect((await undoNewest(world.gm, x.campaignId, 'weather.correct')).ok).toBe(true);
    expect(await loadWeather(asDb(world.playerA), x.expeditionId, 0)).toMatchObject({ result: 'Drizzle', tags: ['wet'], correctedBy: null });
  });

  it("after the toast's time, only the GM can undo or change a player's entry", async () => {
    const x = await freshExpedition();
    expect((await as(world.playerA, enterWeather, entry(x, '1'))).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 31_000));
    expect((await undoNewest(world.playerA, x.campaignId, 'weather.enter')).ok).toBe(false);
    expect((await undoNewest(world.gm, x.campaignId, 'weather.enter')).ok).toBe(true);
    expect(await loadWeather(asDb(world.gm), x.expeditionId, 0)).toBeNull();
  }, 60_000);
});
