// Fix (supabase/migrations/20261114235500_fix_weather_table_readable.sql; found by the rv-3 review of #802; Francis's
// yes wl-1, 2026-11-14, option (2)): a player's weather entry is taken only on a weather table the readable part of
// the setting rules names, so naming a GM-only table never shows a player its row. TEST project only; invented weather.
import { describe, expect, it } from 'vitest';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { CurrentUser } from '../../src/core/commands.ts';
import type { Db } from '../../src/core/supabase.ts';
import { enterWeather } from '../../src/modules/expedition/weatherPlay.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

describe("a player's weather entry names only a table they can read (fix)", () => {
  it(
    'a player naming a GM-only weather table is refused, and learns none of its rows',
    async () => {
      let world: World | undefined;
      const packIds: string[] = [];
      try {
        world = await buildWorld();
        const admin = world.admin;
        // The weather table in force, named in the readable setting rules (so the weather is due for players).
        const readablePackId = must(await admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Marsh weather' }).select('id').single()).id as string;
        packIds.push(readablePackId);
        must(
          await admin
            .from('library_entries')
            .insert([
              { pack_id: readablePackId, kind: 'rulesSet', pack_entry_id: 'marsh-weather', name: 'Marsh weather', data: { id: 'marsh-weather', name: 'Marsh weather', weather: { tables: { any: 'marsh-sky' } } } },
              { pack_id: readablePackId, kind: 'table', pack_entry_id: 'marsh-sky', name: 'Marsh sky', data: { id: 'marsh-sky', name: 'Marsh sky', die: 'd6', rows: [{ min: 1, max: 3, result: 'Low fog' }, { min: 4, max: 6, result: 'Pale sun' }] } },
            ])
            .select('id'),
        );
        // A weather table only the GM's part of the setting rules names: the whole weather block is in the rules set's
        // gmOnly list, so none of it stays in the part players read. Its row is one a player must not learn.
        const hiddenPackId = must(await admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Barrow weather' }).select('id').single()).id as string;
        packIds.push(hiddenPackId);
        must(
          await admin
            .from('library_entries')
            .insert([
              {
                pack_id: hiddenPackId,
                kind: 'rulesSet',
                pack_entry_id: 'barrow-weather',
                name: 'Barrow weather',
                data: { id: 'barrow-weather', name: 'Barrow weather', gmOnly: ['weather'], weather: { tables: { winter: 'barrow-sky' } } },
              },
              { pack_id: hiddenPackId, kind: 'table', pack_entry_id: 'barrow-sky', name: 'Barrow sky', data: { id: 'barrow-sky', name: 'Barrow sky', die: 'd6', rows: [{ min: 1, max: 6, result: 'The Lantern Warden walks' }] } },
            ])
            .select('id'),
        );
        // The GM-only table really is out of the part players read.
        const readable = must(await admin.from('library_entries').select('data').eq('pack_id', hiddenPackId).eq('kind', 'rulesSet').single());
        expect(JSON.stringify(readable.data)).not.toContain('barrow-sky');
        // A campaign with the GM and both players, both packs, players rolling the weather, and an expedition under way.
        const campaign = must(await admin.from('campaigns').insert({ name: 'The Barrow Lantern Road', created_by: world.gm.id, settings: { weatherRolledBy: 'players' } }).select().single());
        must(
          await admin
            .from('members')
            .insert([
              { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
              { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
              { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
            ])
            .select(),
        );
        must(
          await admin
            .from('campaign_packs')
            .insert([
              { campaign_id: campaign.id, pack_id: readablePackId, option_choices: {}, priority: 1 },
              { campaign_id: campaign.id, pack_id: hiddenPackId, option_choices: {}, priority: 0 },
            ])
            .select(),
        );
        const expedition = must(await admin.from('expeditions').insert({ campaign_id: campaign.id, mode: 'wilderness' }).select().single());

        // Skipping the app's own check, so the database decides.
        const playerDb = world.playerA.db as unknown as Db;
        const player = (await loadCurrentUser(playerDb)) as CurrentUser;
        const sneaky = await enterWeather.run(playerDb, player, {
          campaignId: campaign.id as string,
          expeditionId: expedition.id as string,
          period: 0,
          startsAt: 0,
          tableId: 'barrow-sky',
          roll: '3',
          rolledBy: 'players',
        });
        // Before the fix this is the hidden row's result.
        expect(sneaky.ok ? sneaky.value.result : null).toBeNull();
        expect(!sneaky.ok && sneaky.message).toBe("That isn't one of the setting's weather tables.");
        expect(must(await admin.from('weather_rolls').select('id').eq('expedition_id', expedition.id))).toEqual([]);
        expect(must(await world.playerB.db.from('events').select('id').eq('campaign_id', campaign.id).eq('type', 'weather.enter'))).toEqual([]);
      } finally {
        if (world) for (const id of packIds) await world.admin.from('packs').delete().eq('id', id);
        await tearDownWorld(world);
      }
    },
    360_000,
  );
});
