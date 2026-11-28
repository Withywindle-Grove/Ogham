// dec5-gaps piece E (#189; G-228, dg-11, dg-12, dg-16; supabase/migrations/20261128160000_dec5_e_held_send.sql): the GM's
// send (public.give_find) takes a held thing's key, "held:<the person's pack id>:<the item's id>", beside a hoard's row
// keys. TEST project only; invented names (Mother Sedge, The Quay, iron key).
//   Purpose (seam 4):
//   1. A held key is accepted: the thing lands on the character, and the key sits on the send's GM-only line alone, in
//      its rows, beside the place, as a hoard row's key does (rp-4).
//   2. Hidden means hidden: neither player reads the key, the person's id or the rows on anything of the send; the GM
//      does.
//   3. The send's Undo (public.undo_find, unchanged) is Take it back: the thing comes out, as a reversal of its line,
//      and the log keeps the key on the send's GM line, now undone.
//   4. A key of the wrong shape (a name with spaces, a missing item, a capital, an id over 80) is refused, writing
//      nothing; a hoard's row keys are still accepted beside a held key.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

type Answer<T = unknown> = { data: T; error: { code?: string; message: string } | null };

let world: World;
let placeId: string;
let rulesPack: string;
let keyEntryId: string;
const KEY = 'held:mother-sedge:iron-key';

function tagged(person: Person, type: string, requestId: string = crypto.randomUUID()) {
  return { db: taggedDb(person.db as unknown as Db, { type, level: 'simple', requestId }) as unknown as Person['db'], requestId };
}
const eventsOf = async (requestId: string) =>
  must(await world.admin.from('events').select('id, seq, type, target_table, target_id, before, after, reason, audience, reverts_event_id').eq('request_id', requestId).order('seq')) as {
    id: string; type: string; target_table: string; target_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; audience: string; reverts_event_id: string | null;
  }[];
const linesOf = async (actorId: string) =>
  must(await world.admin.from('inventory_lines').select('id, name, qty, how_got').eq('actor_id', actorId)) as { id: string; name: string; qty: number; how_got: string }[];

/** A held send, as the GM's device calls it (find.give): the person's thing to Wren, with its key. */
async function send(person: Person, rows: unknown[], things: unknown[] = [{ libraryEntryId: keyEntryId, qty: 1 }]) {
  const { db, requestId } = tagged(person, 'find.give');
  const answer = (await db.rpc('give_find', { campaign: world.campaignId, to_actor: world.wrenId, place: placeId, things, coins: {}, rows })) as Answer<string | null>;
  return { ...answer, requestId };
}

beforeAll(async () => {
  world = await buildWorld();
  // A pack with a person (GM-only, 07 §5) who holds an iron key, attached to the campaign; and the place she is at.
  rulesPack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Quay rules', version: '0.1', kind: 'setting' }).select('id').single()).id as string;
  keyEntryId = must(
    await world.admin.from('library_entries').insert({ pack_id: rulesPack, kind: 'item', pack_entry_id: 'iron-key', name: 'iron key', data: { id: 'iron-key', name: 'iron key', category: 'tool', stack: 1 } }).select('id').single(),
  ).id as string;
  must(
    await world.admin.from('library_entries').insert({
      pack_id: rulesPack, kind: 'npc', pack_entry_id: 'mother-sedge', name: 'Mother Sedge', data: { id: 'mother-sedge', name: 'Mother Sedge', holds: [{ itemId: 'iron-key' }] },
    }).select('id'),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: rulesPack, created_by: world.gm.id, option_choices: {} }).select('id'));
  placeId = must(await world.admin.from('places').insert({ campaign_id: world.campaignId, name: 'The Quay', created_by: world.gm.id }).select('id').single()).id as string;
}, 300_000);
afterAll(async () => {
  await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', rulesPack);
  await world.admin.from('packs').delete().eq('id', rulesPack);
  await tearDownWorld(world);
}, 60_000);

describe('a send can come from a person (dec5-gaps E)', () => {
  it('1. accepts a held key, and keeps it on the GM-only line alone', async () => {
    const sent = await send(world.gm, [KEY]);
    expect(sent.error).toBeNull();
    expect((await linesOf(world.wrenId)).some((l) => l.name === 'iron key' && l.how_got === 'found')).toBe(true);
    const events = await eventsOf(sent.requestId);
    const party = events.filter((e) => e.audience !== 'gm');
    expect(party.length).toBeGreaterThan(0);
    for (const e of party) expect(JSON.parse(e.reason!)).toEqual({ find: { to: world.wrenId } });
    const gm = events.filter((e) => e.audience === 'gm');
    expect(gm).toHaveLength(1);
    expect(JSON.parse(gm[0]!.reason!)).toEqual({ find: { to: world.wrenId, placeId, rows: [KEY] } });
  });

  it('2. no player reads the key, the person or the rows; the GM does', async () => {
    const sent = await send(world.gm, [KEY]);
    expect(sent.error).toBeNull();
    const readBy = async (person: Person) => must(await person.db.from('events').select('*').eq('request_id', sent.requestId)) as unknown[];
    for (const player of [world.playerA, world.playerB]) {
      const lines = await readBy(player);
      // Each player reads the party's line of the send, so the checks below read something.
      expect(lines.length).toBeGreaterThan(0);
      const read = JSON.stringify(lines);
      expect(read).not.toContain('held:');
      expect(read).not.toContain('mother-sedge');
      expect(read).not.toContain('"rows"');
      expect(read).not.toContain(placeId);
    }
    expect(JSON.stringify(await readBy(world.gm))).toContain(KEY);
  });

  it('3. the send’s Undo takes it back (Take it back), and the key’s send is undone', async () => {
    const before = (await linesOf(world.wrenId)).map((l) => l.id).sort();
    const sent = await send(world.gm, [KEY]);
    expect(sent.error).toBeNull();
    const made = (await eventsOf(sent.requestId)).filter((e) => e.target_table === 'inventory_lines' && e.before === null);
    expect(made).toHaveLength(1);
    const { db } = tagged(world.gm, 'find.undo');
    expect(((await db.rpc('undo_find', { event_id: sent.data! })) as Answer).error).toBeNull();
    expect((await linesOf(world.wrenId)).map((l) => l.id).sort()).toEqual(before);
    const reversal = must(await world.admin.from('events').select('type, after, reverts_event_id').eq('reverts_event_id', made[0]!.id)) as { type: string; after: unknown }[];
    expect(reversal).toEqual([{ type: 'find.undo', after: null, reverts_event_id: made[0]!.id }]);
    // A player still can't take it back.
    const again = await send(world.gm, [KEY]);
    expect(((await tagged(world.playerA, 'find.undo').db.rpc('undo_find', { event_id: again.data! })) as Answer).error?.code).toBe('42501');
  });

  it('4. refuses a key of the wrong shape, writing nothing; a hoard row beside a held key is fine', async () => {
    const before = (await linesOf(world.wrenId)).length;
    for (const bad of ['held:Mother Sedge:iron-key', 'held:mother-sedge', 'held:mother-sedge:', 'held:Mother-sedge:iron-key', `held:${'x'.repeat(81)}:iron-key`, 'held:mother-sedge:iron-key:2', 'kept:mother-sedge:iron-key']) {
      const sent = await send(world.gm, [bad]);
      expect(sent.error?.message).toBe('Send at most 25 rows of a hoard at once.');
      expect(await eventsOf(sent.requestId)).toEqual([]);
    }
    expect((await linesOf(world.wrenId)).length).toBe(before);
    const both = await send(world.gm, ['2:thing', KEY]);
    expect(both.error).toBeNull();
  });
});
