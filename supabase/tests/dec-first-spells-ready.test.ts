// A new caster's first spells are ready at once (row FS1; supabase/migrations/20261126120000_dec_first_spells_ready.sql;
// docs/plans/dec-first-spells-ready.md). TEST project only; invented names.
//   Purpose:
//   1. A play row made from now on is not rested (rested_once false), whoever makes it.
//   2. set_spells (the rest and the GM's set by hand) marks the character rested, on a new row and on one already there.
//   3. A player still can't call set_spells, so they can't close their own first spells that way; nothing is written.
//   4. Another member reads rested_once with the rest of the row, as before; an outsider reads nothing.
//   5. Undo of the rest's line from the log puts rested_once back, so the first spells open again.
//   6. Undo of a line written before the column changed anything (its picture of the row has no rested_once) leaves the
//      mark as it is, so an old line's Undo never reopens a caster who has rested.
// The migration's one-off update of the rows already there runs once, at the push; it is checked on the test project
// before and after that push, not here (the pull request's text has the dry-run query and the seeded rows).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;

const lamp = [{ spell: 'mire-lamp', level: 1 }];
const setSpells = (person: Person, actorId: string, ready: unknown, requestId = crypto.randomUUID()) =>
  taggedDb(person.db as unknown as Db, { type: 'character.setSpells', level: 'simple', requestId }).rpc('set_spells', {
    actor: actorId,
    new_ready: ready as never,
    new_chosen: null as never,
    new_cast: {} as never,
  });
const restedOf = async (actorId: string) =>
  (must(await world.admin.from('character_play').select('rested_once').eq('actor_id', actorId).single()) as { rested_once: boolean }).rested_once;
const fresh = async (actorId: string, rested?: boolean) => {
  must(await world.admin.from('character_play').delete().eq('actor_id', actorId).select('actor_id'));
  const row = { actor_id: actorId, campaign_id: world.campaignId, prepared: [], chosen: null, spells_cast: {}, ...(rested === undefined ? {} : { rested_once: rested }) };
  must(await world.admin.from('character_play').insert(row).select('actor_id'));
};
const lineOf = async (requestId: string) =>
  must(await world.admin.from('events').select('id, before, after').eq('request_id', requestId).eq('target_table', 'character_play').single()) as {
    id: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('rested_once', () => {
  it('1. a row made from now on is not rested', async () => {
    await fresh(world.wrenId);
    expect(await restedOf(world.wrenId)).toBe(false);
    // The owner making their own row (as Prepare's first choice does) starts not rested too.
    must(await world.admin.from('character_play').delete().eq('actor_id', world.wrenId).select('actor_id'));
    must(await world.playerA.db.from('character_play').insert({ actor_id: world.wrenId, campaign_id: world.campaignId, prepared: lamp }).select('actor_id'));
    expect(await restedOf(world.wrenId)).toBe(false);
  });

  it('2. set_spells marks the character rested, on a row already there and on a new one', async () => {
    await fresh(world.wrenId);
    must(await setSpells(world.gm, world.wrenId, lamp));
    expect(await restedOf(world.wrenId)).toBe(true);
    must(await world.admin.from('character_play').delete().eq('actor_id', world.wrenId).select('actor_id'));
    must(await setSpells(world.gm, world.wrenId, []));
    expect(await restedOf(world.wrenId)).toBe(true);
  });

  it("3. a player can't call set_spells, for their own character or another's; nothing is written", async () => {
    await fresh(world.wrenId);
    expect((await setSpells(world.playerA, world.wrenId, lamp)).error).not.toBeNull();
    expect((await setSpells(world.playerB, world.wrenId, lamp)).error).not.toBeNull();
    expect(await restedOf(world.wrenId)).toBe(false);
  });

  it('4. another member reads it with the row; an outsider reads nothing', async () => {
    await fresh(world.wrenId);
    expect(must(await world.playerB.db.from('character_play').select('rested_once, prepared').eq('actor_id', world.wrenId))).toEqual([{ rested_once: false, prepared: [] }]);
    expect(must(await world.outsider.db.from('character_play').select('rested_once').eq('actor_id', world.wrenId))).toHaveLength(0);
  });
});

describe('Undo from the log', () => {
  it("5. Undo of the rest's line puts rested_once back to not rested", async () => {
    await fresh(world.wrenId, false);
    const requestId = crypto.randomUUID();
    must(await setSpells(world.gm, world.wrenId, lamp, requestId));
    const line = await lineOf(requestId);
    expect(line.before).toMatchObject({ rested_once: false });
    expect(line.after).toMatchObject({ rested_once: true });
    must(await world.gm.db.rpc('undo_request', { event_id: line.id }));
    expect(must(await world.admin.from('character_play').select('rested_once, prepared').eq('actor_id', world.wrenId).single())).toEqual({ rested_once: false, prepared: [] });
  });

  it('6. Undo of a line that never changed the mark leaves it as it is', async () => {
    // A caster who has rested: the set changes the spells but not the mark, so its line holds no rested_once, as a line
    // written before the column did.
    await fresh(world.wrenId, true);
    const requestId = crypto.randomUUID();
    must(await setSpells(world.gm, world.wrenId, lamp, requestId));
    const line = await lineOf(requestId);
    expect(line.before ?? {}).not.toHaveProperty('rested_once');
    must(await world.gm.db.rpc('undo_request', { event_id: line.id }));
    expect(must(await world.admin.from('character_play').select('rested_once, prepared').eq('actor_id', world.wrenId).single())).toEqual({ rested_once: true, prepared: [] });
  });
});
