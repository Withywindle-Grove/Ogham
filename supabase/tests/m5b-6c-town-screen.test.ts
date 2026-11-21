// M5b step 6c: the town screen (supabase/migrations/20261104170000_m5b_6c_town_screen.sql; ruled 2026-10-30, ST3,
// ST12; bq3-1; docs/03, hidden means hidden). TEST project only; invented content.
//   A hidden place in town is never sent to a player's device: players can't read places.town, and
//   public.scene_town gives them only what the GM shows. Show players reveals one place in town only; Open / Closed
//   reaches them; Undo takes a show back. The screen still works after End expedition (the party stays where it is).
//   A place that is neither Safe nor Hostile isn't a town: nothing reaches players. A player can't show a place.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { setPlaceSafety } from '../../src/modules/expedition/placeSafety.ts';
import { addPiece, loadGroupPlaces, showPiece, type Place } from '../../src/modules/expedition/placePlay.ts';
import { endExpedition, startExpedition } from '../../src/modules/expedition/play.ts';
import { loadLastPlaces, loadSceneTowns, openTownPlace, showTownPlace } from '../../src/modules/expedition/townPlaces.ts';
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

const smithy = { key: 'service:buy-gear', name: 'The Tinker’s Stall', group: 'shop' as const };
const inn = { key: 'lodging:the lantern rest', name: 'The Lantern Rest', group: 'lodging' as const };

/**
 * A fresh campaign: Reed (player A's), an expedition under way at Fenwick Market, marked Safe, and (unless told
 * otherwise) shown to the group: its description piece shown on the visit (review finding 2, ruled B: players read
 * the town only once the place itself is shown).
 */
async function freshTown(shown = true) {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Road', created_by: world.gm.id }).select().single());
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
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'Fenwick Market' }));
  const place = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
  await ok(as(world.gm, setPlaceSafety, { campaignId, place: await place(), safety: 'safe' }));
  const visit = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
  const describe = async () => ok(as(world.gm, addPiece, { campaignId, placeId: (await place()).id, kind: 'description' as const, text: 'Reed stalls along the quay.' }));
  if (shown) {
    const pieceId = await describe();
    await ok(as(world.gm, showPiece, { campaignId, row: await visit(), piece: { id: pieceId } }));
  }
  return { campaignId, trip, place, visit, describe };
}

const playerSees = async (campaignId: string) => (await loadSceneTowns(asDb(world.playerA), campaignId))?.get(1)?.places ?? [];

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('The town screen (M5b step 6c)', () => {
  it('a hidden place in town never reaches a player; Show players reveals that one only; Open / Closed and Undo reach them', async () => {
    const { campaignId, place } = await freshTown();
    // The GM closes the inn (still hidden) and shows the stall.
    await ok(as(world.gm, openTownPlace, { campaignId, place: await place(), entry: inn, open: false }));
    expect(await playerSees(campaignId)).toEqual([]);
    await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: smithy, shown: true }));

    expect(await playerSees(campaignId)).toEqual([{ key: smithy.key, name: smithy.name, kind: 'shop', open: true }]);
    // The place row (and its town column) stays the GM's.
    const raw = await world.playerA.db.from('places').select('id, town').eq('id', (await place()).id);
    expect(raw.data ?? []).toEqual([]);
    // The rpc's rows carry nothing about the hidden inn.
    const rows = must(await world.playerA.db.rpc('scene_town', { campaign: campaignId }));
    expect(JSON.stringify(rows)).not.toContain('Lantern Rest');

    // Showing the closed inn brings it as Closed.
    await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: inn, shown: true }));
    expect((await playerSees(campaignId)).find((p) => p.key === inn.key)).toMatchObject({ open: false });

    // Each change is one Verbose GM line; Undo of the last show hides the inn again.
    const lines = must(await world.admin.from('events').select('id, level, type').eq('campaign_id', campaignId).in('type', ['town.showPlace', 'town.openPlace']).order('seq'));
    expect(lines.map((l) => [l.type, l.level])).toEqual([
      ['town.openPlace', 'verbose'],
      ['town.showPlace', 'verbose'],
      ['town.showPlace', 'verbose'],
    ]);
    expect(await as(world.gm, undoChange, { campaignId, eventId: lines[2]!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect((await playerSees(campaignId)).map((p) => p.key)).toEqual([smithy.key]);

    // A player can't show anything.
    const sneaky = await as(world.playerA, showTownPlace, { campaignId, place: await place(), entry: inn, shown: true });
    expect(sneaky.ok).toBe(false);
  });

  it('after End expedition the party stays in town: the GM reads the last place, players keep what is shown', async () => {
    const { campaignId, trip, place } = await freshTown();
    await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: smithy, shown: true }));
    const latest = must(await world.admin.from('expeditions').select('*').eq('id', trip.id).single());
    await ok(as(world.gm, endExpedition, { campaignId, expedition: { ...trip, version: latest.version as number } }));

    const last = (await loadLastPlaces(asDb(world.gm), campaignId))!.get(1)!.place as Place;
    expect(last.name).toBe('Fenwick Market');
    expect(last.town?.[smithy.key]).toMatchObject({ shown: true, open: true });
    expect((await playerSees(campaignId)).map((p) => p.key)).toEqual([smithy.key]);

    // Marked neither safe nor hostile, it's no town: nothing reaches players.
    await ok(as(world.gm, setPlaceSafety, { campaignId, place: last, safety: null }));
    expect(await playerSees(campaignId)).toEqual([]);
  });

  // Purpose (review finding 2, ruled B): a shown shop in a town the group hasn't been shown stays invisible to its
  // players; shown in the same request as the town (its description piece), both appear, as one log line whose Undo
  // hides both again.
  it('a shown place in a town players don’t see yet stays invisible; shown with the town, both appear; one Undo hides both', async () => {
    const { campaignId, place, visit, describe } = await freshTown(false);
    await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: smithy, shown: true }));
    expect(await playerSees(campaignId)).toEqual([]);
    expect(JSON.stringify(must(await world.playerA.db.rpc('scene_town', { campaign: campaignId })))).not.toContain('Fenwick');

    const pieceId = await describe();
    await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: inn, shown: true, alsoShow: { visitId: (await visit()).id, pieceId } }));
    expect((await playerSees(campaignId)).map((p) => p.key).sort()).toEqual([inn.key, smithy.key].sort());
    const lines = must(await world.admin.from('events').select('id, request_id, target_table').eq('campaign_id', campaignId).eq('type', 'town.showPlace').order('seq'));
    const last = lines.filter((l) => l.request_id === lines.at(-1)!.request_id);
    expect(last.map((l) => l.target_table).sort()).toEqual(['piece_shows', 'places']);

    expect(await as(world.gm, undoChange, { campaignId, eventId: last[0]!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await playerSees(campaignId)).toEqual([]);
    const after = (await loadGroupPlaces(asDb(world.gm), campaignId, (await visit()).expeditionId))!.get(1)!;
    expect(after.pieces.map((p) => p.shown)).toEqual([false]);
    expect(after.place?.town?.[inn.key]?.shown ?? false).toBe(false);
  });

  // Purpose (review of 2026-11-04): someone outside the campaign, or in another one, gets nothing from scene_town.
  it('a non-member and a member of another campaign read nothing of the town', async () => {
    const { campaignId } = await freshTown();
    const stranger = await world.outsider.db.rpc('scene_town', { campaign: campaignId });
    expect(stranger.data ?? []).toEqual([]);
    const elsewhere = await world.newcomer.db.rpc('scene_town', { campaign: campaignId });
    expect(elsewhere.data ?? []).toEqual([]);
    expect(await playerSees(campaignId)).toEqual([]);
  });

  it('an entry that isn’t written right is refused', async () => {
    const { place } = await freshTown();
    const bad = await world.admin.from('places').update({ town: { 'service:x': { name: '', shown: true, open: true } } }).eq('id', (await place()).id);
    expect(bad.error).not.toBeNull();
  });
});
