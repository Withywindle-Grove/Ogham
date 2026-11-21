// A shop's stock for the day (W12; docs/plans/dec-3-the-whole-town.md row W12; brief
// docs/plans/briefs/dec-3-w12-day-stock-brief.md; Francis's yes w12-1 and w12-2; migration 20261115110000).
// TEST project or CI's local database; invented content. What it checks:
//   * a player reads an in line and never an out or undecided one: not its row, not its thing's id, not in the log;
//     the GM reads all three; an outsider, and the GM of another campaign, read nothing;
//   * a player can't write: by the command, by the functions called straight, or at the table; nor can the GM write
//     the table straight;
//   * set and Undo (a new row marked undone; a changed row put back, undecided included); reset and Undo;
//   * a new day reads clean and yesterday's rows are still there;
//   * the players' reader works the answer in force out itself: a default-in thing with no row comes back; a stored
//     out or undecided row hides it, whatever the device offers and even after the default flips; the device's list
//     only narrows; a forged id (not for sale, unknown, another campaign's) comes back as nothing;
//   * a GM-only availability and a GM-only forSale: false still decide (the reader reads the whole entry);
//   * parity, two ways: (a) private.stock_default called directly (through shop_stock_default_check, the service
//     role's) gives the same answer as stockDefault (in, out or undecided) for every shape and every town size (none,
//     a listed one, an unlisted one); (b) the reader, on a day with no rows, returns exactly the things whose
//     stockDefault is in with no size, so the reader feeds the default the item's real availability.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadStockInForPlayer, loadStockLines, resetStock, setStock, stockDefault } from '../../src/modules/requests/shopStock.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const SHOP = 'w12-general-goods';
// Thing ids no other test uses, so the log and the rows are this file's own.
const LANTERN = 'w12-lantern';
const ROPE = 'w12-rope';
const EEL_TRAP = 'w12-eel-trap';
const WAND = 'w12-wand';
const FAR_LAMP = 'w12-far-lamp';
// Its availability kept GM-only by its pack (`gmOnly`): sold only in a city.
const CLOAK = 'w12-city-cloak';
// Not for sale, said GM-only (`gmOnly: ['forSale']`); with no availability it would read in.
const CHARM = 'w12-charm';

// Every shape of `availability` the default reads, by item id (the parity check runs each through both functions).
const SHAPES: Record<string, unknown> = {
  [LANTERN]: undefined,
  [ROPE]: { chance: '3-in-6' },
  [EEL_TRAP]: { chance: 'always' },
  'w12-p-empty': {},
  'w12-p-caps': { chance: 'Always' },
  'w12-p-size': { where: ['Town', 'City'] },
  'w12-p-size-always': { where: ['Town'], chance: 'always' },
  'w12-p-size-chance': { where: ['Town'], chance: '1-in-6' },
  'w12-p-blank-size': { where: ['', ' '], chance: ' always ' },
  'w12-p-rarity': { rarity: 'Rare' },
  'w12-p-note': { note: 'Only from the travelling tinker' },
  // Whitespace JavaScript's trim() takes off and Postgres's btrim() would not: tab, line feed, no-break space.
  'w12-p-tab': { chance: '\talways\t' },
  'w12-p-newline': { where: ['\nTown\n'], chance: 'always\n' },
  'w12-p-nbsp': { chance: ' always ' },
  'w12-p-blank-nbsp': { where: [' ', '\t'], note: ' ' },
};
// The town sizes the direct parity check uses: none known, a listed one, an unlisted one.
const SIZES = [null, 'Town', 'Hamlet'] as const;
const ALL_IDS = [...Object.keys(SHAPES), WAND];

let packId = '';
let otherPackId = '';
async function makePack(person: Person, name: string, items: Record<string, unknown>[]) {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name, version: '0.1' }, items }));
  if (!read.ok) throw new Error(read.message);
  const made = await as(person, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

beforeAll(async () => {
  world = await buildWorld();
  const items: Record<string, unknown>[] = Object.entries(SHAPES).map(([id, availability]) => ({ id, name: id, category: 'gear', ...(availability === undefined ? {} : { availability }) }));
  // Not for sale: a magic thing, "always" in stock if it were.
  items.push({ id: WAND, name: WAND, category: 'magic-wand', availability: { chance: 'always' } });
  items.push({ id: CLOAK, name: CLOAK, category: 'gear', availability: { where: ['City'] }, gmOnly: ['availability'] });
  items.push({ id: CHARM, name: CHARM, category: 'gear', forSale: false, gmOnly: ['forSale'] });
  packId = await makePack(world.gm, 'W12 fen goods', items);
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  // Another campaign's thing, in stock by default there.
  otherPackId = await makePack(world.gm, 'W12 barrow goods', [{ id: FAR_LAMP, name: FAR_LAMP, category: 'gear' }]);
  await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId: otherPackId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const set = (itemId: string, answer: 'in' | 'out', day = 1, campaignId = world.campaignId) => as(world.gm, setStock, { campaignId, serviceId: SHOP, itemId, day, answer });
// What a player reads, narrowed to this file's things (the world's campaign may use other packs too).
const readIn = async (person: Person, day: number, offered?: string[]) => ((await loadStockInForPlayer(asDb(person), world.campaignId, SHOP, day, offered ?? ALL_IDS)) ?? []);
const reset = (itemIds: string[], day = 1) => as(world.gm, resetStock, { campaignId: world.campaignId, serviceId: SHOP, day, itemIds });
const answersAs = async (person: Person, day = 1) => ((await loadStockLines(asDb(person), world.campaignId, SHOP, day)) ?? []).map((l) => [l.itemId, l.answer]).sort();
const rawAs = async (person: Person) => JSON.stringify(must(await person.db.from('shop_stock').select('*').eq('campaign_id', world.campaignId)));
const logAs = async (person: Person) => JSON.stringify(must(await person.db.from('events').select('type, before, after').eq('campaign_id', world.campaignId).eq('target_table', 'shop_stock')));
async function undoLast(type: string) {
  const line = must(await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!;
  return as(world.gm, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id });
}

describe('who reads the day\'s stock (hard rule 5; w12-1)', () => {
  // Purpose: with a thing in, one out and one undecided, the GM reads all three and a player only the in one: no row,
  // no id and no log line of the others; an outsider and another campaign's GM read nothing.
  it('the GM reads all three; a player the in line only; outsiders nothing', async () => {
    expect(await set(LANTERN, 'in')).toMatchObject({ ok: true });
    expect(await set(ROPE, 'out')).toMatchObject({ ok: true });
    expect(await set(EEL_TRAP, 'in')).toMatchObject({ ok: true });
    expect(await reset([EEL_TRAP])).toMatchObject({ ok: true, value: 1 });
    expect(await answersAs(world.gm)).toEqual([[EEL_TRAP, 'undecided'], [LANTERN, 'in'], [ROPE, 'out']]);
    for (const player of [world.playerA, world.playerB]) {
      expect(await answersAs(player)).toEqual([]);
      const raw = await rawAs(player);
      expect(raw).not.toContain(ROPE);
      expect(raw).not.toContain(EEL_TRAP);
      // The lines are the GM's alone (the brief's item 6, open as a flag): a player reads none of them.
      expect(await logAs(player)).toBe('[]');
    }
    for (const person of [world.outsider]) {
      expect(await rawAs(person)).toBe('[]');
      expect(await readIn(person, 1, [LANTERN])).toEqual([]);
    }
  });

  // Purpose: a row the other campaign's GM writes there is that campaign's: read as this campaign's GM and players,
  // nothing of it comes back (rows, ids or the reader).
  it("another campaign's rows aren't this one's", async () => {
    expect(await set(FAR_LAMP, 'in', 1, world.otherCampaignId)).toMatchObject({ ok: true });
    expect(JSON.stringify(must(await world.gm.db.from('shop_stock').select('*').eq('campaign_id', world.campaignId)))).not.toContain(FAR_LAMP);
    expect(await readIn(world.gm, 1, [FAR_LAMP])).toEqual([]);
    for (const player of [world.playerA, world.playerB]) {
      expect(JSON.stringify(must(await player.db.from('shop_stock').select('*')))).not.toContain(FAR_LAMP);
      expect(await readIn(player, 1, [FAR_LAMP])).toEqual([]);
    }
    expect(must(await world.outsider.db.from('shop_stock').select('id'))).toEqual([]);
  });
});

describe('who writes it', () => {
  // Purpose: a player can't set or reset, through the command or the functions called straight.
  it("a player can't set or reset", async () => {
    expect(await as(world.playerA, setStock, { campaignId: world.campaignId, serviceId: SHOP, itemId: ROPE, day: 1, answer: 'in' })).toMatchObject({ ok: false });
    const direct = await world.playerA.db.rpc('set_shop_stock', { campaign: world.campaignId, service: SHOP, item: ROPE, on_day: 1, answer: 'in' });
    expect(direct.error?.code).toBe('42501');
    const reseted = await world.playerA.db.rpc('reset_shop_stock', { campaign: world.campaignId, service: SHOP, on_day: 1, items: [LANTERN] });
    expect(reseted.error?.code).toBe('42501');
    expect(await answersAs(world.gm)).toEqual([[EEL_TRAP, 'undecided'], [LANTERN, 'in'], [ROPE, 'out']]);
  });

  // Purpose: nobody writes the table straight, the GM included (only the functions and an undo do).
  it('nobody writes the table straight', async () => {
    for (const person of [world.playerA, world.gm]) {
      const inserted = await person.db.from('shop_stock').insert({ campaign_id: world.campaignId, service_id: SHOP, item_id: 'w12-sneaky', day: 1, answer: 'in' });
      expect(inserted.error).not.toBeNull();
      await person.db.from('shop_stock').update({ answer: 'in' }).eq('campaign_id', world.campaignId).eq('item_id', ROPE);
    }
    expect(await answersAs(world.gm)).toEqual([[EEL_TRAP, 'undecided'], [LANTERN, 'in'], [ROPE, 'out']]);
  });
});

describe('set, reset and Undo', () => {
  // Purpose: Undo of a first answer marks its row undone (never removed): the thing reads as its default again.
  it('Undo of a first answer: the row is marked undone', async () => {
    const OIL = 'w12-lamp-oil';
    expect(await set(OIL, 'in')).toMatchObject({ ok: true });
    expect(await undoLast('stock.set')).toMatchObject({ ok: true });
    expect((await answersAs(world.gm)).map(([id]) => id)).not.toContain(OIL);
    expect(must(await world.admin.from('shop_stock').select('undone').eq('campaign_id', world.campaignId).eq('item_id', OIL))).toEqual([{ undone: true }]);
    // And it can be answered again.
    expect(await set(OIL, 'out')).toMatchObject({ ok: true });
  });

  // Purpose: Undo of a changed answer puts it back, undecided included.
  it('Undo of a change puts the answer back, undecided included', async () => {
    expect(await set(EEL_TRAP, 'in')).toMatchObject({ ok: true });
    expect(await undoLast('stock.set')).toMatchObject({ ok: true });
    expect((await answersAs(world.gm)).find(([id]) => id === EEL_TRAP)).toEqual([EEL_TRAP, 'undecided']);
  });

  // Purpose: reset puts the listed things back on undecided; Undo restores the answers it cleared.
  it('reset and Undo', async () => {
    expect(await reset([LANTERN, ROPE])).toMatchObject({ ok: true, value: 2 });
    expect((await answersAs(world.gm)).filter(([id]) => id === LANTERN || id === ROPE)).toEqual([[LANTERN, 'undecided'], [ROPE, 'undecided']]);
    expect(await answersAs(world.playerA)).toEqual([]);
    expect(await undoLast('stock.reset')).toMatchObject({ ok: true });
    expect((await answersAs(world.gm)).filter(([id]) => id === LANTERN || id === ROPE)).toEqual([[LANTERN, 'in'], [ROPE, 'out']]);
  });
});

describe('a new day, and what a player reads', () => {
  // Purpose: a new day reads clean (no row: every thing at its default), and yesterday's rows are still there.
  it('a new day reads clean; yesterday stays', async () => {
    expect(await answersAs(world.gm, 2)).toEqual([]);
    expect((await answersAs(world.gm, 1)).length).toBeGreaterThan(0);
  });

  // Purpose (a): private.stock_default, called directly, gives the same answer as stockDefault (in, out or undecided)
  // for every shape and every town size: none known, a listed one, an unlisted one.
  it('parity (a): private.stock_default and stockDefault give the same answer, every shape and size', async () => {
    const got: string[] = [];
    const want: string[] = [];
    for (const [id, availability] of Object.entries(SHAPES)) {
      for (const size of SIZES) {
        const { data, error } = await world.admin.rpc('shop_stock_default_check', { availability: availability ?? null, ...(size === null ? {} : { town_size: size }) });
        expect(error).toBeNull();
        got.push(`${id} @ ${String(size)}: ${String(data)}`);
        want.push(`${id} @ ${String(size)}: ${stockDefault(availability, size)}`);
      }
    }
    expect(got).toEqual(want);
    // All three answers are exercised.
    expect(new Set(want.map((line) => line.split(': ')[1]))).toEqual(new Set(['in', 'out', 'undecided']));
  });

  // Purpose: a player can't call the check (the service role's alone).
  it('parity check is the service role\'s alone', async () => {
    const { error } = await world.playerA.db.rpc('shop_stock_default_check', { availability: null });
    expect(error).not.toBeNull();
  });

  // Purpose (b): the reader feeds the default the item's real availability: on a day with no rows, a player reads
  // exactly the for-sale things whose stockDefault (town size unknown) is in.
  it('parity (b): the reader returns exactly the things stockDefault says are in', async () => {
    const expected = Object.entries(SHAPES).filter(([, a]) => stockDefault(a, null) === 'in').map(([id]) => id).sort();
    expect(await readIn(world.playerA, 10)).toEqual(expected);
  });

  // Purpose: a default-in thing with no row comes back; an undecided stored row hides a default-in thing; a thing the
  // GM set out never comes back, whatever the device offers and even after its default flips; the device's list only
  // narrows; a forged id (not for sale, unknown, another campaign's) comes back as nothing.
  it("the players' reader works the answer out itself", async () => {
    const DAY = 4;
    expect(await readIn(world.playerA, DAY, [LANTERN, EEL_TRAP])).toEqual([EEL_TRAP, LANTERN].sort());
    expect(await set(LANTERN, 'out', DAY)).toMatchObject({ ok: true });
    expect(await set(EEL_TRAP, 'in', DAY)).toMatchObject({ ok: true });
    expect(await reset([EEL_TRAP], DAY)).toMatchObject({ ok: true, value: 1 });
    expect(await set(ROPE, 'out', DAY)).toMatchObject({ ok: true });
    expect(await readIn(world.playerA, DAY, [LANTERN, EEL_TRAP, ROPE])).toEqual([]);
    // ROPE's default flips to "always" (its pack entry changed): the GM's out still wins.
    const rope = must(await world.admin.from('library_entries').select('id, data').eq('pack_id', packId).eq('pack_entry_id', ROPE))[0]!;
    must(await world.admin.from('library_entries').update({ data: { ...(rope.data as Record<string, unknown>), availability: { chance: 'always' } } }).eq('id', rope.id).select());
    expect(await readIn(world.playerA, DAY, [ROPE])).toEqual([]);
    // ...and on a day without a row it is now in by default.
    expect(await readIn(world.playerA, DAY + 1, [ROPE])).toEqual([ROPE]);
    // Forged ids: not for sale, unknown, another campaign's.
    expect(await readIn(world.playerA, DAY, [WAND, 'w12-no-such-thing', FAR_LAMP])).toEqual([]);
    // The device's list never adds: an empty list reads nothing.
    expect(await readIn(world.playerA, DAY, [])).toEqual([]);
  });

  // Purpose: an availability the pack keeps GM-only still decides the default: with no row, a player does not get a
  // thing sold only in a city (the readable part has no availability, which alone would read in); its availability
  // never reaches the player.
  it('a GM-only availability still decides', async () => {
    const rows = must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId).eq('pack_entry_id', CLOAK));
    // The player can read the entry itself (it is for sale)...
    expect(rows).toHaveLength(1);
    // ...but not its availability.
    expect(JSON.stringify(rows)).not.toContain('City');
    expect(await readIn(world.playerA, 20, [CLOAK])).toEqual([]);
    expect(await readIn(world.playerA, 20, [CLOAK, LANTERN])).toEqual([LANTERN]);
  });

  // Purpose: a GM-only forSale: false keeps a thing off the players' list, though with no availability it would read
  // in, and its readable part carries no forSale value.
  it('a GM-only forSale: false keeps it off', async () => {
    const rows = must(await world.admin.from('library_entries').select('data').eq('pack_id', packId).eq('pack_entry_id', CHARM));
    expect(rows).toHaveLength(1);
    expect((rows[0]!.data as Record<string, unknown>).forSale).toBeUndefined();
    expect(await readIn(world.playerA, 21, [CHARM, LANTERN])).toEqual([LANTERN]);
  });

  // Purpose: the device's list is capped at 2000 ids, as Reset's is.
  it('refuses more than 2000 offered ids', async () => {
    const many = Array.from({ length: 2001 }, (_, i) => `w12-many-${i}`);
    const { error } = await world.playerA.db.rpc('shop_stock_in', { campaign: world.campaignId, service: SHOP, on_day: 1, offered: many });
    expect(error?.message).toBe("That's too many things at once.");
  });
});
