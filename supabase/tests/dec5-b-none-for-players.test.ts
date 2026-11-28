// dec5-gaps piece B (#190; G-27, ruling dg-3): a player reads "None here" at a place whose pack says no encounters
// (supabase/migrations/20261128141000_dec5_b_none_for_players.sql). TEST project only; invented packs, places and words.
// What it checks, in plain words:
//   * at a shown spot inside a "none" place, a player's check read carries the `none` mark, and nothing else: no when,
//     no chance, never the pack's sentence;
//   * the place they weren't shown (the quay, from its steps) comes under the shown spot's name: the quay's name and id
//     never leave the database;
//   * the GM's switch off: the player reads no place check (the setting's holds); Undo puts the mark back;
//   * before the spot is shown, nothing; a `none` that isn't `true` is no check at all.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { loadPlayersCheck, setCheckInForce } from '../../src/modules/expedition/placeRules.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

const QUAY_NOTE = 'The harbour watch keeps the quay quiet.';

/** An invented adventure: a quay with no encounters and steps inside it; a mill whose `none` isn't `true`. */
const quayPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'the-quay', name: 'The Quay', type: 'region', playerView: { text: 'Stone steps and a watch-house.' }, encounterCheck: { none: true, note: QUAY_NOTE } },
        { id: 'quay-steps', name: '2 The quay steps', type: 'site', parentId: 'the-quay', playerView: { text: 'Slick with weed.' } },
        { id: 'old-mill', name: 'The old mill', type: 'site', playerView: { text: 'A wheel that no longer turns.' }, encounterCheck: { none: 'yes', replacesScheduled: true, chance: { die: 'd6', on: [1] } } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

let packId = '';
let campaignId = '';

beforeAll(async () => {
  world = await buildWorld();
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: world.gm.id }).select().single());
  campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Wren the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select());
  packId = await ok(as(world.gm, importPack, { pack: quayPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const entryOf = async (id: string) => {
  const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
  const found = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === id);
  if (!found) throw new Error(`no ${id}`);
  return { packId, packEntryId: id, name: found.name, data: found.data as Record<string, unknown> };
};
const rawRead = async () => must(await world.playerA.db.rpc('encounter_check_for_players', { campaign: campaignId }));

describe('a place with no encounters, as a player reads its check (G-27 piece B, dg-3)', () => {
  it('reads the `none` mark in force, by the shown name; switched off, the setting’s; Undo puts it back', async () => {
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('quay-steps') }));

    // Not shown yet: nothing.
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);

    // Shown: the `none` mark, under the steps' name (the quay itself was never shown).
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    expect(await rawRead()).toEqual([{ group_number: 1, place_name: '2 The quay steps', checked: { none: true } }]);
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([{ group: 1, placeName: '2 The quay steps', eachMove: false, every: null, chance: null, none: true }]);
    const sent = JSON.stringify(await rawRead());
    for (const secret of [QUAY_NOTE, 'The Quay', 'the-quay']) expect(sent).not.toContain(secret);

    // The GM's switch off: no place check for the player (the setting's holds); Undo puts the mark back.
    await ok(as(world.gm, setCheckInForce, { campaignId, packId, entryId: 'the-quay', on: false }));
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);
    const eventId = await latestChange(asDb(world.gm), campaignId, 'placeRule.inForce', world.gm.id);
    if (!eventId) throw new Error('no placeRule.inForce line');
    await ok(as(world.gm, undoChange, { campaignId, eventId, authorUserId: world.gm.id }));
    expect((await loadPlayersCheck(asDb(world.playerA), campaignId))?.map((c) => [c.placeName, c.none])).toEqual([['2 The quay steps', true]]);

    // A `none` that isn't `true` is no check at all, even beside `replacesScheduled` and a chance.
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('old-mill') }));
    const mill = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: mill, piece: mill.pieces[0]! }));
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);
  });
});
