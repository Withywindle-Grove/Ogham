// K16b, the GM sends a find (pk-12: "When you send a find from a hoard, one action adds the things and the coin together,
// and your Undo takes both back in one step"; pk-1, pk-2, pu-9; supabase/migrations/20261115090000_dec_6_k16b_send_find.sql).
// TEST project only; invented coins (herons, bits), items and places. Written in a cloud session, where database tests
// can't run: CI's database job runs them.
//   Purpose:
//   1. The GM sends things and coin to a character as one action (one request, every line `find.give`, ids only): the
//      party's lines say whom it went to, and one GM-only line also the place and the rows; and to the party stash.
//   2. Another player reads no amount: no purse line of the send, and nothing they read carries a coin's count; the
//      receiver's player reads the amount on their purse's line. No player reads the place's id or the rows (rp-4).
//   3. The GM's Undo (public.undo_find) takes the things and the coin back in one step, and the log keeps each removed
//      line's whole copy (hard rule 4's exception of 2026-11-03); it runs once only, even twice at the same moment; and
//      it takes back an item's knowledge the send taught the party, unless the party knew it before or a line the
//      party holds still has one (uf-2; an NPC's copy doesn't count).
//   4. That Undo is refused, nothing changed, once a sent thing was changed, something put in it, or the coin spent.
//   5. A player can't send; neither can another campaign's GM. A player's Undo of the send stays refused, by undo_find
//      and by the generic Undo; another campaign's GM can't Undo it either.
//   6. The shape: a negative or fractional amount, a coin the setting doesn't define, a thing with no count, is refused
//      with nothing written.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

type Coins = Record<string, number>;
type Answer<T = unknown> = { data: T; error: { code?: string; message: string } | null };

let world: World;
let stashId: string;
let placeId: string;
let opalEntryId: string;
let rulesPack: string;

/** A tagged connection for this person, as the app's runCommand makes, with its request id. */
function tagged(person: Person, type: string, requestId: string = crypto.randomUUID()) {
  return { db: taggedDb(person.db as unknown as Db, { type, level: 'simple', requestId }) as unknown as Person['db'], requestId };
}
const coinsOf = async (actorId: string) => must(await world.admin.from('purses').select('coins').eq('actor_id', actorId).single()).coins as Coins;
const stashCoins = async () => must(await world.admin.from('purses').select('coins').eq('location_id', stashId).single()).coins as Coins;
const setCoins = async (where: { actor?: string; stash?: true }, coins: Coins) => {
  const q = world.admin.from('purses').update({ coins });
  must(await (where.stash ? q.eq('location_id', stashId) : q.eq('actor_id', where.actor!)).select('id'));
};
const linesOn = async (where: { actor?: string; stash?: true }) => {
  const q = world.admin.from('inventory_lines').select('id, name, qty, actor_id, location_id, how_got');
  return must(await (where.stash ? q.eq('location_id', stashId) : q.eq('actor_id', where.actor!))) as { id: string; name: string; qty: number; actor_id: string | null; location_id: string | null; how_got: string }[];
};
const eventsOf = async (requestId: string) =>
  must(await world.admin.from('events').select('id, seq, type, target_table, target_id, before, after, reason, audience, owner_user_id, reverts_event_id').eq('request_id', requestId).order('seq')) as {
    id: string; type: string; target_table: string; target_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; audience: string; owner_user_id: string | null; reverts_event_id: string | null;
  }[];

/** The send, as the GM's device calls it (find.give), to a character or (null) the stash. */
async function send(person: Person, to: string | null, things: unknown[], coins: unknown, rows: string[] = ['0:thing']) {
  const { db, requestId } = tagged(person, 'find.give');
  const answer = (await db.rpc('give_find', { campaign: world.campaignId, to_actor: to, place: placeId, things, coins, rows })) as Answer<string | null>;
  return { ...answer, requestId };
}
async function undo(person: Person, eventId: string) {
  const { db } = tagged(person, 'find.undo');
  return (await db.rpc('undo_find', { event_id: eventId })) as Answer;
}
const OPAL = () => ({ libraryEntryId: opalEntryId, qty: 2 });
const HOOK = { name: 'A silver hook', qty: 1 };
/** Items not for sale (players read them only once the party knows them), one per known-item test. */
const RARE = ['pale-key', 'bog-lantern', 'reed-whistle', 'ash-flute'] as const;
const rareIds: Record<string, string> = {};
const known = async (item: string) => must(await world.admin.from('known_items').select('item_id').eq('campaign_id', world.campaignId).eq('item_id', item)).length > 0;
/** Can Player B read the item's entry, as the library reads it for a player? */
const playerReads = async (item: string) =>
  must(await world.playerB.db.from('library_entries').select('pack_entry_id').eq('pack_id', rulesPack).eq('kind', 'item').eq('pack_entry_id', item)).length > 0;
/** The send's one GM-only line (the place, the rows, the items it taught). */
const gmLineOf = async (requestId: string) => (await eventsOf(requestId)).find((e) => e.audience === 'gm' && e.target_table === 'places');

beforeAll(async () => {
  world = await buildWorld();
  stashId = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash').single()).id as string;
  // The setting's coins (herons, bits) and one item, in a pack attached to the campaign.
  rulesPack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Reed rules', version: '0.1', kind: 'setting' }).select('id').single()).id as string;
  must(
    await world.admin.from('library_entries').insert({
      pack_id: rulesPack, kind: 'rulesSet', pack_entry_id: 'reed-rules', name: 'Reed rules',
      data: { id: 'reed-rules', name: 'Reed rules', currency: [{ key: 'heron', label: 'herons', valueInBase: 1 }, { key: 'bit', label: 'bits', valueInBase: 10 }] },
    }).select('id'),
  );
  opalEntryId = must(await world.admin.from('library_entries').insert({ pack_id: rulesPack, kind: 'item', pack_entry_id: 'moon-opal', name: 'Moon opal', data: { id: 'moon-opal', name: 'Moon opal', category: 'gem', stack: 10 } }).select('id').single()).id as string;
  for (const item of RARE) {
    rareIds[item] = must(
      await world.admin.from('library_entries').insert({ pack_id: rulesPack, kind: 'item', pack_entry_id: item, name: item, data: { id: item, name: item, category: 'magic-trinket', forSale: false, stack: 1 } }).select('id').single(),
    ).id as string;
  }
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: rulesPack, created_by: world.gm.id, option_choices: {} }).select('id'));
  placeId = must(await world.admin.from('places').insert({ campaign_id: world.campaignId, name: 'The Reed Stair', created_by: world.gm.id }).select('id').single()).id as string;
}, 300_000);
afterAll(async () => {
  await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', rulesPack);
  await world.admin.from('packs').delete().eq('id', rulesPack);
  await tearDownWorld(world);
}, 60_000);
beforeEach(async () => {
  await setCoins({ actor: world.wrenId }, { heron: 5 });
  await setCoins({ stash: true }, {});
});

describe('1. the GM sends a find (pk-12)', () => {
  it('sends things and coin to a character as one action, every line a find with the same ids-only reason', async () => {
    const before = (await linesOn({ actor: world.wrenId })).length;
    const sent = await send(world.gm, world.wrenId, [OPAL(), HOOK], { heron: 40, bit: 0 }, ['1:coin', '2:thing', '3:thing']);
    expect(sent.error).toBeNull();
    expect(typeof sent.data).toBe('string');
    const lines = await linesOn({ actor: world.wrenId });
    expect(lines).toHaveLength(before + 2);
    expect(lines.filter((l) => l.how_got === 'found').map((l) => [l.name, l.qty]).sort()).toEqual(expect.arrayContaining([['A silver hook', 1], ['Moon opal', 2]]));
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 45 });
    const events = await eventsOf(sent.requestId);
    expect(events.map((e) => e.type).every((t) => t === 'find.give')).toBe(true);
    expect(events.map((e) => e.target_table).sort()).toEqual(expect.arrayContaining(['inventory_lines', 'inventory_lines', 'purses', 'places']));
    // The party's lines (the things', the purse's): whom it went to and that coin went; never the place or the rows.
    const party = events.filter((e) => e.audience !== 'gm');
    expect(party.length).toBe(3);
    for (const e of party) expect(JSON.parse(e.reason!)).toEqual({ find: { to: world.wrenId, coin: true } });
    // One GM-only line: the place and the rows, and the item the send taught the party (the opal, new to it here).
    const gm = events.filter((e) => e.audience === 'gm');
    expect(gm).toHaveLength(1);
    expect(gm[0]!.target_table).toBe('places');
    expect(JSON.parse(gm[0]!.reason!)).toEqual({ find: { to: world.wrenId, placeId, coin: true, rows: ['1:coin', '2:thing', '3:thing'] } });
    expect(gm[0]!.after).toEqual({ learned: ['moon-opal'] });
    // The answer is the send's first event: what the GM's Undo is given.
    expect(events[0]!.id).toBe(sent.data);
  });

  it('sends to the party stash', async () => {
    const sent = await send(world.gm, null, [HOOK], { bit: 3 });
    expect(sent.error).toBeNull();
    expect((await linesOn({ stash: true })).some((l) => l.name === 'A silver hook')).toBe(true);
    expect(await stashCoins()).toEqual({ bit: 3 });
    expect(JSON.parse((await eventsOf(sent.requestId))[0]!.reason!)).toEqual({ find: { to: null, coin: true } });
    expect(JSON.parse((await gmLineOf(sent.requestId))!.reason!)).toMatchObject({ find: { to: null, placeId, coin: true } });
  });
});

describe('2. hidden means hidden (pu-9)', () => {
  it("another player reads no amount; the receiver's player reads it on their purse's line", async () => {
    const sent = await send(world.gm, world.wrenId, [HOOK], { heron: 77 });
    expect(sent.error).toBeNull();
    const readBy = async (person: Person) => must(await person.db.from('events').select('*').eq('request_id', sent.requestId)) as Record<string, unknown>[];
    const other = await readBy(world.playerB);
    // Player B reads the thing's line (the party's), with the reason, and no purse line.
    expect(other.length).toBeGreaterThan(0);
    expect(other.some((e) => e.target_table === 'purses')).toBe(false);
    // No coin's count anywhere they read: no `coins` in any payload, and nothing but ids, words and flags in the reason.
    expect(JSON.stringify(other)).not.toContain('"coins"');
    for (const e of other) {
      const find = (JSON.parse(String(e.reason)) as { find: Record<string, unknown> }).find;
      expect(Object.values(find).some((v) => typeof v === 'number')).toBe(false);
    }
    const mine = await readBy(world.playerA);
    const purse = mine.find((e) => e.target_table === 'purses');
    expect((purse?.after as { coins?: Coins } | undefined)?.coins).toEqual({ heron: 82 });
    // Neither player reads where it was found or which hoard rows went (rp-4): not the place's id, not the rows, not
    // the GM's line; the GM reads them.
    for (const read of [other, mine]) {
      expect(JSON.stringify(read)).not.toContain(placeId);
      expect(JSON.stringify(read)).not.toContain('"rows"');
      expect(read.some((e) => e.audience === 'gm')).toBe(false);
    }
    expect(JSON.stringify(await readBy(world.gm))).toContain(placeId);
  });
});

describe('3. the GM undoes a send (pk-12; hard rule 4, 2026-11-03)', () => {
  it('takes the things and the coin back in one step, and the log keeps each removed line whole', async () => {
    const before = await linesOn({ actor: world.wrenId });
    const sent = await send(world.gm, world.wrenId, [OPAL(), HOOK], { heron: 40 });
    expect(sent.error).toBeNull();
    const made = (await eventsOf(sent.requestId)).filter((e) => e.target_table === 'inventory_lines' && e.before === null).map((e) => e.target_id);
    expect((await undo(world.gm, sent.data!)).error).toBeNull();
    expect((await linesOn({ actor: world.wrenId })).map((l) => l.id).sort()).toEqual(before.map((l) => l.id).sort());
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 5 });
    // The removals and the coin's return are reversals of the send's lines, each line's whole copy kept.
    const reversals = must(await world.admin.from('events').select('target_table, target_id, before, after, reverts_event_id, type').eq('campaign_id', world.campaignId).eq('target_table', 'inventory_lines').not('reverts_event_id', 'is', null).in('target_id', made)) as { before: Record<string, unknown> | null; after: unknown; type: string }[];
    expect(reversals).toHaveLength(2);
    for (const r of reversals) {
      expect(r.after).toBeNull();
      expect(r.before).toMatchObject({ how_got: 'found', actor_id: world.wrenId });
      expect(r.type).toBe('find.undo');
    }
    // Done once: again is refused.
    expect((await undo(world.gm, sent.data!)).error?.message).toBe('That was already undone.');
  });

  it('is refused, nothing changed, once a sent thing has changed since', async () => {
    const sent = await send(world.gm, world.wrenId, [HOOK], { heron: 40 });
    const hook = (await eventsOf(sent.requestId)).find((e) => e.target_table === 'inventory_lines')!.target_id;
    must(await world.admin.from('inventory_lines').update({ qty: 3 }).eq('id', hook).select('id'));
    expect((await undo(world.gm, sent.data!)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect((await linesOn({ actor: world.wrenId })).some((l) => l.id === hook)).toBe(true);
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 45 });
  });

  it('is refused, nothing changed, once the sent coin has been spent', async () => {
    const sent = await send(world.gm, world.wrenId, [HOOK], { heron: 40 });
    const hook = (await eventsOf(sent.requestId)).find((e) => e.target_table === 'inventory_lines')!.target_id;
    await setCoins({ actor: world.wrenId }, { heron: 10 });
    expect((await undo(world.gm, sent.data!)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect((await linesOn({ actor: world.wrenId })).some((l) => l.id === hook)).toBe(true);
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 10 });
  });

  // Purpose: a player's own things never fall out of a found bag being taken back: the Undo refuses, nothing changed.
  it('is refused, nothing changed, while something has been put inside a sent thing', async () => {
    const sent = await send(world.gm, world.wrenId, [{ name: 'A reed satchel', qty: 1 }], {});
    const satchel = (await eventsOf(sent.requestId)).find((e) => e.target_table === 'inventory_lines')!.target_id;
    const inside = must(
      await world.admin.from('inventory_lines').insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Eel jerky', qty: 2, how_got: 'bought', container_line_id: satchel }).select('id').single(),
    ).id as string;
    expect((await undo(world.gm, sent.data!)).error?.message).toBe("That's changed since. Undo the later change first.");
    const lines = await linesOn({ actor: world.wrenId });
    expect(lines.some((l) => l.id === satchel)).toBe(true);
    expect(lines.some((l) => l.id === inside)).toBe(true);
    await world.admin.from('inventory_lines').delete().eq('id', inside);
  });

  // Purpose: a double tap, or two devices at once, takes a coin-only send back once: the coin comes out once.
  it('runs once only, even when two Undos of a coin-only send arrive together', async () => {
    await setCoins({ actor: world.wrenId }, { heron: 100 });
    const sent = await send(world.gm, world.wrenId, [], { heron: 40 }, []);
    expect(sent.error).toBeNull();
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 140 });
    const both = await Promise.all([undo(world.gm, sent.data!), undo(world.gm, sent.data!)]);
    expect(both.filter((a) => a.error === null)).toHaveLength(1);
    expect(both.find((a) => a.error !== null)?.error?.message).toBe('That was already undone.');
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 100 });
  });

  // Purpose (uf-2): an item the send taught the party is unknown again after the Undo; players can't read its entry,
  // and the log keeps the knowledge's copy on the GM's reversal line.
  it('takes back the knowledge of an item the send taught the party', async () => {
    const item = RARE[0];
    expect(await known(item)).toBe(false);
    const sent = await send(world.gm, world.wrenId, [{ libraryEntryId: rareIds[item], qty: 1 }], {});
    expect(sent.error).toBeNull();
    expect(await known(item)).toBe(true);
    expect(await playerReads(item)).toBe(true);
    expect((await gmLineOf(sent.requestId))!.after).toEqual({ learned: [item] });
    expect((await undo(world.gm, sent.data!)).error).toBeNull();
    expect(await known(item)).toBe(false);
    expect(await playerReads(item)).toBe(false);
    const kept = must(
      await world.admin.from('events').select('type, before, audience, reverts_event_id').eq('campaign_id', world.campaignId).eq('target_table', 'known_items').eq('reverts_event_id', (await gmLineOf(sent.requestId))!.id),
    ) as { type: string; before: Record<string, unknown> | null; audience: string }[];
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ type: 'find.undo', audience: 'gm', before: { campaign_id: world.campaignId, item_id: item } });
  });

  // Purpose (uf-2): knowledge the party had before the send stays after its Undo.
  it('leaves the knowledge of an item the party already knew', async () => {
    const item = RARE[1];
    must(await world.admin.from('known_items').insert({ campaign_id: world.campaignId, item_id: item }).select('item_id'));
    const sent = await send(world.gm, world.wrenId, [{ libraryEntryId: rareIds[item], qty: 1 }], {});
    expect((await gmLineOf(sent.requestId))!.after).toEqual({ learned: [] });
    expect((await undo(world.gm, sent.data!)).error).toBeNull();
    expect(await known(item)).toBe(true);
    expect(await playerReads(item)).toBe(true);
  });

  // Purpose (uf-2): while another line in the campaign still holds the item, the party still knows it.
  it('leaves the knowledge while another character still holds one', async () => {
    const item = RARE[2];
    const sent = await send(world.gm, world.wrenId, [{ libraryEntryId: rareIds[item], qty: 1 }], {});
    expect((await gmLineOf(sent.requestId))!.after).toEqual({ learned: [item] });
    const ashs = must(
      await world.admin.from('inventory_lines').insert({ campaign_id: world.campaignId, actor_id: world.ashId, library_entry_id: rareIds[item], name: 'Item', qty: 1, how_got: 'given' }).select('id').single(),
    ).id as string;
    expect((await undo(world.gm, sent.data!)).error).toBeNull();
    expect(await known(item)).toBe(true);
    expect(await playerReads(item)).toBe(true);
    await world.admin.from('inventory_lines').delete().eq('id', ashs);
  });

  // Purpose (uf-2, as the lead read it): "nobody else" is nobody in the party. A copy on an NPC (the GM's, approved)
  // never taught the party, so it doesn't keep the knowledge: after the Undo the item is unknown and unreadable.
  it("takes the knowledge back even while an NPC holds one", async () => {
    const item = RARE[3];
    const npc = must(
      await world.admin.from('actors').insert({ campaign_id: world.campaignId, kind: 'npc', name: 'Bog lurker', owner_type: 'gm', approval: 'approved' }).select('id').single(),
    ).id as string;
    const sent = await send(world.gm, world.wrenId, [{ libraryEntryId: rareIds[item], qty: 1 }], {});
    expect((await gmLineOf(sent.requestId))!.after).toEqual({ learned: [item] });
    const npcs = must(
      await world.admin.from('inventory_lines').insert({ campaign_id: world.campaignId, actor_id: npc, library_entry_id: rareIds[item], name: 'Item', qty: 1, how_got: 'given' }).select('id').single(),
    ).id as string;
    expect((await undo(world.gm, sent.data!)).error).toBeNull();
    expect(await known(item)).toBe(false);
    expect(await playerReads(item)).toBe(false);
    await world.admin.from('inventory_lines').delete().eq('id', npcs);
    await world.admin.from('actors').delete().eq('id', npc);
  });
});

describe('4. who may send and undo', () => {
  it("a player can't send, nor can another campaign's GM", async () => {
    const before = (await linesOn({ actor: world.wrenId })).length;
    expect((await send(world.playerA, world.wrenId, [HOOK], {})).error?.code).toBe('42501');
    // The outsider runs a campaign of their own, and is GM nowhere here.
    const theirs = must(await world.admin.from('campaigns').insert({ name: 'The Heron Weir', created_by: world.outsider.id }).select('id').single()).id as string;
    must(await world.admin.from('members').insert({ campaign_id: theirs, user_id: world.outsider.id, base_role: 'gm' }).select());
    expect((await send(world.outsider, world.wrenId, [HOOK], {})).error?.code).toBe('42501');
    expect((await linesOn({ actor: world.wrenId })).length).toBe(before);
  });

  it("a player's Undo of the send stays refused, by undo_find and by the generic Undo", async () => {
    const sent = await send(world.gm, world.wrenId, [HOOK], { heron: 4 });
    expect((await undo(world.playerA, sent.data!)).error?.code).toBe('42501');
    const { db } = tagged(world.playerA, 'log.undo');
    expect((await db.rpc('undo_request_said', { event_id: sent.data! })).error).not.toBeNull();
    // The GM's own generic Undo is refused too: a find is undone by undo_find alone.
    const gm = tagged(world.gm, 'log.undo');
    expect((await gm.db.rpc('undo_request_said', { event_id: sent.data! })).error).not.toBeNull();
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 9 });
  });

  it("another campaign's GM can't Undo the send", async () => {
    const sent = await send(world.gm, world.wrenId, [HOOK], { heron: 4 });
    const hook = (await eventsOf(sent.requestId)).find((e) => e.target_table === 'inventory_lines')!.target_id;
    // The outsider runs a campaign of their own.
    const theirs = must(await world.admin.from('campaigns').insert({ name: 'The Eel Ford', created_by: world.outsider.id }).select('id').single()).id as string;
    must(await world.admin.from('members').insert({ campaign_id: theirs, user_id: world.outsider.id, base_role: 'gm' }).select());
    expect((await undo(world.outsider, sent.data!)).error?.code).toBe('42501');
    expect((await linesOn({ actor: world.wrenId })).some((l) => l.id === hook)).toBe(true);
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 9 });
  });
});

describe('5. the shape the server checks', () => {
  it('refuses a negative or fractional amount, a coin the setting does not define, and a thing with no count, writing nothing', async () => {
    const before = (await linesOn({ actor: world.wrenId })).length;
    for (const [things, coins] of [
      [[HOOK], { heron: -1 }],
      [[HOOK], { heron: 1.5 }],
      [[HOOK], { zz: 3 }],
      [[{ name: 'A silver hook', qty: 0 }], {}],
      [[], {}],
    ] as const) {
      const sent = await send(world.gm, world.wrenId, [...things], coins);
      expect(sent.error).not.toBeNull();
      expect(await eventsOf(sent.requestId)).toEqual([]);
    }
    expect((await linesOn({ actor: world.wrenId })).length).toBe(before);
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 5 });
  });
});
