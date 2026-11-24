// What an inventory line keeps of its item (M4 step 3; docs/04-data-model.md). TEST project only; invented content.
// A line from the setting rules gets its details from the database, never from the device: everything a
// player may see of the entry, nothing hidden, and a soft pointer (pack and entry id) back to where it came from.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, moveItem, revealItemField, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
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

const CURSE = 'Hums at the full moon';
let entries: Record<string, string> = {};
let packId = '';
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });

async function makePack(name: string, attach: boolean) {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name },
      items: [
        {
          id: 'hum-blade',
          name: 'Humming blade',
          category: 'weapon',
          weightCoin: 50,
          slot: 'hand',
          hands: 1,
          weaponTags: ['Melee'],
          notes: 'Sings softly.',
          source: 'Invented',
          cursed: true,
          fields: { Curse: CURSE },
          gmOnly: ['cursed', 'fields'],
        },
        { id: 'tote', name: 'Tote bag', category: 'gear', weightCoin: 5, container: { capacityCoin: 200 } },
      ],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  if (attach) await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
  return made.value;
}

beforeAll(async () => {
  world = await buildWorld();
  packId = await makePack('Fen Arms', true);
  await makePack('Unused Arms', false);
  const rows = must(await world.gm.db.from('library_entries').select('id, pack_entry_id, pack_id'));
  entries = Object.fromEntries(rows.map((r) => [`${r.pack_id === packId ? 'fen' : 'loose'}:${r.pack_entry_id}`, r.id as string]));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const add = (person: Person, libraryEntryId: string | null, details: Record<string, unknown> = {}) =>
  as(person, addItem, {
    carrier: wren(),
    item: { libraryEntryId, name: 'Whatever the device says', category: 'junk', weightCoin: 999, slots: null, stack: 1, details },
    qty: 1,
    howGot: 'found',
  });

describe('a line from the setting rules', () => {
  it('copies what a player may see of the entry, from the database, whatever the device sent; never the hidden fields', async () => {
    for (const person of [world.playerA, world.gm]) {
      const added = await add(person, entries['fen:hum-blade']!, { cursed: true, fields: { Curse: CURSE } });
      if (!added.ok) throw new Error(added.message);
      const [row] = must(
        await world.admin.from('inventory_lines').select('name, category, weight_coin, item_data, source_pack_id, source_entry_id').eq('id', added.value.id),
      );
      // K22a: a cursed item starts unidentified, so its line is its face: the category's name, and none of its own
      // words or source until the GM tells everything (k22-reveal-hidden.test.ts).
      expect(row).toMatchObject({
        name: 'Weapon',
        category: 'weapon',
        weight_coin: 50,
        source_pack_id: packId,
        source_entry_id: 'hum-blade',
        item_data: { slot: 'hand', hands: 1, weaponTags: ['Melee'] },
      });
      expect(row!.item_data).not.toHaveProperty('notes');
      expect(row!.item_data).not.toHaveProperty('source');
      expect(JSON.stringify(row)).not.toContain(CURSE);
      expect(row!.item_data).not.toHaveProperty('cursed');
      expect(row!.item_data).not.toHaveProperty('gmOnly');
    }
  });

  it("keeps a container's block, so the load knows what it holds", async () => {
    const added = await add(world.playerA, entries['fen:tote']!);
    if (!added.ok) throw new Error(added.message);
    expect(added.value.details).toMatchObject({ container: { capacityCoin: 200 } });
  });

  it("refuses an entry that isn't an item, or isn't in the campaign's setting rules", async () => {
    const bog = must(await world.gm.db.from('library_entries').select('id').eq('pack_id', packId).eq('kind', 'statBlock'))[0]!.id as string;
    expect((await add(world.gm, bog)).ok).toBe(false);
    expect((await add(world.gm, entries['loose:hum-blade']!)).ok).toBe(false);
  });
});

describe('a one-off item', () => {
  it("keeps what the device sent, except anything its gmOnly list hides, and has no pointer", async () => {
    const added = await add(world.playerA, null, { notes: 'Found in the reeds', secret: 'cursed', gmOnly: ['secret'] });
    if (!added.ok) throw new Error(added.message);
    const [row] = must(await world.admin.from('inventory_lines').select('name, item_data, source_pack_id, source_entry_id').eq('id', added.value.id));
    expect(row).toEqual({ name: 'Whatever the device says', item_data: { notes: 'Found in the reeds' }, source_pack_id: null, source_entry_id: null });
  });
});

describe('revealing a hidden field to the holder (M4 step 5)', () => {
  it('only the GM can change what a line says about its item; a reveal is logged and the holder sees it', async () => {
    const added = await add(world.playerA, entries['fen:hum-blade']!);
    if (!added.ok) throw new Error(added.message);
    const line = { id: added.value.id, carrier: wren() };

    // The holder can't write it in themselves.
    await world.playerA.db.from('inventory_lines').update({ item_data: { ...added.value.details, cursed: true } }).eq('id', line.id);
    expect(must(await world.admin.from('inventory_lines').select('item_data').eq('id', line.id))[0]!.item_data).not.toHaveProperty('cursed');
    expect(await as(world.playerA, revealItemField, { line, field: 'cursed', value: true })).toMatchObject({ ok: false });

    expect(await as(world.gm, revealItemField, { line, field: 'fields', value: { Curse: CURSE } })).toMatchObject({ ok: true });
    const [seen] = must(await world.playerA.db.from('inventory_lines').select('item_data').eq('id', line.id));
    expect(seen!.item_data).toMatchObject({ fields: { Curse: CURSE }, slot: 'hand' });
    expect(must(await world.playerA.db.from('events').select('type').eq('target_id', line.id).eq('type', 'inventory.reveal'))).toHaveLength(1);
  });

  it('a revealed field stays when part of a stack is handed on', async () => {
    const added = await add(world.gm, entries['fen:hum-blade']!);
    if (!added.ok) throw new Error(added.message);
    await world.admin.from('inventory_lines').update({ qty: 2 }).eq('id', added.value.id);
    const line = { id: added.value.id, carrier: wren() };
    await as(world.gm, revealItemField, { line, field: 'cursed', value: true });
    const ash: CarrierRef = { campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false };
    const moved = await as(world.gm, moveItem, { line, to: ash, qty: 1, of: 2 });
    expect(moved).toMatchObject({ ok: true, value: { details: { cursed: true }, sourceEntryId: 'hum-blade' } });
  });
});
