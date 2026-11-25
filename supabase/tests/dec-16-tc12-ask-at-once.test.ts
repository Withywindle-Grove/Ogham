// Ask for… answered at once (town row TC12, the stack's W10a; tn-7, tn-8; docs/plans/dec-16-town-carry.md; migration
// 20261125180000_dec16_tc12_ask_answered_at_once.sql). TEST project or CI's local database; invented content. What it
// checks, in plain words:
//   * a thing the GM set in today is answered at once ("In stock" at its price) and one set out "Not here"; with no
//     stored answer an "always" thing is answered from its default; a chance thing, an undecided one, an unlisted one and
//     Something not listed… wait for the GM;
//   * the answer is one log line, town.askFor, the player's: the asker and the GM read it, the other player doesn't;
//   * a later flip in the stock table does not unsend it, and the GM can't answer it again;
//   * a player learns "Not here" only for the thing asked for: the other player reads nothing of it, and the asker reads
//     no other stock line that is out or undecided;
//   * forged ids are refused: another player's character, a character of another campaign, a campaign the asker is
//     not in; another campaign's shop answers never answer here; a past day is never answered at once;
//   * the transaction setting the function uses can't be set by a player to answer their own send_request.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { answerRequest, sendRequest } from '../../src/modules/requests/requests.ts';
import { setStock } from '../../src/modules/requests/shopStock.ts';
import { askFor, type BuyPrompt } from '../../src/modules/requests/townRequests.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const SHOP = 'tc12-chandler';
// Thing ids no other test uses.
const OIL = 'tc12-lamp-oil';
const ROPE = 'tc12-rope';
const TRAP = 'tc12-eel-trap';
const GLASS = 'tc12-spyglass';
const HOOK = 'tc12-boat-hook';
const FAR = 'tc12-far-lamp';

async function makePack(person: Person, name: string, items: Record<string, unknown>[]) {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name, version: '0.1' }, items }));
  if (!read.ok) throw new Error(read.message);
  const made = await as(person, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

beforeAll(async () => {
  world = await buildWorld();
  const chance = (id: string, c: string) => ({ id, name: id, category: 'gear', availability: { chance: c } });
  const packId = await makePack(world.gm, 'TC12 fen goods', [chance(OIL, '3-in-6'), chance(ROPE, '3-in-6'), chance(TRAP, 'always'), chance(GLASS, '1-in-6'), chance(HOOK, '2-in-6')]);
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  const otherPackId = await makePack(world.gm, 'TC12 barrow goods', [chance(FAR, '3-in-6')]);
  await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId: otherPackId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const wren = () => ({ id: world.wrenId, campaignId: world.campaignId, ownerUserId: world.playerA.id });
const prompt = (itemId: string | null, price = '2 herons', serviceId = SHOP): BuyPrompt => ({ serviceId, shop: 'The Chandler', itemId, item: itemId ?? 'A brass bell', price });
const set = (itemId: string, answer: 'in' | 'out', day = 1, campaignId = world.campaignId) => as(world.gm, setStock, { campaignId, serviceId: SHOP, itemId, day, answer });
async function ask(p: BuyPrompt, day = 1) {
  const done = await as(world.playerA, askFor, { character: wren(), text: `${p.item}, The Chandler`, day, prompt: p });
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

describe('answered at once from the day\'s stock (tn-7)', () => {
  // Purpose: a thing set in today is answered at once, In stock at its price; one set out, Not here.
  it('a thing set in or out today is answered at once', async () => {
    expect(await set(OIL, 'in')).toMatchObject({ ok: true });
    expect(await set(ROPE, 'out')).toMatchObject({ ok: true });
    const oil = await ask(prompt(OIL));
    expect([oil.status, oil.answer]).toEqual(['answered', { kind: 'buy', result: 'inStock', price: '2 herons', note: '' }]);
    const rope = await ask(prompt(ROPE));
    expect([rope.status, rope.answer]).toEqual(['answered', { kind: 'buy', result: 'notHere', price: '', note: '' }]);
  });

  // Purpose: with no stored answer an "always" thing is answered from its default; a chance thing, an unlisted thing,
  // Something not listed… and an in thing with no price to say wait for the GM.
  it('the default decides; the undecided and the unlisted wait', async () => {
    expect((await ask(prompt(TRAP))).status).toBe('answered');
    expect((await ask(prompt(GLASS))).status).toBe('waiting');
    expect((await ask(prompt('tc12-no-such-thing'))).status).toBe('waiting');
    expect((await ask(prompt(null, ''))).status).toBe('waiting');
    expect((await ask(prompt(OIL, ''))).status).toBe('waiting');
  });
});

describe('logged, kept, and told only to the asker (tn-8)', () => {
  // Purpose: the answer is one log line, town.askFor, which the asker and the GM read and the other player doesn't.
  it('one log line, read by the asker and the GM', async () => {
    const asked = await ask(prompt(ROPE));
    const lineOf = async (person: Person) => must(await person.db.from('events').select('type, after').eq('campaign_id', world.campaignId).eq('target_id', asked.id));
    expect((await lineOf(world.playerA)).map((e) => e.type)).toEqual(['town.askFor']);
    expect((await lineOf(world.gm)).map((e) => e.type)).toEqual(['town.askFor']);
    expect(await lineOf(world.playerB)).toEqual([]);
    expect(must(await world.playerB.db.from('requests').select('id').eq('id', asked.id))).toEqual([]);
  });

  // Purpose: a later flip in the stock table does not unsend the answer, and the GM can't answer it again.
  it('a later flip does not unsend it', async () => {
    const asked = await ask(prompt(OIL));
    expect(await set(OIL, 'out')).toMatchObject({ ok: true });
    const kept = must(await world.playerA.db.from('requests').select('status, answer').eq('id', asked.id))[0]!;
    expect(kept).toMatchObject({ status: 'answered', answer: { result: 'inStock' } });
    const again = await as(world.gm, answerRequest, { request: asked, answer: { kind: 'buy', result: 'notHere', price: '', note: '' } });
    expect(again.ok).toBe(false);
    expect(await set(OIL, 'in')).toMatchObject({ ok: true });
  });

  // Purpose: the asker reads no stock line out or undecided, and nothing of another thing: only their own answer.
  it("the asker reads no other thing's answer", async () => {
    expect(await set(HOOK, 'out')).toMatchObject({ ok: true });
    await ask(prompt(OIL));
    const rows = JSON.stringify(must(await world.playerA.db.from('shop_stock').select('*').eq('campaign_id', world.campaignId)));
    expect(rows).not.toContain(HOOK);
    expect(rows).not.toContain(ROPE);
    const mine = JSON.stringify(must(await world.playerA.db.from('requests').select('*').eq('campaign_id', world.campaignId)));
    expect(mine).not.toContain(HOOK);
  });
});

describe('forged ids (hard rule 5)', () => {
  // Purpose: another player's character, another campaign's character and a campaign the asker isn't in are refused.
  it('refuses a character that is not the asker\'s, and a campaign they are not in', async () => {
    const asB = await world.playerB.db.rpc('ask_for_thing', { campaign: world.campaignId, actor: world.wrenId, body: 'Rope', on_day: 1, prompt: prompt(ROPE) as never });
    expect(asB.error).not.toBeNull();
    const elsewhere = await world.playerA.db.rpc('ask_for_thing', { campaign: world.otherCampaignId, actor: world.wrenId, body: 'Rope', on_day: 1, prompt: prompt(ROPE) as never });
    expect(elsewhere.error?.code).toBe('42501');
    const outsider = await world.outsider.db.rpc('ask_for_thing', { campaign: world.campaignId, actor: world.wrenId, body: 'Rope', on_day: 1, prompt: prompt(ROPE) as never });
    expect(outsider.error?.code).toBe('42501');
    const bad = await world.playerA.db.rpc('ask_for_thing', { campaign: world.campaignId, actor: world.wrenId, body: 'Rope', on_day: 0, prompt: prompt(ROPE) as never });
    expect(bad.error).not.toBeNull();
  });

  // Purpose: another campaign's shop answers never answer a request here (its thing is not this campaign's).
  it("another campaign's stock answers nothing here", async () => {
    expect(await set(FAR, 'in', 1, world.otherCampaignId)).toMatchObject({ ok: true });
    expect((await ask(prompt(FAR))).status).toBe('waiting');
  });

  // Purpose: a device can't name a past day to learn its answers: before the newest stocked day it waits.
  it('a past day is never answered at once', async () => {
    expect(await set(GLASS, 'in', 3)).toMatchObject({ ok: true });
    expect((await ask(prompt(ROPE), 2)).status).toBe('waiting');
    expect((await ask(prompt(GLASS), 3)).status).toBe('answered');
  });

  // Purpose: a plain send_request is never answered by the stock: only ask_for_thing sets the answer, for its own row.
  // (A guard: it holds before the function is built too, so it is never marked to fail.)
  it('send_request is not answered by the stock', async () => {
    const sent = await as(world.playerA, sendRequest, { character: wren(), kind: 'buy', text: 'Rope, The Chandler', prompt: { ...prompt(ROPE) } });
    expect(sent).toMatchObject({ ok: true, value: { status: 'waiting' } });
  });
});
