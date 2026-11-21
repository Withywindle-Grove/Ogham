// The stand-in database's sorting, as PostgREST does it: with several `.order()` calls the first sorts and each later
// one only breaks the ties left by those before it. The stand-in used to keep only the last call, so a read of each
// group's current place (`.order('group_number').order('created_at', { ascending: false })`, Move on's ways) put a group
// that arrived later first, by the clock alone: moveOnWiring.test.tsx failed on slow machines (cleanup-flaky-2).
// Invented content.
import { describe, expect, it } from 'vitest';
import { createFakeDb } from './fakeDb.ts';

describe("the stand-in's order", () => {
  // Purpose: rows sort by the first column named, and the second column orders only rows the first leaves tied.
  it('sorts by the first order and breaks ties with the next', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('gm@mere.example', 'Priya');
    const campaign = world.addCampaign('The Mere Tower', gm);
    world.signInAs(gm);
    const visit = (id: string, group: number, at: string) =>
      world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: 'exp-1', group_number: group, place_id: `place-${id}`, shown: true, created_at: at, undone: false, moved_on: false });
    // Group 2 arrived last of all; group 1 has an older and a newer visit.
    visit('g1-old', 1, '2026-11-14T10:00:00Z');
    visit('g2', 2, '2026-11-14T12:00:00Z');
    visit('g1-new', 1, '2026-11-14T11:00:00Z');
    const { data, error } = await world.db.from('group_places').select('id').eq('campaign_id', campaign).order('group_number').order('created_at', { ascending: false });
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual(['g1-new', 'g1-old', 'g2']);
  });

  // Purpose: one order alone sorts as before, either way round.
  it('sorts by a single order, ascending or descending', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('gm@mere.example', 'Priya');
    const campaign = world.addCampaign('The Mere Tower', gm);
    world.signInAs(gm);
    for (const [id, group] of [['b', 2], ['c', 3], ['a', 1]] as const)
      world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: 'exp-1', group_number: group, place_id: `place-${id}`, shown: true, created_at: '2026-11-14T10:00:00Z', undone: false, moved_on: false });
    const up = await world.db.from('group_places').select('id').eq('campaign_id', campaign).order('group_number');
    expect((up.data ?? []).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    const down = await world.db.from('group_places').select('id').eq('campaign_id', campaign).order('group_number', { ascending: false });
    expect((down.data ?? []).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});
