// Row P8 of docs/plans/dec-9-the-players-scene.md (with P14): what the marching order reads, tested on what the
// DATABASE sends a player, never on what a screen draws (hard rule 5). TEST project or CI's local database; invented
// people and places only.
//
// The marching order's card (`src/app/MarchingOrder.tsx`) reads six things: the orders (`marching_orders`), who is in
// which group (`party_group_members`), the party's characters (`actors`: approved, active characters and hirelings),
// the lights (`character_lights`), the clock and the campaign's settings. Its statuses come through the status book,
// whose secret timers are proved never to reach a player in m5-statuses and m5b-status-time; a monster's hit points in
// dec-9-scene-hidden. This file proves:
//   * as a player, what the order's reads receive is the party and nothing else: no monster, no NPC, no other
//     player's character still waiting for approval; an outsider reads none of it. The monster and the NPC are left
//     out by the card's own query (`loadMarchers` asks for characters and hirelings), not by row-level security: a
//     member may read their rows, never their hit points. Row-level security itself keeps another player's character
//     waiting for approval and a monster's hit points from a player, and both are read raw here too;
//   * split (page 18, PL6; ap-10: who, never where), the order's reads name who is in the other group and carry nothing
//     of where that group is, though the GM has named its place; read raw, the other group's place and its row in
//     `group_places` don't reach the player either.
// Another character's hit points when "Show each other's HP" is off still reach every member until M6 (mo-2): that
// test to do stays in dec-9-scene-hidden.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { loadCampaignSettings } from '../../src/core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup, loadGroupMembers } from '../../src/modules/expedition/groupPlay.ts';
import { loadClockNow, loadLights } from '../../src/modules/expedition/lightPlay.ts';
import { loadMarchers, loadMarchingOrders } from '../../src/modules/expedition/marchingPlay.ts';
import { loadGroupPlaces, setPlace } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let campaign = '';
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  const user = (await loadCurrentUser(asDb(person))) as CurrentUser;
  const done = await runCommand(registry, asDb(person), user, command, input);
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** Everything the marching order's card reads, as this person, the way the card reads it. */
async function orderReads(person: Person) {
  const db = asDb(person);
  const [orders, members, marchers, lights, now, settings] = await Promise.all([
    loadMarchingOrders(db, campaign),
    loadGroupMembers(db, campaign),
    loadMarchers(db, campaign),
    loadLights(db, campaign),
    loadClockNow(db, campaign),
    loadCampaignSettings(db, campaign),
  ]);
  return { orders, members: members ? [...members.entries()] : null, marchers, lights, now, settings };
}

beforeAll(async () => {
  world = await buildWorld();
  campaign = world.campaignId;
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('what the marching order reads, as a player (P8, P14; hard rule 5)', () => {
  // Purpose: what a player's marching order receives is the party's approved characters and nothing else of the
  // campaign's people: not a monster, not an NPC, not another player's character still waiting for approval. Read
  // raw, row-level security keeps that waiting character and the monster's hit points from the other player. Someone
  // outside the campaign reads no order, no group and no character.
  it('holds the party only: no monster, no NPC, no character waiting for approval; an outsider reads none of it', async () => {
    const monster = must(await world.gm.db.from('actors').insert({ campaign_id: campaign, kind: 'monster', name: 'Bog lurker', owner_type: 'gm', approval: 'approved' }).select('id').single()).id as string;
    must(await world.gm.db.from('actor_secrets').insert({ actor_id: monster, hp_current: 17, hp_max: 19 }).select('actor_id'));
    must(await world.gm.db.from('actors').insert({ campaign_id: campaign, kind: 'npc', name: 'The Tidewife', owner_type: 'gm', approval: 'approved' }).select('id'));
    must(await world.playerB.db.from('actors').insert({ campaign_id: campaign, kind: 'pc', name: 'Quill the Unready', owner_type: 'user', owner_user_id: world.playerB.id }).select('id'));

    for (const player of [world.playerA, world.playerB]) {
      const read = await orderReads(player);
      expect((read.marchers ?? []).map((m) => m.id).sort()).toEqual([world.ashId, world.wrenId].sort());
      const raw = JSON.stringify(read);
      for (const word of ['Bog lurker', 'The Tidewife', 'Quill the Unready', monster]) expect(raw, word).not.toContain(word);
    }

    // Raw, as player A: Quill (player B's, waiting for approval) isn't among the rows they may read, and the monster's
    // hit points reach neither player.
    const actorsRaw = must(await world.playerA.db.from('actors').select('id, name').eq('campaign_id', campaign));
    expect(actorsRaw.map((a) => a.name)).not.toContain('Quill the Unready');
    for (const player of [world.playerA, world.playerB]) {
      expect(must(await player.db.from('actor_secrets').select('actor_id, hp_current, hp_max').eq('actor_id', monster))).toEqual([]);
    }

    const outside = await orderReads(world.outsider);
    expect(outside.marchers ?? []).toEqual([]);
    expect(outside.orders === 'error' ? [] : outside.orders).toEqual([]);
    expect(outside.members ?? []).toEqual([]);
    expect(outside.lights ?? []).toEqual([]);
  });

  // Purpose (PL6; ap-10: who, never where): split, a player's order reads who is in the other group, so the card can
  // say "Ash is elsewhere", and nothing of where that group is, though the GM has named the other group's place.
  it('split: names who is in the other group and nothing of where it is', async () => {
    await as(world.gm, startExpedition, { campaignId: campaign, mode: 'dungeon' });
    await as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId: campaign, ownerUserId: world.playerB.id }, group: null });
    await as(world.gm, setPlace, { campaignId: campaign, group: 2, name: 'The Weir’s Throat', placeId: null, packEntry: null });

    // The GM's place for group 2 is there to be found.
    const trip = must(await world.gm.db.from('expeditions').select('id').eq('campaign_id', campaign).is('ended_at', null).single()).id as string;
    expect((await loadGroupPlaces(asDb(world.gm), campaign, trip))?.get(2)?.place?.name).toBe('The Weir’s Throat');

    const read = await orderReads(world.playerA);
    expect(new Map(read.members ?? []).get(world.ashId)).toBe(2);
    expect((read.marchers ?? []).find((m) => m.id === world.ashId)?.name).toBe('Ash the Reed Cutter');
    expect(JSON.stringify(read)).not.toContain('Weir');

    // Where group 2 is never reaches player A: not through the places' own read, and not raw from `places` or
    // `group_places`.
    const placesSeen = await loadGroupPlaces(asDb(world.playerA), campaign, trip);
    expect(placesSeen).not.toBeNull();
    expect(placesSeen!.has(2)).toBe(false);
    const placesRaw = must(await world.playerA.db.from('places').select('*').eq('campaign_id', campaign));
    expect(JSON.stringify(placesRaw)).not.toContain('Weir');
    const groupPlacesRaw = must(await world.playerA.db.from('group_places').select('*').eq('campaign_id', campaign));
    expect(groupPlacesRaw.filter((r) => r.group_number === 2)).toEqual([]);
    expect(JSON.stringify(groupPlacesRaw)).not.toContain('Weir');
  });
});
