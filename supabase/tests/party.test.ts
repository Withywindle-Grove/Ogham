// The party list, and the race and class slots on each character. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/core/supabase.ts';
import { loadParty } from '../../src/core/party.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
  must(await world.admin.from('actors').update({ company_id: world.companyId, level: 3 }).eq('id', world.wrenId).select());
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function character(owner: Person, approval: 'pending' | 'approved', name: string, status = 'active') {
  return must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval, status })
      .select()
      .single(),
  ).id;
}

describe('the party', () => {
  it("every member sees each approved character with its player, company and level, but not others' waiting or archived ones", async () => {
    await character(world.playerB, 'pending', 'Bram the Unready');
    await character(world.playerB, 'approved', 'Sly Cob', 'archived');
    for (const person of [world.playerA, world.playerB, world.gm]) {
      const party = (await loadParty(asDb(person), world.campaignId)) ?? [];
      const wren = party.find((c) => c.id === world.wrenId);
      expect(wren).toMatchObject({ playerName: expect.any(String), companyName: 'The Sluice Gate Company', level: 3 });
      expect(party.some((c) => c.id === world.ashId)).toBe(true);
      expect(party.map((c) => c.name)).not.toContain('Bram the Unready');
      expect(party.map((c) => c.name)).not.toContain('Sly Cob');
    }
  });

  it('an outsider sees no party', async () => {
    expect(await loadParty(asDb(world.outsider), world.campaignId)).toEqual([]);
  });
});

describe('race and class slots', () => {
  it('a new character starts with no classes and no race', async () => {
    const id = await character(world.playerA, 'pending', 'Hollis');
    expect(must(await world.admin.from('actors').select('classes, race_ref').eq('id', id).single())).toEqual({
      classes: [],
      race_ref: null,
    });
  });

  it("the player sets them while waiting; once approved only the GM changes them", async () => {
    const id = await character(world.playerA, 'pending', 'Hollis');
    const entry = [{ classRef: 'lantern-warden', level: 1, xp: 0 }];
    const waiting = await world.playerA.db.from('actors').update({ classes: entry, race_ref: 'marsh-folk' }).eq('id', id).select('id');
    expect(waiting.error).toBeNull();

    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', id).select());
    for (const change of [{ classes: [{ classRef: 'reedblade', level: 2, xp: 0 }] }, { race_ref: 'hill-folk' }]) {
      const byPlayer = await world.playerA.db.from('actors').update(change).eq('id', id).select('id');
      expect(byPlayer.error?.code).toBe('42501');
    }
    const byGm = await world.gm.db.from('actors').update({ race_ref: 'hill-folk' }).eq('id', id).select('id');
    expect(byGm.error).toBeNull();
  });

  it('classes must be a list', async () => {
    const id = await character(world.playerA, 'pending', 'Hollis');
    const bad = await world.playerA.db.from('actors').update({ classes: { classRef: 'x' } }).eq('id', id).select('id');
    expect(bad.error).not.toBeNull();
  });
});
