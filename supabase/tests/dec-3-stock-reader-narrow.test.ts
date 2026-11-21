// The players' stock reader, narrowed for a pack's shop (dec-3, town row W9; the lead's ruling sh-1 (a); migration
// 20261115150000_dec_3_stock_reader_narrow.sql). TEST project or CI's local database; invented things. What it checks:
//   * a `place:` key with no stored answers returns nothing (no default is computed, even for a thing that is in by
//     default at a setting's shop);
//   * a stored "in" comes back; a stored "out" and a reset (undecided) one do not; nor a stored "in" on a thing not for
//     sale or not an item (narrowing only: the old reader hid those too);
//   * the device's `offered` list changes nothing for a `place:` key;
//   * a setting's service key reads as before (a default-in thing with no row comes back);
//   * an outsider reads nothing, and a player only the GM's "in".
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadStockInForPlayer, resetStock, setStock } from '../../src/modules/requests/shopStock.ts';
import { buildWorld, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

// A pack's shop, keyed by its place entry; and a setting's generic shop.
const STALL = 'place:nr-lantern-warden-stall';
const GENERIC = 'nr-general-goods';
// Ids no other test uses. HIDE and OIL have no availability: in by default at a setting's shop.
const HIDE = 'nr-bog-lurker-hide';
const OIL = 'nr-lamp-oil';
const REEDS = 'nr-reed-bundle';
// A magic thing: not for sale.
const WAND = 'nr-lantern-wand';
const ALL = [HIDE, OIL, REEDS];

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Narrow reader goods', version: '0.1' },
      items: [
        { id: HIDE, name: 'Bog lurker hide', category: 'gear' },
        { id: OIL, name: 'Lamp oil', category: 'gear' },
        { id: REEDS, name: 'Reed bundle', category: 'gear', availability: { chance: '3-in-6' } },
        { id: WAND, name: 'Lantern wand', category: 'magic-wand', availability: { chance: 'always' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const set = (serviceId: string, itemId: string, answer: 'in' | 'out', day: number) => as(world.gm, setStock, { campaignId: world.campaignId, serviceId, itemId, day, answer });
const readIn = async (person: Person, serviceId: string, day: number, offered?: string[]) => (await loadStockInForPlayer(asDb(person), world.campaignId, serviceId, day, offered)) ?? [];

describe("a pack shop's stock: the GM's stored answers only (sh-1 a)", () => {
  // Purpose: a place: key with no stored answers returns nothing: no default is computed, though the same things read
  // in by default at a setting's shop.
  it('with no stored answers, returns nothing', async () => {
    expect(await readIn(world.playerA, STALL, 1)).toEqual([]);
    expect(await readIn(world.playerA, STALL, 1, ALL)).toEqual([]);
    expect(await readIn(world.gm, STALL, 1)).toEqual([]);
  });

  // Purpose: a stored "in" comes back; a stored "out" and an undecided (reset) one do not; nor a stored "in" on a thing
  // not for sale or not an item (narrowing only).
  it('returns a stored in, never an out or undecided, never a thing not for sale', async () => {
    const DAY = 2;
    expect(await set(STALL, HIDE, 'in', DAY)).toMatchObject({ ok: true });
    expect(await set(STALL, OIL, 'out', DAY)).toMatchObject({ ok: true });
    expect(await set(STALL, REEDS, 'in', DAY)).toMatchObject({ ok: true });
    expect(await as(world.gm, resetStock, { campaignId: world.campaignId, serviceId: STALL, day: DAY, itemIds: [REEDS] })).toMatchObject({ ok: true, value: 1 });
    expect(await set(STALL, WAND, 'in', DAY)).toMatchObject({ ok: true });
    expect(await set(STALL, 'nr-no-such-thing', 'in', DAY)).toMatchObject({ ok: true });
    expect(await readIn(world.playerA, STALL, DAY)).toEqual([HIDE]);
    expect(await readIn(world.gm, STALL, DAY)).toEqual([HIDE]);
  });

  // Purpose: the device's offered list changes nothing for a place: key: it neither narrows nor adds.
  it('ignores the device’s offered list', async () => {
    const DAY = 2;
    expect(await readIn(world.playerA, STALL, DAY, [OIL, REEDS])).toEqual([HIDE]);
    expect(await readIn(world.playerA, STALL, DAY, [])).toEqual([HIDE]);
    expect(await readIn(world.playerA, STALL, DAY, ALL)).toEqual([HIDE]);
  });

  // Purpose: a setting's service key reads exactly as before: a default-in thing with no row comes back, the
  // device's list narrows, and a stored out hides a thing.
  it('a setting’s shop reads as before', async () => {
    const DAY = 3;
    expect(await readIn(world.playerA, GENERIC, DAY, ALL)).toEqual([HIDE, OIL].sort());
    expect(await readIn(world.playerA, GENERIC, DAY, [OIL])).toEqual([OIL]);
    expect(await set(GENERIC, OIL, 'out', DAY)).toMatchObject({ ok: true });
    expect(await readIn(world.playerA, GENERIC, DAY, ALL)).toEqual([HIDE]);
  });

  // Purpose: an outsider reads nothing at a pack's shop, even a thing the GM stored as in.
  it('an outsider reads nothing', async () => {
    expect(await readIn(world.outsider, STALL, 2)).toEqual([]);
    expect(await readIn(world.outsider, STALL, 2, ALL)).toEqual([]);
  });
});
