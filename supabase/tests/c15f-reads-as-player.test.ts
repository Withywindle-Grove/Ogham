// The GM's view as the player reads the players' Scene as that player (row C15f of
// docs/plans/test-feedback-2026-11-19.md; supabase/migrations/20261122150000_c15f_reads_as_player.sql; Francis's ruling
// a2, 2026-11-22; hard rule 5). Tested on what the DATABASE sends, never on what a screen draws. TEST project or CI's
// local database; invented packs, places and words only. What it checks, in plain words:
//   * the GM asking as Wren's player gets exactly what Wren's player gets from every one of the players' Scene reads;
//   * a player naming another player gets nothing, from every read;
//   * a GM of another campaign naming Wren's player gets nothing, and so does the GM asking this campaign's player in
//     his other campaign;
//   * the GM asking as a player whose character is in another travel group of the split party gets that group's
//     reading only: nothing of the place shown to Wren's group;
//   * someone outside the campaign naming Wren's player gets nothing;
//   * asked with nobody named, each read is the reader's own, as before.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { setKnowledgeShare } from '../../src/modules/expedition/placeKnowledge.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
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

const SHOWN = 'Black piles and a slick deck.';
const SHARED = 'The harbour silted in a single winter.';
const RULE = 'Falling into the harbour';

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
          playerView: { text: SHOWN },
          gm: { sections: [{ heading: 'What everyone knows', text: SHARED }] },
          rules: [{ id: 'falling-in', name: RULE, text: 'A character in the water is cold at once.' }],
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

/** What each read sends this person for a campaign, as themselves or naming a player. */
const readAll = async (person: Person, campaign: string, asPlayer?: string) => {
  const out: Record<string, unknown> = {};
  for (const name of READS) {
    const read = asPlayer ? await person.db.rpc(name, { campaign, as_player: asPlayer }) : await person.db.rpc(name, { campaign });
    // An error fails the test: "nothing" must be an empty answer, never a read that broke.
    out[name] = must(read);
  }
  return out;
};
const nothing = Object.fromEntries(READS.map((name) => [name, []]));

beforeAll(async () => {
  world = await buildWorld();
  campaignId = world.campaignId;
  packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
  tripId = (await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }))).id;
  // Player B's Ash goes to a travel group of its own, which is shown nothing.
  await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId, ownerUserId: world.playerB.id }, group: null }));
  const found = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'the-jetty');
  if (!found) throw new Error('no jetty');
  await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: { packId, packEntryId: 'the-jetty', name: found.name, data: found.data as Record<string, unknown> } }));
  const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(1)!;
  await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
  await ok(as(world.gm, setKnowledgeShare, { campaignId, group: 1, packId, entryId: 'the-jetty', sectionAt: 0, share: true }));
  // The newcomer runs a campaign of their own: a GM, but not of this one.
  elsewhere = must(await world.admin.from('campaigns').insert({ name: 'The Salt Road', created_by: world.newcomer.id }).select().single()).id as string;
  must(await world.admin.from('members').insert({ campaign_id: elsewhere, user_id: world.newcomer.id, base_role: 'gm' }).select());
}, 300_000);

afterAll(async () => {
  if (elsewhere) await world.admin.from('campaigns').delete().eq('id', elsewhere);
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("the players' Scene reads as a named player (C15f; ruling a2)", () => {
  // Purpose: the GM naming Wren's player gets, from every read, exactly what that player gets asking for themselves,
  // and that is something (the shown piece, the shared section, the rule and the place's check).
  it("gives the GM, as Wren's player, exactly what Wren's player reads", async () => {
    const own = await readAll(world.playerA, campaignId);
    const text = JSON.stringify(own);
    for (const words of [SHOWN, SHARED, RULE, 'eachMove']) expect(text, words).toContain(words);
    expect(await readAll(world.gm, campaignId, world.playerA.id)).toEqual(own);
  });

  // Purpose: a player naming another player gets nothing from any read, nor does someone outside the campaign.
  it('gives a player, or an outsider, naming Wren’s player nothing', async () => {
    expect(await readAll(world.playerB, campaignId, world.playerA.id)).toEqual(nothing);
    expect(await readAll(world.outsider, campaignId, world.playerA.id)).toEqual(nothing);
  });

  // Purpose: a GM of another campaign naming Wren's player gets nothing of this campaign; and this campaign's GM naming
  // Wren's player in his other campaign, where that player has no character, gets nothing either.
  it("gives another campaign's GM nothing", async () => {
    expect(await readAll(world.newcomer, campaignId, world.playerA.id)).toEqual(nothing);
    expect(await readAll(world.gm, world.otherCampaignId, world.playerA.id)).toEqual(nothing);
  });

  // Purpose: the GM naming the player whose character is in the other travel group of the split party reads as that
  // player: nothing of the place shown to Wren's group, exactly as that player reads it.
  it('gives the GM, as a player in the other travel group, nothing of Wren’s group’s place', async () => {
    const theirs = await readAll(world.playerB, campaignId);
    expect(theirs).toEqual(nothing);
    expect(await readAll(world.gm, campaignId, world.playerB.id)).toEqual(theirs);
  });

  // Purpose: asked with nobody named, the GM's reads are his own (he has no character in this campaign: nothing).
  it('keeps the reader’s own reading when nobody is named', async () => {
    expect(await readAll(world.gm, campaignId)).toEqual(nothing);
  });
});
