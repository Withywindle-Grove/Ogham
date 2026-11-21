// December step 6, piece (a): the purse's data and its read rule
// (supabase/migrations/20261111160000_dec_6a_purse_data.sql; docs/plans/dec-6-purse.md). TEST project only;
// invented names and coins.
//   Purpose:
//   1. Every character, hireling and Party stash has a purse row, made by the database with it; an animal has none.
//   2. Hidden means hidden: a character's purse is read by its owner and the GM; another player and someone outside
//      the campaign read nothing of it. The Party stash's coin is read by every member and by nobody outside.
//   3. The named exception (ruled 2026-10-29): while a character is Down (HP at or under the setting's `death.at`) or
//      dead, the other players read its purse; it closes again when the character recovers. With no `death.at` in
//      the setting, 0 HP opens nothing. Someone outside the campaign never reads it.
//   4. A hireling's purse follows its pack: its employer (its owner) reads it, another player doesn't. A party's
//      hireling's purse is the GM's alone. The GM doesn't read the purse of another person's draft.
//   5. Nobody writes a purse from a device (the commands' functions come with piece b): not the owner, not the GM.
//   6. Coin is whole numbers, never below zero; whose purse it is never changes.
//   7. A purse's log lines are its owner's and the GM's; the stash's coin lines are everyone's in the campaign.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

type Coins = Record<string, number>;

let world: World;
let wrenPurse: string;
let ashPurse: string;
let stashPurse: string;
let stashId: string;

/** The coins this person reads in a character's purse; null when they can't read it at all. */
async function coinsOf(person: Person, actorId: string): Promise<Coins | null> {
  const rows = must(await person.db.from('purses').select('coins').eq('actor_id', actorId));
  return rows.length === 0 ? null : (rows[0]!.coins as Coins);
}
/** The coins this person reads in the Party stash; null when they can't read it. */
async function stashCoins(person: Person): Promise<Coins | null> {
  const rows = must(await person.db.from('purses').select('coins').eq('location_id', stashId));
  return rows.length === 0 ? null : (rows[0]!.coins as Coins);
}
const purseId = async (actorId: string) => must(await world.admin.from('purses').select('id').eq('actor_id', actorId).single()).id as string;
const setCoins = async (id: string, coins: Coins) => must(await world.admin.from('purses').update({ coins }).eq('id', id).select('id'));
const setActor = async (actorId: string, values: Record<string, unknown>) => must(await world.admin.from('actors').update(values).eq('id', actorId).select('id'));
const actor = async (values: Record<string, unknown>) =>
  must(await world.admin.from('actors').insert({ campaign_id: world.campaignId, kind: 'pc', approval: 'approved', ...values }).select('id').single()).id as string;

/** An invented rules set attached to the campaign (what it says about death), with its optional-rule choices; null detaches it. */
let packId: string | null = null;
async function setRules(data: Record<string, unknown> | null, choices: Record<string, string> = {}) {
  if (packId) {
    await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', packId);
    await world.admin.from('packs').delete().eq('id', packId);
    packId = null;
  }
  if (data === null) return;
  const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen sample', version: '0.1', kind: 'setting' }).select('id').single());
  packId = pack.id as string;
  must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data }).select('id'));
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, created_by: world.gm.id, option_choices: choices }).select('id'));
}

beforeAll(async () => {
  world = await buildWorld();
  wrenPurse = await purseId(world.wrenId);
  ashPurse = await purseId(world.ashId);
  stashId = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash').single()).id as string;
  stashPurse = must(await world.admin.from('purses').select('id').eq('location_id', stashId).single()).id as string;
  await setCoins(wrenPurse, { gp: 12, sp: 4 });
  await setCoins(ashPurse, { gp: 3 });
  await setCoins(stashPurse, { cp: 40 });
}, 300_000);
afterAll(async () => {
  await setRules(null);
  await tearDownWorld(world);
}, 60_000);

describe('1. a purse with every character, hireling and Party stash', () => {
  it('each starts empty, at version 1; an animal has none; every campaign has its stash purse', async () => {
    const pip = await actor({ kind: 'hireling', name: 'Pip the link-boy', owner_type: 'user', owner_user_id: world.playerA.id });
    const mule = await actor({ kind: 'animal', name: 'Thistledown the mule', owner_type: 'user', owner_user_id: world.playerA.id });
    expect(must(await world.admin.from('purses').select('coins, version, location_id').eq('actor_id', pip))).toEqual([{ coins: {}, version: 1, location_id: null }]);
    expect(must(await world.admin.from('purses').select('id').eq('actor_id', mule))).toEqual([]);
    const otherStash = must(await world.admin.from('purses').select('actor_id, coins').eq('campaign_id', world.otherCampaignId));
    expect(otherStash).toEqual([{ actor_id: null, coins: {} }]);
    // A purse goes with its character (one never approved, which its owner or the GM may delete).
    const fern = await actor({ name: 'Fern', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' });
    expect(must(await world.admin.from('purses').select('id').eq('actor_id', fern))).toHaveLength(1);
    must(await world.admin.from('actors').delete().eq('id', fern).select('id'));
    expect(must(await world.admin.from('purses').select('id').eq('actor_id', fern))).toEqual([]);
  });
});

describe('2. who reads a purse', () => {
  it('its owner and the GM read it', async () => {
    expect(await coinsOf(world.playerA, world.wrenId)).toEqual({ gp: 12, sp: 4 });
    expect(await coinsOf(world.gm, world.wrenId)).toEqual({ gp: 12, sp: 4 });
    expect(await coinsOf(world.playerB, world.ashId)).toEqual({ gp: 3 });
  });

  it('another player reads nothing of it, by any way of asking', async () => {
    expect(await coinsOf(world.playerB, world.wrenId)).toBeNull();
    expect(await coinsOf(world.playerA, world.ashId)).toBeNull();
    expect(must(await world.playerB.db.from('purses').select('id').eq('id', wrenPurse))).toEqual([]);
    // Everything Player B can read in the campaign: their own purse and the stash's, nothing else.
    const all = must(await world.playerB.db.from('purses').select('actor_id, location_id').eq('campaign_id', world.campaignId));
    expect(all.map((p) => p.actor_id ?? p.location_id).sort()).toEqual([world.ashId, stashId].sort());
  });

  it('someone outside the campaign reads no purse, not even the stash', async () => {
    expect(must(await world.outsider.db.from('purses').select('id'))).toEqual([]);
    expect(await coinsOf(world.outsider, world.wrenId)).toBeNull();
    expect(await stashCoins(world.outsider)).toBeNull();
  });

  it("the Party stash's coin is every member's to read", async () => {
    expect(await stashCoins(world.playerA)).toEqual({ cp: 40 });
    expect(await stashCoins(world.playerB)).toEqual({ cp: 40 });
    expect(await stashCoins(world.gm)).toEqual({ cp: 40 });
  });
});

describe('3. a Down or dead character', () => {
  afterAll(async () => {
    await setRules(null);
    await setActor(world.ashId, { hp_current: 5 });
  });

  it("with no Down mark in the setting, 0 HP doesn't open the purse", async () => {
    await setActor(world.ashId, { hp_current: 0 });
    expect(await coinsOf(world.playerA, world.ashId)).toBeNull();
    await setRules({ name: 'No death rule' });
    expect(await coinsOf(world.playerA, world.ashId)).toBeNull();
  });

  it('at the Down mark it opens to the other players, and closes again on recovery', async () => {
    await setRules({ death: { at: 0 } });
    await setActor(world.ashId, { hp_current: 0 });
    expect(await coinsOf(world.playerA, world.ashId)).toEqual({ gp: 3 });
    // Still nothing for someone outside the campaign, and its owner and the GM read it as before.
    expect(await coinsOf(world.outsider, world.ashId)).toBeNull();
    expect(await coinsOf(world.playerB, world.ashId)).toEqual({ gp: 3 });
    expect(await coinsOf(world.gm, world.ashId)).toEqual({ gp: 3 });
    await setActor(world.ashId, { hp_current: 1 });
    expect(await coinsOf(world.playerA, world.ashId)).toBeNull();
  });

  it('reads the Down mark with the chosen optional rule applied', async () => {
    await setRules({ death: { at: 0 }, byOption: { 'grim=on': { death: { at: -3 } } } }, { grim: 'on' });
    await setActor(world.ashId, { hp_current: 0 });
    expect(await coinsOf(world.playerA, world.ashId)).toBeNull();
    await setActor(world.ashId, { hp_current: -3 });
    expect(await coinsOf(world.playerA, world.ashId)).toEqual({ gp: 3 });
    await setActor(world.ashId, { hp_current: 5 });
  });

  it('a dead character is open to the others; an archived one is closed to them', async () => {
    await setRules(null);
    const sedge = await actor({ name: 'Sedge the Eel Catcher', owner_type: 'user', owner_user_id: world.playerB.id, hp_current: 4, hp_max: 4 });
    await setCoins(await purseId(sedge), { sp: 8 });
    expect(await coinsOf(world.playerA, sedge)).toBeNull();
    await setActor(sedge, { status: 'dead' });
    expect(await coinsOf(world.playerA, sedge)).toEqual({ sp: 8 });
    expect(await coinsOf(world.outsider, sedge)).toBeNull();
    await setActor(sedge, { status: 'archived' });
    expect(await coinsOf(world.playerA, sedge)).toBeNull();
    expect(await coinsOf(world.playerB, sedge)).toEqual({ sp: 8 });
  });

  it("a Down character that isn't approved stays closed", async () => {
    await setRules({ death: { at: 0 } });
    const reed = await actor({ name: 'Reed', owner_type: 'user', owner_user_id: world.playerB.id, approval: 'pending', hp_current: 0, hp_max: 4 });
    expect(await coinsOf(world.playerA, reed)).toBeNull();
    expect(await coinsOf(world.playerB, reed)).toEqual({});
  });
});

describe('4. hirelings and drafts', () => {
  it("a hireling's purse is read by its employer and the GM, not by another player", async () => {
    const pip = await actor({ kind: 'hireling', name: 'Pip the link-boy', owner_type: 'user', owner_user_id: world.playerA.id });
    await setCoins(await purseId(pip), { sp: 6 });
    expect(await coinsOf(world.playerA, pip)).toEqual({ sp: 6 });
    expect(await coinsOf(world.gm, pip)).toEqual({ sp: 6 });
    expect(await coinsOf(world.playerB, pip)).toBeNull();
  });

  it("a party's hireling's purse is the GM's alone", async () => {
    const dob = await actor({ kind: 'hireling', name: 'Dob the porter', owner_type: 'party' });
    await setCoins(await purseId(dob), { cp: 9 });
    expect(await coinsOf(world.gm, dob)).toEqual({ cp: 9 });
    expect(await coinsOf(world.playerA, dob)).toBeNull();
    expect(await coinsOf(world.playerB, dob)).toBeNull();
  });

  it("the GM doesn't read the purse of another person's draft; its owner does", async () => {
    const moss = await actor({ name: 'Moss', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'draft' });
    expect(await coinsOf(world.playerA, moss)).toEqual({});
    expect(await coinsOf(world.gm, moss)).toBeNull();
    expect(await coinsOf(world.playerB, moss)).toBeNull();
  });
});

describe('5. nobody writes a purse from a device', () => {
  it('a change, a new row and a removal do nothing, for the owner, another player and the GM alike', async () => {
    for (const person of [world.playerA, world.playerB, world.gm]) {
      await person.db.from('purses').update({ coins: { gp: 999 } }).eq('id', wrenPurse);
      await person.db.from('purses').delete().eq('id', wrenPurse);
      const made = await person.db.from('purses').insert({ campaign_id: world.campaignId, actor_id: world.wrenId, coins: { gp: 5 } }).select('id');
      expect(made.error).not.toBeNull();
    }
    expect(must(await world.admin.from('purses').select('coins').eq('actor_id', world.wrenId))).toEqual([{ coins: { gp: 12, sp: 4 } }]);
  });
});

describe('6. what the database decides', () => {
  it('coin is whole numbers, never below zero, under short names', async () => {
    for (const coins of [{ gp: -1 }, { gp: 1.5 }, { gp: '3' }, { gp: null }, { gp: 1_000_000_000 }, { '': 1 }, { ' gp': 1 }, ['gp', 1], 'gp', 7]) {
      const refused = await world.admin.from('purses').update({ coins }).eq('id', wrenPurse).select('id');
      expect([JSON.stringify(coins), refused.error?.message]).toEqual([JSON.stringify(coins), 'Coin is counted in whole numbers, never below zero.']);
    }
    must(await world.admin.from('purses').update({ coins: { gp: 0, sp: 999_999_999 } }).eq('id', wrenPurse).select('id'));
    await setCoins(wrenPurse, { gp: 12, sp: 4 });
  });

  it('whose purse it is never changes, and only a character, a hireling or the stash has one', async () => {
    const moved = await world.admin.from('purses').update({ actor_id: world.ashId }).eq('id', wrenPurse).select('id');
    expect(moved.error).not.toBeNull();
    const toStash = await world.admin.from('purses').update({ actor_id: null, location_id: stashId }).eq('id', wrenPurse).select('id');
    expect(toStash.error).not.toBeNull();
    const second = await world.admin.from('purses').insert({ campaign_id: world.campaignId, actor_id: world.wrenId }).select('id');
    expect(second.error).not.toBeNull();
    const neither = await world.admin.from('purses').insert({ campaign_id: world.campaignId }).select('id');
    expect(neither.error).not.toBeNull();
    const elsewhere = await world.admin.from('purses').insert({ campaign_id: world.otherCampaignId, actor_id: world.wrenId }).select('id');
    expect(elsewhere.error).not.toBeNull();
    expect(must(await world.admin.from('purses').select('id').eq('actor_id', world.wrenId))).toEqual([{ id: wrenPurse }]);
  });
});

describe("7. who sees a purse's log lines", () => {
  const lines = async (person: Person, id: string) =>
    must(await person.db.from('events').select('audience, owner_user_id, before, after').eq('target_table', 'purses').eq('target_id', id).order('seq'));

  it("a character's purse: its owner and the GM, never another player; only the coins that changed", async () => {
    const owners = await lines(world.playerA, wrenPurse);
    expect(owners.length).toBeGreaterThan(0);
    expect(owners[0]).toEqual({ audience: 'owner', owner_user_id: world.playerA.id, before: { coins: {} }, after: { coins: { gp: 12, sp: 4 } } });
    expect((await lines(world.gm, wrenPurse)).length).toBe(owners.length);
    expect(await lines(world.playerB, wrenPurse)).toEqual([]);
    expect(await lines(world.outsider, wrenPurse)).toEqual([]);
  });

  it("the stash's coin: everyone in the campaign, nobody outside it", async () => {
    const seen = await lines(world.playerB, stashPurse);
    expect(seen).toEqual([{ audience: 'all', owner_user_id: null, before: { coins: {} }, after: { coins: { cp: 40 } } }]);
    expect(await lines(world.playerA, stashPurse)).toEqual(seen);
    expect(await lines(world.outsider, stashPurse)).toEqual([]);
  });

  it("a party's hireling's purse: the GM alone", async () => {
    const dob = await actor({ kind: 'hireling', name: 'Dob the porter', owner_type: 'party' });
    const id = await purseId(dob);
    await setCoins(id, { cp: 9 });
    expect((await lines(world.gm, id)).map((line) => line.audience)).toEqual(['gm']);
    expect(await lines(world.playerA, id)).toEqual([]);
  });
});
