// M5b step 1 follow-up, build order 7: a place's picture (supabase/migrations/20261103200000_m5b_1b_place_picture.sql
// and 20261103201000_m5b_1b_picture_shown_on_its_own.sql; ruled 2026-11-03, m5b-1 ⚑ 2, and B on the follow-up's ⚑:
// players get it only when the GM shows the picture itself; docs/03, hidden means hidden). TEST project only.
//   The GM uploads a picture (an asset of kind 'place', the GM's) and makes it the place's picture piece, hidden.
//   A player reads it (its asset row, a link to its file, public.scene_pictures) only once the GM shows the picture
//   itself to their group: not while only a piece is shown, not after Hide the picture or Hide all, never as a player
//   of another group, never from outside the campaign. A return visit brings it back if it was shown at the end of
//   the last visit (gp-5). Change picture retires the old one; Undo brings it back. Players can't set one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPlacePicture, setPlacePicture } from '../../src/modules/expedition/placePicture.ts';
import { addPiece, hideAllPieces, hidePiece, loadGroupPlaces, loadScenePlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
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

/** A fresh campaign: Reed (player A's) and Moss (player B's), an expedition under way at the Heron Jetty. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Drowned Chapter', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Heron Jetty' }));
  const visit = async (group = 1) => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(group)!;
  const first = await visit();
  const upload = () => ok(as(world.gm, addPlacePicture, { campaignId, place: first.place!, image: new Blob(['a heron on a post'], { type: 'image/jpeg' }) }));
  // The GM's picture of the jetty, uploaded and made the place's picture (hidden), and one line players may be shown.
  const assetId = await upload();
  await ok(as(world.gm, setPlacePicture, { campaignId, place: first.place!, assetId }));
  const piece = await ok(as(world.gm, addPiece, { campaignId, placeId: first.placeId!, kind: 'description', text: 'A rotten jetty over black water' }));
  const showPicture = async (group = 1) => ok(as(world.gm, showPiece, { campaignId, row: await visit(group), piece: { id: (await visit(group)).picture!.id } }));
  return { campaignId, visit, assetId, piece, upload, showPicture, place: first.place!, moss: { id: moss!.id, campaignId, ownerUserId: world.playerB.id } };
}

/** What this person can read of the picture: its asset row, a link to its file, and the scene's picture ids. */
async function reads(person: Person, campaignId: string, assetId: string) {
  forgetFileLinks();
  const row = must(await person.db.from('assets').select('id').eq('id', assetId));
  const link = await person.db.storage.from(FILES_BUCKET).createSignedUrls([assetPath(campaignId, assetId)], 60);
  const file = (link.data ?? []).some((l) => !!l.signedUrl && !l.error);
  const scene = must(await person.db.rpc('scene_pictures', { campaign: campaignId })) as { group_number: number; asset_id: string }[];
  return { row: row.length === 1, file, scene: scene.map((s) => s.asset_id) };
}
const nothing = { row: false, file: false, scene: [] };

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("a place's picture: shown on its own (ruled B, 2026-11-03; docs/03)", () => {
  // Purpose: the GM's picture is the GM's: an asset of kind 'place', the place's picture piece (hidden), read by the GM.
  it('the GM uploads a picture, an asset of kind place, made the place\'s picture and hidden', async () => {
    const t = await freshTable();
    expect(must(await world.admin.from('assets').select('kind, visibility').eq('id', t.assetId))).toEqual([{ kind: 'place', visibility: 'gm' }]);
    const row = await t.visit();
    expect(row.picture).toMatchObject({ assetId: t.assetId, shown: false });
    // It isn't one of the text pieces.
    expect(row.pieces.map((p) => p.text)).toEqual(['A rotten jetty over black water']);
    expect(await reads(world.gm, t.campaignId, t.assetId)).toMatchObject({ row: true, file: true });
  });

  // Purpose: showing a piece no longer reveals the picture: only its own eye does, and hiding it takes it back.
  it('a player reads nothing of the picture while only a piece is shown; its own eye shows it, and hides it', async () => {
    const t = await freshTable();
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: await t.visit(), piece: { id: t.piece } }));
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    expect((await loadScenePlaces(asDb(world.playerA), t.campaignId))!.get(1)).toMatchObject({ pictureAssetId: null, pieces: [{ text: 'A rotten jetty over black water' }] });

    await t.showPicture();
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual({ row: true, file: true, scene: [t.assetId] });
    // The picture reaches the player as the picture, never as a line of text.
    expect((await loadScenePlaces(asDb(world.playerA), t.campaignId))!.get(1)).toMatchObject({ pictureAssetId: t.assetId, pieces: [{ text: 'A rotten jetty over black water' }] });

    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row: await t.visit(), piece: { id: (await t.visit()).picture!.id } }));
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
  });

  // Purpose: the picture shown alone (no text piece) still reaches the player with the place's name.
  it('the picture shown alone reaches the player with the place\'s name', async () => {
    const t = await freshTable();
    await t.showPicture();
    expect((await loadScenePlaces(asDb(world.playerA), t.campaignId))!.get(1)).toMatchObject({ name: 'The Heron Jetty', pieces: [], pictureAssetId: t.assetId });
  });

  // Purpose: Hide all hides the picture with the pieces.
  it('Hide all hides the picture too', async () => {
    const t = await freshTable();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: await t.visit(), piece: { id: t.piece } }));
    await t.showPicture();
    expect(await ok(as(world.gm, hideAllPieces, { campaignId: t.campaignId, row: await t.visit() }))).toBe(2);
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
  });

  // Purpose: shown to Group 1, the picture reaches Group 1 only; outsiders and another campaign's players get nothing.
  it("a player of another group, an outsider and another campaign's player read nothing", async () => {
    const t = await freshTable();
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await t.showPicture(1);
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toMatchObject({ row: true, file: true });
    expect(await reads(world.playerB, t.campaignId, t.assetId)).toEqual(nothing);
    expect(await reads(world.outsider, t.campaignId, t.assetId)).toEqual(nothing);
    expect(await reads(world.newcomer, t.campaignId, t.assetId)).toEqual(nothing);
  });

  // Purpose: a return visit brings the picture back when it was shown at the end of the last visit (gp-5), and not
  // when it wasn't.
  it('a return visit brings the picture back if it was shown when the group left', async () => {
    const t = await freshTable();
    await t.showPicture();
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Reed Bank' }));
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    const back = await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Heron Jetty' }));
    expect(back.backShown).toBe(1);
    expect((await t.visit()).picture).toMatchObject({ shown: true });
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toMatchObject({ row: true, file: true, scene: [t.assetId] });
  });

  // Purpose: Change picture retires the old one (hidden from players with it), the new one starts hidden, and Undo
  // brings the old one back; Take it off leaves no picture, and its Undo brings it back.
  it('Change picture retires the old one and Undo brings it back; Take it off too', async () => {
    const t = await freshTable();
    await t.showPicture();
    const next = await t.upload();
    await ok(as(world.gm, setPlacePicture, { campaignId: t.campaignId, place: t.place, assetId: next }));
    expect((await t.visit()).picture).toMatchObject({ assetId: next, shown: false });
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    expect(await reads(world.playerA, t.campaignId, next)).toEqual(nothing);

    const latest = async () => must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId).eq('type', 'place.setPicture').order('seq', { ascending: false }).limit(1))[0]!.id as string;
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: await latest(), authorUserId: world.gm.id }));
    expect((await t.visit()).picture).toMatchObject({ assetId: t.assetId, shown: true });
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toMatchObject({ row: true, file: true });

    await ok(as(world.gm, setPlacePicture, { campaignId: t.campaignId, place: t.place, assetId: null }));
    expect((await t.visit()).picture).toBeNull();
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: await latest(), authorUserId: world.gm.id }));
    expect((await t.visit()).picture).toMatchObject({ assetId: t.assetId });
  });
});

describe("a place's picture: who may set it", () => {
  // Purpose: players can't upload or set a place's picture, as commands or straight to the database.
  it("players can't upload or set a picture", async () => {
    const t = await freshTable();
    expect((await as(world.playerA, addPlacePicture, { campaignId: t.campaignId, place: t.place, image: new Blob(['x'], { type: 'image/jpeg' }) })).ok).toBe(false);
    expect((await as(world.playerA, setPlacePicture, { campaignId: t.campaignId, place: t.place, assetId: null })).ok).toBe(false);
    const sneaky = await world.playerA.db.from('assets').insert({ campaign_id: t.campaignId, kind: 'place', name: 'Sneaky', visibility: 'all' }).select('id');
    expect(sneaky.error).toBeTruthy();
    const rpc = await world.playerA.db.rpc('set_place_picture', { place: t.place.id, asset: null });
    expect(rpc.error).toBeTruthy();
    expect((await t.visit()).picture).toMatchObject({ assetId: t.assetId });
  });

  // Purpose: a picture piece needs a place picture of its own campaign (not a portrait, not another campaign's), and
  // a picture stays a picture.
  it("a portrait or another campaign's picture is refused, and a picture can't become a line", async () => {
    const t = await freshTable();
    const other = await freshTable();
    const portrait = must(await world.admin.from('assets').insert({ campaign_id: t.campaignId, kind: 'portrait', name: 'Reed', visibility: 'all' }).select('id').single()).id as string;
    for (const assetId of [portrait, other.assetId]) {
      const tried = await world.gm.db.rpc('set_place_picture', { place: t.place.id, asset: assetId });
      expect(tried.error?.message).toContain("can't be this place's picture");
    }
    const turned = await world.gm.db.rpc('edit_place_piece', { piece: (await t.visit()).picture!.id, kind: 'exit', body: 'Not a picture' });
    expect(turned.error?.message).toContain('A picture stays a picture');
  });
});
