// December step 13, piece C8: pins for spells and traits (supabase/migrations/20261115170000_dec13_c8_pins.sql;
// docs/plans/dec-13-the-player-screen.md; Francis's yes pin-2). TEST project only; invented names.
//   Purpose:
//   1. The owner of an approved character and the GM write `pins`; another player and an outsider can't (the write
//      changes nothing), and a draft character's owner can't either.
//   2. Another player READS a pin exactly as they already read `prepared`: the same row, the same rule; an outsider
//      reads neither.
//   3. The column keeps only a list of at most 24 entries, each a kind of spell or trait with a key of 1 to 80
//      characters; anything else is refused, and the default is an empty list.
//   4. Pinning and unpinning are updates of one row (never a delete), logged under character.pin when tagged, and the
//      log's Undo can put the list back.
//   5. A pin whose spell or trait the character no longer has is stored and harmless: the database does not look.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;

const setPins = (person: Person, actorId: string, pins: unknown) =>
  person.db.from('character_play').update({ pins: pins as never }).eq('actor_id', actorId).select('actor_id');
const rowOf = async (actorId: string) => must(await world.admin.from('character_play').select('prepared, pins').eq('actor_id', actorId).single());
const start = (actorId: string, pins: unknown = []) =>
  world.admin.from('character_play').upsert({ actor_id: actorId, campaign_id: world.campaignId, prepared: [{ spell: 'mire-lamp', level: 1 }], pins: pins as never }).select('actor_id');
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('type').eq('request_id', requestId)) as { type: string }[];

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('1. who writes pins', () => {
  it('the owner and the GM write them; another player and an outsider cannot', async () => {
    must(await start(world.wrenId));
    expect(must(await setPins(world.playerA, world.wrenId, [{ kind: 'spell', key: 'mire-lamp' }]))).toHaveLength(1);
    expect(must(await setPins(world.gm, world.wrenId, [{ kind: 'spell', key: 'mire-lamp' }, { kind: 'trait', key: 'night-eyes' }]))).toHaveLength(1);
    expect((await setPins(world.playerB, world.wrenId, [])).data ?? []).toHaveLength(0);
    expect((await setPins(world.outsider, world.wrenId, [])).data ?? []).toHaveLength(0);
    expect((await rowOf(world.wrenId)).pins).toEqual([{ kind: 'spell', key: 'mire-lamp' }, { kind: 'trait', key: 'night-eyes' }]);
    // Another player cannot create the row for someone else's character either.
    must(await world.admin.from('character_play').delete().eq('actor_id', world.wrenId).select('actor_id'));
    const created = await world.playerB.db.from('character_play').insert({ actor_id: world.wrenId, campaign_id: world.campaignId, pins: [{ kind: 'spell', key: 'x' }] as never }).select('actor_id');
    expect(created.error).not.toBeNull();
  });

  it('the owner of a draft character cannot pin for it', async () => {
    const draft = must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Ash-draft Pip', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'draft' })
        .select('id')
        .single(),
    );
    try {
      const made = await world.playerA.db.from('character_play').insert({ actor_id: draft.id, campaign_id: world.campaignId, pins: [{ kind: 'spell', key: 'x' }] as never }).select('actor_id');
      expect(made.error).not.toBeNull();
    } finally {
      must(await world.admin.from('actors').delete().eq('id', draft.id).select('id'));
    }
  });
});

describe('2. who reads pins', () => {
  it('another player reads a pin exactly as they read prepared; an outsider reads neither', async () => {
    must(await start(world.wrenId, [{ kind: 'trait', key: 'night-eyes' }]));
    const both = must(await world.playerB.db.from('character_play').select('prepared, pins').eq('actor_id', world.wrenId));
    expect(both).toEqual([{ prepared: [{ spell: 'mire-lamp', level: 1 }], pins: [{ kind: 'trait', key: 'night-eyes' }] }]);
    expect(must(await world.gm.db.from('character_play').select('pins').eq('actor_id', world.wrenId))).toHaveLength(1);
    expect(must(await world.outsider.db.from('character_play').select('prepared, pins').eq('actor_id', world.wrenId))).toHaveLength(0);
  });
});

describe('3. the shape and size of the list', () => {
  it('refuses a stray shape, an unknown kind, an empty or long key and a 25th entry; defaults to an empty list', async () => {
    must(await world.admin.from('character_play').delete().eq('actor_id', world.wrenId).select('actor_id'));
    must(await world.admin.from('character_play').insert({ actor_id: world.wrenId, campaign_id: world.campaignId }).select('actor_id'));
    expect((await rowOf(world.wrenId)).pins).toEqual([]);
    const refused = (pins: unknown) => world.admin.from('character_play').update({ pins: pins as never }).eq('actor_id', world.wrenId).select('actor_id');
    for (const bad of [
      { kind: 'spell', key: 'a' },
      ['nonsense'],
      [{ kind: 'item', key: 'a' }],
      [{ kind: 'spell', key: '' }],
      [{ kind: 'spell', key: 'k'.repeat(81) }],
      [{ kind: 'spell', key: 7 }],
      [{ key: 'a' }],
      [{ kind: 'spell', key: 'a', note: 'extra' }],
      Array.from({ length: 25 }, (_, n) => ({ kind: 'spell', key: `s${n}` })),
    ]) {
      expect((await refused(bad)).error, JSON.stringify(bad).slice(0, 60)).not.toBeNull();
    }
    expect((await refused(Array.from({ length: 24 }, (_, n) => ({ kind: 'trait', key: `t${n}` })))).error).toBeNull();
    expect((await refused([{ kind: 'spell', key: 'k'.repeat(80) }])).error).toBeNull();
    // 24 keys at the longest, in four-byte text, still fit under the size check.
    expect((await refused(Array.from({ length: 24 }, (_, n) => ({ kind: 'trait', key: String.fromCodePoint(0x1f432).repeat(79) + String.fromCharCode(97 + n) })))).error).toBeNull();
  });
});

describe('4. pin, unpin and the log', () => {
  it('are updates of one row, logged under character.pin, and a pin for a thing the character no longer has is simply stored', async () => {
    must(await start(world.wrenId));
    const pinId = crypto.randomUUID();
    const tagged = (requestId: string) => taggedDb(world.playerA.db as unknown as Db, { type: 'character.pin', level: 'simple', requestId });
    must(await tagged(pinId).from('character_play').update({ pins: [{ kind: 'spell', key: 'unlearned-spell' }] as never }).eq('actor_id', world.wrenId).select('actor_id'));
    expect((await eventsOf(pinId)).map((e) => e.type)).toEqual(['character.pin']);
    const unpinId = crypto.randomUUID();
    must(await tagged(unpinId).from('character_play').update({ pins: [] }).eq('actor_id', world.wrenId).select('actor_id'));
    expect((await eventsOf(unpinId)).map((e) => e.type)).toEqual(['character.pin']);
    const rows = must(await world.admin.from('character_play').select('actor_id').eq('actor_id', world.wrenId));
    expect(rows).toHaveLength(1);
    expect((await rowOf(world.wrenId)).pins).toEqual([]);
  });
});
