// A place's map (dec-7 piece 5m-2; supabase/migrations/20261114210000_dec_7_5m_2_place_map.sql; plan
// docs/plans/dec-7-5-place-page-and-map.md; docs/03, hidden means hidden). TEST project only.
//   The GM uploads a map's copy (an asset of kind 'map', visibility 'gm') and ties it to a place
//   (places.map_asset_id). The GM reads the tie, the asset row and its file. A player of the campaign and an outsider
//   read nothing of it (not the place's row, not the asset row, not the file) while its visibility is 'gm'. The tie
//   takes only a map of the place's own campaign; Undo unties it; players can't tie or upload one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addPlaceMap, loadPlaceMap, setPlaceMap } from '../../src/modules/expedition/placeMap.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
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

/** A fresh campaign with a player, an expedition under way at the Salt Steps, and the GM's map of it, tied. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select('id'));
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Salt Steps' }));
  const placeNow = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
  const first = await placeNow();
  const upload = () => ok(as(world.gm, addPlaceMap, { campaignId, place: first, title: 'The Salt Steps, a sketch', image: new Blob(['a sketch of steps'], { type: 'image/png' }) }));
  const assetId = await upload();
  await ok(as(world.gm, setPlaceMap, { campaignId, place: first, assetId }));
  // The place as it is after the tie (its version moved on), so later writes aren't refused as from an old copy.
  return { campaignId, place: await placeNow(), assetId, upload };
}

/** What this person reads of the map: the place's tie, the asset row, and a link to its file. */
async function reads(person: Person, campaignId: string, placeId: string, assetId: string) {
  forgetFileLinks();
  const tie = must(await person.db.from('places').select('map_asset_id').eq('id', placeId)) as { map_asset_id: string | null }[];
  const row = must(await person.db.from('assets').select('id').eq('id', assetId));
  const link = await person.db.storage.from(FILES_BUCKET).createSignedUrls([assetPath(campaignId, assetId)], 60);
  const file = (link.data ?? []).some((l) => !!l.signedUrl && !l.error);
  return { tie: tie[0]?.map_asset_id ?? null, row: row.length === 1, file };
}
const nothing = { tie: null, row: false, file: false };

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("a place's map: the GM's alone (dec-7 5m-2; docs/03)", () => {
  // Purpose: + Map's copy is a map asset the GM alone may see, tied to the place; the GM reads the tie, the row and the
  // file, and the place's map reads as added under the copy's name.
  it('the GM reads the tie, the asset and its file', async () => {
    const t = await freshTable();
    expect(must(await world.admin.from('assets').select('kind, visibility, name').eq('id', t.assetId))).toEqual([{ kind: 'map', visibility: 'gm', name: 'The Salt Steps, a sketch' }]);
    expect(await reads(world.gm, t.campaignId, t.place.id, t.assetId)).toEqual({ tie: t.assetId, row: true, file: true });
    expect(await loadPlaceMap(asDb(world.gm), t.campaignId, t.place)).toEqual({ kind: 'added', assetId: t.assetId, title: 'The Salt Steps, a sketch', alt: 'The Salt Steps, a sketch, the map' });
  });

  // Purpose: hidden means hidden: while the map's visibility is gm, a player of the campaign and an outsider read
  // nothing of it: not the tie, not the asset row, not the file.
  it('a player and an outsider read nothing while it is the GM’s', async () => {
    const t = await freshTable();
    expect(await reads(world.playerA, t.campaignId, t.place.id, t.assetId)).toEqual(nothing);
    expect(await reads(world.outsider, t.campaignId, t.place.id, t.assetId)).toEqual(nothing);
    expect(await loadPlaceMap(asDb(world.playerA), t.campaignId, t.place)).toEqual({ kind: 'none' });
  });

  // Purpose: the tie's line is the GM's, and Undo takes the map off the place (the copy itself stays, unseen).
  it('the tie is logged for the GM and Undo unties it', async () => {
    const t = await freshTable();
    const line = must(await world.admin.from('events').select('id, audience').eq('campaign_id', t.campaignId).eq('type', 'place.setMap').order('seq', { ascending: false }).limit(1))[0] as { id: string; audience: string };
    expect(line.audience).toBe('gm');
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: line.id, authorUserId: world.gm.id }));
    expect((await reads(world.gm, t.campaignId, t.place.id, t.assetId)).tie).toBeNull();
    expect(await loadPlaceMap(asDb(world.gm), t.campaignId, t.place)).toEqual({ kind: 'none' });
  });
});

describe("a place's map: who may set it, and what", () => {
  // Purpose: players can't upload a map or tie one, as commands or straight to the database.
  it("players can't upload or tie a map", async () => {
    const t = await freshTable();
    expect((await as(world.playerA, addPlaceMap, { campaignId: t.campaignId, place: t.place, title: 'Mine', image: new Blob(['x'], { type: 'image/png' }) })).ok).toBe(false);
    expect((await as(world.playerA, setPlaceMap, { campaignId: t.campaignId, place: t.place, assetId: null })).ok).toBe(false);
    const sneaky = await world.playerA.db.from('assets').insert({ campaign_id: t.campaignId, kind: 'map', name: 'Sneaky', visibility: 'all' }).select('id');
    expect(sneaky.error).toBeTruthy();
    const untie = await world.playerA.db.from('places').update({ map_asset_id: null }).eq('id', t.place.id).select('id');
    expect(untie.data ?? []).toEqual([]);
    expect((await reads(world.gm, t.campaignId, t.place.id, t.assetId)).tie).toBe(t.assetId);
  });

  // Purpose: a place's map is a map of its own campaign: a portrait, a place's picture or another campaign's map is
  // refused.
  it("a portrait, a place's picture or another campaign's map is refused", async () => {
    const t = await freshTable();
    const other = await freshTable();
    const portrait = must(await world.admin.from('assets').insert({ campaign_id: t.campaignId, kind: 'portrait', name: 'Reed', visibility: 'all' }).select('id').single()).id as string;
    const picture = must(await world.admin.from('assets').insert({ campaign_id: t.campaignId, kind: 'place', name: 'The steps', visibility: 'gm' }).select('id').single()).id as string;
    for (const assetId of [portrait, picture, other.assetId]) {
      const tried = await as(world.gm, setPlaceMap, { campaignId: t.campaignId, place: t.place, assetId });
      expect(tried.ok).toBe(false);
    }
    expect((await reads(world.gm, t.campaignId, t.place.id, t.assetId)).tie).toBe(t.assetId);
  });
});
