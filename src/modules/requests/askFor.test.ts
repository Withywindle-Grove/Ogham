// Ask for… answered at once (town row TC12, the stack's W10a; tn-7, tn-8) against the stand-in database, as
// supabase/tests/dec-16-tc12-ask-at-once.test.ts checks the real one. Invented things only. In plain words:
//   * a thing the GM set in today is answered at once, "In stock" at its price, with no card waiting for the GM;
//   * a thing the GM set out today is answered at once, "Not here";
//   * a thing with no stored answer reads its default (a setting's shop): "always" in is answered, a chance waits;
//   * an undecided thing, one not in the list, or Something not listed… still reaches the GM, waiting;
//   * a later flip in the stock table does not unsend the answer;
//   * a day before the newest stocked day is never answered at once (a device can't name a past day);
//   * the answer is one log line, the player's, saying what was answered;
//   * a player can't ask as another player's character.
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
  const item = (id: string, data: Record<string, unknown>) => ({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'item', pack_entry_id: id, name: id, data: { category: 'gear', ...data } });
  fake.tables.library_entries.push(
    item('lamp-oil', { availability: { chance: '3-in-6' } }),
    item('rope', { availability: { chance: '3-in-6' } }),
    item('eel-trap', { availability: { chance: 'always' } }),
    item('spyglass', { availability: { chance: '1-in-6' } }),
  );
  const db = fake.db as unknown as Db;
  const gm = { id: gmId, roles: { [camp]: 'gm' as const } };
  const player = { id: playerId, roles: { [camp]: 'player' as const } };
  const other = { id: otherPlayerId, roles: { [camp]: 'player' as const } };
  const character = { id: wren, campaignId: camp, ownerUserId: playerId };
  return { fake, db, gm, player, other, gmId, playerId, otherPlayerId, camp, character };
}

const prompt = (itemId: string | null, item = itemId ?? 'A bell', price = '2 herons'): BuyPrompt => ({ serviceId: SHOP, shop: 'The Chandler', itemId, item, price });

async function set(w: ReturnType<typeof setup>, itemId: string, answer: 'in' | 'out', day = 1) {
  w.fake.signInAs(w.gmId);
  expect(await runCommand(registry, w.db, w.gm, setStock, { campaignId: w.camp, serviceId: SHOP, itemId, day, answer })).toMatchObject({ ok: true });
}

async function ask(w: ReturnType<typeof setup>, p: BuyPrompt, day = 1) {
  w.fake.signInAs(w.playerId);
  const done = await runCommand(registry, w.db, w.player, askFor, { character: w.character, text: `${p.item}, The Chandler`, day, prompt: p });
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

describe('Ask for… answered at once (TC12)', () => {
  // Purpose (tn-7): a thing the GM set in today is answered at once, In stock at its price; the GM gets no card.
  it.fails('a thing set in today: In stock at once', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    const r = await ask(w, prompt('lamp-oil'));
    expect(r.status).toBe('answered');
    expect(r.answer).toEqual({ kind: 'buy', result: 'inStock', price: '2 herons', note: '' });
  });

  // Purpose (tn-7): a thing the GM set out today is answered at once, Not here.
  it.fails('a thing set out today: Not here at once', async () => {
    const w = setup();
    await set(w, 'rope', 'out');
    const r = await ask(w, prompt('rope'));
    expect(r.status).toBe('answered');
    expect(r.answer).toEqual({ kind: 'buy', result: 'notHere', price: '', note: '' });
  });

  // Purpose (tn-7): with no stored answer, the default decides at a setting's shop: "always" is in; a chance waits.
  it.fails('no stored answer: an "always" thing is answered, a chance thing waits', async () => {
    const w = setup();
    expect((await ask(w, prompt('eel-trap'))).status).toBe('answered');
    expect((await ask(w, prompt('spyglass'))).status).toBe('waiting');
  });

  // Purpose (tn-7): an undecided thing, a thing not in the list, and Something not listed… still reach the GM.
  it.fails('undecided, unlisted and not-listed asks wait for the GM', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    expect((await ask(w, prompt('spyglass'))).status).toBe('waiting');
    expect((await ask(w, prompt('no-such-thing'))).status).toBe('waiting');
    expect((await ask(w, prompt(null, 'A brass bell', ''))).status).toBe('waiting');
    // In stock but with no price to say: the GM prices it.
    expect((await ask(w, prompt('lamp-oil', 'lamp-oil', ''))).status).toBe('waiting');
  });

  // Purpose (tn-8): a later flip in the stock table does not unsend an answer already given.
  it.fails('a later flip does not unsend the answer', async () => {
    const w = setup();
    await set(w, 'lamp-oil', 'in');
    const r = await ask(w, prompt('lamp-oil'));
    await set(w, 'lamp-oil', 'out');
    const kept = w.fake.tables.requests.find((row) => row.id === r.id)!;
    expect(kept.status).toBe('answered');
    expect(kept.answer).toMatchObject({ result: 'inStock' });
  });

  // Purpose: a device can't name a past day to learn its answers: a day before the newest stocked day waits.
  it.fails('a past day is never answered at once', async () => {
    const w = setup();
    await set(w, 'rope', 'out', 1);
    await set(w, 'lamp-oil', 'in', 2);
    expect((await ask(w, prompt('rope'), 1)).status).toBe('waiting');
    expect((await ask(w, prompt('lamp-oil'), 2)).status).toBe('answered');
  });

  // Purpose (tn-8): the answer is one log line, the player's, naming what was answered.
  it.fails('one log line says what was answered', async () => {
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
