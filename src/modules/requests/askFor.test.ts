// Ask for… answered at once (town row TC12, the stack's W10a; tn-7, tn-8) against the stand-in database, as
// supabase/tests/dec-16-tc12-ask-at-once.test.ts checks the real one. Invented things only. In plain words:
//   * a thing the GM set in today is answered at once, "In stock" at its price, with no card waiting for the GM;
//   * a thing the GM set out today is answered at once, "Not here";
//   * a thing with no stored answer reads its default (a setting's shop): "always" in is answered, a chance waits;
//   * an undecided thing, one not in the list, or Something not listed… still reaches the GM, waiting;
//   * a later flip in the stock table does not unsend the answer;
//   * a day before the newest stocked day is never answered at once (a device can't name a past day);
//   * the answer is one log line, the player's, saying what was answered;
//   * a player can't ask as another player's character;
//   * a shop not shown, closed, or not in the town the group is in answers nothing at once (review fix, hard rule 5);
//   * the price said is the entry's, never the device's prompt (review fix);
//   * a thing not for sale is never answered at once, Not here included (review fix: as stock_answer_for).
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand } from '../../core/commands.ts';
import { describeEntry, type LogEvent } from '../../core/events.ts';
import type { Db } from '../../core/supabase.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { setStock } from './shopStock.ts';
import { askFor, type BuyPrompt } from './townRequests.ts';

const registry = createAppRegistry();
const SHOP = 'tc12-chandler';
// Review fix, round 1: shops the group can't use here. Shown but closed; listed but hidden; shown and open in a town the
// group has left.
const CLOSED = 'tc12-net-loft';
const HIDDEN = 'tc12-back-room';
const ELSEWHERE = 'tc12-far-stall';

function setup() {
  const fake = createFakeDb();
  const gmId = fake.addPerson('gm@example.test');
  const playerId = fake.addPerson('player@example.test');
  const otherPlayerId = fake.addPerson('other@example.test');
  const camp = fake.addCampaign('Reedmouth', gmId);
  const wren = fake.addCharacter(camp, 'Wren', { ownerId: playerId });
  fake.addMember(camp, playerId, 'player', wren);
  fake.addMember(camp, otherPlayerId, 'player');
  fake.tables.packs.push({ id: 'pack-fen', kind: 'setting', owner_user_id: gmId, campaign_id: null });
  fake.tables.campaign_packs.push({ id: 'cp-fen', campaign_id: camp, pack_id: 'pack-fen', priority: 0 });
  const item = (id: string, data: Record<string, unknown>) => ({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'item', pack_entry_id: id, name: id, data: { category: 'gear', value: { herons: 2 }, ...data } });
  fake.tables.library_entries.push(
    item('lamp-oil', { availability: { chance: '3-in-6' } }),
    item('rope', { availability: { chance: '3-in-6' } }),
    item('eel-trap', { availability: { chance: 'always' } }),
    item('spyglass', { availability: { chance: '1-in-6' } }),
    item('reed-charm', { availability: { chance: 'always' }, forSale: false }),
  );
  // The group's town: an expedition under way, its visit to Reedmouth Quay (Safe), with the Chandler shown and open.
  // An earlier visit, moved on from, was to Saltmarsh Cross, where the far stall is shown and open.
  const shop = (name: string, shown: boolean, open: boolean) => ({ name, kind: 'shop', shown, open });
  fake.tables.expeditions.push({ id: 'trip', campaign_id: camp, ended_at: null, undone: false, created_at: '2026-11-01T10:00:00Z' });
  fake.tables.places.push(
    {
      id: 'quay', campaign_id: camp, name: 'Reedmouth Quay', description: '', version: 1, undone: false, safety: 'safe', settlement: null,
      town: { [`service:${SHOP}`]: shop('The Chandler', true, true), [`service:${CLOSED}`]: shop('The Net Loft', true, false), [`service:${HIDDEN}`]: shop('The Back Room', false, true) },
    },
    { id: 'cross', campaign_id: camp, name: 'Saltmarsh Cross', description: '', version: 1, undone: false, safety: 'safe', settlement: null, town: { [`service:${ELSEWHERE}`]: shop('The Far Stall', true, true) } },
  );
  fake.tables.group_places.push(
    { id: 'visit-cross', campaign_id: camp, expedition_id: 'trip', group_number: 1, place_id: 'cross', shown: false, moved_on: true, undone: false, created_at: '2026-11-01T11:00:00Z' },
    { id: 'visit-quay', campaign_id: camp, expedition_id: 'trip', group_number: 1, place_id: 'quay', shown: false, moved_on: false, undone: false, created_at: '2026-11-01T12:00:00Z' },
  );
  const db = fake.db as unknown as Db;
  const gm = { id: gmId, roles: { [camp]: 'gm' as const } };
  const player = { id: playerId, roles: { [camp]: 'player' as const } };
  const other = { id: otherPlayerId, roles: { [camp]: 'player' as const } };
  const character = { id: wren, campaignId: camp, ownerUserId: playerId };
  return { fake, db, gm, player, other, gmId, playerId, otherPlayerId, camp, character };
}

const prompt = (itemId: string | null, item = itemId ?? 'A bell', price = '2 herons', serviceId = SHOP): BuyPrompt => ({ serviceId, shop: 'The Chandler', itemId, item, price });

async function set(w: ReturnType<typeof setup>, itemId: string, answer: 'in' | 'out', day = 1, serviceId = SHOP) {
  w.fake.signInAs(w.gmId);
  expect(await runCommand(registry, w.db, w.gm, setStock, { campaignId: w.camp, serviceId, itemId, day, answer })).toMatchObject({ ok: true });
}

async function ask(w: ReturnType<typeof setup>, p: BuyPrompt, day = 1) {
  w.fake.signInAs(w.playerId);
  const done = await runCommand(registry, w.db, w.player, askFor, { character: w.character, text: `${p.item}, The Chandler`, day, prompt: p });
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

describe('Ask for… answered at once (TC12)', () => {
  // Purpose (tn-7): a thing the GM set in today is answered at once, In stock at its price; the GM gets no card.
  it('a thing set in today: In stock at once', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    const r = await ask(w, prompt('lamp-oil'));
    expect(r.status).toBe('answered');
    expect(r.answer).toEqual({ kind: 'buy', result: 'inStock', price: '2 herons', note: '' });
  });

  // Purpose (tn-7): a thing the GM set out today is answered at once, Not here.
  it('a thing set out today: Not here at once', async () => {
    const w = setup();
    await set(w, 'rope', 'out');
    const r = await ask(w, prompt('rope'));
    expect(r.status).toBe('answered');
    expect(r.answer).toEqual({ kind: 'buy', result: 'notHere', price: '', note: '' });
  });

  // Purpose (tn-7): with no stored answer, the default decides at a setting's shop: "always" is in; a chance waits.
  it('no stored answer: an "always" thing is answered, a chance thing waits', async () => {
    const w = setup();
    expect((await ask(w, prompt('eel-trap'))).status).toBe('answered');
    expect((await ask(w, prompt('spyglass'))).status).toBe('waiting');
  });

  // Purpose (tn-7): an undecided thing, a thing not in the list, and Something not listed… still reach the GM.
  it('undecided, unlisted and not-listed asks wait for the GM', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    expect((await ask(w, prompt('spyglass'))).status).toBe('waiting');
    expect((await ask(w, prompt('no-such-thing'))).status).toBe('waiting');
    expect((await ask(w, prompt(null, 'A brass bell', ''))).status).toBe('waiting');
  });

  // Purpose: an in-stock thing whose entry says no price waits for the GM, who prices it.
  it('an in-stock thing with no price on its entry waits for the GM', async () => {
    const w = setup();
    w.fake.tables.library_entries.push({ id: 'entry-bell', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'brass-bell', name: 'brass-bell', data: { category: 'gear', availability: { chance: 'always' } } });
    expect((await ask(w, prompt('brass-bell'))).status).toBe('waiting');
  });

  // Purpose (tn-8): a later flip in the stock table does not unsend an answer already given.
  it('a later flip does not unsend the answer', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    const r = await ask(w, prompt('lamp-oil'));
    await set(w, 'lamp-oil', 'out');
    const kept = w.fake.tables.requests.find((row) => row.id === r.id)!;
    expect(kept.status).toBe('answered');
    expect(kept.answer).toMatchObject({ result: 'inStock' });
  });

  // Purpose: a device can't name a past day to learn its answers: a day before the newest stocked day waits.
  it('a past day is never answered at once', async () => {
    const w = setup();
    await set(w, 'rope', 'out', 1);
    await set(w, 'lamp-oil', 'in', 2);
    expect((await ask(w, prompt('rope'), 1)).status).toBe('waiting');
    expect((await ask(w, prompt('lamp-oil'), 2)).status).toBe('answered');
  });

  // Purpose (tn-8): the answer is one log line, the player's, naming what was answered.
  it('one log line says what was answered', async () => {
    const w = setup();
    await set(w, 'rope', 'out');
    await ask(w, prompt('rope'));
    const lines = w.fake.tables.events.filter((e) => e.type === 'town.askFor');
    expect(lines).toHaveLength(1);
    const after = lines[0]!.after as Record<string, unknown>;
    const main: LogEvent = { id: 'e1', seq: 1, type: 'town.askFor', level: 'simple', actorUserId: w.playerId, targetTable: 'requests', targetId: String(after.id), before: null, after, fiat: false, reason: null, revertsEventId: null, requestId: null, createdAt: '' };
    const none = new Map<string, string>();
    const said = describeEntry({ main, events: [main] }, { me: w.playerId, people: none, characters: new Map([[w.character.id, 'Wren']]), companies: none, fields: none, packs: none, items: none, places: none });
    expect(said).toContain('Not here');
    expect(said).toContain('Wren');
  });

  // Purpose (review fix, hard rule 5): a shop not shown, closed, or not in this town answers nothing at once: a forged
  // shop key never reads back the GM's answers (in or out) nor whether a thing is decided there.
  it('a shop not shown, closed, or not in this town answers nothing at once', async () => {
    const w = setup();
    for (const shop of [HIDDEN, CLOSED, ELSEWHERE]) {
      await set(w, 'rope', 'out', 1, shop);
      await set(w, 'lamp-oil', 'in', 1, shop);
      for (const thing of ['rope', 'lamp-oil', 'eel-trap']) {
        const r = await ask(w, prompt(thing, thing, '2 herons', shop));
        expect([shop, thing, r.status, r.answer]).toEqual([shop, thing, 'waiting', null]);
      }
    }
    // The shop the group can use still answers at once.
    expect((await ask(w, prompt('eel-trap'))).status).toBe('answered');
  });

  // Purpose (review fix): the price said is the entry's, never the device's: a tampered prompt price reaches neither
  // the answer nor the log line.
  it("a tampered prompt price doesn't reach the answer or the log", async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    const r = await ask(w, prompt('lamp-oil', 'lamp-oil', '0 herons'));
    expect(r.answer).toEqual({ kind: 'buy', result: 'inStock', price: '2 herons', note: '' });
    const line = w.fake.tables.events.find((e) => e.type === 'town.askFor')!;
    const after = line.after as Record<string, unknown>;
    const main: LogEvent = { id: 'e1', seq: 1, type: 'town.askFor', level: 'simple', actorUserId: w.playerId, targetTable: 'requests', targetId: String(after.id), before: null, after, fiat: false, reason: null, revertsEventId: null, requestId: null, createdAt: '' };
    const none = new Map<string, string>();
    const said = describeEntry({ main, events: [main] }, { me: w.playerId, people: none, characters: new Map([[w.character.id, 'Wren']]), companies: none, fields: none, packs: none, items: none, places: none });
    expect(said).toContain('In stock: 2 herons');
    expect(said).not.toContain('0 herons');
  });

  // Purpose (review fix, as stock_answer_for): a thing not for sale is never answered at once, not even Not here from
  // a stored out.
  it('a thing not for sale is never answered at once', async () => {
    const w = setup();
    w.fake.tables.shop_stock.push({ id: 'stock-charm', campaign_id: w.camp, service_id: SHOP, item_id: 'reed-charm', day: 1, answer: 'out', undone: false });
    const r = await ask(w, prompt('reed-charm'));
    expect([r.status, r.answer]).toEqual(['waiting', null]);
  });

  // Purpose: a player can't ask as another player's character (the command and the database both refuse).
  // (A guard: it holds before the command is built too, so it is never marked to fail.)
  it("another player's character is refused", async () => {
    const w = setup();
    w.fake.signInAs(w.otherPlayerId);
    const done = await runCommand(registry, w.db, w.other, askFor, { character: w.character, text: 'Rope, The Chandler', day: 1, prompt: prompt('rope') });
    expect(done.ok).toBe(false);
    const direct = await w.db.rpc('ask_for_thing', { campaign: w.camp, actor: w.character.id, body: 'Rope', on_day: 1, prompt: prompt('rope') as never });
    expect(direct.error).not.toBeNull();
  });
});
