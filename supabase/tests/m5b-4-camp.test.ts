// M5b step 4, part 1: camp (supabase/migrations/20261103160000_m5b_4_camp.sql; ruled 2026-10-30, D5, D13–D17).
// TEST project only; invented places, characters and items.
//   A player of the group makes camp (a second tap gives back the same camp); another group's player reads none of
//   it. Firewood from a pack goes on the campfire (the bundles used up); only the camp's firewood counts. The cook's
//   ingredients become portions in the pot; a character eats once, from the pot or their own pack. A player can't
//   eat or cook for another player's character; the GM can. Undo of a meal brings the food back; undoing a cooking
//   whose portions were eaten, or a camp with steps done, is refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { campFire, potOf } from '../../src/modules/expedition/camp.ts';
import { addCampFuel, campTalk, cookAtCamp, eatAtCamp, loadCamps, openCamp } from '../../src/modules/expedition/campPlay.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign with firewood and two foods in its setting rules; Reed (A's, with wood, eels and fen-bread) and Moss (B's). */
async function freshCamp() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id }).select().single());
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
  const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen camp' }).select('id').single()).id as string;
  const entry = async (id: string, name: string, food?: string) =>
    must(await world.admin.from('library_entries').insert({ pack_id: pack, kind: 'item', pack_entry_id: id, name, data: { id, name, category: 'gear', ...(food ? { food } : {}) } }).select('id').single()).id as string;
  const [wood, eel, bread] = [await entry('bog-wood', 'Bog-wood bundle'), await entry('eel', 'Eel', 'fresh'), await entry('fen-bread', 'Fen-bread', 'preserved')];
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: pack, option_choices: {}, priority: 1 }).select());
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const line = async (actor: string, libraryEntryId: string, name: string, qty: number) =>
    must(await world.admin.from('inventory_lines').insert({ campaign_id: campaignId, actor_id: actor, library_entry_id: libraryEntryId, name, category: 'gear', stack: 1, qty, how_got: 'found' }).select('id').single()).id as string;
  const lines = { wood: await line(reed!.id, wood, 'Bog-wood bundle', 3), eel: await line(reed!.id, eel, 'Eel', 2), bread: await line(reed!.id, bread, 'Fen-bread', 1), mossBread: await line(moss!.id, bread, 'Fen-bread', 2) };
  await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness', place: 'The Reed Jetty' }));
  const trip = must(await world.admin.from('expeditions').select('id').eq('campaign_id', campaignId).is('ended_at', null).single()).id as string;
  const reedOf = { campaignId, id: reed!.id, ownerUserId: world.playerA.id };
  const mossOf = { campaignId, id: moss!.id, ownerUserId: world.playerB.id };
  return { campaignId, trip, reed: reedOf, moss: mossOf, lines };
}

type Fresh = Awaited<ReturnType<typeof freshCamp>>;
const open = (t: Fresh, person: Person, group = 1) =>
  as(person, openCamp, { target: { campaignId: t.campaignId, group, mine: true }, day: 0, fire: { typeId: 'campfire', name: 'Campfire', fuelItem: 'bog-wood' } });
const qtyOf = async (id: string) => (await world.admin.from('inventory_lines').select('qty').eq('id', id).maybeSingle()).data?.qty ?? 0;
const campOf = async (t: Fresh, person: Person = world.gm) => (await loadCamps(asDb(person), t.campaignId, t.trip, 0))?.get(1) ?? null;
async function undoLatest(person: Person, t: Fresh, type: string) {
  const user = await userOf(person);
  const eventId = await latestChange(asDb(person), t.campaignId, type, user.id);
  return runCommand(registry, asDb(person), user, undoChange, { campaignId: t.campaignId, eventId: eventId!, authorUserId: user.id });
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('camp (D13–D17)', () => {
  it("a player of the group makes camp; a second tap gives back the same camp; another group's player reads none of it", async () => {
    const t = await freshCamp();
    const camp = await ok(open(t, world.playerA));
    expect(camp).toMatchObject({ group: 1, day: 0, fireTypeId: 'campfire', fuelItem: 'bog-wood' });
    expect((await ok(open(t, world.playerB))).id).toBe(camp.id);
    // Moss splits off: player B now reads nothing of group 1's camp, and can't make camp for it.
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    expect(must(await world.playerB.db.from('camps').select('id').eq('id', camp.id))).toEqual([]);
    expect((await as(world.playerB, openCamp, { target: { campaignId: t.campaignId, group: 1, mine: true }, day: 1 })).ok).toBe(false);
    expect(must(await world.playerA.db.from('camps').select('id').eq('id', camp.id)).length).toBe(1);
  });

  it('firewood from a pack lights the campfire and is used up; only the camp’s firewood counts; Undo puts it back', async () => {
    const t = await freshCamp();
    const camp = await ok(open(t, world.playerA));
    await ok(as(world.playerA, addCampFuel, { campId: camp.id, actor: t.reed, lineId: t.lines.wood, qty: 2, secondsEach: 3600 }));
    expect(await qtyOf(t.lines.wood)).toBe(1);
    const fire = campFire((await campOf(t))!.entries, 0);
    expect([fire.burning, fire.bundles, fire.lit?.seconds]).toEqual([true, 2, 7200]);
    expect(campFire((await campOf(t))!.entries, 7200).burning).toBe(false);
    // Eels aren't firewood.
    expect((await as(world.playerA, addCampFuel, { campId: camp.id, actor: t.reed, lineId: t.lines.eel, qty: 1, secondsEach: 3600 })).ok).toBe(false);
    // The last bundle goes with its line; Undo brings it back.
    await ok(as(world.playerA, addCampFuel, { campId: camp.id, actor: t.reed, lineId: t.lines.wood, qty: 1, secondsEach: 3600 }));
    expect(await qtyOf(t.lines.wood)).toBe(0);
    expect((await undoLatest(world.playerA, t, 'camp.fuel')).ok).toBe(true);
    expect(await qtyOf(t.lines.wood)).toBe(1);
    expect(campFire((await campOf(t))!.entries, 0).bundles).toBe(2);
  });

  it('the cook’s ingredients become portions in the pot; each eats once; the pot runs empty; eaten portions keep the cooking', async () => {
    const t = await freshCamp();
    const camp = await ok(open(t, world.playerA));
    await ok(as(world.playerA, cookAtCamp, { campId: camp.id, actor: t.reed, ingredients: [{ lineId: t.lines.eel, qty: 1 }], portions: 1 }));
    expect(await qtyOf(t.lines.eel)).toBe(1);
    expect(potOf((await campOf(t))!.entries)).toEqual({ made: 1, left: 1 });
    await ok(as(world.playerB, eatAtCamp, { campId: camp.id, actor: t.moss, fromPot: true }));
    expect(potOf((await campOf(t))!.entries)).toEqual({ made: 1, left: 0 });
    // Moss has eaten; the pot is empty for Reed, who eats from their own pack instead.
    expect((await as(world.playerB, eatAtCamp, { campId: camp.id, actor: t.moss, fromPot: false, lineId: t.lines.mossBread })).ok).toBe(false);
    expect((await as(world.playerA, eatAtCamp, { campId: camp.id, actor: t.reed, fromPot: true })).ok).toBe(false);
    const meal = await ok(as(world.playerA, eatAtCamp, { campId: camp.id, actor: t.reed, fromPot: false, lineId: t.lines.bread }));
    expect([meal.foodName, meal.foodKind]).toEqual(['Fen-bread', 'preserved']);
    expect(await qtyOf(t.lines.bread)).toBe(0);
    // Undoing the cooking is refused while its portion is eaten; the camp with steps done can't be undone either.
    expect((await undoLatest(world.playerA, t, 'camp.cook')).ok).toBe(false);
    expect((await undoLatest(world.playerA, t, 'camp.open')).ok).toBe(false);
    // Reed's meal undone: the bread is back.
    expect((await undoLatest(world.playerA, t, 'camp.eat')).ok).toBe(true);
    expect(await qtyOf(t.lines.bread)).toBe(1);
  });

  it("a player can't eat, cook or talk for another player's character; the GM can", async () => {
    const t = await freshCamp();
    const camp = await ok(open(t, world.playerA));
    expect((await as(world.playerB, eatAtCamp, { campId: camp.id, actor: t.reed, fromPot: false, lineId: t.lines.bread })).ok).toBe(false);
    // Straight to the database too, past the app's check.
    expect((await world.playerB.db.rpc('eat_at_camp', { camp: camp.id, actor: t.reed.id, from_pot: false, line: t.lines.bread })).error).not.toBeNull();
    expect((await world.playerB.db.rpc('cook_at_camp', { camp: camp.id, cook: t.reed.id, ingredients: [{ line: t.lines.eel, qty: 1 }], portions: 2 })).error).not.toBeNull();
    // Nor eat from someone else's pack for their own character.
    expect((await world.playerB.db.rpc('eat_at_camp', { camp: camp.id, actor: t.moss.id, from_pot: false, line: t.lines.bread })).error).not.toBeNull();
    // A player can't write the rows directly.
    expect((await world.playerA.db.from('camp_entries').insert({ camp_id: camp.id, campaign_id: t.campaignId, group_number: 1, kind: 'talk', actor_id: t.reed.id, outcome: 'worked' })).error).not.toBeNull();
    expect(await qtyOf(t.lines.bread)).toBe(1);
    await ok(as(world.gm, eatAtCamp, { campId: camp.id, actor: t.reed, fromPot: false, lineId: t.lines.bread }));
    const talk = await ok(as(world.playerB, campTalk, { campId: camp.id, actor: t.moss, outcome: 'worked' }));
    expect(talk.outcome).toBe('worked');
  });
});
