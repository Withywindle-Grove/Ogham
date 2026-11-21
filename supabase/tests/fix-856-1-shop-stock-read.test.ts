// Fix fix-856-1 (supabase/migrations/20261118090000_fix_856_1_shop_stock_gm_read.sql; found by the look-back review of
// #856; Francis's ruling, 2026-11-18: players read shop stock only through its reader, public.shop_stock_in): the
// table public.shop_stock is the GM's alone to read. Before the fix any member read every live `in` row straight
// from the table (things not for sale, hidden shops' keys), past the reader's filters. TEST project only; invented
// content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadStockInForPlayer, setStock } from '../../src/modules/requests/shopStock.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  const user = (await loadCurrentUser(asDb(person))) as CurrentUser;
  return runCommand(registry, asDb(person), user, command, input);
}

const SHOP = 'f856-mossy-stall';
// For sale, set in stock today.
const LAMP = 'f856-reed-lamp';
// Not for sale (a magic thing), with a stored in row the GM wrote anyway: only the table could show it.
const WAND = 'f856-wand';

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'F856 stall goods', version: '0.1' },
      items: [
        { id: LAMP, name: LAMP, category: 'gear', availability: { chance: '1-in-6' } },
        { id: WAND, name: WAND, category: 'magic-wand', availability: { chance: 'always' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
  for (const itemId of [LAMP, WAND]) {
    expect(await as(world.gm, setStock, { campaignId: world.campaignId, serviceId: SHOP, itemId, day: 1, answer: 'in' })).toMatchObject({ ok: true });
  }
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const rows = async (person: Person) => must(await person.db.from('shop_stock').select('item_id, answer').eq('campaign_id', world.campaignId).eq('service_id', SHOP));

describe('players read shop stock only through its reader (fix-856-1)', () => {
  // Purpose: a player selecting from the shop_stock table gets no rows at all, not even a line in stock today.
  it('a player reads no rows from the table', async () => {
    for (const player of [world.playerA, world.playerB]) expect(await rows(player)).toEqual([]);
  });

  // Purpose: a player still learns what is for sale and in stock today through the reader, and never the thing not
  // for sale.
  it('a player still reads the for-sale things in stock through shop_stock_in', async () => {
    for (const player of [world.playerA, world.playerB]) {
      expect(await loadStockInForPlayer(asDb(player), world.campaignId, SHOP, 1, [LAMP, WAND])).toEqual([LAMP]);
    }
  });

  // Purpose: the GM still reads every line straight from the table.
  it('the GM still reads the table', async () => {
    expect((await rows(world.gm)).map((r) => [r.item_id, r.answer]).sort()).toEqual([
      [LAMP, 'in'],
      [WAND, 'in'],
    ]);
  });
});
