// December step 3, rows W4b and W4c: a place in town's shown parts (docs/plans/dec-3-the-whole-town.md; brief
// docs/plans/briefs/dec-3-w4b-w4c-place-in-town-brief.md at 52f7bb2f; tr-1 and ge-1, Francis 2026-11-14; migration
// 20261115130000_dec_3_w4b_w4c_place_in_town.sql). Tests on what the database sends and refuses, never on a screen.
// TEST project only; invented names. Written by a local builder with no database: the Builder runs it on TEST.
//
// The world: the party (Wren, Player A; Ash, Player B) in the town of Fenwick, made from a pack and marked Safe. One
// level under Fenwick: the Lantern Chapel (its GM name "…of Saint Gloam", its players' name "A small chapel"), in the
// town's list as `place:<chapel>`. Two levels under: the chapel's crypt. Another town, Saltford, with its mill. A place
// made by hand. Each scenario starts a fresh expedition (ending the last), so scenarios don't see each other's visits.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { hideAllPieces, setPlace } from '../../src/modules/expedition/placePlay.ts';
import { hideTownPiece, showTownPiece } from '../../src/modules/expedition/townParts.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}
const undo = (person: Person, eventId: string) => as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: person.id });
const latestEvent = async (type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;

type Row = Record<string, unknown>;
const read = async (person: Person, fn: string, campaign = world.campaignId) => {
  const { data, error } = await person.db.rpc(fn, { campaign });
  if (error) throw error;
  return (data ?? []) as Row[];
};
const pieceIds = async (person: Person) => (await read(person, 'scene_town_pieces')).map((r) => r.piece_id);
const gmEyes = async (person: Person, visit: string) => {
  const { data, error } = await person.db.rpc('town_parts_shown', { visit });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => r.piece_id);
};

const GM_NAME = 'The Lantern Chapel of Saint Gloam';
const PLAYERS_NAME = 'A small chapel';

/** One fresh scenario: an expedition under way, the party (group 1) in Fenwick, the town's description shown. */
async function scene(options: { townShown?: boolean } = {}) {
  const tag = crypto.randomUUID().slice(0, 8);
  const pack = crypto.randomUUID();
  const ids = { town: `fenwick-${tag}`, chapel: `lantern-chapel-${tag}`, crypt: `chapel-crypt-${tag}`, saltford: `saltford-${tag}`, mill: `saltford-mill-${tag}` };
  const campaign = world.campaignId;
  must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('campaign_id', campaign).is('ended_at', null).eq('undone', false).select());
  const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: campaign, mode: 'dungeon' }).select('id').single()).id as string;
  const entry = (name: string, shown = true) => ({ name, kind: 'other', shown, open: true });
  const place = async (row: Row) => must(await world.admin.from('places').insert({ campaign_id: campaign, ...row }).select('id').single()).id as string;
  const town = await place({
    name: `Fenwick ${tag}`,
    players_name: 'A market town',
    pack_id: pack,
    pack_entry_id: ids.town,
    safety: 'safe',
    // The crypt and Saltford's mill are listed too, so only their depth or their parent refuses them.
    town: { [`place:${ids.chapel}`]: entry(PLAYERS_NAME), [`place:${ids.crypt}`]: entry('A crypt'), [`place:${ids.mill}`]: entry('A mill') },
  });
  const chapel = await place({ name: `${GM_NAME} ${tag}`, players_name: PLAYERS_NAME, pack_id: pack, pack_entry_id: ids.chapel, pack_parent_id: ids.town });
  const crypt = await place({ name: `Crypt ${tag}`, pack_id: pack, pack_entry_id: ids.crypt, pack_parent_id: ids.chapel });
  const saltford = await place({ name: `Saltford ${tag}`, pack_id: pack, pack_entry_id: ids.saltford, safety: 'safe', town: { [`place:${ids.mill}`]: entry('A mill') } });
  const mill = await place({ name: `Saltford Mill ${tag}`, pack_id: pack, pack_entry_id: ids.mill, pack_parent_id: ids.saltford });
  const byHand = await place({ name: `A shed by hand ${tag}` });
  const piece = async (placeId: string, kind: string, body: string, extra: Row = {}) =>
    must(await world.admin.from('place_pieces').insert({ campaign_id: campaign, place_id: placeId, kind, body, ...extra }).select('id').single()).id as string;
  const pieces = {
    townDescription: await piece(town, 'description', 'Stalls under a leaning clock tower.'),
    description: await piece(chapel, 'description', 'Candles in green glass, and a [[npc:old-tom|warden]] asleep.', { lead: 'Smells of wax' }),
    clue: await piece(chapel, 'clue', 'A loose flagstone by the font.'),
    person: await piece(chapel, 'person', 'Sister Wick, who keeps the keys and owes the Bog lurker a debt.'),
    crypt: await piece(crypt, 'description', 'Bones in niches.'),
    mill: await piece(mill, 'description', 'A wheel turning in brown water.'),
    byHand: await piece(byHand, 'description', 'Rakes and a broken cart.'),
  };
  const visit = must(await world.admin.from('group_places').insert({ campaign_id: campaign, expedition_id: expedition, group_number: 1, place_id: town }).select('id').single()).id as string;
  if (options.townShown !== false) {
    must(await world.admin.from('piece_shows').insert({ campaign_id: campaign, group_place_id: visit, piece_id: pieces.townDescription, group_number: 1 }).select());
  }
  const show = (pieceId: string, at = visit) => as(world.gm, showTownPiece, { campaignId: campaign, visitId: at, pieceId });
  const hide = (pieceId: string, at = visit) => as(world.gm, hideTownPiece, { campaignId: campaign, visitId: at, pieceId });
  const setEntry = async (key: string, shown: boolean) => {
    const row = must(await world.admin.from('places').select('town').eq('id', town).single());
    const list = row.town as Record<string, Row>;
    list[key] = { ...list[key], shown };
    must(await world.admin.from('places').update({ town: list }).eq('id', town).select('id'));
  };
  return { tag, ids, expedition, town, chapel, crypt, saltford, mill, byHand, pieces, visit, show, hide, setEntry };
}

/** The visit a group is on now (newest, not moved on or undone), in the running expedition. */
async function visitOf(group: number, expedition: string) {
  return must(
    await world.admin
      .from('group_places')
      .select('id, place_id')
      .eq('campaign_id', world.campaignId)
      .eq('expedition_id', expedition)
      .eq('group_number', group)
      .eq('moved_on', false)
      .eq('undone', false)
      .order('created_at', { ascending: false })
      .limit(1),
  )[0] as { id: string; place_id: string };
}

const wren = () => ({ id: world.wrenId, campaignId: world.campaignId, ownerUserId: world.playerA.id });
const ash = () => ({ id: world.ashId, campaignId: world.campaignId, ownerUserId: world.playerB.id });
// A third character, the GM's own, who stays in group 1 unless moved: with only two characters, a group someone joins
// while the other group still has members would always be merged into one by the database's tidy-up
// (private.tidy_party_groups: everyone in one group becomes group 1).
let reedId = '';
const reed = () => ({ id: reedId, campaignId: world.campaignId, ownerUserId: world.gm.id });
/**
 * Everyone back in group 1, by the GM's Split the party (the member rows take no direct write; a player may not join a
 * group that is in another place, the GM may).
 */
async function together() {
  const rows = must(await world.admin.from('party_group_members').select('actor_id, group_number').eq('campaign_id', world.campaignId));
  for (const row of rows) {
    if (row.group_number === 1) continue;
    const character = row.actor_id === world.wrenId ? wren() : row.actor_id === world.ashId ? ash() : row.actor_id === reedId ? reed() : null;
    if (character) await ok(as(world.gm, chooseGroup, { character, group: 1 }));
  }
}

beforeAll(async () => {
  world = await buildWorld();
  // The newcomer is a member of the campaign with no character (so in no group).
  must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.newcomer.id, base_role: 'player' }).select());
  // The latecomer plays in the other campaign only.
  must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.latecomer.id, base_role: 'player' }).select());
  reedId = must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Reed the Lantern Warden', owner_type: 'user', owner_user_id: world.gm.id, approval: 'approved', status: 'active', level: 1 })
      .select('id')
      .single(),
  ).id as string;
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 120_000);

describe('W4b: what a player reads of a place in town (tr-1)', () => {
  // Purpose: a player in the town reads a shown piece of a shown place one level under it, with exactly
  // scene_pieces' columns plus the entry's key, the place under its players' name and link marks stripped.
  it('sends the shown piece, with exactly these columns and nothing else', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    const rows = await read(world.playerA, 'scene_town_pieces');
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(['body', 'entry_key', 'group_number', 'kind', 'lead', 'piece_id', 'place_name']);
    expect(rows[0]).toEqual({
      group_number: 1,
      place_name: PLAYERS_NAME,
      piece_id: t.pieces.description,
      kind: 'description',
      body: 'Candles in green glass, and a warden asleep.',
      lead: 'Smells of wax',
      entry_key: `place:${t.ids.chapel}`,
    });
    // The GM's name of the place, its id and the place row reach no player.
    const payload = JSON.stringify([rows, await read(world.playerA, 'scene_town_pictures')]);
    expect(payload).not.toContain('Saint Gloam');
    expect(payload).not.toContain(t.chapel);
    expect(payload).not.toContain('old-tom');
    // Both players of the party read it.
    expect(await pieceIds(world.playerB)).toEqual([t.pieces.description]);
  });

  // Purpose: anything short of every test sends nothing: a piece not shown, a piece undone, the place's entry hidden
  // (and back once shown again), a visit moved on or undone.
  it('sends nothing for an unshown or undone piece, a hidden entry, or a visit moved on or undone', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    await ok(t.show(t.pieces.clue));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description, t.pieces.clue]);
    // Not shown: the person piece was never shown, and is not there.
    await ok(t.hide(t.pieces.clue));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    // The entry hidden: its parts stop at once; the store's rows stay as they are; shown again, they're back.
    await t.setEntry(`place:${t.ids.chapel}`, false);
    expect(await pieceIds(world.playerA)).toEqual([]);
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description]);
    await t.setEntry(`place:${t.ids.chapel}`, true);
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    // The piece undone.
    must(await world.admin.from('place_pieces').update({ undone: true }).eq('id', t.pieces.description).select('id'));
    expect(await pieceIds(world.playerA)).toEqual([]);
    // A visit moved on, then (another scenario) a visit undone.
    const u = await scene();
    await ok(u.show(u.pieces.description));
    must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', u.visit).select('id'));
    expect(await pieceIds(world.playerA)).toEqual([]);
    const v = await scene();
    await ok(v.show(v.pieces.description));
    must(await world.admin.from('group_places').update({ undone: true }).eq('id', v.visit).select('id'));
    expect(await pieceIds(world.playerA)).toEqual([]);
  });

  // Purpose: a piece of kind person (it may hold every line of a pack's person) never reaches a player, shown or not,
  // until W8; the GM's eye still records the show.
  it("never sends a person's piece, even shown", async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.person));
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.person]);
    expect(await pieceIds(world.playerA)).toEqual([]);
    expect(JSON.stringify(await read(world.playerA, 'scene_town_pieces'))).not.toContain('Sister Wick');
  });

  // Purpose: a part of a place never arrives before the town itself is shown on the visit (scene_town's own test).
  it('sends nothing until a piece of the town itself is shown on the visit', async () => {
    await together();
    const t = await scene({ townShown: false });
    await ok(t.show(t.pieces.description));
    expect(await pieceIds(world.playerA)).toEqual([]);
    must(await world.admin.from('piece_shows').insert({ campaign_id: world.campaignId, group_place_id: t.visit, piece_id: t.pieces.townDescription, group_number: 1 }).select());
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
  });

  // Purpose: nobody outside the group reads it: a player of another group, a member with no character, an outsider and
  // another campaign's player; and no player reads the store or the reset marker directly.
  it('reaches no one outside the group, and no player reads the store or its markers', async () => {
    await together();
    const t = await scene();
    // Ash goes to a group of their own (group 2) before anything of the chapel is shown.
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    await ok(t.show(t.pieces.description));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    for (const [who, person] of [['another group', world.playerB], ['no character', world.newcomer], ['an outsider', world.outsider], ['another campaign', world.latecomer]] as const) {
      expect(await read(person, 'scene_town_pieces'), who).toEqual([]);
      expect(await read(person, 'scene_town_pictures'), who).toEqual([]);
      expect(await gmEyes(person, t.visit), who).toEqual([]);
    }
    for (const person of [world.playerA, world.playerB, world.newcomer, world.outsider, world.latecomer]) {
      expect(must(await person.db.from('town_piece_shows').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
      expect(must(await person.db.from('town_piece_resets').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
    }
    // The GM reads both.
    expect(must(await world.gm.db.from('town_piece_shows').select('id').eq('group_place_id', t.visit))).toHaveLength(1);
    expect(must(await world.gm.db.from('town_piece_resets').select('id').eq('campaign_id', world.campaignId)).length).toBeGreaterThan(0);
  });

  // Purpose: between expeditions the group is still in the town (the town's own list's rule); after moving on, nothing;
  // back in the town on a new visit, nothing until the GM shows it again, and the earlier visit's rows are kept.
  it('holds between expeditions, stops on moving on, and starts empty on a new visit', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('id', t.expedition).select('id'));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    // A new expedition: back at the town on a new visit (the old one moved on).
    must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', t.visit).select('id'));
    expect(await pieceIds(world.playerA)).toEqual([]);
    const trip = must(await world.admin.from('expeditions').insert({ campaign_id: world.campaignId, mode: 'dungeon' }).select('id').single()).id as string;
    const again = must(await world.admin.from('group_places').insert({ campaign_id: world.campaignId, expedition_id: trip, group_number: 1, place_id: t.town }).select('id').single()).id as string;
    must(await world.admin.from('piece_shows').insert({ campaign_id: world.campaignId, group_place_id: again, piece_id: t.pieces.townDescription, group_number: 1 }).select());
    expect(await pieceIds(world.playerA)).toEqual([]);
    expect(must(await world.admin.from('town_piece_shows').select('id').eq('group_place_id', t.visit).eq('undone', false))).toHaveLength(1);
    await ok(t.show(t.pieces.description, again));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
  });
});

describe('W4b: a place in town\'s picture (tr-1, "picture")', () => {
  // Purpose: a place in town's one shown picture reaches the player with the entry's key, beside the town's own picture
  // from scene_pictures (unchanged); its file is readable exactly while the read sends it, and no other asset opens.
  it('reads under its tests, beside the town picture, and opens that one file only', async () => {
    await together();
    const t = await scene();
    const upload = async (name: string) => {
      const id = must(await world.admin.from('assets').insert({ campaign_id: world.campaignId, kind: 'place', name, visibility: 'gm' }).select('id').single()).id as string;
      must(await world.admin.storage.from(FILES_BUCKET).upload(assetPath(world.campaignId, id), new Blob([name], { type: 'image/jpeg' }), { upsert: true }));
      return id;
    };
    const townAsset = await upload('The clock tower');
    const chapelAsset = await upload('The chapel door');
    const otherAsset = await upload('The chapel crypt map');
    const townPicture = must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: t.town, kind: 'picture', body: 'A picture', asset_id: townAsset, position: -1 }).select('id').single()).id as string;
    const chapelPicture = must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: t.chapel, kind: 'picture', body: 'A picture', asset_id: chapelAsset, position: -1 }).select('id').single()).id as string;
    // A second picture of the chapel, never shown: its file never opens.
    must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: t.chapel, kind: 'picture', body: 'A picture', asset_id: otherAsset, position: -2 }).select('id'));
    must(await world.admin.from('piece_shows').insert({ campaign_id: world.campaignId, group_place_id: t.visit, piece_id: townPicture, group_number: 1 }).select());
    const file = async (person: Person, asset: string) => {
      forgetFileLinks();
      const link = await person.db.storage.from(FILES_BUCKET).createSignedUrls([assetPath(world.campaignId, asset)], 60);
      return (link.data ?? []).some((l) => !!l.signedUrl && !l.error);
    };
    const townPictures = async (person: Person) => (await read(person, 'scene_pictures')).map((r) => r.asset_id);
    expect(await townPictures(world.playerA)).toEqual([townAsset]);
    expect(await read(world.playerA, 'scene_town_pictures')).toEqual([]);
    expect(await file(world.playerA, chapelAsset)).toBe(false);

    await ok(t.show(chapelPicture));
    const pictures = await read(world.playerA, 'scene_town_pictures');
    expect(pictures).toEqual([{ group_number: 1, entry_key: `place:${t.ids.chapel}`, asset_id: chapelAsset }]);
    expect(Object.keys(pictures[0]!).sort()).toEqual(['asset_id', 'entry_key', 'group_number']);
    expect(await townPictures(world.playerA)).toEqual([townAsset]);
    expect(await file(world.playerA, chapelAsset)).toBe(true);
    expect(await file(world.playerA, otherAsset)).toBe(false);
    // Another group, a member with no character, an outsider, another campaign: no file.
    for (const person of [world.newcomer, world.outsider, world.latecomer]) expect(await file(person, chapelAsset)).toBe(false);
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    expect(await file(world.playerB, chapelAsset)).toBe(false);
    await together();
    // The entry hidden: no picture, no file; shown again: back.
    await t.setEntry(`place:${t.ids.chapel}`, false);
    expect(await read(world.playerA, 'scene_town_pictures')).toEqual([]);
    expect(await file(world.playerA, chapelAsset)).toBe(false);
    await t.setEntry(`place:${t.ids.chapel}`, true);
    expect(await file(world.playerA, chapelAsset)).toBe(true);
    // Hidden: no picture, no file.
    await ok(t.hide(chapelPicture));
    expect(await read(world.playerA, 'scene_town_pictures')).toEqual([]);
    expect(await file(world.playerA, chapelAsset)).toBe(false);
    // Shown again, then the visit moved on: no picture, no file.
    await ok(t.show(chapelPicture));
    expect(await file(world.playerA, chapelAsset)).toBe(true);
    must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', t.visit).select('id'));
    expect(await read(world.playerA, 'scene_town_pictures')).toEqual([]);
    expect(await file(world.playerA, chapelAsset)).toBe(false);
  });
});

describe('W4b: the existing readers are untouched in effect', () => {
  // Purpose: with a piece of a place in town shown, every existing reader of piece_shows returns exactly what it did
  // before (the store is never in piece_shows), and Hide all on the town does not reach the store.
  it('scene_pieces, scene_pictures, scene_town, known places and ways read the same before and after', async () => {
    await together();
    const t = await scene();
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all(['scene_pieces', 'scene_pictures', 'scene_town', 'known_places_campaign', 'known_places', 'campaign_ways_on'].map((fn) => read(world.playerA, fn))),
      );
    const before = await snapshot();
    await ok(t.show(t.pieces.description));
    await ok(t.show(t.pieces.clue));
    expect(await snapshot()).toEqual(before);
    expect(JSON.stringify(await read(world.playerA, 'scene_pieces'))).not.toContain('green glass');
    // Hide all hides the town's own pieces only.
    await ok(as(world.gm, hideAllPieces, { campaignId: world.campaignId, row: { id: t.visit } }));
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description, t.pieces.clue]);
  });

  // Purpose: a move away and back, and a split, still succeed with a piece of a place in town shown.
  it('a move away and back, and a split, still work', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    await ok(as(world.gm, setPlace, { campaignId: world.campaignId, group: 1, name: '', placeId: t.byHand }));
    await ok(as(world.gm, setPlace, { campaignId: world.campaignId, group: 1, name: '', placeId: t.town }));
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: 1 }));
  });
});

describe('W4c: the GM shows a part of a place in town (ge-1)', () => {
  // Purpose: the GM shows and hides a piece of a place in town while the party is in the town; a repeat changes
  // nothing; Undo of the show and of a hide work; the GM's eyes follow.
  it('shows, hides, repeats and undoes', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    await ok(t.show(t.pieces.description));
    expect(must(await world.admin.from('town_piece_shows').select('id').eq('group_place_id', t.visit))).toHaveLength(1);
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description]);
    await ok(t.hide(t.pieces.description));
    expect(await gmEyes(world.gm, t.visit)).toEqual([]);
    await ok(undo(world.gm, await latestEvent('town.hidePiece')));
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description]);
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    // Undo of the first show marks its row undone.
    await ok(t.show(t.pieces.clue));
    await ok(undo(world.gm, await latestEvent('town.showPiece')));
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description]);
    expect(must(await world.admin.from('town_piece_shows').select('undone').eq('piece_id', t.pieces.clue))).toEqual([{ undone: true }]);
    // Hiding a piece never shown changes nothing.
    await ok(t.hide(t.pieces.person));
    expect(must(await world.admin.from('town_piece_shows').select('id').eq('piece_id', t.pieces.person))).toEqual([]);
    // The line is the GM's alone.
    const lines = must(await world.admin.from('events').select('type, level, audience').eq('campaign_id', world.campaignId).in('type', ['town.showPiece', 'town.hidePiece']));
    expect(lines.every((l) => l.level === 'verbose' && l.audience === 'gm')).toBe(true);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', world.campaignId).in('type', ['town.showPiece', 'town.hidePiece']))).toEqual([]);
  });

  // Purpose: every other check of place.showPiece stays: a player is refused; a visit moved on, or no expedition under
  // way, is refused; a place two levels under, another town's, a place made by hand and the town's own piece are refused.
  it('refuses a player, a visit moved on, no expedition under way, and any piece not of a place in this town', async () => {
    await together();
    const t = await scene();
    expect((await as(world.playerA, showTownPiece, { campaignId: world.campaignId, visitId: t.visit, pieceId: t.pieces.description })).ok).toBe(false);
    const direct = await world.playerA.db.rpc('show_town_place_piece', { visit: t.visit, piece: t.pieces.description, show_it: true });
    expect(direct.error).not.toBeNull();
    for (const piece of [t.pieces.crypt, t.pieces.mill, t.pieces.byHand, t.pieces.townDescription]) {
      expect((await t.show(piece)).ok, piece).toBe(false);
    }
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('id', t.expedition).select('id'));
    expect((await t.show(t.pieces.description)).ok).toBe(false);
    const u = await scene();
    must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', u.visit).select('id'));
    expect((await u.show(u.pieces.description)).ok).toBe(false);
    expect(must(await world.admin.from('town_piece_shows').select('id').in('group_place_id', [t.visit, u.visit]))).toEqual([]);
  });

  // Purpose: the store's rules refuse a direct write the function would refuse: a player or outsider writing; the GM
  // showing on a moved-on visit, with no expedition under way, or for a place two levels under; and no write can date a
  // show (a future time is replaced by the database's).
  it('refuses direct writes the function would refuse, and dates every show itself', async () => {
    await together();
    const t = await scene();
    const row = (pieceId: string, at = t.visit) => ({ campaign_id: world.campaignId, group_place_id: at, piece_id: pieceId, group_number: 1, shown: true });
    for (const person of [world.playerA, world.outsider]) {
      expect((await person.db.from('town_piece_shows').insert(row(t.pieces.description)).select()).error).not.toBeNull();
    }
    expect((await world.gm.db.from('town_piece_shows').insert(row(t.pieces.crypt)).select()).error).not.toBeNull();
    expect((await world.gm.db.from('town_piece_shows').insert(row(t.pieces.townDescription)).select()).error).not.toBeNull();
    // A future time is the database's now.
    const made = must(await world.gm.db.from('town_piece_shows').insert({ ...row(t.pieces.description), shown_at: '2099-01-01T00:00:00Z' }).select().single());
    expect(new Date(made.shown_at as string).getFullYear()).toBeLessThan(2099);
    const moved = must(await world.gm.db.from('town_piece_shows').update({ shown_at: '2099-01-01T00:00:00Z' }).eq('id', made.id).select().single());
    expect(new Date(moved.shown_at as string).getFullYear()).toBeLessThan(2099);
    // A player can't change it either (no row comes back to them).
    expect(must(await world.playerA.db.from('town_piece_shows').update({ shown: false }).eq('id', made.id).select())).toEqual([]);
    // A moved-on visit, and no expedition under way: the GM's direct show is refused.
    must(await world.gm.db.from('town_piece_shows').update({ shown: false }).eq('id', made.id).select());
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('id', t.expedition).select('id'));
    expect((await world.gm.db.from('town_piece_shows').update({ shown: true }).eq('id', made.id).select()).error).not.toBeNull();
    const u = await scene();
    must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', u.visit).select('id'));
    expect((await world.gm.db.from('town_piece_shows').insert({ ...row(u.pieces.description, u.visit) }).select()).error).not.toBeNull();
  });

  // Purpose: the rules' other branches hold against a direct GM write: an undone row can't be revived; a time-only
  // write after the expedition ended is refused; a show with shown true and no expedition under way is refused at
  // insert. (An Undo moving the time forward can't be reached through the API: Undo only ever puts an older time back.
  // The re-show's Undo, which puts the time back, is in the reused-number tests' path; see the status file.)
  it('refuses reviving an undone row, a time-only write with no expedition, and a show with no expedition', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.clue));
    await ok(undo(world.gm, await latestEvent('town.showPiece')));
    const undone = must(await world.admin.from('town_piece_shows').select('id').eq('piece_id', t.pieces.clue).eq('undone', true).single()).id as string;
    expect((await world.gm.db.from('town_piece_shows').update({ undone: false }).eq('id', undone).select()).error).not.toBeNull();
    // A shown row, its time written again after the expedition ended: refused.
    const shown = must(await world.gm.db.from('town_piece_shows').insert({ campaign_id: world.campaignId, group_place_id: t.visit, piece_id: t.pieces.description, group_number: 1, shown: true }).select().single());
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('id', t.expedition).select('id'));
    expect((await world.gm.db.from('town_piece_shows').update({ shown_at: new Date().toISOString() }).eq('id', shown.id).select()).error).not.toBeNull();
    // A direct insert with shown true and no expedition under way: refused.
    expect((await world.gm.db.from('town_piece_shows').insert({ campaign_id: world.campaignId, group_place_id: t.visit, piece_id: t.pieces.clue, group_number: 1, shown: true }).select()).error).not.toBeNull();
  });

  // Purpose: a piece of a place in town undone (or changed) ticks the groups it is shown to, so their screens read again.
  it('ticks the group when a shown piece is undone', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    const tick = async () => (must(await world.admin.from('group_place_signals').select('tick').eq('campaign_id', world.campaignId).eq('group_number', 1).single()).tick as number);
    const before = await tick();
    must(await world.admin.from('place_pieces').update({ undone: true }).eq('id', t.pieces.description).select('id'));
    expect(await tick()).toBeGreaterThan(before);
  });
});

describe('A group number reused: what was shown stays with the people it was shown to', () => {
  // Purpose: group 2 is shown a piece of a place in town; its last member joins group 1; another player later splits
  // into group 2 in the same town and reads nothing of the place (and the GM's eyes say not shown) until the GM shows it
  // again. A player joining a group that still has members reads what it is shown.
  it('a reused group number reads nothing until shown again', async () => {
    await together();
    const t = await scene();
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    const two = await visitOf(2, t.expedition);
    expect(two.place_id).toBe(t.town);
    await ok(t.show(t.pieces.description, two.id));
    expect(await pieceIds(world.playerB)).toEqual([t.pieces.description]);
    expect(await pieceIds(world.playerA)).toEqual([]);
    // Ash joins group 1 (group 2 empties); Wren splits off into group 2 again.
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: 1 }));
    await ok(as(world.playerA, chooseGroup, { character: wren(), group: null }));
    const reused = await visitOf(2, t.expedition);
    expect(await pieceIds(world.playerA)).toEqual([]);
    expect(await gmEyes(world.gm, reused.id)).toEqual([]);
    await ok(t.show(t.pieces.description, reused.id));
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
    // Ash joins Wren's group (it has a member): Ash reads what group 2 is shown.
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: 2 }));
    expect(await pieceIds(world.playerB)).toEqual([t.pieces.description]);
  });

  // Purpose: a player's own Undo of a split that emptied a group with a place-in-town show still works (the reset
  // writes no logged line, so nothing the player can't read joins their action).
  it("a player's own Undo of a split that emptied a group still works", async () => {
    await together();
    const t = await scene();
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    await ok(t.show(t.pieces.description, (await visitOf(2, t.expedition)).id));
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: 1 }));
    await ok(undo(world.playerB, await latestEvent('party.chooseGroup')));
  });

  // Purpose: an Undo of a move that makes an earlier visit current again brings back nothing shown before the group
  // number's last reset: group 2 is shown a part at the town; moves to another place; empties; the GM undoes the move;
  // another player fills the number; they read nothing of the town's places.
  it('an old visit made current again by Undo of a move shows nothing from before the reset', async () => {
    await together();
    const t = await scene();
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    const atTown = await visitOf(2, t.expedition);
    await ok(t.show(t.pieces.description, atTown.id));
    await ok(as(world.gm, setPlace, { campaignId: world.campaignId, group: 2, name: '', placeId: t.byHand }));
    // Group 2 is in another place now: only the GM may move Ash back into the party.
    await ok(as(world.gm, chooseGroup, { character: ash(), group: 1 }));
    await ok(undo(world.gm, await latestEvent('place.set')));
    expect((await visitOf(2, t.expedition)).id).toBe(atTown.id);
    await ok(as(world.playerA, chooseGroup, { character: wren(), group: null }));
    expect(await pieceIds(world.playerA)).toEqual([]);
    expect(await gmEyes(world.gm, atTown.id)).toEqual([]);
  });

  // Purpose: the reset takes effect against a show made before it, and a show made after a reset is shown (the order
  // rule, tested directly: the harness has one session per person, so two transactions can't be raced here).
  it('a show before the reset is closed by it; a show after it is open', async () => {
    await together();
    const t = await scene();
    await ok(t.show(t.pieces.description));
    const shownAt = must(await world.admin.from('town_piece_shows').select('shown_at').eq('group_place_id', t.visit).single()).shown_at as string;
    // Group 1 emptied and filled again: Ash splits off, Wren and Reed follow (group 1 empties), and the database's
    // tidy-up puts everyone, now in one group, back in group 1.
    await ok(as(world.playerB, chooseGroup, { character: ash(), group: null }));
    await ok(as(world.playerA, chooseGroup, { character: wren(), group: 2 }));
    await ok(as(world.gm, chooseGroup, { character: reed(), group: 2 }));
    await together();
    expect((await visitOf(1, t.expedition)).id).toBe(t.visit);
    const resetAt = must(await world.admin.from('town_piece_resets').select('reset_at').eq('campaign_id', world.campaignId).eq('group_number', 1).order('reset_at', { ascending: false }).limit(1))[0]!.reset_at as string;
    expect(new Date(resetAt).getTime()).toBeGreaterThan(new Date(shownAt).getTime());
    expect(await gmEyes(world.gm, t.visit)).toEqual([]);
    expect(await pieceIds(world.playerA)).toEqual([]);
    await ok(t.show(t.pieces.description));
    expect(await gmEyes(world.gm, t.visit)).toEqual([t.pieces.description]);
    expect(await pieceIds(world.playerA)).toEqual([t.pieces.description]);
  });
});

describe('Deleting a campaign with groups still works', () => {
  // Purpose: the reset trigger does nothing while a campaign is being deleted, so its member rows can go with it.
  it('deletes a campaign whose characters are in groups', async () => {
    const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Gone Fen', created_by: world.gm.id }).select('id').single()).id as string;
    must(await world.admin.from('members').insert({ campaign_id: campaign, user_id: world.playerA.id, base_role: 'player' }).select());
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: campaign, kind: 'pc', name: 'Fen the Lantern Warden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 })
        .select('id'),
    );
    expect(must(await world.admin.from('party_group_members').select('id').eq('campaign_id', campaign))).toHaveLength(1);
    const gone = await world.admin.from('campaigns').delete().eq('id', campaign);
    expect(gone.error).toBeNull();
    expect(must(await world.admin.from('campaigns').select('id').eq('id', campaign))).toEqual([]);
  });
});
