// December piece 2c: a place's aspects as pieces with a bold lead-in (supabase/migrations/
// 20261111170000_dec_2c_piece_lead.sql; docs/plans/dec-2-3-places-and-port.md; ruling pf-3). TEST project only;
// invented packs, places and people. What it checks, in plain words:
//   * picking a location makes each aspect a piece with its lead; a piece added by hand has none (null);
//   * hidden means hidden: a player never reads an unshown piece's lead, not from the pieces table, not through
//     scene_pieces, not through known_places_campaign; once the GM shows one aspect, its lead reaches the player and
//     the other's still doesn't;
//   * a lead can't be changed after the piece is made.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { addPiece, loadGroupPlaces, loadScenePlaces, loadShownPlaces, showPiece } from '../../src/modules/expedition/placePlay.ts';
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

/** An invented adventure: an inn with a description and two aspects, the second a secret the GM may never show. */
const innPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Reed Lantern', version: '0.1', kind: 'adventure' },
      locations: [
        {
          id: 'eel-and-lantern',
          name: 'The Eel and Lantern',
          type: 'building',
          playerView: {
            text: 'Three storeys of tarred timber leaning over the quay.',
            aspects: [
              { lead: 'Sign', text: 'A brass lantern with an eel coiled round it.' },
              { lead: 'Hidden stair', text: 'Behind the hearth, a narrow stair goes down.' },
            ],
          },
        },
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
  packId = await ok(as(world.gm, importPack, { pack: innPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("an aspect's lead-in (pf-3)", () => {
  it('is made with the piece, hidden from players until shown, and never changes', async () => {
    const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
    const entry = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'eel-and-lantern');
    if (!entry) throw new Error('no entry');
    const inn = await ok(as(world.gm, placeFromPack, { campaignId, entry }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: inn.id }));
    let visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    expect(visit.pieces.map((p) => [p.kind, p.lead ?? ''])).toEqual([
      ['description', ''],
      ['other', 'Sign'],
      ['other', 'Hidden stair'],
    ]);
    // A piece added by hand carries no lead (the GM's + Piece gains nothing for it).
    await ok(as(world.gm, addPiece, { campaignId, placeId: inn.id, kind: 'exit', text: 'A door to the yard' }));
    const typed = must(await world.admin.from('place_pieces').select('lead').eq('place_id', inn.id).eq('body', 'A door to the yard'));
    expect(typed).toEqual([{ lead: null }]);

    // Nothing shown: the player reads no lead anywhere.
    expect(must(await world.playerA.db.from('place_pieces').select('id, lead').eq('place_id', inn.id))).toEqual([]);
    expect((await loadScenePlaces(asDb(world.playerA), campaignId))?.get(1)).toBeUndefined();
    expect(JSON.stringify(must(await world.playerA.db.rpc('scene_pieces', { campaign: campaignId })))).not.toContain('Sign');
    expect(JSON.stringify(must(await world.playerA.db.rpc('known_places_campaign', { campaign: campaignId })))).not.toContain('Sign');

    // The GM shows the description and the sign: the player reads the sign's lead, and never the hidden stair's.
    visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[1]! }));
    const seen = (await loadScenePlaces(asDb(world.playerA), campaignId))?.get(1);
    expect(seen?.pieces.map((p) => [p.lead ?? '', p.text])).toEqual([
      ['', 'Three storeys of tarred timber leaning over the quay.'],
      ['Sign', 'A brass lantern with an eel coiled round it.'],
    ]);
    const known = await loadShownPlaces(asDb(world.playerA), campaignId);
    expect(known?.current[0]?.pieces.map((p) => p.lead ?? '')).toEqual(['', 'Sign']);
    const everything = JSON.stringify([must(await world.playerA.db.rpc('scene_pieces', { campaign: campaignId })), must(await world.playerA.db.rpc('known_places_campaign', { campaign: campaignId }))]);
    expect(everything).not.toContain('Hidden stair');
    expect(everything).not.toContain('narrow stair');

    // The lead is the piece's as made: the GM can't change it.
    const sign = visit.pieces[1]!;
    const changed = await world.gm.db.from('place_pieces').update({ lead: 'Shop sign' }).eq('id', sign.id).select('id');
    expect(changed.error?.message).toContain("can't be changed");
  });
});
