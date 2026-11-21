// December step 6, piece (b): the purse commands (supabase/migrations/20261114090000_dec_6b_purse_commands.sql;
// docs/plans/dec-6-purse.md). TEST project only; invented names and coins. (Who may run each command, both ways, is
// also in src/testing/permissionCases.ts, run for real by commands.test.ts.)
//   Purpose:
//   1. The GM gives and takes; a player spends, gives (to another character or the stash) and takes from the stash.
//      Each change is logged under its command's name, a spend with its few words.
//   2. Hidden means hidden: the line on the purse a gift reached is its owner's and the GM's, not the giver's; and a
//      refusal to someone who can't touch a purse says nothing of what it holds, even when it holds too little.
//   3. A purse never goes below zero: refused with "<Name> has <n> <coin>." (code GR422, its detail for the app's
//      words), and nothing moves, on either purse.
//   4. Undo: a player undoes their own give to another player's character (a purse they can't read), and both purses
//      come back; it is refused once the coin has moved on since, refused a second time, and refused to anyone else.
//   5. The same request sent again changes nothing twice.
//   6. A dead character's purse is open to another player's take; once the character is back in play, it isn't.
//   7. Devices still never write the purses table themselves.
//   8. An archived character's purse is the GM's alone to change; the stash is "The stash" in a refusal; a purse holds
//      at most 999,999,999 of a coin; a bad amount is refused in the lead's words (2026-11-13).
//   9. The review of 2026-11-13: a request without its id is refused; a line is named by its function, never the
//      header; Undo refuses an action that isn't exactly one give, take or spend, so it never makes coin; a take goes
//      back only while its purse is still open (dead), not after; a give past the cap of a purse the giver can't read
//      says only "That give didn't go through. Nothing changed."
//  10. The Fable review of 2026-11-13: an Undo files its reversals under its own id, so the reversal-lines trick makes
//      no coin; a forged action is refused to the player and the GM; a player's and the GM's ordinary Undos work, and a
//      player can't undo the GM's add or a reversal; the GM's moves log both sides; a repeated give or take changes
//      nothing twice; a player can't call the GM's add; a hireling's purse is its employer's; Undo goes by the purses
//      as they are now (archived, a receiver archived since, a character passed to another player).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

type Coins = Record<string, number>;
type Answer = { error: { code?: string; message: string; details?: string | null } | null };

let world: World;
let stashId: string;

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
const linesOf = async (requestId: string) =>
  must(await world.admin.from('events').select('id, type, audience, owner_user_id, reason, target_id, actor_user_id').eq('request_id', requestId)) as {
    id: string; type: string; audience: string; owner_user_id: string | null; reason: string | null; target_id: string; actor_user_id: string;
  }[];
const purseIdOf = async (actorId: string) => must(await world.admin.from('purses').select('id').eq('actor_id', actorId).single()).id as string;

beforeAll(async () => {
  world = await buildWorld();
  stashId = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash').single()).id as string;
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);
beforeEach(async () => {
  await setCoins({ actor: world.wrenId }, { heron: 30, bit: 4 });
  await setCoins({ actor: world.ashId }, {});
  await setCoins({ stash: true }, {});
  must(await world.admin.from('actors').update({ status: 'active' }).eq('id', world.ashId).select('id'));
});

describe('1. give, take, spend', () => {
  it('the GM gives coin to a character and to the stash, and takes it out again', async () => {
    const { db, requestId } = tagged(world.gm, 'purse.add');
    expect((await db.rpc('purse_add', { campaign: world.campaignId, actor: world.ashId, location: null, coins: { heron: 40 } })).error).toBeNull();
    expect(await coinsOf(world.ashId)).toEqual({ heron: 40 });
    expect(await linesOf(requestId)).toMatchObject([{ type: 'purse.add', audience: 'owner', owner_user_id: world.playerB.id }]);
    const stash = tagged(world.gm, 'purse.add');
    expect((await stash.db.rpc('purse_add', { campaign: world.campaignId, actor: null, location: stashId, coins: { bit: 4 } })).error).toBeNull();
    expect(await linesOf(stash.requestId)).toMatchObject([{ type: 'purse.add', audience: 'all' }]);
    const out = tagged(world.gm, 'purse.remove');
    expect((await out.db.rpc('purse_remove', { campaign: world.campaignId, actor: null, location: stashId, coins: { bit: 4 } })).error).toBeNull();
    // A coin at zero leaves the purse.
    expect(await stashCoins()).toEqual({});
  });

  it('a player spends from their own purse, the words kept in its line', async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.spend');
    expect((await db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 2 }, what_for: '  Eel pie ' })).error).toBeNull();
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 28, bit: 4 });
    expect(await linesOf(requestId)).toMatchObject([{ type: 'purse.spend', reason: 'Eel pie', audience: 'owner', owner_user_id: world.playerA.id }]);
  });

  it('a player puts coin in the stash and another player takes it into their own purse', async () => {
    const give = tagged(world.playerA, 'purse.give');
    expect((await give.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 10 } })).error).toBeNull();
    const take = tagged(world.playerB, 'purse.take');
    expect((await take.db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.ashId, coins: { heron: 10 } })).error).toBeNull();
    expect([await coinsOf(world.wrenId), await stashCoins(), await coinsOf(world.ashId)]).toEqual([{ heron: 20, bit: 4 }, {}, { heron: 10 }]);
    expect((await linesOf(take.requestId)).map((l) => l.audience).sort()).toEqual(['all', 'owner']);
  });
});

describe('2. hidden means hidden', () => {
  it("the line on the purse a gift reached is its owner's, not the giver's", async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.give');
    expect((await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    const ashPurse = await purseIdOf(world.ashId);
    const seenByA = must(await world.playerA.db.from('events').select('target_id').eq('request_id', requestId)) as { target_id: string }[];
    expect(seenByA.map((e) => e.target_id)).not.toContain(ashPurse);
    const seenByB = must(await world.playerB.db.from('events').select('target_id').eq('request_id', requestId)) as { target_id: string }[];
    expect(seenByB.map((e) => e.target_id)).toEqual([ashPurse]);
    // Each side's line names the other (pu-7: "Wren gave Ash 5 herons", read by both), never an amount it can't read.
    const reasons = new Map((await linesOf(requestId)).map((l) => [l.target_id, l.reason]));
    expect(reasons.get(ashPurse)).toBe(`with:${world.wrenId}`);
    expect(reasons.get(await purseIdOf(world.wrenId))).toBe(`with:${world.ashId}`);
    // And Player A still reads nothing of Ash's purse.
    expect(must(await world.playerA.db.from('purses').select('id').eq('actor_id', world.ashId))).toEqual([]);
  });

  it("a refusal to someone who can't touch a purse says nothing of what it holds", async () => {
    // Ash holds nothing; asking for far more than that still only says "not allowed".
    for (const ask of [
      world.playerA.db.rpc('purse_spend', { campaign: world.campaignId, actor: world.ashId, coins: { heron: 999 } }),
      world.playerA.db.rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: 999 } }),
      world.playerA.db.rpc('purse_remove', { campaign: world.campaignId, actor: world.ashId, location: null, coins: { heron: 999 } }),
      world.outsider.db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.wrenId, coins: { heron: 999 } }),
    ]) {
      const { error } = (await ask) as Answer;
      expect(error?.code).toBe('42501');
      expect(error?.message).not.toMatch(/has/);
    }
  });
});

describe('3. never below zero', () => {
  it('is refused with what the purse has, and nothing moves on either side', async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.give');
    const { error } = (await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { bit: 1, heron: 31 } })) as Answer;
    expect(error?.code).toBe('GR422');
    const wrenName = must(await world.admin.from('actors').select('name').eq('id', world.wrenId).single()).name as string;
    expect(error?.message).toBe(`${wrenName} has 30 heron.`);
    expect(JSON.parse(error?.details ?? '{}')).toEqual({ name: wrenName, coin: 'heron', has: 30 });
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 30, bit: 4 }, {}]);
    expect(await linesOf(requestId)).toEqual([]);
  });

  it('refuses an amount that is not whole numbers of 1 or more', async () => {
    for (const coins of [{}, { heron: 0 }, { heron: -2 }, { heron: 1.5 }, { heron: '2' }]) {
      const { error } = (await tagged(world.playerA, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins })) as Answer;
      expect(error?.message, JSON.stringify(coins)).toBe('Say how many: a whole number, 1 or more.');
    }
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 30, bit: 4 });
  });
});

describe('4. undo', () => {
  it("a player undoes their own give to another player's character: both purses come back", async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.give');
    expect((await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    const wrenPurse = await purseIdOf(world.wrenId);
    const mine = (await linesOf(requestId)).find((l) => l.target_id === wrenPurse)!;
    // Someone else can't undo it.
    expect(((await world.playerB.db.rpc('undo_request', { event_id: mine.id })) as Answer).error?.code).toBe('42501');
    const undo = tagged(world.playerA, 'event.undo');
    expect((await undo.db.rpc('undo_request', { event_id: mine.id })).error).toBeNull();
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 30, bit: 4 }, {}]);
    const reversing = must(await world.admin.from('events').select('reverts_event_id').in('reverts_event_id', (await linesOf(requestId)).map((l) => l.id))) as { reverts_event_id: string | null }[];
    expect(reversing).toHaveLength(2);
    // Not twice.
    expect(((await world.playerA.db.rpc('undo_request', { event_id: mine.id })) as Answer).error?.message).toMatch(/already undone/);
  });

  it('is refused once the coin has moved on since', async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.give');
    expect((await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    expect((await tagged(world.playerB, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: world.ashId, coins: { heron: 1 } })).error).toBeNull();
    const wrenPurse = await purseIdOf(world.wrenId);
    const mine = (await linesOf(requestId)).find((l) => l.target_id === wrenPurse)!;
    const { error } = (await world.playerA.db.rpc('undo_request', { event_id: mine.id })) as Answer;
    expect(error?.message).toBe("That's changed since. Undo the later change first.");
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 25, bit: 4 }, { heron: 4 }]);
  });
});

describe('5. the same request again', () => {
  it('changes nothing twice', async () => {
    const requestId = crypto.randomUUID();
    for (let i = 0; i < 2; i += 1) {
      const { db } = tagged(world.playerA, 'purse.spend', requestId);
      expect((await db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 30 } })).error).toBeNull();
    }
    expect(await coinsOf(world.wrenId)).toEqual({ bit: 4 });
    expect(await linesOf(requestId)).toHaveLength(1);
  });
});

describe('6. a dead character', () => {
  it("opens its purse to another player's take, and closes again when it's back in play", async () => {
    await setCoins({ actor: world.ashId }, { heron: 9 });
    const take = (n: number) =>
      tagged(world.playerA, 'purse.take').db.rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: n } }) as unknown as Promise<Answer>;
    expect((await take(1)).error?.code).toBe('42501');
    must(await world.admin.from('actors').update({ status: 'dead' }).eq('id', world.ashId).select('id'));
    expect((await take(4)).error).toBeNull();
    must(await world.admin.from('actors').update({ status: 'active' }).eq('id', world.ashId).select('id'));
    expect((await take(1)).error?.code).toBe('42501');
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 34, bit: 4 }, { heron: 5 }]);
  });
});

describe('8. an archived character, the stash and the cap (the lead, 2026-11-13)', () => {
  it("an archived character's purse is the GM's alone to change", async () => {
    const kept = must(
      await world.admin.from('actors').insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Old Bram', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'archived' }).select('id').single(),
    ).id as string;
    await setCoins({ actor: kept }, { heron: 6 });
    for (const ask of [
      world.playerA.db.rpc('purse_spend', { campaign: world.campaignId, actor: kept, coins: { heron: 1 } }),
      world.playerA.db.rpc('purse_give', { campaign: world.campaignId, from_actor: kept, to_actor: null, to_location: stashId, coins: { heron: 1 } }),
      world.playerA.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: kept, to_location: null, coins: { heron: 1 } }),
      world.playerA.db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: kept, coins: { heron: 1 } }),
    ]) {
      expect(((await ask) as Answer).error?.code).toBe('42501');
    }
    expect(await coinsOf(kept)).toEqual({ heron: 6 });
    expect((await tagged(world.gm, 'purse.take').db.rpc('purse_take', { campaign: world.campaignId, from_actor: kept, from_location: null, to_actor: world.wrenId, coins: { heron: 6 } })).error).toBeNull();
    expect([await coinsOf(kept), await coinsOf(world.wrenId)]).toEqual([{}, { heron: 36, bit: 4 }]);
  });

  it('the stash is named "The stash" in a refusal, and a purse holds at most 999,999,999 of a coin', async () => {
    const short = (await tagged(world.playerA, 'purse.take').db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.wrenId, coins: { bit: 1 } })) as Answer;
    expect([short.error?.code, short.error?.message]).toEqual(['GR422', 'The stash has 0 bit.']);
    await setCoins({ actor: world.ashId }, { heron: 999_999_999 });
    const full = (await tagged(world.gm, 'purse.add').db.rpc('purse_add', { campaign: world.campaignId, actor: world.ashId, location: null, coins: { heron: 1 } })) as Answer;
    expect(full.error?.code).toBe('GR423');
    expect(JSON.parse(full.error?.details ?? '{}')).toMatchObject({ coin: 'heron', most: 999_999_999 });
    expect(await coinsOf(world.ashId)).toEqual({ heron: 999_999_999 });
    const bad = (await tagged(world.playerA, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 0 } })) as Answer;
    expect(bad.error?.message).toBe('Say how many: a whole number, 1 or more.');
  });
});

describe('9. the review of 2026-11-13: no coin from nothing, the take back, the cap on a give', () => {
  it('refuses a coin change sent without its request id, and changes nothing', async () => {
    const plain = (await world.playerA.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })) as Answer;
    expect([plain.error?.code, plain.error?.message]).toEqual(['22023', 'That change needs its request id. Try again from the app.']);
    expect([await coinsOf(world.wrenId), await stashCoins()]).toEqual([{ heron: 30, bit: 4 }, {}]);
  });

  it("names each line itself: a give sent under another command's name is logged as a give", async () => {
    const { db, requestId } = tagged(world.playerA, 'purse.spend');
    expect((await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    expect((await linesOf(requestId)).map((l) => l.type)).toEqual(['purse.give', 'purse.give']);
  });

  it('refuses an Undo of an action that is not exactly one give, so Undo never makes coin', async () => {
    // One request id for a give to the stash and a take back from it: two kinds of line in one action.
    const { db, requestId } = tagged(world.playerA, 'purse.give');
    expect((await db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    expect((await db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.wrenId, coins: { heron: 5 } })).error).toBeNull();
    const lines = await linesOf(requestId);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(((await world.playerA.db.rpc('undo_request', { event_id: line.id })) as Answer).error?.code).toBe('42501');
    }
    // Two spends under one request id: a spend's action is its one line.
    const twice = tagged(world.playerA, 'purse.spend');
    for (let i = 0; i < 2; i += 1) {
      expect((await twice.db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 1 } })).error).toBeNull();
    }
    const spent = await linesOf(twice.requestId);
    expect(spent).toHaveLength(2);
    expect(((await world.playerA.db.rpc('undo_request', { event_id: spent[0]!.id })) as Answer).error?.code).toBe('42501');
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 28, bit: 4 });
  });

  it("a player's take from a dead character goes back while it is still dead, and not once it is back in play", async () => {
    await setCoins({ actor: world.ashId }, { heron: 9 });
    must(await world.admin.from('actors').update({ status: 'dead' }).eq('id', world.ashId).select('id'));
    const wrenPurse = await purseIdOf(world.wrenId);
    const take = async () => {
      const { db, requestId } = tagged(world.playerA, 'purse.take');
      expect((await db.rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: 4 } })).error).toBeNull();
      return (await linesOf(requestId)).find((l) => l.target_id === wrenPurse)!;
    };
    const first = await take();
    expect(((await world.playerA.db.rpc('undo_request', { event_id: first.id })) as Answer).error).toBeNull();
    expect([await coinsOf(world.ashId), await coinsOf(world.wrenId)]).toEqual([{ heron: 9 }, { heron: 30, bit: 4 }]);
    const second = await take();
    must(await world.admin.from('actors').update({ status: 'active' }).eq('id', world.ashId).select('id'));
    const refused = (await world.playerA.db.rpc('undo_request', { event_id: second.id })) as Answer;
    expect(refused.error?.message).toBe("That's changed since. Undo the later change first.");
    expect([await coinsOf(world.ashId), await coinsOf(world.wrenId)]).toEqual([{ heron: 5 }, { heron: 34, bit: 4 }]);
  });

  it("a give past the cap of a purse the giver can't read names no one; one they can read, pu-8's words", async () => {
    await setCoins({ actor: world.ashId }, { heron: 999_999_999 });
    const hidden = (await tagged(world.playerA, 'purse.give').db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { heron: 1 } })) as Answer;
    expect([hidden.error?.code, hidden.error?.message, hidden.error?.details ?? null]).toEqual(['GR424', "That give didn't go through. Nothing changed.", null]);
    await setCoins({ stash: true }, { heron: 999_999_999 });
    const seen = (await tagged(world.playerA, 'purse.give').db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 1 } })) as Answer;
    expect([seen.error?.code, seen.error?.message]).toEqual(['GR423', "The stash can't hold more than 999,999,999 heron."]);
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 30, bit: 4 }, { heron: 999_999_999 }]);
  });
});

describe("10. the Fable review of 2026-11-13: Undo can't make or lose coin, and goes by the purses as they are now", () => {
  const undoAs = (person: Person, eventId: string, requestId?: string) =>
    (requestId ? tagged(person, 'event.undo', requestId).db : person.db).rpc('undo_request', { event_id: eventId }) as unknown as Promise<Answer>;
  const pc = async (owner: Person, values: Record<string, unknown> = {}) =>
    must(await world.admin.from('actors').insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Reed Tam', owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', ...values }).select('id').single()).id as string;
  const lineOn = async (requestId: string, purse: string) => (await linesOf(requestId)).find((l) => l.target_id === purse)!;

  it('the four steps of the reversal-lines trick make no coin: the forged-header Undo is refused, nothing moves', async () => {
    const wrenPurse = await purseIdOf(world.wrenId);
    const spend = tagged(world.playerA, 'purse.spend');
    expect((await spend.db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 5 } })).error).toBeNull();
    const give = tagged(world.playerA, 'purse.give');
    expect((await give.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    // Undo the give with the device naming the spend's request id: the database's after-check finds Wren's side not
    // put back (the header reads as a repeat of the spend) and refuses the whole Undo.
    expect((await undoAs(world.playerA, (await lineOn(give.requestId, wrenPurse)).id, spend.requestId)).error?.message).toBe("That can't be undone.");
    expect([await coinsOf(world.wrenId), await stashCoins()]).toEqual([{ heron: 20, bit: 4 }, { heron: 5 }]);
    expect(await linesOf(spend.requestId)).toHaveLength(1);
  });

  it("an ordinary Undo files its reversal lines under the database's own id, never the device's", async () => {
    const wrenPurse = await purseIdOf(world.wrenId);
    const give = tagged(world.playerA, 'purse.give');
    expect((await give.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    const deviceId = crypto.randomUUID();
    const picked = await lineOn(give.requestId, wrenPurse);
    expect((await undoAs(world.playerA, picked.id, deviceId)).error).toBeNull();
    expect(await linesOf(deviceId)).toEqual([]);
    const reversals = must(await world.admin.from('events').select('request_id').in('reverts_event_id', (await linesOf(give.requestId)).map((l) => l.id))) as { request_id: string }[];
    expect(reversals).toHaveLength(2);
    expect(new Set(reversals.map((r) => r.request_id)).size).toBe(1);
    expect([give.requestId, deviceId]).not.toContain(reversals[0]!.request_id);
    expect([await coinsOf(world.wrenId), await stashCoins()]).toEqual([{ heron: 30, bit: 4 }, {}]);
  });

  it('two gives under one request id, with another give in between, are refused to Undo: no coin made', async () => {
    const pip = await pc(world.playerA, { kind: 'hireling', name: 'Pip the link-boy' });
    await setCoins({ actor: pip }, { heron: 6 });
    const x = tagged(world.playerA, 'purse.give');
    expect((await x.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    expect((await tagged(world.playerA, 'purse.give').db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: pip, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    expect((await x.db.rpc('purse_give', { campaign: world.campaignId, from_actor: pip, to_actor: world.wrenId, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    const before = [await coinsOf(world.wrenId), await coinsOf(pip), await stashCoins()];
    expect(before).toEqual([{ heron: 25, bit: 4 }, { heron: 6 }, { heron: 5 }]);
    for (const line of await linesOf(x.requestId)) {
      expect((await undoAs(world.playerA, line.id)).error?.code).toBe('42501');
      expect((await undoAs(world.gm, line.id)).error?.code).toBe('42501');
    }
    expect([await coinsOf(world.wrenId), await coinsOf(pip), await stashCoins()]).toEqual(before);
  });

  it("a forged action (a reversal line filed under a spend's request id) is refused to the player and to the GM, and nothing moves", async () => {
    const wrenPurse = await purseIdOf(world.wrenId);
    const spend = tagged(world.playerA, 'purse.spend');
    expect((await spend.db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 5 } })).error).toBeNull();
    const line = await lineOn(spend.requestId, wrenPurse);
    must(
      await world.admin.from('events').insert({
        campaign_id: world.campaignId, type: 'purse.spend', level: 'simple', actor_user_id: world.playerA.id, target_table: 'purses', target_id: wrenPurse,
        before: { coins: { heron: 25, bit: 4 } }, after: { coins: { heron: 30, bit: 4 } }, fiat: false, audience: 'owner', owner_user_id: world.playerA.id,
        reveal_at: 'now', request_id: spend.requestId, request_part: 1, reverts_event_id: line.id,
      }).select('id'),
    );
    expect((await undoAs(world.playerA, line.id)).error?.code).toBe('42501');
    expect((await undoAs(world.gm, line.id)).error?.code).toBe('42501');
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 25, bit: 4 });
  });

  it("a player undoes their own spend; the GM undoes a player's give and their own add", async () => {
    const wrenPurse = await purseIdOf(world.wrenId);
    const spend = tagged(world.playerA, 'purse.spend');
    expect((await spend.db.rpc('purse_spend', { campaign: world.campaignId, actor: world.wrenId, coins: { heron: 5 } })).error).toBeNull();
    expect((await undoAs(world.playerA, (await lineOn(spend.requestId, wrenPurse)).id)).error).toBeNull();
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 30, bit: 4 });
    const give = tagged(world.playerA, 'purse.give');
    expect((await give.db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: world.ashId, to_location: null, coins: { heron: 5 } })).error).toBeNull();
    expect((await undoAs(world.gm, (await lineOn(give.requestId, wrenPurse)).id)).error).toBeNull();
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 30, bit: 4 }, {}]);
    const add = tagged(world.gm, 'purse.add');
    expect((await add.db.rpc('purse_add', { campaign: world.campaignId, actor: world.ashId, location: null, coins: { heron: 7 } })).error).toBeNull();
    const added = (await linesOf(add.requestId))[0]!;
    // A player can't undo the GM's add, nor a reversal line.
    expect((await undoAs(world.playerB, added.id)).error?.code).toBe('42501');
    expect((await undoAs(world.gm, added.id)).error).toBeNull();
    expect(await coinsOf(world.ashId)).toEqual({});
    const reversal = must(await world.admin.from('events').select('id').eq('reverts_event_id', added.id).single()).id as string;
    expect((await undoAs(world.playerB, reversal)).error?.code).toBe('42501');
    // Nor can the GM undo an Undo of coin (the lead, 2026-11-13): an ordinary refusal in these words, nothing changes.
    expect((await undoAs(world.gm, reversal)).error?.message).toBe("An Undo of coin can't be undone. Move the coin again instead.");
    expect(await coinsOf(world.ashId)).toEqual({});
  });

  it("the GM's moves: both lines read by the right people, each naming the other side", async () => {
    await setCoins({ actor: world.ashId }, { heron: 9 });
    await setCoins({ stash: true }, { heron: 4 });
    const move = tagged(world.gm, 'purse.take');
    expect((await move.db.rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: 9 } })).error).toBeNull();
    const moved = new Map((await linesOf(move.requestId)).map((l) => [l.target_id, l]));
    expect(moved.get(await purseIdOf(world.ashId))).toMatchObject({ type: 'purse.take', audience: 'owner', owner_user_id: world.playerB.id, reason: `with:${world.wrenId}` });
    expect(moved.get(await purseIdOf(world.wrenId))).toMatchObject({ type: 'purse.take', audience: 'owner', owner_user_id: world.playerA.id, reason: `with:${world.ashId}` });
    const fromStash = tagged(world.gm, 'purse.take');
    expect((await fromStash.db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.ashId, coins: { heron: 4 } })).error).toBeNull();
    const stashPurse = must(await world.admin.from('purses').select('id').eq('location_id', stashId).single()).id as string;
    const given = new Map((await linesOf(fromStash.requestId)).map((l) => [l.target_id, l]));
    expect(given.get(stashPurse)).toMatchObject({ audience: 'all', reason: `with:${world.ashId}` });
    expect(given.get(await purseIdOf(world.ashId))).toMatchObject({ audience: 'owner', owner_user_id: world.playerB.id, reason: 'with:stash' });
  });

  it('a give or a take sent again changes nothing twice, on either purse', async () => {
    const requestId = crypto.randomUUID();
    for (let i = 0; i < 2; i += 1) {
      expect((await tagged(world.playerA, 'purse.give', requestId).db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: null, to_location: stashId, coins: { heron: 5 } })).error).toBeNull();
    }
    expect([await coinsOf(world.wrenId), await stashCoins()]).toEqual([{ heron: 25, bit: 4 }, { heron: 5 }]);
    const again = crypto.randomUUID();
    for (let i = 0; i < 2; i += 1) {
      expect((await tagged(world.playerB, 'purse.take', again).db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: world.ashId, coins: { heron: 5 } })).error).toBeNull();
    }
    expect([await stashCoins(), await coinsOf(world.ashId)]).toEqual([{}, { heron: 5 }]);
    expect(await linesOf(again)).toHaveLength(2);
  });

  it("a GM ruling's reason never overwrites the other side a move's lines name", async () => {
    await setCoins({ actor: world.ashId }, { heron: 3 });
    const requestId = crypto.randomUUID();
    const ruled = taggedDb(world.gm.db as unknown as Db, { type: 'purse.take', level: 'simple', requestId, fiat: true, reason: 'The bargain stands' }) as unknown as Person['db'];
    expect((await ruled.rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: 3 } })).error).toBeNull();
    const reasons = new Map((await linesOf(requestId)).map((l) => [l.target_id, l.reason]));
    expect(reasons.get(await purseIdOf(world.ashId))).toBe(`with:${world.wrenId}`);
    expect(reasons.get(await purseIdOf(world.wrenId))).toBe(`with:${world.ashId}`);
  });

  it("a player's Undo of a take is refused once the taker's own character is archived or passed to another player", async () => {
    const reed = await pc(world.playerA, { name: 'Reed Sallow' });
    const reedPurse = await purseIdOf(reed);
    await setCoins({ stash: true }, { heron: 8 });
    const takeFromStash = async () => {
      const { db, requestId } = tagged(world.playerA, 'purse.take');
      expect((await db.rpc('purse_take', { campaign: world.campaignId, from_actor: null, from_location: stashId, to_actor: reed, coins: { heron: 4 } })).error).toBeNull();
      return lineOn(requestId, reedPurse);
    };
    const first = await takeFromStash();
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', reed).select('id'));
    expect((await undoAs(world.playerA, first.id)).error?.message).toBe("That's changed since. Undo the later change first.");
    must(await world.admin.from('actors').update({ status: 'active' }).eq('id', reed).select('id'));
    const second = await takeFromStash();
    must(await world.admin.from('actors').update({ owner_user_id: world.playerB.id }).eq('id', reed).select('id'));
    expect((await undoAs(world.playerA, second.id)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect([await coinsOf(reed), await stashCoins()]).toEqual([{ heron: 8 }, {}]);
  });

  it("a take from the player's own dead hireling can't be undone into it once the GM has archived it", async () => {
    const pip = await pc(world.playerA, { kind: 'hireling', name: 'Pip the link-boy', status: 'dead' });
    const pipPurse = await purseIdOf(pip);
    await setCoins({ actor: pip }, { heron: 6 });
    const { db, requestId } = tagged(world.playerA, 'purse.take');
    expect((await db.rpc('purse_take', { campaign: world.campaignId, from_actor: pip, from_location: null, to_actor: world.wrenId, coins: { heron: 6 } })).error).toBeNull();
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', pip).select('id'));
    expect((await undoAs(world.playerA, (await lineOn(requestId, pipPurse)).id)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect([await coinsOf(pip), await coinsOf(world.wrenId)]).toEqual([{}, { heron: 36, bit: 4 }]);
  });

  it("a player can't spend or give from their own character's purse while it is a draft or waiting", async () => {
    for (const approval of ['draft', 'pending']) {
      const fern = await pc(world.playerA, { name: 'Fern', approval });
      await setCoins({ actor: fern }, { heron: 4 });
      expect(((await tagged(world.playerA, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: fern, coins: { heron: 1 } })) as Answer).error?.code).toBe('42501');
      expect(((await tagged(world.playerA, 'purse.give').db.rpc('purse_give', { campaign: world.campaignId, from_actor: fern, to_actor: null, to_location: stashId, coins: { heron: 1 } })) as Answer).error?.code).toBe('42501');
      expect(await coinsOf(fern)).toEqual({ heron: 4 });
    }
  });

  it('a player calling the GM\'s add is refused', async () => {
    const { error } = (await tagged(world.playerA, 'purse.add').db.rpc('purse_add', { campaign: world.campaignId, actor: world.wrenId, location: null, coins: { heron: 99 } })) as Answer;
    expect(error?.code).toBe('42501');
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 30, bit: 4 });
  });

  it("a hireling's purse is its employer's to spend and give to, not another player's", async () => {
    const pip = await pc(world.playerA, { kind: 'hireling', name: 'Pip the link-boy' });
    await setCoins({ actor: pip }, { heron: 6 });
    expect((await tagged(world.playerA, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: pip, coins: { heron: 1 } })).error).toBeNull();
    expect(((await tagged(world.playerB, 'purse.spend').db.rpc('purse_spend', { campaign: world.campaignId, actor: pip, coins: { heron: 1 } })) as Answer).error?.code).toBe('42501');
    expect((await tagged(world.playerA, 'purse.give').db.rpc('purse_give', { campaign: world.campaignId, from_actor: world.wrenId, to_actor: pip, to_location: null, coins: { heron: 2 } })).error).toBeNull();
    expect(await coinsOf(pip)).toEqual({ heron: 7 });
  });

  it('Undo goes by the purses as they are now: archived, a receiver archived since, or no longer the player\'s', async () => {
    const tam = await pc(world.playerA);
    const tamPurse = await purseIdOf(tam);
    await setCoins({ actor: tam }, { heron: 10 });
    // A spend, then the GM archives the character: its Undo is refused, the archived purse left alone.
    const spend = tagged(world.playerA, 'purse.spend');
    expect((await spend.db.rpc('purse_spend', { campaign: world.campaignId, actor: tam, coins: { heron: 3 } })).error).toBeNull();
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', tam).select('id'));
    expect((await undoAs(world.playerA, (await lineOn(spend.requestId, tamPurse)).id)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect(await coinsOf(tam)).toEqual({ heron: 7 });
    must(await world.admin.from('actors').update({ status: 'active' }).eq('id', tam).select('id'));
    // A give to a character archived since: refused.
    const reed = await pc(world.playerB);
    const give = tagged(world.playerA, 'purse.give');
    expect((await give.db.rpc('purse_give', { campaign: world.campaignId, from_actor: tam, to_actor: reed, to_location: null, coins: { heron: 2 } })).error).toBeNull();
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', reed).select('id'));
    expect((await undoAs(world.playerA, (await lineOn(give.requestId, tamPurse)).id)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect([await coinsOf(tam), await coinsOf(reed)]).toEqual([{ heron: 5 }, { heron: 2 }]);
    // A spend, then the character passes to another player: its old player's Undo is refused.
    const later = tagged(world.playerA, 'purse.spend');
    expect((await later.db.rpc('purse_spend', { campaign: world.campaignId, actor: tam, coins: { heron: 1 } })).error).toBeNull();
    must(await world.admin.from('actors').update({ owner_user_id: world.playerB.id }).eq('id', tam).select('id'));
    expect((await undoAs(world.playerA, (await lineOn(later.requestId, tamPurse)).id)).error?.message).toBe("That's changed since. Undo the later change first.");
    expect(await coinsOf(tam)).toEqual({ heron: 4 });
  });
});

describe('7. no writes from a device', () => {
  it('the owner and the GM still cannot write the table directly', async () => {
    for (const person of [world.playerA, world.gm]) {
      await person.db.from('purses').update({ coins: { heron: 999 } }).eq('actor_id', world.wrenId);
    }
    expect(await coinsOf(world.wrenId)).toEqual({ heron: 30, bit: 4 });
  });
});
