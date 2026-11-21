// The M4 fresh-session review and code health check fixes (2026-10-24; docs/health/M4.md;
// supabase/migrations/20261024230000_m4_review_fixes.sql). TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, giveAway, moveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
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
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
async function stash(): Promise<CarrierRef> {
  const [row] = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'));
  return { campaignId: world.campaignId, actorId: null, locationId: row!.id as string, ownerUserId: null, archived: false };
}
const line = async (id: string) => must(await world.admin.from('inventory_lines').select('*').eq('id', id))[0]!;

let packId = '';
let entries: Record<string, string> = {};

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen review rules' },
      items: [
        { id: 'torch-bundle', name: 'Torches (6)', category: 'light', weightCoin: 12, bundle: 6, unitName: 'Torch' },
        { id: 'reed-wand', name: 'Reed wand', category: 'wand', weightCoin: 1 },
        { id: 'pebble', name: 'Smooth pebble', category: 'gear', weightCoin: 1 },
      ],
      rulesSets: [
        {
          id: 'fen-rules',
          name: 'Fen rules',
          magicItems: { charges: { wand: '2d6', hidden: true }, table: 'GM only' },
          monsters: { lurkers: 'In the mill pond' },
          byOption: { 'lamp=dark': { monsters: { lurkers: 'Under the plank bridge' }, encumbrance: { mode: 'coin' } } },
        },
      ],
      options: [{ id: 'lamp', name: 'Lamps', default: 'dark', choices: [{ id: 'dark', name: 'Dark' }, { id: 'lit', name: 'Lit' }] }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  if (!attached.ok) throw new Error(attached.message);
  const rows = must(await world.gm.db.from('library_entries').select('id, pack_entry_id').eq('pack_id', packId));
  entries = Object.fromEntries(rows.map((r) => [r.pack_entry_id as string, r.id as string]));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

const fromEntry = (person: Person, entry: string, qty: number) =>
  as(person, addItem, {
    carrier: wren(),
    item: { libraryEntryId: entries[entry]!, name: 'x', category: 'x', weightCoin: null, slots: null, stack: 1, details: {} },
    qty,
    howGot: 'found',
  });

describe('1. GM-only rules-set sections and optional-rule overrides', () => {
  it("a player never receives a GM-only section through an optional rule's overrides; the GM keeps all of it", async () => {
    const [seen] = must(await world.playerA.db.from('library_entries').select('data').eq('id', entries['fen-rules']!));
    const data = seen!.data as Record<string, unknown>;
    expect(data.monsters).toBeUndefined();
    expect(data.magicItems).toEqual({ charges: { wand: '2d6', hidden: true } });
    expect(data.byOption).toEqual({ 'lamp=dark': { encumbrance: { mode: 'coin' } } });
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id').eq('id', entries['fen-rules']!))).toEqual([]);
    const [secret] = must(await world.gm.db.from('library_entry_secrets').select('data').eq('id', entries['fen-rules']!));
    expect((secret!.data as { byOption: unknown }).byOption).toEqual({
      'lamp=dark': { monsters: { lurkers: 'Under the plank bridge' }, encumbrance: { mode: 'coin' } },
    });
  });
});

describe('2. charges', () => {
  it("a player's new line takes hidden charges from the setting rules, whatever the device says", async () => {
    const wand = await as(world.playerA, addItem, {
      carrier: wren(),
      item: { libraryEntryId: entries['reed-wand']!, name: 'x', category: 'x', weightCoin: null, slots: null, stack: 1, details: {} },
      qty: 1,
      howGot: 'found',
      chargesHidden: false,
    });
    expect(wand.ok && (await line(wand.value.id)).charges_hidden).toBe(true);
    const pebble = await fromEntry(world.playerA, 'pebble', 1);
    expect(pebble.ok && (await line(pebble.value.id)).charges_hidden).toBe(false);
  });

  it('a player can neither blank visible charges to set them again nor set a count on hidden ones', async () => {
    const shown = must(
      await world.gm.db
        .from('inventory_lines')
        .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Glow wand', category: 'wand', qty: 1, how_got: 'found', charges_left: 3 })
        .select('id'),
    )[0]!.id as string;
    await world.playerA.db.from('inventory_lines').update({ charges_left: null }).eq('id', shown);
    expect((await line(shown)).charges_left).toBe(3);
    await world.playerA.db.from('inventory_lines').update({ charges_left: 2 }).eq('id', shown);
    expect((await line(shown)).charges_left).toBe(2);

    const hidden = must(
      await world.gm.db
        .from('inventory_lines')
        .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Murky wand', category: 'wand', qty: 1, how_got: 'found', charges_hidden: true })
        .select('id'),
    )[0]!.id as string;
    await world.playerA.db.from('inventory_lines').update({ charges_left: 9 }).eq('id', hidden);
    expect((await line(hidden)).charges_left).toBeNull();
  });
});

describe('3. what a line is', () => {
  const base = () => ({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Golden idol', category: 'treasure', weight_coin: 0, qty: 1, how_got: 'found' });

  it("a player's line can't name an entry the campaign doesn't have, or claim setting rules without one", async () => {
    const madeUp = await world.playerA.db.from('inventory_lines').insert({ ...base(), library_entry_id: crypto.randomUUID() }).select('id');
    expect(madeUp.error).not.toBeNull();
    const claimed = await world.playerA.db.from('inventory_lines').insert({ ...base(), source_pack_id: packId, source_entry_id: 'pebble' }).select('id');
    expect(claimed.error).not.toBeNull();
    // A plain one-off still works, and waits for the GM.
    const oneOff = must(await world.playerA.db.from('inventory_lines').insert(base()).select('approval'));
    expect(oneOff).toEqual([{ approval: 'pending' }]);
  });

  it('a player changes where a line is and how many, never its name, weight or links', async () => {
    const added = await fromEntry(world.playerA, 'pebble', 3);
    if (!added.ok) throw new Error(added.message);
    const id = added.value.id;
    for (const change of [{ weight_coin: 0 }, { name: 'Diamond' }, { per_units: 3 }, { slots: 0 }, { source_entry_id: 'reed-wand' }]) {
      await world.playerA.db.from('inventory_lines').update(change).eq('id', id);
    }
    expect(await line(id)).toMatchObject({ weight_coin: 1, name: 'Smooth pebble', per_units: 1, slots: null, source_entry_id: 'pebble' });
    await world.playerA.db.from('inventory_lines').update({ qty: 2, equipped: true }).eq('id', id);
    expect(await line(id)).toMatchObject({ qty: 2, equipped: true });
  });
});

describe('4. campaigns', () => {
  it('a line stays in its campaign, even for the service role', async () => {
    const added = await fromEntry(world.playerA, 'pebble', 1);
    if (!added.ok) throw new Error(added.message);
    const moved = await world.admin.from('inventory_lines').update({ campaign_id: world.otherCampaignId, actor_id: null }).eq('id', added.value.id).select('id');
    expect(moved.error).not.toBeNull();
    expect((await line(added.value.id)).campaign_id).toBe(world.campaignId);
  });
});

describe('5. splitting a stack', () => {
  it('moving part of a bundle keeps its share of the weight, in one step', async () => {
    const added = await fromEntry(world.playerA, 'torch-bundle', 6);
    if (!added.ok) throw new Error(added.message);
    expect(await line(added.value.id)).toMatchObject({ name: 'Torch', per_units: 6, qty: 6 });
    const moved = await as(world.playerA, moveItem, { line: { id: added.value.id, carrier: wren() }, to: await stash(), qty: 2, of: 6 });
    if (!moved.ok) throw new Error(moved.message);
    expect(await line(moved.value.id)).toMatchObject({ qty: 2, per_units: 6, actor_id: null, approval: 'approved', source_entry_id: 'torch-bundle' });
    expect((await line(added.value.id)).qty).toBe(4);
  });

  it("giving part of a GM's gift away makes it found, and the rest stays", async () => {
    const gift = must(
      await world.gm.db
        .from('inventory_lines')
        .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Eel pie', category: 'food', qty: 3, how_got: 'given' })
        .select('id'),
    )[0]!.id as string;
    const gone = await as(world.playerA, giveAway, { line: { id: gift, carrier: wren() }, qty: 1, of: 3, to: 'The ferryman' });
    expect(gone.ok).toBe(true);
    expect(await line(gift)).toMatchObject({ qty: 2, how_got: 'given' });
  });

  it('a split takes from 1 to one less than the stack, and only from a line the caller can see', async () => {
    const added = await fromEntry(world.playerA, 'pebble', 2);
    if (!added.ok) throw new Error(added.message);
    // The 2 may have joined a pebble stack an earlier case left loose (Q2, sw-1): the whole stack is its count now.
    const whole = added.value.qty;
    expect((await world.playerA.db.rpc('split_inventory_line', { line: added.value.id, how_many: whole })).error).not.toBeNull();
    expect((await world.outsider.db.rpc('split_inventory_line', { line: added.value.id, how_many: 1 })).error).not.toBeNull();
    expect((await line(added.value.id)).qty).toBe(whole);
  });
});

describe('the triggers on inventory lines', () => {
  it('run in this order (Postgres runs them by name; renaming one changes it, see the migration)', async () => {
    const rows = must(await world.admin.rpc('inventory_line_triggers'));
    expect(rows).toEqual([
      // M5 step 4: the copy version is checked first, so a save from an old copy is refused before anything else.
      { name: 'check_copy_version', timing: 'before' },
      { name: 'check_inventory_line', timing: 'before' },
      { name: 'copy_item_details', timing: 'before' },
      { name: 'guard_charges', timing: 'before' },
      { name: 'guard_lines_from_players', timing: 'before' },
      { name: 'keep_campaign', timing: 'before' },
      { name: 'note_fizzle', timing: 'before' },
      { name: 'refuse_when_retired', timing: 'before' },
      { name: 'stamp', timing: 'before' },
      { name: 'unpin_when_handed_on', timing: 'before' },
      // M5 small fixes: a chosen base armour must be one the item offers (after the player guard).
      { name: 'verify_base_armour', timing: 'before' },
      { name: 'carry_contents', timing: 'after' },
      { name: 'learn_item', timing: 'after' },
      { name: 'log_change', timing: 'after' },
      { name: 'mark_spent', timing: 'after' },
      // M5 step 4: the tier line, worked out once at the end of the change (deferred).
      { name: 'settle_load_tier', timing: 'after' },
    ]);
    expect((await world.playerA.db.rpc('inventory_line_triggers')).error).not.toBeNull();
  });
});
