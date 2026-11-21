// December step 3, W11b: Undo on "Buy it" (supabase/migrations/20261115180000_dec3_w11b_buy_undo.sql; Francis's bu-1 and
// hr4: the sixth named exception to hard rule 4). TEST project only; invented content.
//   The buyer's own Undo removes the bought line while nobody has touched it (its version unchanged since the purchase
//   made it) and the log keeps a full copy; refused once it is touched; refused for the GM's general Undo, and for
//   anyone but the buyer; nothing is charged, so no coin moves.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { addItem, loadInventory, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { answerRequest, loadRequests, sendRequest, type Request } from '../../src/modules/requests/requests.ts';
import { replyRequest, undoBuy } from '../../src/modules/requests/townRequests.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, context: { requestId?: string } = {}) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input, context);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/**
 * A campaign with Reed (player A's), and a bought lantern: asked, answered In stock at 10 gp, bought. With `forged`, the
 * reply buys nothing but carries another request's id (what a buyer who knows an id could send).
 */
async function boughtLantern(forged?: { requestId: string | null }, how: 'buy' | 'decline' | 'none' = 'buy') {
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
  const character = { id: reed, campaignId, ownerUserId: world.playerA.id };
  const carrier: CarrierRef = { campaignId, actorId: reed, locationId: null, ownerUserId: world.playerA.id, archived: false };
  const asked = await ok(as(world.playerA, sendRequest, { character, kind: 'buy', text: 'Lantern from the stall', prompt: { item: 'Lantern', itemId: null, shop: 'The stall', serviceId: 'buy-gear', price: '10 gp' } }));
  await ok(as(world.gm, answerRequest, { request: asked, answer: { kind: 'buy', result: 'inStock', price: '10 gp', note: '' } }));
  const answered = (await loadRequests(asDb(world.playerA), campaignId))!.find((r) => r.id === asked.id)!;
  if (how === 'none') {
    // Answered by the GM, never replied to.
  } else if (how === 'decline') {
    await ok(as(world.playerA, replyRequest, { request: answered, accept: false }));
  } else if (forged && forged.requestId === null) {
    // An untagged reply: straight to the database function, with no request id on its events.
    must(await world.playerA.db.rpc('reply_request', { request: answered.id, accept: true, seen_version: answered.version }));
  } else if (forged) {
    await ok(as(world.playerA, replyRequest, { request: answered, accept: true }, { requestId: forged.requestId ?? undefined }));
  } else {
    await ok(as(world.playerA, replyRequest, { request: answered, accept: true, buy: { carrier, item: { libraryEntryId: null, name: 'Lantern', category: 'gear', weightCoin: 30, slots: null, stack: 1 }, cost: '10 gp' } }));
  }
  const request = (await loadRequests(asDb(world.playerA), campaignId))!.find((r) => r.id === asked.id) as Request;
  const lines = async () => ((await loadInventory(asDb(world.playerA), campaignId))?.lines ?? []).filter((l) => l.actorId === reed && l.name === 'Lantern');
  if (!forged && how === 'buy') expect(await lines()).toHaveLength(1);
  return { campaignId, reed, carrier, request, lines };
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Undo on Buy it (W11b; bu-1, bu-2, hr4)', () => {
  it("the buyer's Undo removes an untouched bought line, and the log keeps a full copy linked to the purchase", async () => {
    const { campaignId, request, lines } = await boughtLantern();
    await ok(as(world.playerA, undoBuy, { request }));
    expect(await lines()).toEqual([]);
    const kept = must(
      await world.admin.from('events').select('type, target_table, before, after, reverts_event_id').eq('campaign_id', campaignId).eq('type', 'request.undoBuy').eq('target_table', 'inventory_lines'),
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]!.after).toBeNull();
    expect(kept[0]!.before).toMatchObject({ name: 'Lantern', how_got: 'bought', cost: '10 gp', qty: 1 });
    expect(kept[0]!.reverts_event_id).toBeTruthy();
    // The purchase is marked undone, and Undo twice is refused.
    expect((await loadRequests(asDb(world.playerA), campaignId))!.some((r) => r.id === request.id)).toBe(false);
    expect((await as(world.playerA, undoBuy, { request })).ok).toBe(false);
  });

  it('Undo is refused once the bought line was touched (here pinned), and the line stays', async () => {
    const { reed, request, lines } = await boughtLantern();
    must(await world.admin.from('inventory_lines').update({ pinned: true }).eq('actor_id', reed).eq('name', 'Lantern').select());
    const refused = await as(world.playerA, undoBuy, { request });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/That's changed since/);
    expect(await lines()).toHaveLength(1);
  });

  it("the GM's general Undo goes on refusing a purchase; the GM and another player can't use the buyer's Undo", async () => {
    const { campaignId, request, lines } = await boughtLantern();
    const eventId = (await latestChange(asDb(world.playerA), campaignId, 'request.reply', world.playerA.id))!;
    expect((await as(world.gm, undoChange, { campaignId, eventId, authorUserId: world.playerA.id })).ok).toBe(false);
    expect((await as(world.gm, undoBuy, { request })).ok).toBe(false);
    expect((await as(world.playerB, undoBuy, { request })).ok).toBe(false);
    expect(await lines()).toHaveLength(1);
  });

  it("a reply tagged with the id of someone else's line, or of a line that wasn't a purchase, is refused and that line stays", async () => {
    const stray = { libraryEntryId: null, name: 'Silver comb', category: 'treasure', weightCoin: 1, slots: null, stack: 1 };
    const kept = async (campaignId: string, reed: string) => must(await world.admin.from('inventory_lines').select('id').eq('campaign_id', campaignId).eq('actor_id', reed).eq('name', 'Silver comb'));
    // 1. A line the GM added, under a request id the buyer then reuses for the reply.
    const gmId = crypto.randomUUID();
    const first = await boughtLantern({ requestId: gmId });
    await ok(as(world.gm, addItem, { carrier: first.carrier, item: stray, qty: 1, howGot: 'given' }, { requestId: gmId }));
    const refusedGm = await as(world.playerA, undoBuy, { request: first.request });
    expect(refusedGm.ok).toBe(false);
    if (!refusedGm.ok) expect(refusedGm.message).toBe("There's no purchase to undo.");
    expect(await kept(first.campaignId, first.reed)).toHaveLength(1);
    // 2. The buyer's own line made by another command (inventory.add), not by the reply.
    const ownId = crypto.randomUUID();
    const second = await boughtLantern({ requestId: ownId });
    await ok(as(world.playerA, addItem, { carrier: second.carrier, item: stray, qty: 1, howGot: 'bought', cost: '1 gp' }, { requestId: ownId }));
    const refusedOwn = await as(world.playerA, undoBuy, { request: second.request });
    expect(refusedOwn.ok).toBe(false);
    if (!refusedOwn.ok) expect(refusedOwn.message).toBe("There's no purchase to undo.");
    expect(await kept(second.campaignId, second.reed)).toHaveLength(1);
  });

  it('Undo is refused when a light was lit from the bought line, or something was put in it, and the line stays', async () => {
    const lit = await boughtLantern();
    const line = must(await world.admin.from('inventory_lines').select('id').eq('actor_id', lit.reed).eq('name', 'Lantern').single()).id as string;
    // A character holds one light row (unique per character): point it at the bought line, or make it if there is none yet.
    const pointed = must(await world.admin.from('character_lights').update({ line_id: line, name: 'Lantern' }).eq('actor_id', lit.reed).select('id'));
    if (pointed.length === 0) must(await world.admin.from('character_lights').insert({ actor_id: lit.reed, campaign_id: lit.campaignId, line_id: line, name: 'Lantern' }).select('id'));
    expect((await as(world.playerA, undoBuy, { request: lit.request })).ok).toBe(false);
    expect(await lit.lines()).toHaveLength(1);

    const bag = await boughtLantern();
    const bagLine = must(await world.admin.from('inventory_lines').select('id').eq('actor_id', bag.reed).eq('name', 'Lantern').single()).id as string;
    must(await world.admin.from('inventory_lines').insert({ campaign_id: bag.campaignId, actor_id: bag.reed, name: 'Flint', category: 'gear', stack: 1, qty: 1, how_got: 'found', container_line_id: bagLine }).select());
    expect((await as(world.playerA, undoBuy, { request: bag.request })).ok).toBe(false);
    expect(await bag.lines()).toHaveLength(1);
  });

  // Purpose: a buyer whose reply carries no request id can't undo it (nothing can be matched safely), and nothing changes.
  it("a buyer whose request has no request id can't undo it, and nothing changes", async () => {
    const t = await boughtLantern({ requestId: null });
    const refused = await as(world.playerA, undoBuy, { request: t.request });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe("There's no purchase to undo.");
    expect((await loadRequests(asDb(world.playerA), t.campaignId))!.some((r) => r.id === t.request.id)).toBe(true);
  });

  // Purpose: once the character is given to another player, the old owner can't undo a purchase out of it.
  it("a buyer can't undo after the character was given to another player", async () => {
    const t = await boughtLantern();
    must(await world.gm.db.from('actors').update({ owner_type: 'user', owner_user_id: world.playerB.id }).eq('id', t.reed).select('id'));
    const refused = await as(world.playerA, undoBuy, { request: t.request });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe("There's no purchase to undo.");
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', t.reed).eq('name', 'Lantern'))).toHaveLength(1);
  });

  // Purpose: once the bought item was given to another character, Undo is refused and the item stays with them.
  it('Undo is refused once the bought item was given to another character', async () => {
    const t = await boughtLantern();
    const other = must(await world.admin.from('actors').insert({ campaign_id: t.campaignId, kind: 'pc', name: 'Moss the Reed-cutter', owner_type: 'user', owner_user_id: world.playerB.id, approval: 'approved', status: 'active', level: 1 }).select('id').single()).id as string;
    must(await world.admin.from('inventory_lines').update({ actor_id: other }).eq('actor_id', t.reed).eq('name', 'Lantern').select('id'));
    expect((await as(world.playerA, undoBuy, { request: t.request })).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', other).eq('name', 'Lantern'))).toHaveLength(1);
  });

  // Purpose: once the GM archives the buyer's character, the buyer can't delete the bought line from its pack, and it stays.
  it("a buyer can't undo after the GM archived the character, and the line stays", async () => {
    const t = await boughtLantern();
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', t.reed).select('id'));
    const refused = await as(world.playerA, undoBuy, { request: t.request });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe("There's no purchase to undo.");
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', t.reed).eq('name', 'Lantern'))).toHaveLength(1);
  });

  // Purpose: once the bought item was put in a container, Undo is refused and the item stays.
  it('Undo is refused once the bought item was put in a container', async () => {
    const t = await boughtLantern();
    const bag = must(await world.admin.from('inventory_lines').insert({ campaign_id: t.campaignId, actor_id: t.reed, name: 'Satchel', category: 'gear', stack: 1, qty: 1, how_got: 'found' }).select('id').single()).id as string;
    must(await world.admin.from('inventory_lines').update({ container_line_id: bag }).eq('actor_id', t.reed).eq('name', 'Lantern').select('id'));
    expect((await as(world.playerA, undoBuy, { request: t.request })).ok).toBe(false);
    expect(await t.lines()).toHaveLength(1);
  });

  // The refusal's plain words are one text whatever touched the line.
  const CHANGED = /^That's changed since: the Lantern was used or moved\. Undo the later change first\.$/;
  const lineOf = async (t: { reed: string }) => must(await world.admin.from('inventory_lines').select('id').eq('actor_id', t.reed).eq('name', 'Lantern').single()).id as string;
  const spare = async (t: { campaignId: string; reed: string }) =>
    must(await world.admin.from('inventory_lines').insert({ campaign_id: t.campaignId, actor_id: t.reed, name: 'Spare lamp', category: 'gear', stack: 1, qty: 1, how_got: 'found' }).select('id').single()).id as string;
  const refusedWith = async (t: { request: Request }, person: Person = world.playerA) => {
    const done = await as(person, undoBuy, { request: t.request });
    expect(done.ok).toBe(false);
    return done.ok ? '' : done.message;
  };

  // Purpose: a torch lit from the bought line and then replaced by another light leaves the line at version 1, yet counts as touched (bu-2b); and the GM's hidden charges give the very same words.
  it('a lit torch replaced by another light, and GM-hidden charges set on the line, are both refused in the same words', async () => {
    const lit = await boughtLantern();
    const litLine = await lineOf(lit);
    const other = await spare(lit);
    const pointed = must(await world.admin.from('character_lights').update({ line_id: litLine, name: 'Torch' }).eq('actor_id', lit.reed).select('id'));
    if (pointed.length === 0) must(await world.admin.from('character_lights').insert({ actor_id: lit.reed, campaign_id: lit.campaignId, line_id: litLine, name: 'Torch' }).select('id'));
    must(await world.admin.from('character_lights').update({ line_id: other, name: 'Spare lamp' }).eq('actor_id', lit.reed).select('id'));
    expect(must(await world.admin.from('inventory_lines').select('version').eq('id', litLine).single()).version).toBe(1);
    const viaLight = await refusedWith(lit);
    expect(viaLight).toMatch(CHANGED);
    expect(await lit.lines()).toHaveLength(1);

    const hidden = await boughtLantern();
    must(await world.admin.from('inventory_line_secrets').insert({ id: await lineOf(hidden), campaign_id: hidden.campaignId, charges_total: 3 }).select('id'));
    const viaSecret = await refusedWith(hidden);
    expect(viaSecret).toBe(viaLight);
    expect(await hidden.lines()).toHaveLength(1);
  });

  // Purpose: undoing the same purchase twice is refused the second time with "already undone", and nothing else changes.
  it('a second Undo of the same purchase says already undone and changes nothing', async () => {
    const t = await boughtLantern();
    await ok(as(world.playerA, undoBuy, { request: t.request }));
    const before = must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId)).length;
    expect(await refusedWith(t)).toBe('That was already undone.');
    expect(await t.lines()).toEqual([]);
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId))).toHaveLength(before);
  });

  // Purpose: someone outside the campaign gets the same refusal as for a request that isn't there, and never the line's name.
  it('a non-member gets the same refusal as for a missing request, and the refusal never names the line', async () => {
    const t = await boughtLantern();
    const stranger = await refusedWith(t, world.outsider);
    const missing = await refusedWith({ request: { ...t.request, id: crypto.randomUUID() } }, world.outsider);
    expect(stranger).toBe(missing);
    expect(stranger).not.toMatch(/Lantern/);
    expect(await refusedWith(t, world.playerB)).not.toMatch(/Lantern/);
  });

  // Purpose: a request that isn't an accepted buy (a sale, an unanswered buy, a declined one) can't be undone as a purchase.
  it("a request that isn't a buy, or wasn't accepted, is refused", async () => {
    const none = await boughtLantern(undefined, 'none');
    expect((await as(world.playerA, undoBuy, { request: none.request })).ok).toBe(false);
    const declined = await boughtLantern(undefined, 'decline');
    expect((await as(world.playerA, undoBuy, { request: declined.request })).ok).toBe(false);
    // A sale accepted: the sell request is the buyer's own, but not a buy.
    const sale = await boughtLantern();
    const line = await lineOf(sale);
    const sent = await ok(as(world.playerA, sendRequest, { character: { id: sale.reed, campaignId: sale.campaignId, ownerUserId: world.playerA.id }, kind: 'sell', text: 'Sell Lantern', prompt: { lineId: line, item: 'Lantern', qty: 1, of: 1, serviceId: 'x', buyer: 'The jeweller' } }));
    await ok(as(world.gm, answerRequest, { request: sent, answer: { kind: 'offer', price: '2 gp', note: '' } }));
    const offer = (await loadRequests(asDb(world.playerA), sale.campaignId))!.find((r) => r.id === sent.id)!;
    await ok(as(world.playerA, replyRequest, { request: offer, accept: true }));
    const reply = (await loadRequests(asDb(world.playerA), sale.campaignId))!.find((r) => r.id === sent.id)!;
    expect((await as(world.playerA, undoBuy, { request: reply })).ok).toBe(false);
  });

  // Purpose: a bought item moved to the party stash, equipped, or with its quantity changed or part split off is touched: refused, and it stays.
  it('Undo is refused after a move to the party stash, equipping, a quantity change, or a split', async () => {
    const stashed = await boughtLantern();
    const stashedLine = await lineOf(stashed);
    let [stash] = must(await world.admin.from('locations').select('id').eq('campaign_id', stashed.campaignId).eq('kind', 'stash'));
    if (!stash) stash = must(await world.admin.from('locations').insert({ campaign_id: stashed.campaignId, kind: 'stash', name: 'Party stash' }).select('id').single());
    must(await world.admin.from('inventory_lines').update({ actor_id: null, location_id: stash.id }).eq('id', stashedLine).select('id'));
    expect((await as(world.playerA, undoBuy, { request: stashed.request })).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', stashedLine))).toHaveLength(1);

    const worn = await boughtLantern();
    must(await world.admin.from('inventory_lines').update({ equipped: true }).eq('id', await lineOf(worn)).select('id'));
    expect((await as(world.playerA, undoBuy, { request: worn.request })).ok).toBe(false);
    expect(await worn.lines()).toHaveLength(1);

    const more = await boughtLantern();
    const moreLine = await lineOf(more);
    must(await world.admin.from('inventory_lines').update({ qty: 3 }).eq('id', moreLine).select('id'));
    expect((await as(world.playerA, undoBuy, { request: more.request })).ok).toBe(false);
    must(await world.playerA.db.rpc('split_inventory_line', { line: moreLine, how_many: 1 }));
    expect((await as(world.playerA, undoBuy, { request: more.request })).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', moreLine))).toHaveLength(1);
  });

  // Purpose: a character that is now the GM's or the party's, or was deleted, or sits in a retired campaign, can't have a purchase undone out of it.
  it('Undo is refused for a GM-owned character, a deleted character and a retired campaign', async () => {
    const gmOwned = await boughtLantern();
    must(await world.gm.db.from('actors').update({ owner_type: 'gm', owner_user_id: null }).eq('id', gmOwned.reed).select('id'));
    expect((await as(world.playerA, undoBuy, { request: gmOwned.request })).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', gmOwned.reed).eq('name', 'Lantern'))).toHaveLength(1);

    const gone = await boughtLantern();
    must(await world.admin.from('actors').delete().eq('id', gone.reed).select('id'));
    expect((await as(world.playerA, undoBuy, { request: gone.request })).ok).toBe(false);

    const retired = await boughtLantern();
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', retired.campaignId).select('id'));
    expect((await as(world.playerA, undoBuy, { request: retired.request })).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', retired.reed).eq('name', 'Lantern'))).toHaveLength(1);
  });

  // Purpose: two Undos sent at once on the same purchase: exactly one succeeds, and the line is gone once.
  it('two Undos at once: exactly one succeeds', async () => {
    const t = await boughtLantern();
    const [a, b] = await Promise.all([as(world.playerA, undoBuy, { request: t.request }), as(world.playerA, undoBuy, { request: t.request })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await t.lines()).toEqual([]);
  });
});
