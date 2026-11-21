// December step 8, piece A: a character's magic as state (supabase/migrations/20261113140000_dec_8a_magic_state.sql;
// docs/plans/dec-8-magic-first-cut.md). TEST project only; invented names.
//   Purpose:
//   1. What is chosen for the next rest is kept apart from what is ready today: the owner and the GM write it, another
//      player and an outsider can't, and members read it like the rest of the character's play row.
//   2. cast_spell spends one casting of a ready spell, never more than the times it is ready: of two casts of the last
//      casting, the second is refused with a reason; a spell taken twice keeps one casting after one cast.
//   3. cast_spell gives a casting back (-1), never below none, and refuses a spell that isn't ready.
//   4. cast_spell is the owner's or the GM's: another player and an outsider are refused, and a refusal is not logged;
//      a retired campaign refuses it.
//   5. set_spells is the GM's alone: it sets ready, chosen and cast together; the owner and another player are refused.
//   6. Each command is logged under its own name; the GM's set under character.setSpells, a player's untagged write
//      never under it.
//   7. The GM's set with no casts given keeps today's casts, read inside the database: a cast made on another device
//      after the GM's screen read the row is kept (trimmed to the spells still ready).
//   8. A count of casts is a whole number from 0 to 999: set_spells refuses anything else with a reason, and the column
//      itself refuses a bad count, so a bad value can never stop a cast.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;

const cast = (person: Person, actorId: string, spell: string, level: number, change: number, type = 'character.castSpell', requestId = crypto.randomUUID()) =>
  taggedDb(person.db as unknown as Db, { type, level: 'simple', requestId }).rpc('cast_spell', { actor: actorId, spell, spell_level: level, change });
const setSpells = (person: Person, actorId: string, ready: unknown, chosen: unknown, spellsCast: unknown, requestId = crypto.randomUUID()) =>
  taggedDb(person.db as unknown as Db, { type: 'character.setSpells', level: 'simple', requestId }).rpc('set_spells', {
    actor: actorId,
    new_ready: ready as never,
    new_chosen: chosen as never,
    new_cast: spellsCast as never,
  });
const rowOf = async (actorId: string) => must(await world.admin.from('character_play').select('prepared, chosen, spells_cast').eq('actor_id', actorId).single());
const readyAs = (actorId: string, prepared: unknown, spellsCast: unknown = {}) =>
  world.admin.from('character_play').upsert({ actor_id: actorId, campaign_id: world.campaignId, prepared, chosen: null, spells_cast: spellsCast }).select('actor_id');
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('type').eq('request_id', requestId)) as { type: string }[];

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('1. chosen apart from ready', () => {
  it('the owner and the GM write what is chosen; ready stays; another player and an outsider cannot; members read it', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }]));
    const choose = (person: Person, chosen: unknown) => person.db.from('character_play').update({ chosen }).eq('actor_id', world.wrenId).select('actor_id');
    expect(must(await choose(world.playerA, [{ spell: 'fog-ring', level: 1 }]))).toHaveLength(1);
    expect(must(await choose(world.gm, [{ spell: 'reed-song', level: 1 }]))).toHaveLength(1);
    expect((await choose(world.playerB, [])).data ?? []).toHaveLength(0);
    expect((await choose(world.outsider, [])).data ?? []).toHaveLength(0);
    expect(await rowOf(world.wrenId)).toMatchObject({ prepared: [{ spell: 'mire-lamp', level: 1 }], chosen: [{ spell: 'reed-song', level: 1 }] });
    expect(must(await world.playerB.db.from('character_play').select('chosen, spells_cast').eq('actor_id', world.wrenId))).toHaveLength(1);
    expect(must(await world.outsider.db.from('character_play').select('chosen').eq('actor_id', world.wrenId))).toHaveLength(0);
    // Only a list or nothing: a stray shape is refused.
    expect((await world.admin.from('character_play').update({ chosen: { spell: 'x' } }).eq('actor_id', world.wrenId).select('actor_id')).error).not.toBeNull();
  });
});

describe('2. and 3. cast_spell', () => {
  it('spends one casting at a time, never more than ready, and refuses the second cast of the last one', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }, { spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 2 }]));
    expect(must(await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 1))).toEqual({ '1:mire-lamp': 1 });
    expect(must(await cast(world.gm, world.wrenId, 'mire-lamp', 1, 1))).toEqual({ '1:mire-lamp': 2 });
    const third = await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 1);
    expect(third.error?.message).toBe('Every casting of that spell is spent.');
    // Two devices at once on fog-ring's one casting: one succeeds, the other is refused.
    const both = await Promise.all([cast(world.playerA, world.wrenId, 'fog-ring', 2, 1), cast(world.gm, world.wrenId, 'fog-ring', 2, 1)]);
    expect(both.filter((r) => r.error === null)).toHaveLength(1);
    expect(both.find((r) => r.error)?.error?.message).toBe('Every casting of that spell is spent.');
    expect((await rowOf(world.wrenId)).spells_cast).toEqual({ '1:mire-lamp': 2, '2:fog-ring': 1 });
  });

  it('gives one back, never below none, and refuses a spell that is not ready', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }], { '1:mire-lamp': 1 }));
    expect(must(await cast(world.playerA, world.wrenId, 'mire-lamp', 1, -1, 'character.uncastSpell'))).toEqual({});
    expect((await cast(world.playerA, world.wrenId, 'mire-lamp', 1, -1, 'character.uncastSpell')).error?.message).toBe("That spell hasn't been cast.");
    expect((await cast(world.playerA, world.wrenId, 'mire-lamp', 2, 1)).error?.message).toBe("That spell isn't ready.");
    expect((await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 2)).error).not.toBeNull();
  });
});

describe('4. who may cast', () => {
  it('another player and an outsider are refused and nothing is logged; a retired campaign refuses', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }]));
    for (const person of [world.playerB, world.outsider]) {
      const requestId = crypto.randomUUID();
      expect((await cast(person, world.wrenId, 'mire-lamp', 1, 1, 'character.castSpell', requestId)).error?.code).toBe('42501');
      expect(await eventsOf(requestId)).toEqual([]);
    }
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', world.campaignId).select('id'));
    try {
      expect((await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 1)).error).not.toBeNull();
    } finally {
      must(await world.admin.from('campaigns').update({ retired_at: null }).eq('id', world.campaignId).select('id'));
    }
    expect((await rowOf(world.wrenId)).spells_cast).toEqual({});
  });
});

describe("5. and 6. the GM's set, and the log", () => {
  it('only the GM sets ready, chosen and cast together; each command is logged under its own name', async () => {
    must(await readyAs(world.wrenId, []));
    const ready = [{ spell: 'reed-song', level: 1 }];
    for (const person of [world.playerA, world.playerB, world.outsider]) {
      expect((await setSpells(person, world.wrenId, ready, null, {})).error?.code).toBe('42501');
    }
    const requestId = crypto.randomUUID();
    expect((await setSpells(world.gm, world.wrenId, ready, [{ spell: 'fog-ring', level: 1 }], { '1:reed-song': 1 }, requestId)).error).toBeNull();
    expect(await rowOf(world.wrenId)).toEqual({ prepared: ready, chosen: [{ spell: 'fog-ring', level: 1 }], spells_cast: { '1:reed-song': 1 } });
    expect(new Set((await eventsOf(requestId)).map((e) => e.type))).toEqual(new Set(['character.setSpells']));
    expect((await setSpells(world.gm, world.wrenId, { not: 'a list' }, null, {})).error).not.toBeNull();

    const castId = crypto.randomUUID();
    must(await cast(world.playerA, world.wrenId, 'reed-song', 1, -1, 'character.uncastSpell', castId));
    expect((await eventsOf(castId)).map((e) => e.type)).toEqual(['character.uncastSpell']);
    // A player's write tagged as the GM's set (6.) is logged under a plain name, never as the GM's.
    const sneak = crypto.randomUUID();
    must(await taggedDb(world.playerA.db as unknown as Db, { type: 'character.setSpells', level: 'simple', requestId: sneak }).from('character_play').update({ chosen: null }).eq('actor_id', world.wrenId).select('actor_id'));
    expect((await eventsOf(sneak)).map((e) => e.type)).toEqual(['character_play.update']);
  });
});

describe('7. the GM set keeps a cast made meanwhile', () => {
  it('with no casts given, the casts in the database at the moment of the set are kept, trimmed to what is still ready', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 2 }]));
    // The GM's screen has read the row (no casts); then Wren casts on another device; then the GM's set lands.
    must(await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 1));
    must(await cast(world.playerA, world.wrenId, 'fog-ring', 2, 1));
    expect((await setSpells(world.gm, world.wrenId, [{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-song', level: 1 }], null, null)).error).toBeNull();
    expect((await rowOf(world.wrenId)).spells_cast).toEqual({ '1:mire-lamp': 1 });
  });
});

describe('8. whole counts only', () => {
  it('set_spells refuses a count that is not a whole number of 0 or more, and the column refuses one written directly', async () => {
    must(await readyAs(world.wrenId, [{ spell: 'mire-lamp', level: 1 }]));
    for (const bad of [{ '1:mire-lamp': -1 }, { '1:mire-lamp': 1.5 }, { '1:mire-lamp': 'one' }]) {
      expect((await setSpells(world.gm, world.wrenId, [{ spell: 'mire-lamp', level: 1 }], null, bad)).error?.message).toBe('A count of casts must be a whole number, 0 or more.');
    }
    for (const bad of [{ '1:mire-lamp': -1 }, { '1:mire-lamp': 'one' }, { '1:mire-lamp': 100000 }]) {
      expect((await world.playerA.db.from('character_play').update({ spells_cast: bad }).eq('actor_id', world.wrenId).select('actor_id')).error).not.toBeNull();
    }
    expect(must(await cast(world.playerA, world.wrenId, 'mire-lamp', 1, 1))).toEqual({ '1:mire-lamp': 1 });
  });
});
