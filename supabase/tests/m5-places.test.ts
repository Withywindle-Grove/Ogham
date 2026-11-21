// M5 step 11: places per group and Send (supabase/migrations/20261031170000_m5_places_messages.sql; ruled 2026-10-30
// DG9, DG11, DG14; 2026-10-31 B1 and Francis's ruling that a shown place is visible to its group's players only).
// TEST project only; invented places and characters.
//   Start expedition's Where? puts every group at that place, hidden: no player reads it until the GM shows a piece
//   (M5b g2), and then only that group's players, through their scene; the GM's notes never reach a player, shown or
//   not. Players can't set or edit a place. The place's lines are the GM's.
//   A split: the new group starts where its first member was. Join up: a player can't join groups in different
//   places (a plain reason), can once they're in the same place; hirelings come along. The GM can always.
//   (Send's tests moved with it: Messaging replaced Send in M5b g4, supabase/tests/m5b-g4-messages.test.ts.)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup, joinUp } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, editPlace, loadGroupPlaces, loadMeeting, loadScenePlaces, setPlace, showPiece, together } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, { requestId });
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign: Reed (player A's) with A's hireling Bree, and Moss (player B's). */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Warrens', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person, kind = 'pc') => ({ campaign_id: campaign.id, kind, name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss, bree] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Bree the Lantern Bearer', world.playerA, 'hireling')]).select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person) => ({ id, campaignId: campaign.id as string, ownerUserId: owner.id });
  return { campaignId: campaign.id as string, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB), bree: ref(bree!.id, world.playerA) };
}

const groupOf = async (actorId: string) => Number(must(await world.admin.from('party_group_members').select('group_number').eq('actor_id', actorId).single()).group_number);
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const seenTables = async (person: Person, campaignId: string) =>
  must(await person.db.from('events').select('target_table').eq('campaign_id', campaignId)).map((e) => e.target_table as string);
const placesSeen = async (person: Person, campaignId: string) => must(await person.db.from('places').select('name, description').eq('campaign_id', campaignId));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('a place per group (DG9, DG14)', () => {
  it("a player never receives a place that isn't shown, or another group's place, and never the GM's notes", async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Drowned Stair' }));
    // Moss splits off to a group of their own (B's split): they start at the Drowned Stair too.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    const gmView = (await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))!;
    expect(gmView.get(1)?.place?.name).toBe('The Drowned Stair');
    expect(gmView.get(mossGroup)?.place?.name).toBe('The Drowned Stair');
    const place = gmView.get(1)!.place!;
    await ok(as(world.gm, editPlace, { campaignId: t.campaignId, place, description: 'Black water laps at the steps.', notes: { traps: 'The ninth step gives way.' } }));
    // Group 2 goes on to the Moth Gallery.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: mossGroup, name: 'The Moth Gallery' }));
    expect(await placesSeen(world.playerA, t.campaignId)).toEqual([]);
    expect(await placesSeen(world.playerB, t.campaignId)).toEqual([]);

    // A piece shown to group 1 (M5b g2): player A (Reed's) gets it through their scene; player B (in group 2) doesn't;
    // nobody reads the place row itself any more (its description is a piece), nor the notes.
    const now = (await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))!;
    const pieceId = await ok(as(world.gm, addPiece, { campaignId: t.campaignId, placeId: place.id, kind: 'description', text: 'Black water laps at the steps.' }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: now.get(1)!, piece: { id: pieceId } }));
    expect((await loadScenePlaces(asDb(world.playerA), t.campaignId))?.get(1)).toEqual({ group: 1, name: 'The Drowned Stair', pieces: [{ id: pieceId, kind: 'description', text: 'Black water laps at the steps.' }], pictureAssetId: null });
    expect(await loadScenePlaces(asDb(world.playerB), t.campaignId)).toEqual(new Map());
    expect(await placesSeen(world.playerA, t.campaignId)).toEqual([]);
    expect(await placesSeen(world.playerB, t.campaignId)).toEqual([]);
    expect(must(await world.playerA.db.from('place_notes').select('traps').eq('campaign_id', t.campaignId))).toEqual([]);
    expect((await loadGroupPlaces(asDb(world.playerA), t.campaignId, trip.id))?.get(1)).toBeUndefined();
    // Player B's group was moved on unseen: they get no row for it (nor for the earlier, or another group's, place);
    // nor does player A (pieces are shown through the scene, so no row says "shown" any more).
    expect(must(await world.playerB.db.from('group_places').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    const aRows = must(await world.playerA.db.from('group_places').select('group_number, shown').eq('campaign_id', t.campaignId));
    expect(aRows).toEqual([]);
    // The place's lines are the GM's alone.
    expect(await seenTables(world.playerA, t.campaignId)).not.toEqual(expect.arrayContaining(['places']));
    for (const table of ['places', 'place_notes', 'group_places', 'place_pieces', 'piece_shows']) expect(await seenTables(world.playerA, t.campaignId)).not.toContain(table);
    expect(await seenTables(world.gm, t.campaignId)).toEqual(expect.arrayContaining(['places', 'place_notes', 'group_places', 'place_pieces', 'piece_shows']));
  });

  it("players can't set or edit a place, nor write a group's row", async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Salt Cellar' }));
    const row = (await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))!.get(1)!;
    expect((await as(world.playerA, setPlace, { campaignId: t.campaignId, group: 1, name: 'Sneaky' })).ok).toBe(false);
    expect((await world.playerA.db.rpc('set_group_place', { campaign: t.campaignId, group_no: 1, place_name: 'Sneaky' })).error).not.toBeNull();
    const shown = must(await world.playerA.db.from('group_places').update({ shown: true }).eq('id', row.id).select('id'));
    expect(shown).toEqual([]);
    const written = must(await world.playerA.db.from('places').update({ description: 'Sneaky' }).eq('campaign_id', t.campaignId).select('id'));
    expect(written).toEqual([]);
  });

  // Show / Hide, Undo and the signal, piece by piece: supabase/tests/m5b-place-pieces.test.ts (M5b g2).

  it('Where now? moves the group on; Undo brings it back to where it was', async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Reed Door' }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: ' the reed door ' }));
    // The same name is the same place (its description and notes come back with it).
    expect(must(await world.admin.from('places').select('id').eq('campaign_id', t.campaignId))).toHaveLength(1);
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Glimmer Pool' }));
    expect((await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))?.get(1)?.place?.name).toBe('The Glimmer Pool');
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'place.set')));
    expect((await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))?.get(1)?.place?.name).toBe('The Reed Door');
  });
});

describe('Join up only in the same place (B1)', () => {
  it("a player can't join up groups in different places; once they're in the same place they can, and the hireling comes too", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Long Barrow' }));
    const reedGroup = await ok(as(world.playerA, chooseGroup, { character: t.reed, group: null }));
    expect(await groupOf(t.bree.id)).toBe(reedGroup);
    // Split in the same room: together, until the GM moves one group on.
    expect(together((await loadMeeting(asDb(world.playerB), t.campaignId))!, reedGroup, 1)).toBe(true);
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: reedGroup, name: 'The Bone Stair' }));
    const apart = (await loadMeeting(asDb(world.playerB), t.campaignId))!;
    expect(together(apart, reedGroup, 1)).toBe(false);
    const refused = await as(world.playerB, joinUp, { campaignId: t.campaignId, together: true, from: reedGroup, into: 1 });
    expect(refused.ok).toBe(false);
    const direct = await world.playerB.db.rpc('join_party_groups', { campaign: t.campaignId, from_group: reedGroup, into_group: 1 });
    expect(direct.error?.message).toBe('Only the GM joins up groups that are in different places.');
    expect(await groupOf(t.reed.id)).toBe(reedGroup);

    // The party catches up: group 1 goes to the Bone Stair too. Now player B can join them up.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Bone Stair' }));
    expect(together((await loadMeeting(asDb(world.playerB), t.campaignId))!, reedGroup, 1)).toBe(true);
    await ok(as(world.playerB, joinUp, { campaignId: t.campaignId, together: true, from: reedGroup, into: 1 }));
    expect([await groupOf(t.reed.id), await groupOf(t.bree.id), await groupOf(t.moss.id)]).toEqual([1, 1, 1]);
  });

  it('the GM can join up groups in different places', async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Long Barrow' }));
    const mossGroup = await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: mossGroup, name: 'The Echo Well' }));
    await ok(as(world.gm, joinUp, { campaignId: t.campaignId, together: false, from: mossGroup, into: 1 }));
    expect(await groupOf(t.moss.id)).toBe(1);
  });

  it("a player's own split can still be undone by them (the new group's place is the GM's line)", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Long Barrow' }));
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(undo(world.playerB, t.campaignId, await latestEvent(t.campaignId, 'party.chooseGroup')));
    expect(await groupOf(t.moss.id)).toBe(1);
  });
});

