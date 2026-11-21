// M5 step 4: shared-state foundations (supabase/migrations/20261029160000_m5_intents.sql). TEST project only;
// invented content.
//   Copy versions: a save made from an old copy of an item is refused, and nothing changes.
//   Request ids: the same command sent again with the same request id changes nothing twice and logs once.
//   The tier line: worked out and written once by the database, the same as the app's load bar works it out.
//   Who sees each log line: one function per table, the same as the one block it replaced.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { forgetCampaignSetting, loadCampaignSetting } from '../../src/app/campaignSetting.ts';
import { tierWords } from '../../src/app/packHelpers.ts';
import { runCommand, STALE, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { carriedLoad, toLoadLine } from '../../src/modules/inventory/encumbrance.ts';
import {
  addItem,
  equipItem,
  giveAway,
  loadInventory,
  loadInventorySettings,
  moveItem,
  removeItem,
  setItemQty,
  type CarrierRef,
  type InventoryLine,
  type ItemCopy,
} from '../../src/modules/inventory/inventory.ts';
import { isSeparate } from '../../src/modules/inventory/packView.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { undoChange } from '../../src/core/undo.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, { requestId });
}
const carrierOf = (actorId: string, owner: Person): CarrierRef => ({
  campaignId: world.campaignId,
  actorId,
  locationId: null,
  ownerUserId: owner.id,
  archived: false,
});
const wren = () => carrierOf(world.wrenId, world.playerA);
const oneOff = (name: string, weightCoin: number | null, extra: Partial<ItemCopy> = {}): ItemCopy => ({
  libraryEntryId: null,
  name,
  category: 'gear',
  weightCoin,
  slots: null,
  stack: 1,
  ...extra,
});
async function give(carrier: CarrierRef, item: ItemCopy, qty = 1, equipped = false): Promise<InventoryLine> {
  const added = await as(world.gm, addItem, { carrier, item, qty, howGot: 'given', equipped });
  if (!added.ok) throw new Error(added.message);
  return added.value;
}
const lineRow = async (id: string) => (await world.admin.from('inventory_lines').select('*').eq('id', id)).data?.[0] as Record<string, unknown> | undefined;
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('type, target_id, before, after').eq('request_id', requestId));
const tierLines = async (actorId: string) =>
  must(await world.admin.from('events').select('after, audience, request_id').eq('type', 'load.tier').eq('target_id', actorId).order('seq'));
const storedTier = async (actorId: string) => (must(await world.admin.from('carrier_loads').select('tier').eq('actor_id', actorId))[0] as { tier: string } | undefined)?.tier;

/** A new approved character for player A, so each test starts with an empty pack. */
async function newCharacter(name: string): Promise<string> {
  const [row] = must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved' })
      .select('id'),
  );
  return row!.id as string;
}
async function setMode(mode: 'none' | 'coin' | 'slot' | 'armour') {
  must(await world.admin.from('campaigns').update({ settings: { encumbrance: { mode } } }).eq('id', world.campaignId).select('id'));
}

/** The tier the app's load bar shows for a character, worked out as the Pack screen does (PackScreen.tsx). */
async function appTier(actorId: string): Promise<string> {
  forgetCampaignSetting(world.campaignId);
  const db = asDb(world.gm);
  const [setting, settings, inventory] = await Promise.all([
    loadCampaignSetting(db, world.gm.id, world.campaignId),
    loadInventorySettings(db, world.campaignId),
    loadInventory(db, world.campaignId),
  ]);
  const rules = setting!.encumbrance;
  const counting = inventory!.lines.filter((l) => l.actorId === actorId && l.approval === 'approved' && !isSeparate(l, rules));
  return tierWords(carriedLoad(counting.map(toLoadLine), rules, settings!.mode));
}

let packLinkId = '';
let packId = '';

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen load rules' },
      rulesSets: [
        {
          id: 'fen-load',
          name: 'Fen load',
          encumbrance: {
            containers: { default: 'hold-only', byOption: { 'sacks=add': 'add' } },
            coin: {
              maxLoadCoin: 400,
              miscGearCoin: 20,
              miscGearCategories: ['sundries'],
              tiers: [
                { label: 'Bowed', max: 400 },
                { label: 'Unhindered', max: 100 },
                { label: 'Laden', max: 250 },
              ],
              overMax: 'Can’t budge',
            },
            slot: { tiers: [{ label: 'Nimble', maxSlots: 5 }, { label: 'Slow', maxSlots: 10 }], overMax: 'Stuck fast' },
            armour: {
              maxLoadCoin: 800,
              movement: [
                { armour: 'none', withoutTreasure: '120 ft', withTreasure: '90 ft' },
                { armour: 'heavy', withoutTreasure: '60 ft', withTreasure: '30 ft' },
              ],
              armourTypes: { plate: 'heavy', hide: 'light' },
            },
            treasureWeights: { gem: 1 },
          },
        },
      ],
      options: [{ id: 'sacks', name: 'Sacks', default: 'hold', choices: [{ id: 'hold', name: 'Only hold' }, { id: 'add', name: 'Add room' }] }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  if (!attached.ok) throw new Error(attached.message);
  packLinkId = attached.value.id;
  await setMode('coin');
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('a save made from an old copy is refused (copy versions)', () => {
  it('a change from an old copy of a line is refused in plain words, and the line stays as the newer change left it', async () => {
    const line = await give(wren(), oneOff('Reed arrows', 1), 10);
    expect(line.version).toBe(1);
    // The GM's device changes it first; the phone still shows version 1.
    expect(await as(world.gm, setItemQty, { line: { id: line.id, carrier: wren(), version: 1 }, qty: 12 })).toMatchObject({ ok: true });
    const refused = await as(world.playerA, setItemQty, { line: { id: line.id, carrier: wren(), version: 1 }, qty: 9 });
    expect(refused).toMatchObject({ ok: false, reason: 'stale', message: STALE });
    expect(await lineRow(line.id)).toMatchObject({ qty: 12, version: 2 });
    expect(must(await world.admin.from('events').select('id').eq('target_id', line.id).eq('type', 'inventory.setQty'))).toHaveLength(1);
    // From the latest copy it saves.
    expect(await as(world.playerA, setItemQty, { line: { id: line.id, carrier: wren(), version: 2 }, qty: 9 })).toMatchObject({ ok: true, value: 9 });
  });

  it('dropping, splitting or giving away from an old copy is refused too, and nothing is lost', async () => {
    const line = await give(wren(), oneOff('Tallow candles', 1), 6);
    await as(world.gm, setItemQty, { line: { id: line.id, carrier: wren(), version: 1 }, qty: 8 });
    const old = { id: line.id, carrier: wren(), version: 1 };
    expect(await as(world.playerA, removeItem, { line: old, qty: 6, of: 6 })).toMatchObject({ ok: false, reason: 'stale' });
    expect(await as(world.playerA, moveItem, { line: old, to: wren(), qty: 2, of: 6 })).toMatchObject({ ok: false, reason: 'stale' });
    expect(await as(world.playerA, giveAway, { line: old, qty: 6, of: 6, to: 'The ferryman' })).toMatchObject({ ok: false, reason: 'stale' });
    expect(await lineRow(line.id)).toMatchObject({ qty: 8, version: 2 });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('name', 'Tallow candles').eq('campaign_id', world.campaignId))).toHaveLength(1);
  });

  it("a save that names no version (an older device) is applied as before, and raises the version", async () => {
    const line = await give(wren(), oneOff('Fishing line', 1));
    expect(await as(world.playerA, equipItem, { line: { id: line.id, carrier: wren() }, equipped: true })).toMatchObject({ ok: true });
    expect(await lineRow(line.id)).toMatchObject({ equipped: true, version: 2 });
  });

  it("a player can't set the version to make an old copy look new", async () => {
    const line = await give(wren(), oneOff('Bone hook', 1));
    await world.playerA.db.from('inventory_lines').update({ version: 50 }).eq('id', line.id);
    expect(await lineRow(line.id)).toMatchObject({ version: 1 });
  });

  it('the version is never in the log, so undo puts back what changed and leaves the version to the database', async () => {
    const line = await give(wren(), oneOff('Eel trap', 2), 2);
    const done = await as(world.playerA, setItemQty, { line: { id: line.id, carrier: wren(), version: 1 }, qty: 3 });
    expect(done.ok).toBe(true);
    const [change] = must(await world.admin.from('events').select('id, before, after').eq('target_id', line.id).eq('type', 'inventory.setQty'));
    expect(change).toMatchObject({ before: { qty: 2 }, after: { qty: 3 } });
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: change!.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect(await lineRow(line.id)).toMatchObject({ qty: 2, version: 3 });
  });
});

describe('a repeated request id changes nothing twice (an offline retry after a lost answer)', () => {
  it('the same change sent twice is applied once, logged once, and the second gets the line as it is', async () => {
    const line = await give(wren(), oneOff('Rush lights', 1), 5);
    const requestId = crypto.randomUUID();
    const input = { line: { id: line.id, carrier: wren(), version: 1 }, qty: 4 };
    expect(await as(world.playerA, setItemQty, input, requestId)).toMatchObject({ ok: true, value: 4 });
    expect(await as(world.playerA, setItemQty, input, requestId)).toMatchObject({ ok: true, value: 4 });
    expect(await eventsOf(requestId)).toHaveLength(1);
    expect(await lineRow(line.id)).toMatchObject({ qty: 4, version: 2 });
  });

  it('the same add sent twice makes one line', async () => {
    const requestId = crypto.randomUUID();
    const input = { carrier: wren(), item: oneOff('Sloe gin', 1), qty: 1, howGot: 'found' as const };
    const first = await as(world.playerA, addItem, input, requestId);
    const again = await as(world.playerA, addItem, input, requestId);
    expect(first).toMatchObject({ ok: true });
    expect(again).toMatchObject({ ok: true, value: { id: first.ok ? first.value.id : '' } });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('name', 'Sloe gin').eq('campaign_id', world.campaignId))).toHaveLength(1);
    expect((await eventsOf(requestId)).filter((e) => e.type === 'inventory.add')).toHaveLength(1);
  });

  it('the same split sent twice moves one part, not two', async () => {
    const line = await give(wren(), oneOff('Smoked eels', 1), 10);
    const stashRow = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!;
    const stash: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stashRow.id as string, ownerUserId: null, archived: false };
    const requestId = crypto.randomUUID();
    const input = { line: { id: line.id, carrier: wren(), version: 1 }, to: stash, qty: 3, of: 10 };
    const first = await as(world.playerA, moveItem, input, requestId);
    const again = await as(world.playerA, moveItem, input, requestId);
    expect(first).toMatchObject({ ok: true });
    expect(again).toMatchObject({ ok: true, value: { id: first.ok ? first.value.id : '' } });
    const eels = must(await world.admin.from('inventory_lines').select('qty, location_id').eq('name', 'Smoked eels').eq('campaign_id', world.campaignId).order('qty'));
    expect(eels).toEqual([
      { qty: 3, location_id: stash.locationId },
      { qty: 7, location_id: null },
    ]);
  });

  it('the same give-away sent twice gives once and answers "done" the second time', async () => {
    const line = await give(wren(), oneOff('Copper ring', 1));
    const requestId = crypto.randomUUID();
    const input = { line: { id: line.id, carrier: wren(), version: 1 }, qty: 1, of: 1, to: 'The ferryman' };
    expect(await as(world.playerA, giveAway, input, requestId)).toMatchObject({ ok: true });
    expect(await as(world.playerA, giveAway, input, requestId)).toMatchObject({ ok: true });
    expect((await eventsOf(requestId)).filter((e) => e.after === null)).toHaveLength(1);
  });

  it('a different request with the same change is a new change (not taken for a repeat)', async () => {
    const line = await give(wren(), oneOff('Clay pipes', 1), 2);
    expect(await as(world.playerA, setItemQty, { line: { id: line.id, carrier: wren() }, qty: 3 })).toMatchObject({ ok: true });
    expect(await as(world.playerA, setItemQty, { line: { id: line.id, carrier: wren() }, qty: 4 })).toMatchObject({ ok: true, value: 4 });
  });
});

describe('"<name> is now <tier>" is written once, by the database', () => {
  it('two devices changing one pack at once, both into the next tier, make exactly one line', async () => {
    const reed = await newCharacter('Reed the Wader');
    const carrier = carrierOf(reed, world.playerA);
    const pebbles = await give(carrier, oneOff('Pebble', 10));
    expect(await storedTier(reed)).toBe('Unhindered');
    // At the same moment, the phone (the player) makes it 12 pebbles (120: Laden on its own) and the iPad (the GM)
    // adds a 95 pot (105: Laden on its own). 215 in all: still Laden, and one line between them.
    const [phone, iPad] = await Promise.all([
      as(world.playerA, setItemQty, { line: { id: pebbles.id, carrier, version: pebbles.version }, qty: 12 }),
      as(world.gm, addItem, { carrier, item: oneOff('Iron pot', 95), qty: 1, howGot: 'given' }),
    ]);
    expect([phone.ok, iPad.ok]).toEqual([true, true]);
    expect((await tierLines(reed)).map((l) => l.after)).toEqual([{ tier: 'Laden' }]);
    expect(await storedTier(reed)).toBe('Laden');
  });

  it('a change that stays in its tier writes nothing; undoing back across writes one line', async () => {
    const sedge = await newCharacter('Sedge');
    const carrier = carrierOf(sedge, world.playerA);
    const sack = await give(carrier, oneOff('Grain sack', 90));
    await give(carrier, oneOff('Thread', 1));
    expect(await tierLines(sedge)).toEqual([]);
    const done = await as(world.playerA, setItemQty, { line: { id: sack.id, carrier, version: sack.version }, qty: 2 });
    expect(done.ok).toBe(true);
    expect((await tierLines(sedge)).map((l) => l.after)).toEqual([{ tier: 'Laden' }]);
    const [change] = must(await world.admin.from('events').select('id').eq('target_id', sack.id).eq('type', 'inventory.setQty'));
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: change!.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect((await tierLines(sedge)).map((l) => l.after)).toEqual([{ tier: 'Laden' }, { tier: 'Unhindered' }]);
    // Its own line, not part of the change it followed (so undoing that change never trips on it).
    expect((await tierLines(sedge)).every((l) => l.request_id === null)).toBe(true);
  });

  it('splitting a stack counts once at the end, never in between', async () => {
    const tansy = await newCharacter('Tansy');
    const carrier = carrierOf(tansy, world.playerA);
    const bricks = await give(carrier, oneOff('Peat bricks', 10), 12);
    // The GM splits it (a player's split of a one-off waits for the GM, so it wouldn't count: see the PR's notes).
    await as(world.gm, moveItem, { line: { id: bricks.id, carrier, version: bricks.version }, to: carrier, qty: 5, of: 12 });
    expect(await tierLines(tansy)).toEqual([{ after: { tier: 'Laden' }, audience: 'all', request_id: null }]);
  });

  it("the line is seen like the character: a waiting character's only by its player and the GM", async () => {
    const [row] = must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Marshwort', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' })
        .select('id'),
    );
    const marshwort = row!.id as string;
    await give(carrierOf(marshwort, world.playerA), oneOff('Millstone', 300));
    const seenBy = async (person: Person) => must(await person.db.from('events').select('after').eq('type', 'load.tier').eq('target_id', marshwort));
    expect(await seenBy(world.gm)).toEqual([{ after: { tier: 'Bowed' } }]);
    expect(await seenBy(world.playerA)).toEqual([{ after: { tier: 'Bowed' } }]);
    expect(await seenBy(world.playerB)).toEqual([]);
  });
});

describe('the database works the tier out the same as the app’s load bar', () => {
  it('coin mode: misc gear, bundles, containers that only hold or add room (an optional rule), a bag with a fixed weight, over the max', async () => {
    const heron = await newCharacter('Heron');
    const carrier = carrierOf(heron, world.playerA);
    const check = async () => {
      const app = await appTier(heron);
      expect(app).not.toBe('');
      expect(await storedTier(heron)).toBe(app);
    };
    await give(carrier, oneOff('Rope', 50));
    await give(carrier, oneOff('Odds and ends', null, { category: 'sundries' }));
    const torches = await give(carrier, oneOff('Torches', 12), 4);
    must(await world.admin.from('inventory_lines').update({ per_units: 6 }).eq('id', torches.id).select('id'));
    await give(carrier, oneOff('Sack', 5, { details: { container: { capacityCoin: 200 } } }));
    await check();
    const bag = await give(carrier, oneOff('Lead-lined bag', 1, { details: { container: { capacityCoin: 100 }, fixedWeightCoin: 10 } }));
    const stones = await give(carrier, oneOff('Standing stones', 300));
    await as(world.gm, moveItem, { line: { id: stones.id, carrier, version: stones.version }, to: carrier, containerLineId: bag.id, qty: 1, of: 1 });
    await check();
    await give(carrier, oneOff('Iron bar', 100));
    await check();
    // The optional rule "Sacks: Add room": the sack adds 200 to every tier.
    must(await world.admin.from('campaign_packs').update({ option_choices: { sacks: 'add' } }).eq('id', packLinkId).select('id'));
    await give(carrier, oneOff('Feather', 0));
    await check();
    must(await world.admin.from('campaign_packs').update({ option_choices: { sacks: 'hold' } }).eq('id', packLinkId).select('id'));
    await give(carrier, oneOff('Anchor', 500));
    await check();
    expect(await storedTier(heron)).toBe('Can’t budge');
  });

  it('slot mode and armour mode', async () => {
    const coot = await newCharacter('Coot');
    const carrier = carrierOf(coot, world.playerA);
    await setMode('slot');
    try {
      await give(carrier, oneOff('Rope', 1, { slots: 1 }), 3);
      await give(carrier, oneOff('Arrows', 0, { slots: 1, stack: 20 }), 25);
      expect(await storedTier(coot)).toBe(await appTier(coot));
      await give(carrier, oneOff('Tent', 10, { slots: 4 }));
      expect(await storedTier(coot)).toBe(await appTier(coot));
      expect(await storedTier(coot)).toBe('Slow');

      await setMode('armour');
      await give(carrier, oneOff('Plate', 300, { details: { armourType: 'plate' } }), 1, true);
      expect(await storedTier(coot)).toBe(await appTier(coot));
      await give(carrier, oneOff('River pearl', null, { category: 'gem' }), 5);
      expect(await storedTier(coot)).toBe(await appTier(coot));
      expect(await storedTier(coot)).toBe('Move 30 ft');
    } finally {
      await setMode('coin');
    }
  });

  // Purpose (eq-5, eq-6; area 3 order 11): a bag that weighs by how full it is and worn gloves that raise the limit
  // give the same tier in the database's tier line as on the app's load bar, at every step.
  it('coin mode: a bag by fill and a carry bonus while worn', async () => {
    const grebe = await newCharacter('Grebe');
    const carrier = carrierOf(grebe, world.playerA);
    const same = async (tier: string) => {
      expect(await appTier(grebe)).toBe(tier);
      expect(await storedTier(grebe)).toBe(tier);
    };
    // Half full: the satchel weighs 100 of 200, and the stones in it don't count.
    const satchel = await give(carrier, oneOff('Heron satchel', 200, { details: { container: { capacityCoin: 400, weightEmpty: 0, weightFull: 200 } } }));
    const stones = await give(carrier, oneOff('River stones', 200));
    await as(world.gm, moveItem, { line: { id: stones.id, carrier, version: stones.version }, to: carrier, containerLineId: satchel.id, qty: 1, of: 1 });
    await give(carrier, oneOff('Feather', 0));
    await same('Unhindered');
    await give(carrier, oneOff('Iron bar', 100));
    await same('Laden');
    // Worn gloves raise every limit by 200: 200 is under the first tier again.
    await give(carrier, oneOff('Ogre grips', 0, { details: { slot: 'hand', carryBonus: 200 } }), 1, true);
    await same('Unhindered');
  });

  // Purpose (bq3-9): in armour mode, an item marked treasure: true counts as treasure in the database too.
  it('armour mode: an item marked treasure: true', async () => {
    const snipe = await newCharacter('Snipe');
    const carrier = carrierOf(snipe, world.playerA);
    await setMode('armour');
    try {
      await give(carrier, oneOff('Otter idol', 10, { category: 'art', details: { treasure: true } }));
      expect(await appTier(snipe)).toBe('Move 90 ft');
      expect(await storedTier(snipe)).toBe('Move 90 ft');
    } finally {
      await setMode('coin');
    }
  });
});

// Who sees each log line: one function per table. Their comparison with the M4b block passed on the test project
// when step 4 landed (#148); step 5 moved the comparison function out of the public schema (m5-clock.test.ts checks
// nothing reaches it), so it no longer runs here. Each table's audience is still checked through real log lines
// (log.test.ts, known-items.test.ts, m5-clock.test.ts and the rest).
