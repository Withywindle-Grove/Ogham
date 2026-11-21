// M5b step 6e: buying, selling and lodging as requests the GM answers (supabase/migrations/20261104190000_m5b_6e_
// town_requests.sql; ruled 2026-10-30, ST5–ST7; dt-11, st-3; docs/03, hidden means hidden). TEST project only;
// invented content.
//   An Ask for… answered In stock reaches the player with the price; Buy it brings the item in as bought, its price
//   as text (like Add, the made line isn't undone: Remove takes it out); Leave it changes nothing and can be undone. A Sell… offer the player declines changes nothing; one accepted takes the
//   item out of the pack, and Undo puts it back. A lodging from the town's list is picked at once and its log line
//   carries the cost; a lodging the GM hides can't be picked; Somewhere else… waits for the GM. Only the requester
//   replies, once, and only to a priced answer; other players never read the requests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { setPlaceSafety } from '../../src/modules/expedition/placeSafety.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { openTownPlace, showTownPlace } from '../../src/modules/expedition/townPlaces.ts';
import { addItem, loadInventory, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { answerRequest, loadRequests, sendRequest, type Request } from '../../src/modules/requests/requests.ts';
import { chooseStay, replyRequest } from '../../src/modules/requests/townRequests.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}
async function undoNewest(person: Person, campaignId: string, type: string) {
  const eventId = await latestChange(asDb(person), campaignId, type, person.id);
  if (!eventId) throw new Error(`No ${type} to undo.`);
  await ok(as(person, undoChange, { campaignId, eventId, authorUserId: person.id }));
}

const inn = { key: 'lodging:the lantern rest', name: 'The Lantern Rest', group: 'lodging' as const };
const loft = { key: 'lodging:the hay loft', name: 'The Hay Loft', group: 'lodging' as const };

/** A fresh campaign: Reed (player A's), an expedition at Fenwick Market (Safe), the Lantern Rest shown and open. */
async function freshTown() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Road', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const reed = must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: campaignId, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 })
      .select('id')
      .single(),
  ).id as string;
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'Fenwick Market' }));
  const place = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
  await ok(as(world.gm, setPlaceSafety, { campaignId, place: await place(), safety: 'safe' }));
  await ok(as(world.gm, showTownPlace, { campaignId, place: await place(), entry: inn, shown: true }));
  const character = { id: reed, campaignId, ownerUserId: world.playerA.id };
  const carrier: CarrierRef = { campaignId, actorId: reed, locationId: null, ownerUserId: world.playerA.id, archived: false };
  return { campaignId, reed, character, carrier, place };
}

const reedLines = async (campaignId: string, reed: string) => ((await loadInventory(asDb(world.playerA), campaignId))?.lines ?? []).filter((l) => l.actorId === reed);
const requestOf = async (person: Person, campaignId: string, id: string): Promise<Request | undefined> => (await loadRequests(asDb(person), campaignId))?.find((r) => r.id === id);

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Buying, selling and lodging in town (M5b step 6e)', () => {
  it('an Ask for… answered In stock reaches the player with the price; Buy it brings the item in as bought, its price as text', async () => {
    const { campaignId, reed, character, carrier } = await freshTown();
    const asked = await ok(as(world.playerA, sendRequest, { character, kind: 'buy', text: 'Lantern from the stall', prompt: { item: 'Lantern', itemId: null, shop: 'The stall', serviceId: 'buy-gear', price: '10 gp' } }));
    expect(asked.answerKind).toBe('hitMissChoice');
    // Player B never reads it.
    expect(await requestOf(world.playerB, campaignId, asked.id)).toBeUndefined();
    // Replying before the GM answers is refused.
    expect((await as(world.playerA, replyRequest, { request: asked, accept: true })).ok).toBe(false);

    await ok(as(world.gm, answerRequest, { request: asked, answer: { kind: 'buy', result: 'inStock', price: '10 gp', note: '' } }));
    const answered = (await requestOf(world.playerA, campaignId, asked.id))!;
    expect(answered.answer).toEqual({ kind: 'buy', result: 'inStock', price: '10 gp', note: '' });
    // The GM can't reply for the player.
    expect((await as(world.gm, replyRequest, { request: answered, accept: true })).ok).toBe(false);

    await ok(as(world.playerA, replyRequest, { request: answered, accept: true, buy: { carrier, item: { libraryEntryId: null, name: 'Lantern', category: 'gear', weightCoin: 30, slots: null, stack: 1 }, cost: '10 gp' } }));
    const bought = (await reedLines(campaignId, reed)).find((l) => l.name === 'Lantern');
    expect(bought).toMatchObject({ howGot: 'bought', cost: '10 gp' });
    expect((await requestOf(world.playerA, campaignId, asked.id))!.reply).toBe('accept');
    // A second reply is refused.
    expect((await as(world.playerA, replyRequest, { request: (await requestOf(world.playerA, campaignId, asked.id))!, accept: false })).ok).toBe(false);

    // Buy it made a line, which the generic Undo never removes (hard rule 4; as Add): the line stays, Remove takes it out.
    const eventId = (await latestChange(asDb(world.playerA), campaignId, 'request.reply', world.playerA.id))!;
    expect((await as(world.playerA, undoChange, { campaignId, eventId, authorUserId: world.playerA.id })).ok).toBe(false);
    expect((await reedLines(campaignId, reed)).some((l) => l.name === 'Lantern')).toBe(true);
  });

  it('Leave it changes nothing in the pack, and Undo puts the answer back for another reply', async () => {
    const { campaignId, reed, character } = await freshTown();
    const asked = await ok(as(world.playerA, sendRequest, { character, kind: 'buy', text: 'A brass spyglass', prompt: { item: 'A brass spyglass', itemId: null, shop: 'The stall', serviceId: 'buy-gear', price: '' } }));
    await ok(as(world.gm, answerRequest, { request: asked, answer: { kind: 'buy', result: 'price', price: '40 gp', note: 'Rare here.' } }));
    await ok(as(world.playerA, replyRequest, { request: (await requestOf(world.playerA, campaignId, asked.id))!, accept: false }));
    expect(await reedLines(campaignId, reed)).toEqual([]);
    await undoNewest(world.playerA, campaignId, 'request.reply');
    expect((await requestOf(world.playerA, campaignId, asked.id))!.reply).toBeNull();
  });

  it('a Sell… offer the player declines changes nothing; one accepted takes the item out, and Undo puts it back', async () => {
    const { campaignId, reed, character, carrier } = await freshTown();
    const line = await ok(as(world.gm, addItem, { carrier, item: { libraryEntryId: null, name: 'Silver comb', category: 'treasure', weightCoin: 1, slots: null, stack: 1 }, qty: 1, howGot: 'given' }));
    const sell = async () => {
      const sent = await ok(as(world.playerA, sendRequest, { character, kind: 'sell', text: 'Sell Silver comb to the jeweller', prompt: { lineId: line.id, item: 'Silver comb', qty: 1, of: 1, serviceId: 'jeweller-sell', buyer: 'The jeweller' } }));
      expect(sent.answerKind).toBe('offer');
      await ok(as(world.gm, answerRequest, { request: sent, answer: { kind: 'offer', price: '8 gp', note: '' } }));
      return (await requestOf(world.playerA, campaignId, sent.id))!;
    };

    const declined = await sell();
    await ok(as(world.playerA, replyRequest, { request: declined, accept: false, sell: { line: { id: line.id, carrier }, qty: 1, of: 1 } }));
    expect((await reedLines(campaignId, reed)).map((l) => l.name)).toEqual(['Silver comb']);
    expect((await requestOf(world.playerA, campaignId, declined.id))!.reply).toBe('decline');

    const accepted = await sell();
    await ok(as(world.playerA, replyRequest, { request: accepted, accept: true, sell: { line: { id: line.id, carrier }, qty: 1, of: 1 } }));
    expect(await reedLines(campaignId, reed)).toEqual([]);
    await undoNewest(world.playerA, campaignId, 'request.reply');
    expect((await reedLines(campaignId, reed)).map((l) => l.name)).toEqual(['Silver comb']);
  });

  it('a lodging from the list is picked at once and its log line carries the cost; a hidden one is refused; Somewhere else… waits for the GM', async () => {
    const { campaignId, character, place } = await freshTown();
    const stay = await ok(as(world.playerA, chooseStay, { character, stay: { listed: true, key: inn.key, name: inn.name, rate: '2 sp a night', at: 100, town: 'Fenwick Market' } }));
    expect(stay.status).toBe('answered');
    expect(stay.answer).toEqual({ kind: 'stay', listed: true });
    const line = must(await world.playerA.db.from('events').select('type, after').eq('campaign_id', campaignId).eq('type', 'town.stay'));
    expect(line).toHaveLength(1);
    expect((line[0]!.after as Record<string, unknown>).cost_text).toBe('2 sp a night');
    // Hidden means hidden: player B reads neither the request nor its line.
    expect(await requestOf(world.playerB, campaignId, stay.id)).toBeUndefined();
    expect(must(await world.playerB.db.from('events').select('id').eq('campaign_id', campaignId).eq('type', 'town.stay'))).toEqual([]);

    // The hay loft is hidden (never shown): picking it is refused; so is the inn once it's closed.
    expect((await as(world.playerA, chooseStay, { character, stay: { listed: true, key: loft.key, name: loft.name, rate: '1 cp a night', at: 100, town: 'Fenwick Market' } })).ok).toBe(false);
    await ok(as(world.gm, openTownPlace, { campaignId, place: await place(), entry: inn, open: false }));
    expect((await as(world.playerA, chooseStay, { character, stay: { listed: true, key: inn.key, name: inn.name, rate: '2 sp a night', at: 200, town: 'Fenwick Market' } })).ok).toBe(false);
    // Nor can a player say a lodging was "listed" by sending it as a plain request: it waits for the GM like any other.
    const elsewhere = await ok(as(world.playerA, sendRequest, { character, kind: 'lodging', text: 'Staying at my aunt’s cottage', prompt: { listed: false, key: '', name: 'My aunt’s cottage', rate: '', at: 200, town: 'Fenwick Market' } }));
    expect(elsewhere.status).toBe('waiting');
    await ok(as(world.gm, answerRequest, { request: elsewhere, answer: { kind: 'yesNo', yes: true, turns: 0, note: '' }, costText: 'free' }));
    expect((await requestOf(world.playerA, campaignId, elsewhere.id))!.costText).toBe('free');

    // Undo of the pick marks it undone.
    await undoNewest(world.playerA, campaignId, 'town.stay');
    expect(await requestOf(world.playerA, campaignId, stay.id)).toBeUndefined();
  });
});
