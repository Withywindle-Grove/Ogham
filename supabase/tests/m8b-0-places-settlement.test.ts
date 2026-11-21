// M8b slice 0, pull request 2: the town on a place its pack marks a settlement (supabase/migrations/
// 20261106150000_m8b_0_places_settlement.sql; docs/plans/m8b-0-places-from-packs.md delivery 5, "No gate on towns").
// TEST project only; invented packs, places and people. What it checks, in plain words:
//   * a place picked from a pack that marks it a settlement carries the mark; one that doesn't, doesn't;
//   * players read the town's shown places there (scene_town) once the place itself is shown, as at a place the GM
//     marked Safe before: both ways keep working;
//   * the mark can't be changed after the place is made (the link's facts), and a player never reads it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { loadSceneTowns, showTownPlace } from '../../src/modules/expedition/townPlaces.ts';
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

/** An invented region pack: a market town marked a settlement, and a hex that isn't; the setting's services come from the base rules. */
const regionPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen Reaches', version: '0.1', kind: 'homebrew' },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6' }],
      rulesSets: [{ id: 'fen-rules', name: 'Fen rules', settlement: { services: [{ id: 'used-goods', name: 'Used goods', kind: 'buy' }], lodgings: [{ name: 'The Eel and Lantern', rate: '2 sp' }] } }],
      locations: [
        { id: 'saltreach', name: 'Saltreach', type: 'site', settlement: { size: 'town', population: 400 }, playerView: { text: 'Smoke over the weirs.' } },
        { id: 'hex-0413', name: 'The Eel Weirs', type: 'area', playerView: { text: 'Reeds and weirs.' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

let packId = '';
let campaignId = '';
const entryOf = async (entryId: string) => {
  const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
  const found = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === entryId);
  if (!found) throw new Error(`no entry ${entryId}`);
  return found;
};
const endExpeditions = async () =>
  must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('campaign_id', campaignId).is('ended_at', null).eq('undone', false).select());

beforeAll(async () => {
  world = await buildWorld();
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Reaches', created_by: world.gm.id }).select().single());
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
  must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select());
  packId = await ok(as(world.gm, importPack, { pack: regionPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('a settlement from a pack', () => {
  it('carries the mark when the pack gives one, and not otherwise; a player never reads it', async () => {
    const town = await ok(as(world.gm, placeFromPack, { campaignId, entry: await entryOf('saltreach') }));
    const hex = await ok(as(world.gm, placeFromPack, { campaignId, entry: await entryOf('hex-0413') }));
    expect(town.settlement).toEqual({ size: 'town', population: 400 });
    expect(hex.settlement).toBeNull();
    expect(must(await world.playerA.db.from('places').select('id, settlement').eq('id', town.id))).toEqual([]);
    // The mark is the link's: it can't change after the place is made.
    const changed = await world.gm.db.from('places').update({ settlement: null, version: town.version }).eq('id', town.id).select('id');
    expect(changed.error?.message).toContain("can't be changed");
  });

  it("players read the town's shown places there once the place is shown, as at a place marked Safe before", async () => {
    const town = await ok(as(world.gm, placeFromPack, { campaignId, entry: await entryOf('saltreach') }));
    await endExpeditions();
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: town.id }));
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    expect(visit.place?.settlement?.size).toBe('town');
    // Nothing for players yet: the place isn't shown.
    expect((await loadSceneTowns(asDb(world.playerA), campaignId))?.get(1)).toBeUndefined();
    await ok(as(world.gm, showTownPlace, { campaignId, place: visit.place!, entry: { key: 'lodging:the eel and lantern', name: 'The Eel and Lantern', group: 'lodging' }, shown: true, alsoShow: { visitId: visit.id, pieceId: visit.pieces[0]!.id } }));
    const seen = (await loadSceneTowns(asDb(world.playerA), campaignId))?.get(1);
    expect(seen?.places.map((p) => p.name)).toEqual(['The Eel and Lantern']);
    expect(seen?.name).toBe('Saltreach');
    // The older way still works: a typed place the GM marked Safe, with a lodging shown.
    const safe = must(await world.admin.from('places').insert({ campaign_id: campaignId, name: 'Marlow Ford', safety: 'safe', town: { 'lodging:the ford inn': { name: 'The Ford Inn', kind: 'lodging', shown: true, open: true } } }).select().single());
    must(await world.admin.from('place_notes').insert({ id: safe.id, campaign_id: campaignId }).select());
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', placeId: safe.id as string }));
    const there = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    const piece = must(await world.admin.from('place_pieces').insert({ campaign_id: campaignId, place_id: safe.id, kind: 'description', body: 'A ford and an inn.' }).select().single());
    await ok(as(world.gm, showPiece, { campaignId, row: there, piece: { id: piece.id as string } }));
    const seenSafe = (await loadSceneTowns(asDb(world.playerA), campaignId))?.get(1);
    expect(seenSafe?.name).toBe('Marlow Ford');
    expect(seenSafe?.places.map((p) => p.name)).toEqual(['The Ford Inn']);
  });
});
