// The GM's view as the player reads the players' Scene as that player (row C15f of
// docs/plans/test-feedback-2026-11-19.md; supabase/migrations/20261122150000_c15f_reads_as_player.sql; Francis's ruling
// a2, 2026-11-22; hard rule 5). Tested on what the DATABASE sends, never on what a screen draws. TEST project or CI's
// local database; invented packs, places and words only.
//
// The fixture: the party split in two travel groups. Wren's (player A) is at the jetty, an adventure Location with a
// shown piece, a shown picture, a shared section, a rule and its own check. Ash's (player B) is in a town, with the
// town's piece shown, a place in town listed, and that place's piece and picture shown. So every one of the ten reads
// sends real rows to one of the two players. What it checks, in plain words:
//   * the GM asking as Wren's player gets exactly what Wren's player gets, from every read, and as Ash's player exactly
//     what Ash's player gets; between them every read sends something;
//   * the split party stays apart both ways: as Wren's player nothing of the town, as Ash's player nothing of the jetty;
//   * a player naming another player gets nothing, from every read, and so does someone outside the campaign;
//   * a GM of another campaign naming Wren's player gets nothing, and so does the GM asking in his other campaign;
//   * a named player whose only character in the group is waiting for approval, or archived, gets nothing;
//   * asked with nobody named, each read is the reader's own, as before (the GM, with no character here: nothing).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { setKnowledgeShare } from '../../src/modules/expedition/placeKnowledge.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { showTownPiece } from '../../src/modules/expedition/townParts.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let campaignId = '';
let packId = '';
let tripId = '';
let elsewhere = '';
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

// The jetty's words (Wren's group) and the town's (Ash's group): each must stay with its own group.
const JETTY = ['Black piles and a slick deck.', 'The harbour silted in a single winter.', 'Falling into the harbour', 'eachMove'] as const;
const TOWN = ['Stalls under a leaning clock tower.', 'A small chapel', 'Candles in green glass.'] as const;

/** An invented adventure: an island Region, a harbour Area, and a numbered Location with a rule and its own check. */
const harbourPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'saltwick-island', name: 'Saltwick Island', type: 'region', playerView: { text: 'A long grey island.' } },
        { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'site', parentId: 'saltwick-island', playerView: { text: 'A silted harbour of black water.' } },
        {
          id: 'the-jetty',
          name: 'The Jetty',
          type: 'area',
          key: '1',
          parentId: 'drowned-harbour',
          playerView: { text: JETTY[0] },
          gm: { sections: [{ heading: 'What everyone knows', text: JETTY[1] }] },
          rules: [{ id: 'falling-in', name: JETTY[2], text: 'A character in the water is cold at once.' }],
          encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] } },
        },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

/** Every players' Scene read with its "as this player" form. */
const READS = [
  'scene_pieces',
  'scene_pictures',
  'known_places_campaign',
  'place_card_for_players',
  'knowledge_for_players',
  'place_rules_for_players',
  'encounter_check_for_players',
  'scene_town',
  'scene_town_pieces',
  'scene_town_pictures',
] as const;

/** What each read sends this person for a campaign, as themselves or naming a player. An error fails the test. */
const readAll = async (person: Person, campaign: string, asPlayer?: string) => {
  const out: Record<string, unknown[]> = {};
  for (const name of READS) {
    const read = asPlayer ? await person.db.rpc(name, { campaign, as_player: asPlayer }) : await person.db.rpc(name, { campaign });
    out[name] = must(read) as unknown[];
  }
  return out;
};
const nothing = Object.fromEntries(READS.map((name) => [name, []]));
const place = async (row: Record<string, unknown>) => must(await world.admin.from('places').insert({ campaign_id: campaignId, ...row }).select('id').single()).id as string;
const piece = async (placeId: string, kind: string, body: string, extra: Record<string, unknown> = {}) =>
  must(await world.admin.from('place_pieces').insert({ campaign_id: campaignId, place_id: placeId, kind, body, ...extra }).select('id').single()).id as string;
const asset = async (name: string) => must(await world.admin.from('assets').insert({ campaign_id: campaignId, kind: 'place', name, visibility: 'gm' }).select('id').single()).id as string;
/** A character of `owner`'s in group 1, as given. */
const characterInGroupOne = async (owner: Person, name: string, extra: Record<string, unknown>) => {
  must(await world.admin.from('members').insert({ campaign_id: campaignId, user_id: owner.id, base_role: 'player' }).select());
  const id = must(
    await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, hp_current: 4, hp_max: 4, ...extra }).select('id').single(),
  ).id as string;
  // The database may already have put the character in group 1 (its row's id is the character's): then that row stands.
  await world.admin.from('party_group_members').upsert({ id, actor_id: id, campaign_id: campaignId, group_number: 1 }, { onConflict: 'id', ignoreDuplicates: true });
  expect(must(await world.admin.from('party_group_members').select('group_number').eq('actor_id', id).single()).group_number).toBe(1);
};

beforeAll(async () => {
  world = await buildWorld();
  campaignId = world.campaignId;
  packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
  tripId = (await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }))).id;
  // Player B's Ash goes to a travel group of its own.
  await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId, ownerUserId: world.playerB.id }, group: null }));

  // Group 1, Wren's: the jetty, its first piece and its picture shown, a section shared.
  const found = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'the-jetty');
  if (!found) throw new Error('no jetty');
  await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: { packId, packEntryId: 'the-jetty', name: found.name, data: found.data as Record<string, unknown> } }));
  const jetty = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(1)!;
  await ok(as(world.gm, showPiece, { campaignId, row: jetty, piece: jetty.pieces[0]! }));
  const jettyPicture = await piece(jetty.place!.id, 'picture', 'A picture', { asset_id: await asset('The jetty at dusk'), position: -1 });
  must(await world.admin.from('piece_shows').insert({ campaign_id: campaignId, group_place_id: jetty.id, piece_id: jettyPicture, group_number: 1 }).select());
  await ok(as(world.gm, setKnowledgeShare, { campaignId, group: 1, packId, entryId: 'the-jetty', sectionAt: 0, share: true }));

  // Group 2, Ash's: a town with a place in it; the town's piece shown, and the chapel's piece and picture.
  const townPack = crypto.randomUUID();
  const town = await place({
    name: 'Fenwick',
    players_name: 'A market town',
    pack_id: townPack,
    pack_entry_id: 'fenwick',
    safety: 'safe',
    town: { 'place:chapel': { name: TOWN[1], kind: 'other', shown: true, open: true } },
  });
  const chapel = await place({ name: 'The Lantern Chapel', players_name: TOWN[1], pack_id: townPack, pack_entry_id: 'chapel', pack_parent_id: 'fenwick' });
  const townPiece = await piece(town, 'description', TOWN[0]);
  const chapelPiece = await piece(chapel, 'description', TOWN[2]);
  const chapelPicture = await piece(chapel, 'picture', 'A picture', { asset_id: await asset('The chapel door'), position: -1 });
  const visit = must(await world.admin.from('group_places').insert({ campaign_id: campaignId, expedition_id: tripId, group_number: 2, place_id: town }).select('id').single()).id as string;
  must(await world.admin.from('piece_shows').insert({ campaign_id: campaignId, group_place_id: visit, piece_id: townPiece, group_number: 2 }).select());
  for (const pieceId of [chapelPiece, chapelPicture]) await ok(as(world.gm, showTownPiece, { campaignId, visitId: visit, pieceId }));

  // A character waiting for approval (the latecomer's) and an archived one (the newcomer's), both in group 1.
  await characterInGroupOne(world.latecomer, 'Rush of the Low Fen', { approval: 'pending', status: 'active' });
  await characterInGroupOne(world.newcomer, 'Moss of the Reed Ferry', { approval: 'approved', status: 'archived' });

  // The newcomer also runs a campaign of their own: a GM, but not of this one.
  elsewhere = must(await world.admin.from('campaigns').insert({ name: 'The Salt Road', created_by: world.newcomer.id }).select().single()).id as string;
  must(await world.admin.from('members').insert({ campaign_id: elsewhere, user_id: world.newcomer.id, base_role: 'gm' }).select());
}, 300_000);

afterAll(async () => {
  if (elsewhere) await world.admin.from('campaigns').delete().eq('id', elsewhere);
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("the players' Scene reads as a named player (C15f; ruling a2)", () => {
  // Purpose: the GM naming a player gets, from every read, exactly what that player gets asking for themselves; and
  // between Wren's player and Ash's player, every one of the ten reads sends real rows.
  it('gives the GM, as each player, exactly what that player reads; every read sends rows to one of them', async () => {
    const wrens = await readAll(world.playerA, campaignId);
    const ashs = await readAll(world.playerB, campaignId);
    for (const name of READS) expect(wrens[name]!.length + ashs[name]!.length, name).toBeGreaterThan(0);
    expect(await readAll(world.gm, campaignId, world.playerA.id)).toEqual(wrens);
    expect(await readAll(world.gm, campaignId, world.playerB.id)).toEqual(ashs);
  });

  // Purpose: the split party stays apart both ways: as Wren's player, nothing of the town; as Ash's, nothing of the jetty.
  it("keeps each travel group's place to itself, both ways", async () => {
    const asWren = JSON.stringify(await readAll(world.gm, campaignId, world.playerA.id));
    const asAsh = JSON.stringify(await readAll(world.gm, campaignId, world.playerB.id));
    for (const words of JETTY) {
      expect(asWren, words).toContain(words);
      expect(asAsh, words).not.toContain(words);
    }
    for (const words of TOWN) {
      expect(asAsh, words).toContain(words);
      expect(asWren, words).not.toContain(words);
    }
  });

  // Purpose: a player naming another player gets nothing from any read, nor does someone outside the campaign.
  it('gives a player, or an outsider, naming another player nothing', async () => {
    expect(await readAll(world.playerB, campaignId, world.playerA.id)).toEqual(nothing);
    expect(await readAll(world.playerA, campaignId, world.playerB.id)).toEqual(nothing);
    expect(await readAll(world.outsider, campaignId, world.playerA.id)).toEqual(nothing);
  });

  // Purpose: a GM of another campaign naming Wren's player gets nothing of this campaign; and this campaign's GM naming
  // Wren's player in his other campaign, where that player has no character, gets nothing either.
  it("gives another campaign's GM nothing", async () => {
    expect(await readAll(world.newcomer, campaignId, world.playerA.id)).toEqual(nothing);
    expect(await readAll(world.gm, world.otherCampaignId, world.playerA.id)).toEqual(nothing);
  });

  // Purpose: the GM naming a player whose only character in group 1 waits for approval, or is archived, gets nothing,
  // though group 1 is shown plenty.
  it('gives the GM nothing as a player whose character is waiting for approval or archived', async () => {
    expect(await readAll(world.gm, campaignId, world.latecomer.id)).toEqual(nothing);
    expect(await readAll(world.gm, campaignId, world.newcomer.id)).toEqual(nothing);
  });

  // Purpose: asked with nobody named, the GM's reads are his own (he has no character in this campaign: nothing).
  it('keeps the reader’s own reading when nobody is named', async () => {
    expect(await readAll(world.gm, campaignId)).toEqual(nothing);
  });
});
