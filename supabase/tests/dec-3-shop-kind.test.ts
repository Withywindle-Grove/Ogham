// An adventure pack's shops (`shops`) are kept on import as a GM-only kind, `shop` (dec-3, town row W9; the lead's ruling
// sh-1; migration 20261115140000_dec_3_shop_kind.sql). TEST project or CI's local database; invented shops. What it checks:
//   * the database takes the kind (and still takes `npc`), and the GM reads each shop back, stock included, from the
//     table and through campaign_library;
//   * hidden means hidden: a player of the campaign and an outsider read no shop entry, from the table or through
//     campaign_library, even one whose data says "gmOnly": false.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
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

const NAME = 'Lantern Warden’s stall';
const STOCK = 'brackwater:bog-lurker-hide';
const OPEN_NAME = 'The reed-cutters’ barrow';
const PERSON = 'Hobb the Lantern Warden';
const read = () => {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 3,
      meta: { name: 'Brackwater shops', version: '0.1', kind: 'adventure' },
      locations: [{ id: 'bh-quay', name: 'The quay', type: 'area' }],
      npcs: [{ id: 'bh-npc-hobb', name: PERSON, locationId: 'bh-quay' }],
      shops: [
        {
          id: 'bh-shop-stall',
          name: NAME,
          locationId: 'bh-quay',
          services: [{ name: 'A lamp trimmed', price: { cp: 3 } }],
          stock: [{ itemRef: STOCK, price: { gp: 12 }, availability: { chance: '2-in-6' } }],
        },
        // A pack can't open a shop to players: a table's "gmOnly": false (fs-1) means nothing on a shop.
        { id: 'bh-shop-barrow', name: OPEN_NAME, gmOnly: false, locationId: 'bh-quay', stock: [] },
      ],
    }),
  );
  if (!result.ok) throw new Error(result.message);
  return result.pack;
};

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const made = await as(world.gm, importPack, { pack: read() });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const fromTable = async (person: Person) => must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId));
const fromLibrary = async (person: Person) => {
  const { data, error } = await person.db.rpc('campaign_library', { campaign: world.campaignId, packs: [packId] });
  if (error) throw new Error(error.message);
  return (data ?? []) as { kind: string; name: string; data: Record<string, unknown> }[];
};

describe('shops, a GM-only kind', () => {
  it('are kept beside people, and the GM reads each back with its stock, from the table and the campaign’s library', async () => {
    const table = await fromTable(world.gm);
    const shops = table.filter((e) => e.kind === 'shop');
    expect(shops.map((e) => e.name).sort()).toEqual([NAME, OPEN_NAME].sort());
    expect(JSON.stringify(shops)).toContain(STOCK);
    expect(table.filter((e) => e.kind === 'npc').map((e) => e.name)).toEqual([PERSON]);
    const library = (await fromLibrary(world.gm)).filter((e) => e.kind === 'shop');
    expect(library.map((e) => e.name).sort()).toEqual([NAME, OPEN_NAME].sort());
  });

  it('never reach a player of the campaign, nor an outsider, from the table or the campaign’s library', async () => {
    for (const person of [world.playerA, world.outsider]) {
      for (const rows of [await fromTable(person), await fromLibrary(person)]) {
        expect(rows.filter((e) => e.kind === 'shop')).toEqual([]);
        const raw = JSON.stringify(rows);
        expect(raw).not.toContain(NAME);
        expect(raw).not.toContain(OPEN_NAME);
        expect(raw).not.toContain(STOCK);
      }
    }
  });
});
