// The stand-in database's purses (December step 6, piece a). It must read a purse the way
// supabase/migrations/20261111160000_dec_6a_purse_data.sql does (supabase/tests/dec-6a-purse-data.test.ts proves the
// real rule), so the screens' tests stand on the same ground. Invented names and coins only.
//   Purpose:
//   1. A purse is read by its owner and the GM; another player and an outsider read nothing of it.
//   2. The Party stash's coin is read by every member, and by nobody outside the campaign.
//   3. A Down or dead character's purse opens to the other players and closes again when the character recovers.
//   4. A hireling's purse is read by its employer; the GM doesn't read the purse of another person's draft.
//   5. Nobody writes a purse from a device.
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeDb, type FakeWorld } from './fakeDb.ts';

type Row = Record<string, unknown>;
type Answer = { data: Row[] | null; error: { message: string; code?: string } | null };

let world: FakeWorld;
let gm: string;
let sam: string;
let tess: string;
let odo: string;
let campaign: string;
let wren: string;
let moss: string;

const purses = async (as: string) => {
  world.signInAs(as);
  return ((await world.db.from('purses' as never).select('*')) as unknown as Answer).data ?? [];
};
const coinsOf = async (as: string, actorId: string) => (await purses(as)).find((p) => p.actor_id === actorId)?.coins ?? null;
const stashCoins = async (as: string) => (await purses(as)).find((p) => p.location_id !== null)?.coins ?? null;
const actor = (id: string) => world.tables.actors.find((a) => a.id === id)!;
/** An invented rules set attached to the campaign, saying the HP at which a character is Down. */
const attachRules = (data: Row, optionChoices: Row = {}) => {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, name: 'Fen sample', kind: 'setting', campaign_id: null });
  world.tables.library_entries.push({ id: 'entry-fen-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', priority: 0, option_choices: optionChoices });
};

beforeEach(async () => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  tess = world.addPerson('tess@lantern.example', 'Tess');
  odo = world.addPerson('odo@lantern.example', 'Odo');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  moss = world.addCharacter(campaign, 'Moss', { ownerId: tess });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tess, 'player', moss);
  Object.assign(actor(wren), { hp_current: 7, hp_max: 9 });
  Object.assign(actor(moss), { hp_current: 5, hp_max: 5 });
  // The rows are made on the first read; then each holds some coin.
  await purses(gm);
  world.tables.purses.find((p) => p.actor_id === wren)!.coins = { gp: 12, sp: 4 };
  world.tables.purses.find((p) => p.actor_id === moss)!.coins = { gp: 3 };
  world.tables.purses.find((p) => p.location_id !== null)!.coins = { cp: 40 };
});

describe('who reads a purse', () => {
  it('every character and the Party stash has one, made with it', async () => {
    const rows = await purses(gm);
    expect(rows.filter((p) => p.actor_id !== null).map((p) => p.actor_id).sort()).toEqual([wren, moss].sort());
    expect(rows.filter((p) => p.location_id !== null)).toHaveLength(1);
  });

  it('its owner and the GM read it; another player and an outsider read nothing of it', async () => {
    expect(await coinsOf(sam, wren)).toEqual({ gp: 12, sp: 4 });
    expect(await coinsOf(gm, wren)).toEqual({ gp: 12, sp: 4 });
    expect(await coinsOf(tess, wren)).toBeNull();
    expect(await coinsOf(odo, wren)).toBeNull();
    expect(await purses(odo)).toEqual([]);
  });

  it("the stash's coin is every member's to read, and nobody's outside the campaign", async () => {
    expect(await stashCoins(sam)).toEqual({ cp: 40 });
    expect(await stashCoins(tess)).toEqual({ cp: 40 });
    expect(await stashCoins(gm)).toEqual({ cp: 40 });
    expect(await stashCoins(odo)).toBeNull();
  });
});

describe('a Down or dead character', () => {
  it('at the Down mark its purse opens to the other players, and closes again when it recovers', async () => {
    attachRules({ death: { at: 0 } });
    expect(await coinsOf(sam, moss)).toBeNull();
    actor(moss).hp_current = 0;
    expect(await coinsOf(sam, moss)).toEqual({ gp: 3 });
    expect(await coinsOf(odo, moss)).toBeNull();
    actor(moss).hp_current = 1;
    expect(await coinsOf(sam, moss)).toBeNull();
  });

  it("with no Down mark in the setting, 0 HP doesn't open it", async () => {
    actor(moss).hp_current = 0;
    expect(await coinsOf(sam, moss)).toBeNull();
    attachRules({ name: 'No death rule' });
    expect(await coinsOf(sam, moss)).toBeNull();
  });

  it('reads the Down mark with the chosen optional rule applied', async () => {
    attachRules({ death: { at: 0 }, byOption: { 'grim=on': { death: { at: -3 } } } }, { grim: 'on' });
    actor(moss).hp_current = 0;
    expect(await coinsOf(sam, moss)).toBeNull();
    actor(moss).hp_current = -3;
    expect(await coinsOf(sam, moss)).toEqual({ gp: 3 });
  });

  it('a dead character is open to the others; an archived one is not', async () => {
    actor(moss).status = 'dead';
    expect(await coinsOf(sam, moss)).toEqual({ gp: 3 });
    actor(moss).status = 'archived';
    expect(await coinsOf(sam, moss)).toBeNull();
    expect(await coinsOf(tess, moss)).toEqual({ gp: 3 });
  });
});

describe('hirelings and drafts', () => {
  it("a hireling's purse is read by its employer and the GM, not by another player", async () => {
    const pip = world.addCharacter(campaign, 'Pip the link-boy', { ownerId: sam });
    actor(pip).kind = 'hireling';
    await purses(gm);
    world.tables.purses.find((p) => p.actor_id === pip)!.coins = { sp: 6 };
    expect(await coinsOf(sam, pip)).toEqual({ sp: 6 });
    expect(await coinsOf(gm, pip)).toEqual({ sp: 6 });
    expect(await coinsOf(tess, pip)).toBeNull();
  });

  it("the GM doesn't read the purse of another person's draft; its owner does", async () => {
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: tess, approval: 'draft' });
    expect(await coinsOf(tess, reed)).toEqual({});
    expect(await coinsOf(gm, reed)).toBeNull();
    expect(await coinsOf(sam, reed)).toBeNull();
  });

  it('an animal has no purse', async () => {
    const mule = world.addCharacter(campaign, 'Thistledown the mule', { ownerId: sam });
    actor(mule).kind = 'animal';
    expect((await purses(gm)).some((p) => p.actor_id === mule)).toBe(false);
  });
});

describe('nobody writes a purse from a device', () => {
  it('a change, a new row and a removal are all refused, for the owner and the GM alike', async () => {
    const id = world.tables.purses.find((p) => p.actor_id === wren)!.id;
    for (const person of [sam, gm]) {
      world.signInAs(person);
      const changed = (await world.db.from('purses' as never).update({ coins: { gp: 999 } } as never).eq('id', id as never)) as unknown as Answer;
      const made = (await world.db.from('purses' as never).insert({ campaign_id: campaign, actor_id: moss, coins: { gp: 5 } } as never)) as unknown as Answer;
      const gone = (await world.db.from('purses' as never).delete().eq('id', id as never)) as unknown as Answer;
      expect([changed.error?.code, made.error?.code, gone.error?.code]).toEqual(['42501', '42501', '42501']);
    }
    expect(world.tables.purses.find((p) => p.id === id)?.coins).toEqual({ gp: 12, sp: 4 });
    expect(world.tables.purses.filter((p) => p.actor_id === moss)).toHaveLength(1);
  });
});
