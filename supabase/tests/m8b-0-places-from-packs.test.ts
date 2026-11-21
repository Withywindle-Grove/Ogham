// M8b slice 0, pull request 1: places from packs, store and link (supabase/migrations/20261106140000_m8b_0_places_from_packs.sql;
// docs/plans/m8b-0-places-from-packs.md; ruled 2026-11-06). TEST project only; invented packs, places and people.
// What it checks, in plain words:
//   * a player reads no pack location, no place made from one, none of its notes or unshown pieces, and nothing
//     through scene_pieces until a piece is shown; a shown piece reaches them with the players' name (⚑ 3, C) and
//     without the GM's facts;
//   * picking the same location twice gives one place (the link); two locations may share a name (⚑ 10);
//   * updating the pack with the same file changes nothing the campaign already has;
//   * Undo marks the place, its notes and its pieces undone in one go; a later pick makes a fresh place;
//   * Start expedition and Where now? by id, and Move… by id, land on the place meant;
//   * the log has the command's row, and the app and the database agree on what Undo marks undone;
//   * a pack not attached, or a location it doesn't hold, is refused; a player can't pick, nor write a place row.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { UNDOABLE_MAKINGS, undoChange } from '../../src/core/undo.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { placeFromPack, type PackPlaceEntry } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, loadScenePlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { startTravelDay, travelMove } from '../../src/modules/expedition/travelPlay.ts';
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

const SECRET = 'The keeper fences stolen lanterns';
const VALUE_WORDS = '40 gp';

/** An invented region pack: two places called Oath Isle (a hex and a site) and an inn with one of everything. */
const regionPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen Reaches', version: '0.1', kind: 'homebrew' },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6' }],
      locations: [
        { id: 'oath-hex', name: 'Oath Isle', type: 'area', key: '0407', terrain: 'marsh', playerView: { text: 'A low isle in the reeds.' }, gm: { notes: 'The hex.' } },
        { id: 'oath-site', name: 'Oath Isle', type: 'site', parentId: 'oath-hex', playerView: { text: 'A ring of stones.' }, gm: { notes: 'The site.' } },
        {
          id: 'the-reed-inn',
          name: 'The Reed Inn',
          type: 'building',
          playerView: { name: 'An inn by the water', text: 'Smoke and eel stew.', exits: ['A door to the yard'] },
          gm: { notes: 'The keeper is nervous.', secrets: [SECRET] },
          treasure: [{ text: 'A silver lantern', value: { gp: 40 } }],
        },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

let packId = '';
let campaignId = '';
const entryOf = async (entryId: string): Promise<PackPlaceEntry> => {
  const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
  const found = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === entryId);
  if (!found) throw new Error(`no entry ${entryId}`);
  return found;
};
const pick = (entryId: string, person: Person = world.gm) => entryOf(entryId).then((entry) => as(person, placeFromPack, { campaignId, entry }));
const latestEvent = async (type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
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

describe('the link', () => {
  it('picking the same location twice gives one place; two locations may share a name (⚑ 10)', async () => {
    const first = await ok(pick('oath-hex'));
    const again = await ok(pick('oath-hex'));
    const other = await ok(pick('oath-site'));
    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(other.name).toBe('Oath Isle');
    expect(first.pack).toEqual({ packId, entryId: 'oath-hex', type: 'area', parentId: '', key: '0407' });
    expect(other.pack).toMatchObject({ entryId: 'oath-site', type: 'site', parentId: 'oath-hex' });
    expect(first.terrainId).toBe('marsh');
    const rows = must(await world.admin.from('places').select('id').eq('campaign_id', campaignId).eq('name', 'Oath Isle').eq('undone', false));
    expect(rows).toHaveLength(2);
  });

  it("updating the pack with the same file changes nothing the campaign already has: the place, its link and its pieces stay", async () => {
    const inn = await ok(pick('the-reed-inn'));
    const before = must(await world.admin.from('place_pieces').select('id, body').eq('place_id', inn.id).order('position'));
    await ok(as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: regionPack() }));
    const same = await ok(pick('the-reed-inn'));
    expect(same.id).toBe(inn.id);
    const after = must(await world.admin.from('place_pieces').select('id, body').eq('place_id', inn.id).order('position'));
    expect(after).toEqual(before);
    expect(after.map((p) => p.body)).toEqual(['Smoke and eel stew.', 'A door to the yard', 'A silver lantern']);
  });

  it('the log has the command row and the app and the database agree on what Undo marks undone', async () => {
    expect(must(await world.playerA.db.from('logged_commands').select('name, level, gm_only').eq('name', 'place.fromPack'))).toEqual([{ name: 'place.fromPack', level: 'simple', gm_only: true }]);
    const rows = must(await world.playerA.db.from('undoable_makings').select('name'));
    expect(rows.map((r) => r.name as string).sort()).toEqual([...UNDOABLE_MAKINGS].sort());
  });
});

describe('hidden means hidden', () => {
  it("a player reads no pack location, no place made from one, none of its notes or pieces, and nothing on the scene until a piece is shown", async () => {
    const inn = await ok(pick('the-reed-inn'));
    const entries = must(await world.playerA.db.from('library_entries').select('kind').eq('pack_id', packId));
    expect(entries.map((e) => e.kind)).toEqual(['class']);
    expect(must(await world.playerA.db.from('places').select('id').eq('campaign_id', campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('place_notes').select('id').eq('id', inn.id))).toEqual([]);
    expect(must(await world.playerA.db.from('place_pieces').select('id').eq('place_id', inn.id))).toEqual([]);
    await endExpeditions();
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: inn.id }));
    expect((await loadScenePlaces(asDb(world.playerA), campaignId))?.get(1)).toBeUndefined();
    // The GM shows the description: the player gets it with the players' name, and nothing of the treasure's value or the secret.
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    expect(visit.pieces.map((p) => p.shown)).toEqual([false, false, false]);
    expect(visit.place?.playersName).toBe('An inn by the water');
    expect(visit.pieces[2]?.gm.value).toBe(VALUE_WORDS);
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    const seen = (await loadScenePlaces(asDb(world.playerA), campaignId))!.get(1)!;
    expect(seen.name).toBe('An inn by the water');
    expect(seen.pieces.map((p) => p.text)).toEqual(['Smoke and eel stew.']);
    const raw = JSON.stringify(must(await world.playerA.db.rpc('scene_pieces', { campaign: campaignId })));
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain(VALUE_WORDS);
    expect(raw).not.toContain('The Reed Inn');
  });

  it("a player can't pick a place from a pack, nor write a linked place row by hand", async () => {
    const refused = await pick('oath-hex', world.playerA);
    expect(refused.ok).toBe(false);
    const written = await world.playerA.db.from('places').insert({ campaign_id: campaignId, name: 'Sneaked in', pack_id: packId, pack_entry_id: 'oath-hex' }).select();
    expect(written.error).not.toBeNull();
  });

  it("a pack not attached to the campaign, or a location it doesn't hold, is refused", async () => {
    const entry = await entryOf('oath-hex');
    const elsewhere = await as(world.gm, placeFromPack, { campaignId: world.campaignId, entry });
    expect(!elsewhere.ok && elsewhere.message).toBe("That place isn't in an attached pack.");
    const unknown = await as(world.gm, placeFromPack, { campaignId, entry: { ...entry, packEntryId: 'oath-nowhere' } });
    expect(!unknown.ok && unknown.message).toBe("That place isn't in an attached pack.");
  });
});

describe('Undo', () => {
  it('marks the place, its notes and its pieces undone in one go; a later pick makes a fresh place', async () => {
    // The site was picked above: retire that place first so this pick makes one (and its line) of its own.
    must(await world.admin.from('places').update({ undone: true }).eq('campaign_id', campaignId).eq('pack_entry_id', 'oath-site').eq('undone', false).select('id'));
    const site = await ok(pick('oath-site'));
    const line = await latestEvent('place.fromPack');
    await ok(as(world.gm, undoChange, { campaignId, eventId: line, authorUserId: world.gm.id }));
    expect(must(await world.admin.from('places').select('undone').eq('id', site.id).single()).undone).toBe(true);
    expect(must(await world.admin.from('place_notes').select('undone').eq('id', site.id).single()).undone).toBe(true);
    expect(must(await world.admin.from('place_pieces').select('undone').eq('place_id', site.id)).every((p) => p.undone)).toBe(true);
    const anew = await ok(pick('oath-site'));
    expect(anew.id).not.toBe(site.id);
  });
});

describe('by place id', () => {
  it('Start expedition and Where now? by id land on the place meant, even with another of the same name', async () => {
    const hex = await ok(pick('oath-hex'));
    const site = await ok(pick('oath-site'));
    await endExpeditions();
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: site.id }));
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(site.id);
    expect(must(await world.admin.from('expedition_places').select('name').eq('expedition_id', trip.id))).toEqual([{ name: 'Oath Isle' }]);
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', placeId: hex.id }));
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(hex.id);
    // A typed name with two pack places of that name makes a typed place of its own (⚑ 10).
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: 'Oath Isle' }));
    const typed = must(await world.admin.from('places').select('id').eq('campaign_id', campaignId).eq('name', 'Oath Isle').is('pack_entry_id', null).eq('undone', false));
    expect(typed).toHaveLength(1);
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(typed[0]!.id);
    const missing = await as(world.gm, setPlace, { campaignId, group: 1, name: '', placeId: crypto.randomUUID() });
    expect(!missing.ok && missing.message).toBe("That place isn't in this campaign.");
  });

  it('Move… by id arrives at the place meant, paid at once or owed and paid the next morning', async () => {
    const hex = await ok(pick('oath-hex'));
    const site = await ok(pick('oath-site'));
    await endExpeditions();
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness' }));
    const day = await ok(as(world.gm, startTravelDay, { campaignId, group: 1, day: 0, total: 4, pace: 'foot', gmPerDay: null }));
    const paid = await ok(as(world.gm, travelMove, { campaignId, row: day, cost: 3, terrainId: 'marsh', routeId: null, placeName: null, placeId: site.id }));
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(site.id);
    const owed = await ok(as(world.gm, travelMove, { campaignId, row: paid, cost: 3, terrainId: 'marsh', routeId: null, placeName: null, placeId: hex.id }));
    expect(owed.pending?.placeId).toBe(hex.id);
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(site.id);
    await ok(as(world.gm, startTravelDay, { campaignId, group: 1, day: 1, total: 4, pace: 'foot', gmPerDay: null }));
    expect((await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))?.get(1)?.placeId).toBe(hex.id);
  });
});
