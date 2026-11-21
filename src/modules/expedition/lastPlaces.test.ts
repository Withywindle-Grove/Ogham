// Where the groups stand between expeditions (`loadLastPlaces`), read as "is the party in a settlement"
// (`partyInSettlement`), against the stand-in database. Invented places only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { partyInSettlement } from './sceneTop.ts';
import { loadLastPlaces } from './townPlaces.ts';

let world: FakeWorld;
let campaign: string;

beforeEach(() => {
  world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.signInAs(gm);
  world.tables.expeditions.push({ id: 'trip', campaign_id: campaign, session_id: null, mode: 'dungeon', started_at: 0, ended_at: 3600, who_went: [], summary: null, started_by: gm, undone: false, version: 2 });
  world.tables.places.push({ id: 'quay', campaign_id: campaign, name: 'Lantern Quay', description: '', version: 1, undone: false, settlement: { size: 'small', population: null }, safety: null });
  world.tables.places.push({ id: 'ford', campaign_id: campaign, name: 'Bog Ford', description: '', version: 1, undone: false, settlement: null, safety: null });
});

const visit = (id: string, group: number, place: string, moved: boolean) =>
  world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: 'trip', group_number: group, place_id: place, shown: false, moved_on: moved, undone: false, created_at: '2026-11-01T12:00:00Z' });

const inSettlement = async () => partyInSettlement([...(await loadLastPlaces(world.db, campaign))!.values()]);

describe('the party between expeditions, after a join-up', () => {
  // Purpose: a group that joined up (its only row moved on) no longer exists, so the party counts as in the settlement where group 1 stands.
  it('a group whose only row is moved on does not count against the settlement', async () => {
    visit('v1', 1, 'quay', false);
    visit('v2', 2, 'ford', true);
    expect(await inSettlement()).toBe(true);
  });

  // Purpose: the same second group, still at an ordinary place and not moved on, keeps the party out of the settlement.
  it('a second group still at an ordinary place keeps the party out of the settlement', async () => {
    visit('v1', 1, 'quay', false);
    visit('v2', 2, 'ford', false);
    expect(await inSettlement()).toBe(false);
  });
});
