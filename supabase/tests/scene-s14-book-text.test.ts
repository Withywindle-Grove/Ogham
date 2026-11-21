// The whole Scene, row S14: the book's text for the GM on the place page (docs/plans/dec-9-the-whole-scene.md; ruling
// gt-1, docs/design/rulings/dec-scene-whole-2026-11-14.md). No migration: this checks that what the database already
// sends a player carries none of a place's `gm.text`. TEST project only; invented pack, place and words.
// What it checks, in plain words:
//   * the GM reads the place's book text through the library, as the place page does;
//   * a player at that place, with a piece shown and the place's rule open, receives none of its words: not from the
//     library, the places, the pieces on the scene, the place's rules for players, nor the log.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, loadPackPlaceEntry, showPiece } from '../../src/modules/expedition/placePlay.ts';
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

// Each part of the book's text carries its own word, so any of them leaking shows.
const FIRST = 'The ferrymen moor here and notice every stranger';
const LISTED = 'The fourth mooring ring is new iron';
const BOXED = 'The old ring went into the water with a boat';
const BOX_TITLE = 'If the party asks about the ring';

const pack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        {
          id: 'the-jetty',
          name: 'The jetty',
          type: 'site',
          identity: 'Black piles and a mooring ring.',
          playerView: { text: 'Black piles, weed to the waterline.' },
          rules: [{ id: 'falling-in', name: 'Falling in', text: 'A swimmer in armour sinks.', button: 'Someone fell in' }],
          gm: { text: { blocks: [{ p: FIRST }, { list: [LISTED, 'The planks are nailed'] }, { box: [{ p: BOXED }], title: BOX_TITLE }, { source: 'p. 39' }] } },
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
  packId = await ok(as(world.gm, importPack, { pack: pack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('the book’s text for the GM is never sent to a player (gt-1)', () => {
  it('the GM reads it; a player at the place, with a piece shown, receives none of its words from any read', async () => {
    // The GM reads it as the place page does.
    const gmEntry = await loadPackPlaceEntry(asDb(world.gm), packId, 'the-jetty');
    expect(JSON.stringify(gmEntry?.data)).toContain(FIRST);

    const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
    const entry = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'the-jetty')!;
    const place = await ok(as(world.gm, placeFromPack, { campaignId, entry }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: place.id }));
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));

    const player = world.playerA.db;
    expect(await loadPackPlaceEntry(asDb(world.playerA), packId, 'the-jetty')).toBeNull();
    const everything = JSON.stringify([
      must(await player.from('library_entries').select('*').eq('pack_id', packId)),
      must(await player.from('places').select('*').eq('campaign_id', campaignId)),
      must(await player.from('place_pieces').select('*').eq('campaign_id', campaignId)),
      must(await player.rpc('scene_pieces', { campaign: campaignId })),
      must(await player.rpc('place_rules_for_players', { campaign: campaignId })),
      must(await player.from('events').select('*').eq('campaign_id', campaignId)),
    ]);
    // The player did receive the shown piece, so the reads above were live.
    expect(everything).toContain('Black piles, weed to the waterline.');
    for (const words of [FIRST, LISTED, BOXED, BOX_TITLE]) expect(everything).not.toContain(words);
  });
});
