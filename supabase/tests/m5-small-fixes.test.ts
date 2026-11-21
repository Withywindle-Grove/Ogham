// M5 small fixes (supabase/migrations/20261030100000_m5_small_fixes.sql; ruled 2026-10-29). TEST project only;
// invented content.
//   A split of an approved one-off stays approved (a player's moved part no longer goes back to the GM); a waiting
//   one-off's part still waits.
//   Changing the encumbrance mode or an optional rule writes "<name> is now <tier>" at once, without an item change.
//   Magic armour's base is one of its own choices; a player picks it once, then only the GM changes it; it can be
//   given as the item is added.
//   Check again is logged Verbose and undone like a recorded check.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { recordCheckAgain } from '../../src/modules/expedition/reminderPlay.ts';
import { addItem, moveItem, setBaseArmour, type CarrierRef, type InventoryLine, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const carrierOf = (actorId: string, owner: Person): CarrierRef => ({ campaignId: world.campaignId, actorId, locationId: null, ownerUserId: owner.id, archived: false });
const oneOff = (name: string, weightCoin: number | null, details: Record<string, unknown> = {}): ItemCopy => ({
  libraryEntryId: null,
  name,
  category: 'gear',
  weightCoin,
  slots: null,
  stack: 1,
  details,
});
async function give(carrier: CarrierRef, item: ItemCopy, qty = 1, extra: { baseArmourId?: string } = {}): Promise<InventoryLine> {
  const added = await as(world.gm, addItem, { carrier, item, qty, howGot: 'given', ...extra });
  if (!added.ok) throw new Error(added.message);
  return added.value;
}
const lineRow = async (id: string) => (await world.admin.from('inventory_lines').select('*').eq('id', id)).data?.[0] as Record<string, unknown> | undefined;
const tierLines = async (actorId: string) => must(await world.admin.from('events').select('after').eq('type', 'load.tier').eq('target_id', actorId).order('seq')).map((e) => e.after);

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

let packId = '';
let packLinkId = '';

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen tiers' },
      rulesSets: [
        {
          id: 'fen-tiers',
          name: 'Fen tiers',
          encumbrance: {
            containers: { default: 'hold-only', byOption: { 'sacks=add': 'add' } },
            coin: { tiers: [{ label: 'Unhindered', max: 100 }, { label: 'Laden', max: 250 }, { label: 'Bowed', max: 400 }] },
            slot: { tiers: [{ label: 'Nimble', maxSlots: 5 }, { label: 'Slow', maxSlots: 10 }] },
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
  must(await world.admin.from('campaigns').update({ settings: { encumbrance: { mode: 'coin' } } }).eq('id', world.campaignId).select('id'));
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('a split of an approved one-off stays approved (ruled 2026-10-29)', () => {
  it("a player's part of an approved one-off, handed to another character, stays approved", async () => {
    const chalk = await give(carrierOf(world.wrenId, world.playerA), oneOff('River chalk', 1), 4);
    expect(chalk.approval).toBe('approved');
    const moved = await as(world.playerA, moveItem, { line: { id: chalk.id, carrier: carrierOf(world.wrenId, world.playerA), version: chalk.version }, to: carrierOf(world.ashId, world.playerB), qty: 1, of: 4 });
    if (!moved.ok) throw new Error(moved.message);
    expect(moved.value).toMatchObject({ actorId: world.ashId, qty: 1, approval: 'approved' });
    expect(await lineRow(chalk.id)).toMatchObject({ qty: 3, approval: 'approved' });
  });

  it("a waiting one-off's part still waits for the GM", async () => {
    const wren = carrierOf(world.wrenId, world.playerA);
    const added = await as(world.playerA, addItem, { carrier: wren, item: oneOff('Odd pebbles', 1), qty: 3, howGot: 'found' });
    if (!added.ok) throw new Error(added.message);
    expect(added.value.approval).toBe('pending');
    const moved = await as(world.playerA, moveItem, { line: { id: added.value.id, carrier: wren, version: added.value.version }, to: wren, qty: 1, of: 3 });
    if (!moved.ok) throw new Error(moved.message);
    expect(moved.value.approval).toBe('pending');
  });
});

describe('"<name> is now <tier>" when the rules change (ruled 2026-10-29)', () => {
  it('changing an optional rule writes the line at once; so does changing the encumbrance mode', async () => {
    const bittern = await newCharacter('Bittern');
    const carrier = carrierOf(bittern, world.playerA);
    await give(carrier, oneOff('Sack', 5, { container: { capacityCoin: 200 } }));
    await give(carrier, oneOff('Peat', 145));
    expect(await tierLines(bittern)).toEqual([{ tier: 'Laden' }]);
    // "Sacks: Add room": the sack adds 200 to every tier, so 150 is Unhindered again: written at once.
    must(await world.admin.from('campaign_packs').update({ option_choices: { sacks: 'add' } }).eq('id', packLinkId).select('id'));
    expect(await tierLines(bittern)).toEqual([{ tier: 'Laden' }, { tier: 'Unhindered' }]);
    must(await world.admin.from('campaign_packs').update({ option_choices: { sacks: 'hold' } }).eq('id', packLinkId).select('id'));
    expect(await tierLines(bittern)).toEqual([{ tier: 'Laden' }, { tier: 'Unhindered' }, { tier: 'Laden' }]);
    // The GM switches the campaign to slots: two things in no slots is Nimble, written at once.
    must(await world.admin.from('campaigns').update({ settings: { encumbrance: { mode: 'slot' } } }).eq('id', world.campaignId).select('id'));
    try {
      expect((await tierLines(bittern)).at(-1)).toEqual({ tier: 'Nimble' });
    } finally {
      must(await world.admin.from('campaigns').update({ settings: { encumbrance: { mode: 'coin' } } }).eq('id', world.campaignId).select('id'));
    }
    expect((await tierLines(bittern)).at(-1)).toEqual({ tier: 'Laden' });
  });

  it('a change to the settings that leaves encumbrance alone writes no tier line', async () => {
    const heron = await newCharacter('Heron');
    await give(carrierOf(heron, world.playerA), oneOff('Peat', 150));
    const before = (await tierLines(heron)).length;
    must(await world.admin.from('campaigns').update({ settings: { encumbrance: { mode: 'coin' }, companies: false } }).eq('id', world.campaignId).select('id'));
    expect((await tierLines(heron)).length).toBe(before);
  });
});

describe("magic armour's chosen base (ruled 2026-10-29)", () => {
  const glimmer = () => oneOff('Glimmer mail', 200, { slot: 'armour', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } } });

  it('the player picks it once (logged); a base that is not one of its choices is refused; after that only the GM changes it', async () => {
    const wren = carrierOf(world.wrenId, world.playerA);
    const line = await give(wren, glimmer());
    expect(line.baseArmourId).toBeNull();
    const notOne = await as(world.playerA, setBaseArmour, { line: { id: line.id, carrier: wren, baseArmourId: null }, baseArmourId: 'gold-leaf' });
    expect(notOne.ok).toBe(false);
    const picked = await as(world.playerA, setBaseArmour, { line: { id: line.id, carrier: wren, baseArmourId: null }, baseArmourId: 'reed-coat' });
    expect(picked).toMatchObject({ ok: true, value: { baseArmourId: 'reed-coat' } });
    expect(must(await world.admin.from('events').select('type, level').eq('target_id', line.id).eq('type', 'inventory.setBaseArmour'))).toEqual([{ type: 'inventory.setBaseArmour', level: 'simple' }]);
    // Straight to the table, as the player: refused once it's chosen.
    const changed = await world.playerA.db.from('inventory_lines').update({ base_armour_id: 'bark-vest' }).eq('id', line.id).select('id');
    expect(changed.error?.code).toBe('42501');
    expect(await lineRow(line.id)).toMatchObject({ base_armour_id: 'reed-coat' });
    const byGm = await as(world.gm, setBaseArmour, { line: { id: line.id, carrier: wren, baseArmourId: 'reed-coat' }, baseArmourId: 'bark-vest' });
    expect(byGm).toMatchObject({ ok: true, value: { baseArmourId: 'bark-vest' } });
  });

  it('it can be given as the item is added, and only one of its choices', async () => {
    const wren = carrierOf(world.wrenId, world.playerA);
    const line = await give(wren, glimmer(), 1, { baseArmourId: 'bark-vest' });
    expect(line.baseArmourId).toBe('bark-vest');
    const refused = await as(world.gm, addItem, { carrier: wren, item: glimmer(), qty: 1, howGot: 'given', baseArmourId: 'gold-leaf' });
    expect(refused.ok).toBe(false);
    const plain = await as(world.gm, addItem, { carrier: wren, item: oneOff('Plain coat', 100), qty: 1, howGot: 'given', baseArmourId: 'reed-coat' });
    expect(plain.ok).toBe(false);
  });
});

describe('Check again (ruled 2026-10-29)', () => {
  it('is logged Verbose, and undone like a recorded check (marked undone, kept)', async () => {
    const record = { checkKey: 'again:mode:bog-wander:camp', name: 'Bog lurkers', source: 'mode' as const, outcome: 'miss' as const, modifiers: [] };
    const result = await as(world.gm, recordCheckAgain, { campaignId: world.campaignId, record });
    if (!result.ok) throw new Error(result.message);
    const [event] = must(await world.admin.from('events').select('id, type, level').eq('target_id', result.value.id));
    expect(event).toMatchObject({ type: 'check.again', level: 'verbose' });
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: event!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('check_results').select('undone').eq('id', result.value.id))).toEqual([{ undone: true }]);
    expect((await as(world.playerA, recordCheckAgain, { campaignId: world.campaignId, record })).ok).toBe(false);
  });
});
