// What a character has prepared and which uses it has spent (character_play; Player screen redesign, ruled
// 2026-10-26; supabase/migrations/20261026180000_m4b_player_spells.sql and 20261028090000_m4b_review_fixes.sql).
// TEST project only; invented content.
//   The owner or the GM changes it, for an approved character; members read approved characters' rows; outsiders
//   read nothing; a draft's row is its owner's alone; a retired campaign refuses changes. Each list has a size cap,
//   and marking a use changes only that ability's count, so two taps at once both count.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const rowOf = async (person: Person, actorId: string) => must(await person.db.from('character_play').select('actor_id, prepared, uses_spent').eq('actor_id', actorId));
const prepare = (person: Person, actorId: string, prepared: unknown) =>
  person.db.from('character_play').upsert({ actor_id: actorId, campaign_id: world.campaignId, prepared }).select('actor_id');
const markUse = (person: Person, actorId: string, ability: string, spent: number) => person.db.rpc('use_ability', { actor: actorId, ability, spent });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('character_play', () => {
  it('the owner and the GM change it; another player and an outsider cannot', async () => {
    expect((await prepare(world.playerA, world.wrenId, [{ spell: 'glimmer', level: 1 }])).error).toBeNull();
    expect((await prepare(world.gm, world.wrenId, [{ spell: 'mist', level: 1 }])).error).toBeNull();
    expect((await prepare(world.playerB, world.wrenId, [])).error).not.toBeNull();
    expect((await prepare(world.outsider, world.wrenId, [])).error).not.toBeNull();
    expect((await markUse(world.playerB, world.wrenId, 'Ember ward', 1)).error).not.toBeNull();
    expect(must(await world.admin.from('character_play').select('prepared').eq('actor_id', world.wrenId).single()).prepared).toEqual([{ spell: 'mist', level: 1 }]);
  });

  it('members read approved characters’ rows; an outsider reads nothing', async () => {
    expect(await rowOf(world.playerB, world.wrenId)).toHaveLength(1);
    expect(await rowOf(world.outsider, world.wrenId)).toHaveLength(0);
  });

  it("a draft's row is its owner's alone, and nobody can write one for a character that isn't approved", async () => {
    const draft = must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Moss', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'draft' })
        .select('id')
        .single(),
    ).id as string;
    expect((await prepare(world.playerA, draft, [])).error).not.toBeNull();
    must(await world.admin.from('character_play').insert({ actor_id: draft, campaign_id: world.campaignId, uses_spent: { 'Ember ward': 1 } }).select('actor_id'));
    expect(await rowOf(world.playerA, draft)).toHaveLength(1);
    expect(await rowOf(world.gm, draft)).toHaveLength(0);
    expect(await rowOf(world.playerB, draft)).toHaveLength(0);
  });

  it('a retired campaign refuses changes', async () => {
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', world.campaignId).select('id'));
    try {
      expect((await prepare(world.playerA, world.wrenId, [])).error).not.toBeNull();
      expect((await markUse(world.playerA, world.wrenId, 'Ember ward', 1)).error).not.toBeNull();
    } finally {
      must(await world.admin.from('campaigns').update({ retired_at: null }).eq('id', world.campaignId).select('id'));
    }
  });

  it('each list is capped in size', async () => {
    const huge = Array.from({ length: 400 }, (_, i) => ({ spell: `spell-number-${i}`, level: 1 }));
    expect((await prepare(world.gm, world.ashId, huge)).error).not.toBeNull();
    expect((await markUse(world.gm, world.ashId, 'x'.repeat(200), 1)).error).toBeNull();
    // 30 names of about 180 characters each: past the cap somewhere along the way.
    const names = Array.from({ length: 30 }, () => Array.from({ length: 5 }, () => crypto.randomUUID()).join(''));
    const results = [];
    for (const name of names) results.push(await markUse(world.gm, world.ashId, name, 1));
    expect(results.some((r) => r.error !== null)).toBe(true);
  });

  it('marking a use changes only that ability: two taps at once both count, and 0 gives it back', async () => {
    const [one, two] = await Promise.all([markUse(world.playerA, world.wrenId, 'Ember ward', 1), markUse(world.playerA, world.wrenId, 'Lantern lore', 2)]);
    expect(one.error).toBeNull();
    expect(two.error).toBeNull();
    expect((await rowOf(world.playerA, world.wrenId))[0]!.uses_spent).toEqual({ 'Ember ward': 1, 'Lantern lore': 2 });
    expect((await markUse(world.playerA, world.wrenId, 'Ember ward', 0)).data).toEqual({ 'Lantern lore': 2 });
    expect((await markUse(world.playerA, world.wrenId, 'Ember ward', -1)).error).not.toBeNull();
    const logged = must(await world.gm.db.from('events').select('id').eq('target_table', 'character_play').eq('target_id', world.wrenId));
    expect(logged.length).toBeGreaterThan(0);
  });
});
