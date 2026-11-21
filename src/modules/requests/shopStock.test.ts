// A shop's stock for the day (W12): the defaults from an item's availability (pure), and the commands and the players'
// reader against the stand-in database (as supabase/tests/dec-3-w12-shop-stock.test.ts checks the real one).
import { describe, expect, it } from 'vitest';
import { runCommand } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { latestChange, undoChange } from '../../core/undo.ts';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { readClock } from '../expedition/clock.ts';
import { WITHOUT_AVAILABILITY, answerInForce, hasChance, loadStockInForPlayer, loadStockLines, readAvailability, resetStock, setStock, stockDefault } from './shopStock.ts';

describe('what a thing reads as before the GM answers (stockDefault)', () => {
  // Purpose: a thing with no availability at all reads as in stock (w12-2), and the case sits in one named place.
  it('no availability at all: in, by the ruled default; the case can be read either way', () => {
    expect(WITHOUT_AVAILABILITY).toBe('in');
    expect(stockDefault(undefined, 'Village')).toBe('in');
    expect(stockDefault(null, null)).toBe('in');
    expect(stockDefault({}, 'Village')).toBe('in');
    expect(stockDefault('a string', 'Village')).toBe('in');
    // The other way, should the ruling change: only this case moves.
    expect(stockDefault(undefined, 'Village', 'undecided')).toBe('undecided');
    expect(stockDefault({ chance: 'always' }, 'Village', 'undecided')).toBe('in');
  });

  // Purpose: a chance of "always" reads in; an "x-in-y" chance reads undecided.
  it('a chance: "always" is in, "3-in-6" is undecided', () => {
    expect(stockDefault({ chance: 'always' }, null)).toBe('in');
    expect(stockDefault({ chance: 'Always' }, null)).toBe('in');
    expect(stockDefault({ chance: '3-in-6' }, 'Village')).toBe('undecided');
  });

  // Purpose: sold by size: in a listed size it is in, in another size out, in a town of unknown size undecided (tn-6).
  it('sold by size: listed size in, another size out, unknown size undecided', () => {
    const a = { where: ['Town', 'City'] };
    expect(stockDefault(a, 'Town')).toBe('in');
    expect(stockDefault(a, 'city')).toBe('in');
    expect(stockDefault(a, 'Hamlet')).toBe('out');
    expect(stockDefault(a, null)).toBe('undecided');
    expect(stockDefault(a, '')).toBe('undecided');
    // Not sold in this size wins over any chance.
    expect(stockDefault({ where: ['City'], chance: 'always' }, 'Hamlet')).toBe('out');
    // tn-6 before a chance: sold by size in a town of unknown size is undecided, even with "always".
    expect(stockDefault({ where: ['Town'], chance: 'always' }, null)).toBe('undecided');
    // A listed size with a chance follows the chance.
    expect(stockDefault({ where: ['Town'], chance: 'always' }, 'Town')).toBe('in');
    expect(stockDefault({ where: ['Town'], chance: '2-in-6' }, 'Town')).toBe('undecided');
  });

  // Purpose: only a rarity, or only a note, leaves the thing undecided.
  it('only a rarity or only a note: undecided', () => {
    expect(stockDefault({ rarity: 'Rare' }, 'Town')).toBe('undecided');
    expect(stockDefault({ note: 'Only from the travelling tinker' }, 'Town')).toBe('undecided');
  });

  // Purpose: the object is read safely, and "has a chance" means an x-in-y chance only (what Reset puts back).
  it('reads the object safely; a chance to decide is x-in-y only', () => {
    expect(readAvailability({ where: ['Town', 3, ''], chance: ' 1-in-6 ' })).toEqual({ where: ['Town'], chance: '1-in-6', rarity: '', note: '' });
    expect(hasChance({ chance: '1-in-6' })).toBe(true);
    expect(hasChance({ chance: 'always' })).toBe(false);
    expect(hasChance({ where: ['Town'] })).toBe(false);
    expect(hasChance(undefined)).toBe(false);
  });

  // Purpose: a stored answer always wins over the default.
  it('the stored answer wins over the default', () => {
    expect(answerInForce('out', 'in')).toBe('out');
    expect(answerInForce('undecided', 'in')).toBe('undecided');
    expect(answerInForce(null, 'in')).toBe('in');
  });

  // Purpose: the day is the clock's day as the app counts it (readClock), so a new day starts a new key.
  it('the day comes from readClock', () => {
    const units = { day: 86_400, hour: 3_600, turn: 600, round: 10 };
    expect(readClock(0, units).day).toBe(1);
    expect(readClock(86_400 * 2 + 5, units).day).toBe(3);
  });
});

describe('the record in the stand-in database', () => {
  const registry = createAppRegistry();
  const base = { campaignId: '', serviceId: 'svc-general', day: 1 };
  async function setup() {
    const fake = createFakeDb();
    const gmId = fake.addPerson('gm@example.test');
    const playerId = fake.addPerson('player@example.test');
    const outsiderId = fake.addPerson('outsider@example.test');
    const camp = fake.addCampaign('Fen', gmId);
    fake.addMember(camp, playerId, 'player');
    const other = fake.addCampaign('Other', outsiderId);
    // The campaign's pack: a thing with no availability (in), a chance thing (undecided), an "always" thing (in), a thing
    // sold by size (undecided: no size known), and a magic thing (not for sale). Another campaign has one of its own.
    fake.tables.packs.push({ id: 'pack-fen', kind: 'setting', owner_user_id: gmId, campaign_id: null }, { id: 'pack-other', kind: 'setting', owner_user_id: outsiderId, campaign_id: null });
    fake.tables.campaign_packs.push({ id: 'cp-fen', campaign_id: camp, pack_id: 'pack-fen', priority: 0 }, { id: 'cp-other', campaign_id: other, pack_id: 'pack-other', priority: 0 });
    const item = (pack: string, id: string, data: Record<string, unknown>) => ({ id: `entry-${id}`, pack_id: pack, kind: 'item', pack_entry_id: id, name: id, data: { category: 'gear', ...data } });
    fake.tables.library_entries.push(
      item('pack-fen', 'lantern', {}),
      item('pack-fen', 'rope', { availability: { chance: '3-in-6' } }),
      item('pack-fen', 'eel-trap', { availability: { chance: 'always' } }),
      item('pack-fen', 'cart', { availability: { where: ['Town'] } }),
      item('pack-fen', 'wand', { category: 'magic-wand', availability: { chance: 'always' } }),
      item('pack-other', 'far-lamp', {}),
      // Its availability kept GM-only (the hidden part): sold only in a city.
      item('pack-fen', 'cloak', {}),
    );
    // Not for sale, said GM-only (the readable part says nothing, which alone would read for sale and in).
    fake.tables.library_entries.push(item('pack-fen', 'charm', {}));
    fake.tables.library_entry_secrets.push(
      { id: 'entry-cloak', pack_id: 'pack-fen', data: { availability: { where: ['City'] } } },
      { id: 'entry-charm', pack_id: 'pack-fen', data: { forSale: false } },
    );
    const db = fake.db as unknown as Db;
    const gm = { id: gmId, roles: { [camp]: 'gm' as const } };
    const player = { id: playerId, roles: { [camp]: 'player' as const } };
    base.campaignId = camp;
    return { fake, db, gm, player, gmId, playerId, outsiderId };
  }

  // Purpose: a player reads an in line and never an out or undecided one; the GM reads all three; an outsider nothing.
  it('the GM reads every line; a player only the in lines; an outsider none', async () => {
    const w = await setup();
    w.fake.signInAs(w.gmId);
    for (const [itemId, answer] of [['lantern', 'in'], ['rope', 'out'], ['eel-trap', 'in']] as const) {
      expect(await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId, answer })).toMatchObject({ ok: true });
    }
    expect(await runCommand(registry, w.db, w.gm, resetStock, { ...base, itemIds: ['eel-trap'] })).toMatchObject({ ok: true, value: 1 });
    expect((await loadStockLines(w.db, base.campaignId, 'svc-general', 1))?.map((l) => [l.itemId, l.answer]).sort()).toEqual([['eel-trap', 'undecided'], ['lantern', 'in'], ['rope', 'out']]);
    w.fake.signInAs(w.playerId);
    expect((await loadStockLines(w.db, base.campaignId, 'svc-general', 1))?.map((l) => l.itemId)).toEqual([]);
    // eel-trap reads in by default, but its stored undecided row hides it.
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1)).toEqual(['lantern']);
    w.fake.signInAs(w.outsiderId);
    expect(await loadStockLines(w.db, base.campaignId, 'svc-general', 1)).toEqual([]);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['lantern'])).toEqual([]);
  });

  // Purpose: the reader works the default out itself: a default-in thing with no row comes back; one the GM set out
  // never does, whatever the device offers and even after its default flips; the device's list only narrows; a forged
  // id (not for sale, unknown, another campaign's) comes back as nothing.
  it("the players' reader: the server's default, the GM's answer wins, offered only narrows", async () => {
    const w = await setup();
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1)).toEqual(['eel-trap', 'lantern']);
    w.fake.signInAs(w.gmId);
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'lantern', answer: 'out' });
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'rope', answer: 'out' });
    // rope's default flips to "always": the GM's out still wins.
    const rope = w.fake.tables.library_entries.find((e) => e.pack_entry_id === 'rope')!;
    rope.data = { category: 'gear', availability: { chance: 'always' } };
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1)).toEqual(['eel-trap']);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['lantern', 'rope'])).toEqual([]);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['eel-trap', 'cart'])).toEqual(['eel-trap']);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['wand', 'no-such-thing', 'far-lamp'])).toEqual([]);
  });

  // Purpose: an availability the pack keeps GM-only still decides the default (sold only in a city: not in, with no
  // row), and the reader gives back only ids.
  it("the players' reader: a GM-only availability still decides", async () => {
    const w = await setup();
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['cloak'])).toEqual([]);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1)).not.toContain('cloak');
  });

  // Purpose: a GM-only forSale: false keeps a thing off the players' list, even though it would read in by default.
  it("the players' reader: a GM-only forSale: false keeps it off", async () => {
    const w = await setup();
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['charm', 'lantern'])).toEqual(['lantern']);
  });

  // Purpose: a pack's shop (a `place:` key; sh-1 a) reads only the GM's stored "in" answers for the day: nothing with no
  // answers (no default, though the same things read in at a setting's shop), never an out or undecided, never a thing
  // not for sale (narrowing only), the device's list ignored, and nothing for an outsider.
  it("the players' reader: a pack's shop reads only the GM's stored in", async () => {
    const w = await setup();
    const stall = { ...base, serviceId: 'place:entry-stall' };
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1)).toEqual([]);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1, ['lantern', 'eel-trap'])).toEqual([]);
    w.fake.signInAs(w.gmId);
    expect(await runCommand(registry, w.db, w.gm, setStock, { ...stall, itemId: 'rope', answer: 'in' })).toMatchObject({ ok: true });
    await runCommand(registry, w.db, w.gm, setStock, { ...stall, itemId: 'lantern', answer: 'out' });
    await runCommand(registry, w.db, w.gm, setStock, { ...stall, itemId: 'cart', answer: 'in' });
    await runCommand(registry, w.db, w.gm, resetStock, { ...stall, itemIds: ['cart'] });
    // Narrowing only: a stored in on a thing not for sale (wand; charm, GM-only), or not an item at all, stays hidden.
    for (const itemId of ['wand', 'charm', 'no-such-thing']) await runCommand(registry, w.db, w.gm, setStock, { ...stall, itemId, answer: 'in' });
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1)).toEqual(['rope']);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1, ['lantern'])).toEqual(['rope']);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1, [])).toEqual(['rope']);
    // A setting's shop still reads as before.
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1)).toEqual(['eel-trap', 'lantern']);
    w.fake.signInAs(w.outsiderId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, stall.serviceId, 1)).toEqual([]);
  });

  // Purpose: the device's list is capped at 2000 ids, as Reset's is.
  it("the players' reader refuses more than 2000 offered ids", async () => {
    const w = await setup();
    w.fake.signInAs(w.playerId);
    const many = Array.from({ length: 2001 }, (_, i) => `thing-${i}`);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, many)).toBeNull();
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, many.slice(0, 2000))).toEqual([]);
  });

  // Purpose: a player can't set or reset, by the command or straight at the table.
  it("a player can't write", async () => {
    const w = await setup();
    w.fake.signInAs(w.playerId);
    expect(await runCommand(registry, w.db, w.player, setStock, { ...base, itemId: 'lantern', answer: 'in' })).toMatchObject({ ok: false });
    expect(await runCommand(registry, w.db, w.player, resetStock, { ...base, itemIds: ['lantern'] })).toMatchObject({ ok: false });
    expect((await w.db.rpc('set_shop_stock', { campaign: base.campaignId, service: 'svc-general', item: 'lantern', on_day: 1, answer: 'in' })).error).not.toBeNull();
    expect(w.fake.tables.shop_stock).toEqual([]);
  });

  // Purpose: set then Undo puts the thing back as it was (no row: its default; a row: its answer, undecided included).
  it('set and Undo; reset and Undo', async () => {
    const w = await setup();
    w.fake.signInAs(w.gmId);
    const undoLast = async (type: string) => {
      const eventId = await latestChange(w.db, base.campaignId, type, w.gmId);
      return runCommand(registry, w.db, w.gm, undoChange, { campaignId: base.campaignId, eventId: eventId!, authorUserId: w.gmId });
    };
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'lantern', answer: 'in' });
    expect(await undoLast('stock.set')).toMatchObject({ ok: true });
    expect(await loadStockLines(w.db, base.campaignId, 'svc-general', 1)).toEqual([]);
    expect(w.fake.tables.shop_stock).toHaveLength(1);
    // Undecided, then in, then Undo: undecided again.
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'rope', answer: 'out' });
    await runCommand(registry, w.db, w.gm, resetStock, { ...base, itemIds: ['rope'] });
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'rope', answer: 'in' });
    expect(await undoLast('stock.set')).toMatchObject({ ok: true });
    expect((await loadStockLines(w.db, base.campaignId, 'svc-general', 1))?.map((l) => [l.itemId, l.answer])).toEqual([['rope', 'undecided']]);
    expect(await undoLast('stock.reset')).toMatchObject({ ok: true });
    expect((await loadStockLines(w.db, base.campaignId, 'svc-general', 1))?.map((l) => [l.itemId, l.answer])).toEqual([['rope', 'out']]);
  });

  // Purpose: a new day reads clean, and yesterday's rows are still there.
  it('a new day reads clean; yesterday stays', async () => {
    const w = await setup();
    w.fake.signInAs(w.gmId);
    await runCommand(registry, w.db, w.gm, setStock, { ...base, itemId: 'lantern', answer: 'out' });
    expect(await loadStockLines(w.db, base.campaignId, 'svc-general', 2)).toEqual([]);
    expect((await loadStockLines(w.db, base.campaignId, 'svc-general', 1))?.map((l) => l.itemId)).toEqual(['lantern']);
    w.fake.signInAs(w.playerId);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 1, ['lantern'])).toEqual([]);
    expect(await loadStockInForPlayer(w.db, base.campaignId, 'svc-general', 2, ['lantern'])).toEqual(['lantern']);
  });
});
