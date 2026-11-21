// Stacks join (Q2: fb5-1 to fb5-3, sw-1 to sw-9; supabase/migrations/20261121120000_q2_stacks_join.sql). TEST project
// only; invented content. A stackable thing from the setting rules added, given or moved to a same-name stack in the
// same place (capitals and plural aside, even from another pack entry) joins it: the stack keeps its own figures and
// weight. Undo takes back the added count while the stack holds at least that many above what it had; with fewer,
// what's left, and says so; none left, refused. A whole line given onto a stack is merged in and removed, the log
// keeping its copy, and Undo makes it again. The carried total is right in both modes after each.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { carriedLoad, combineEncumbrance, toLoadLine } from '../../src/modules/inventory/encumbrance.ts';
import { addItem, approveItem, loadInventory, moveItem, removeItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input, requestId ? { requestId } : {});
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const ash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false });
let stashId = '';
const stash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: null, locationId: stashId, ownerUserId: null, archived: false });

// A coin mode and a slot mode with no misc-gear weight, so a load is exactly what its lines weigh.
const rules = combineEncumbrance([
  {
    coin: { maxLoadCoin: 1000, miscGearCoin: 0, miscGearCategories: [], tiers: [{ label: 'Easy', max: 1000, effect: 'Full pace' }], overMax: 'Stuck' },
    slot: { baseSlots: 20, tiers: [{ label: 'Light', maxSlots: 20, effect: 'Normal pace' }], overMax: "Can't move" },
  },
]);

let made = 0;
/**
 * A pack of its own for each case (so no case finds another's stack): "<Name> torch" (weight 1, 1 slot for 5), and
 * the same light as another entry, "<NAME> TORCHES" (weight 2, 2 slots for 5). Returns what to add.
 */
async function torches(): Promise<{ name: string; one: ItemCopy; other: ItemCopy }> {
  made += 1;
  const name = `Sedge${made} torch`;
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: `Stacks ${made}` },
      items: [
        { id: 'torch', name, category: 'light', weightCoin: 1, slots: 1, stack: 5 },
        { id: 'torches', name: `${name.toUpperCase()}ES`, category: 'light', weightCoin: 2, slots: 2, stack: 5 },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const pack = await as(world.gm, importPack, { pack: read.pack });
  if (!pack.ok) throw new Error(pack.message);
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId: pack.value });
  const rows = must(await world.gm.db.from('library_entries').select('id, pack_entry_id').eq('pack_id', pack.value));
  const id = (entry: string) => rows.find((r) => r.pack_entry_id === entry)!.id as string;
  const copy = (entry: string, weightCoin: number, slots: number): ItemCopy => ({ libraryEntryId: id(entry), name: 'what the device says', category: 'light', weightCoin, slots, stack: 5 });
  return { name, one: copy('torch', 1, 1), other: copy('torches', 2, 2) };
}
const add = async (person: Person, carrier: CarrierRef, item: ItemCopy, qty: number) => {
  const added = await as(person, addItem, { carrier, item, qty, howGot: 'found' });
  if (!added.ok) throw new Error(added.message);
  return added.value;
};
/** A carrier's lines of one stack name (capitals aside), as [name, qty]. */
const stackOn = async (carrier: CarrierRef, name: string) =>
  must(
    await world.admin
      .from('inventory_lines')
      .select('id, name, qty, weight_coin')
      .eq('campaign_id', world.campaignId)
      .ilike('name', `${name}%`)
      .match(carrier.actorId ? { actor_id: carrier.actorId } : { location_id: carrier.locationId! })
      .order('created_at'),
  );
/** The carried total of a carrier's lines of this stack, in each mode, as the Pack works it out. */
async function loads(carrier: CarrierRef, name: string): Promise<{ coin: number; slot: number }> {
  const read = await loadInventory(asDb(world.gm), world.campaignId);
  const lines = read!.lines.filter((l) => l.actorId === carrier.actorId && l.locationId === carrier.locationId && l.name.toLowerCase().startsWith(name.toLowerCase())).map(toLoadLine);
  const load = (mode: 'coin' | 'slot') => {
    const carried = carriedLoad(lines, rules, mode);
    return carried.mode === 'none' ? 0 : carried.load;
  };
  return { coin: load('coin'), slot: load('slot') };
}
const newest = async (person: Person, type: string) =>
  must(await person.db.from('events').select('id').eq('type', type).eq('actor_user_id', person.id).is('reverts_event_id', null).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, eventId: string, author = person) => as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: author.id });

beforeAll(async () => {
  world = await buildWorld();
  stashId = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
}, 300_000);
afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('an add joins a same-name stack (sw-1)', () => {
  // Purpose: "<x> torch" ×2 and an added "<X> TORCHES" ×3 from another entry are one line of 5 at the older line's
  // figures (sw-7, option A); the carried total is 5 by weight and 1 slot; one log line, logged as the add.
  it('one line of 5, counted at the stack’s weight; its Undo leaves the 2', async () => {
    const t = await torches();
    const first = await add(world.playerA, wren(), t.one, 2);
    expect(await loads(wren(), t.name)).toEqual({ coin: 2, slot: 1 });
    const joined = await add(world.playerA, wren(), t.other, 3);
    expect(joined).toMatchObject({ id: first.id, name: t.name, qty: 5, weightCoin: 1, slots: 1 });
    expect(await stackOn(wren(), t.name)).toEqual([{ id: first.id, name: t.name, qty: 5, weight_coin: 1 }]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 5, slot: 1 });
    const eventId = await newest(world.playerA, 'inventory.add');
    expect(must(await world.admin.from('events').select('before, after').eq('id', eventId))).toEqual([{ before: { qty: 2 }, after: { qty: 5 } }]);
    expect(await undo(world.playerA, eventId)).toMatchObject({ ok: true, value: { left: 3, of: 3 } });
    expect(await stackOn(wren(), t.name)).toEqual([{ id: first.id, name: t.name, qty: 2, weight_coin: 1 }]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 2, slot: 1 });
    expect(await undo(world.playerA, eventId)).toMatchObject({ ok: false });
  });

  // Purpose: some used since: Undo takes back what's left of the added part and says so, never below what the stack
  // had; all of it used: refused with the reason, and nothing changes (sw-4).
  it('Undo after some were used takes back what is left; with none left it refuses', async () => {
    const t = await torches();
    const first = await add(world.playerA, wren(), t.one, 2);
    await add(world.playerA, wren(), t.other, 3);
    const eventId = await newest(world.playerA, 'inventory.add');
    expect(await as(world.playerA, removeItem, { line: { id: first.id, carrier: wren() }, qty: 1, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, eventId)).toMatchObject({ ok: true, value: { left: 2, of: 3, by: 'Wren of the Lantern Wardens' } });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2]);

    await add(world.playerA, wren(), t.other, 3);
    const again = await newest(world.playerA, 'inventory.add');
    expect(await as(world.playerA, removeItem, { line: { id: first.id, carrier: wren() }, qty: 3, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, again)).toMatchObject({ ok: false, message: 'None of it is left, so nothing can come back.' });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2]);
  });

  // Purpose: an add that joins keeps its price and the GM's note on its own log line (its reason), never on the stack;
  // a player can't call their add a gift (review finding 1).
  it('a joined add keeps its price and note on its log line', async () => {
    const t = await torches();
    const first = await add(world.playerA, wren(), t.one, 2);
    expect(await as(world.playerA, addItem, { carrier: wren(), item: t.other, qty: 3, howGot: 'bought', cost: '6 cp' })).toMatchObject({ ok: true, value: { id: first.id, qty: 5 } });
    const bought = await newest(world.playerA, 'inventory.add');
    const [line] = must(await world.admin.from('events').select('reason, after').eq('id', bought));
    expect(JSON.parse(String(line!.reason))).toEqual({ join: { howGot: 'bought', cost: '6 cp', note: '' } });
    expect(line!.after).toEqual({ qty: 5 });
    expect(await as(world.gm, addItem, { carrier: wren(), item: t.one, qty: 1, howGot: 'given', note: 'From the drowned shrine' })).toMatchObject({ ok: true, value: { qty: 6 } });
    const [given] = must(await world.admin.from('events').select('reason').eq('id', await newest(world.gm, 'inventory.add')));
    expect(JSON.parse(String(given!.reason))).toEqual({ join: { howGot: 'given', cost: '', note: 'From the drowned shrine' } });
    expect(must(await world.admin.from('inventory_lines').select('how_got, cost, notes').eq('id', first.id))).toEqual([{ how_got: 'found', cost: '', notes: '' }]);
    expect(await as(world.playerA, addItem, { carrier: wren(), item: t.one, qty: 1, howGot: 'given' })).toMatchObject({ ok: false });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([6]);
  });

  // Purpose: part of the joined stack put in a bag in the same pack is not given on: Undo takes back what's left and
  // says so; part given to another character refuses with the reason (sw-4; review finding 2).
  it('part moved into a bag leaves fewer to take back; part given away refuses', async () => {
    const t = await torches();
    const bag = await add(world.gm, wren(), { libraryEntryId: null, name: `${t.name} sack`, category: 'gear', weightCoin: 5, slots: 1, stack: 1, details: { container: { capacitySlots: 4 } } }, 1);
    const first = await add(world.playerA, wren(), t.one, 2);
    await add(world.playerA, wren(), t.other, 3);
    const joined = await newest(world.playerA, 'inventory.add');
    expect(await as(world.playerA, moveItem, { line: { id: first.id, carrier: wren() }, to: wren(), containerLineId: bag.id, qty: 2, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, joined)).toMatchObject({ ok: true, value: { left: 1, of: 3 } });
    expect(must(await world.admin.from('inventory_lines').select('qty').eq('id', first.id))).toEqual([{ qty: 2 }]);

    await add(world.playerA, wren(), t.other, 3);
    const again = await newest(world.playerA, 'inventory.add');
    expect(await as(world.playerA, moveItem, { line: { id: first.id, carrier: wren() }, to: ash(), qty: 2, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, again)).toMatchObject({ ok: false, message: 'Wren of the Lantern Wardens gave some to Ash the Reed Cutter.' });
    expect(must(await world.admin.from('inventory_lines').select('qty').eq('id', first.id))).toEqual([{ qty: 3 }]);
  });

  // Purpose: a stack renamed since refuses the Undo, saying so, and nothing changes (sw-4; review finding 5).
  it('a renamed stack refuses the Undo', async () => {
    const t = await torches();
    const first = await add(world.playerA, wren(), t.one, 2);
    await add(world.playerA, wren(), t.other, 3);
    const joined = await newest(world.playerA, 'inventory.add');
    expect(await as(world.gm, approveItem, { line: { id: first.id, carrier: wren() }, edits: { name: `${t.name} (bright)`, weightCoin: 1, slots: 1 } })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, joined)).toMatchObject({ ok: false, message: "Wren of the Lantern Wardens renamed it since, so it can't go back." });
    expect(must(await world.admin.from('inventory_lines').select('qty').eq('id', first.id))).toEqual([{ qty: 5 }]);
  });

  // Purpose: only things carried in numbers join (sw-10): two of a single thing (one to a slot, no bundle) stay a row
  // each, whatever the count; a thing sold as a bundle joins though one fills a slot.
  it('a single thing never joins; a bundled thing does', async () => {
    made += 1;
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: `Singles ${made}` },
        items: [
          { id: 'sword', name: `Fen${made} sword`, category: 'weapon', weightCoin: 6, slots: 1, stack: 1 },
          { id: 'rations', name: `Trail${made} rations (7)`, category: 'food', weightCoin: 7, slots: 1, stack: 1, bundle: 7, unitName: `Trail${made} ration` },
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const pack = await as(world.gm, importPack, { pack: read.pack });
    if (!pack.ok) throw new Error(pack.message);
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: pack.value });
    const rows = must(await world.gm.db.from('library_entries').select('id, pack_entry_id').eq('pack_id', pack.value));
    const copy = (entry: string): ItemCopy => ({ libraryEntryId: rows.find((r) => r.pack_entry_id === entry)!.id as string, name: 'what the device says', category: 'x', weightCoin: 1, slots: 1, stack: 1 });
    await add(world.playerA, wren(), copy('sword'), 1);
    await add(world.playerA, wren(), copy('sword'), 2);
    await add(world.playerA, wren(), copy('sword'), 1);
    expect((await stackOn(wren(), `Fen${made} sword`)).map((l) => l.qty)).toEqual([1, 2, 1]);
    await add(world.playerA, wren(), copy('rations'), 7);
    await add(world.playerA, wren(), copy('rations'), 7);
    expect((await stackOn(wren(), `Trail${made} ration`)).map((l) => l.qty)).toEqual([14]);
  });

  // Purpose: the same add tried again with its request id (an offline retry after a lost answer) adds once.
  it('a retried add adds once', async () => {
    const t = await torches();
    await add(world.playerA, wren(), t.one, 2);
    const requestId = crypto.randomUUID();
    const input = { carrier: wren(), item: t.other, qty: 3, howGot: 'found' as const };
    expect(await as(world.playerA, addItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(await as(world.playerA, addItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 5 } });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([5]);
  });

  // Purpose: a lit light, or one partly burnt, is never joined (sw-3); the stash stacks by the same rule (sw-2).
  it('a lit light keeps its line; the party stash joins', async () => {
    const t = await torches();
    const lit = await add(world.playerA, wren(), t.one, 2);
    const pointed = must(await world.admin.from('character_lights').update({ line_id: lit.id, name: t.name, lit_at: 0 }).eq('actor_id', world.wrenId).select('id'));
    if (pointed.length === 0) must(await world.admin.from('character_lights').insert({ actor_id: world.wrenId, campaign_id: world.campaignId, line_id: lit.id, name: t.name, lit_at: 0 }).select('id'));
    await add(world.playerA, wren(), t.one, 3);
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2, 3]);
    must(await world.admin.from('character_lights').update({ lit_at: null, left_seconds: 300 }).eq('actor_id', world.wrenId).select('id'));
    await add(world.playerA, wren(), t.one, 1);
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2, 4]);
    must(await world.admin.from('character_lights').update({ line_id: null, left_seconds: null }).eq('actor_id', world.wrenId).select('id'));

    await add(world.playerA, stash(), t.one, 2);
    await add(world.playerB, stash(), t.other, 4);
    expect((await stackOn(stash(), t.name)).map((l) => l.qty)).toEqual([6]);
  });
});

describe('a give or a move joins where it lands (sw-6, sw-9)', () => {
  // Purpose: part of a stack given to another player's character joins their stack (no line made), and the giver's
  // Undo puts both counts back; the carried totals are right after each (sw-7).
  it('part of a stack given joins the stack there; Undo puts both back', async () => {
    const t = await torches();
    await add(world.playerA, wren(), t.one, 5);
    const theirs = await add(world.playerB, ash(), t.other, 3);
    const [mine] = await stackOn(wren(), t.name);
    expect(await as(world.playerA, moveItem, { line: { id: mine!.id as string, carrier: wren() }, to: ash(), qty: 2, of: 5 })).toMatchObject({ ok: true, value: { id: theirs.id, qty: 5 } });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([3]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([5]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 3, slot: 1 });
    expect(await loads(ash(), t.name)).toEqual({ coin: 10, slot: 2 });
    expect(await undo(world.playerA, await newest(world.playerA, 'inventory.move'))).toMatchObject({ ok: true });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([5]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([3]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 5, slot: 1 });
    expect(await loads(ash(), t.name)).toEqual({ coin: 6, slot: 2 });
  });

  // Purpose: a whole line given onto a same-name stack is merged in and removed, its full copy in the log; Undo makes
  // it again, the same line with its count, and the receiver keeps theirs (sw-9's "A"); a receiver who used some
  // gives back only what's left of it, and the undo says so.
  it('a whole line given is merged in and removed; Undo makes it again', async () => {
    const t = await torches();
    const mine = await add(world.playerA, wren(), t.one, 3);
    await add(world.playerB, ash(), t.one, 2);
    expect(await as(world.playerA, moveItem, { line: { id: mine.id, carrier: wren() }, to: ash(), qty: 3, of: 3 })).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(await stackOn(wren(), t.name)).toEqual([]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([5]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 0, slot: 0 });
    expect(await loads(ash(), t.name)).toEqual({ coin: 5, slot: 1 });
    const [copy] = must(await world.admin.from('events').select('before').eq('target_id', mine.id).is('after', null));
    expect(copy!.before).toMatchObject({ name: t.name, qty: 3, actor_id: world.wrenId });
    expect(await undo(world.playerA, await newest(world.playerA, 'inventory.move'))).toMatchObject({ ok: true });
    expect(await stackOn(wren(), t.name)).toEqual([{ id: mine.id, name: t.name, qty: 3, weight_coin: 1 }]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([2]);
    expect(await loads(wren(), t.name)).toEqual({ coin: 3, slot: 1 });
    expect(await loads(ash(), t.name)).toEqual({ coin: 2, slot: 1 });

    expect(await as(world.playerA, moveItem, { line: { id: mine.id, carrier: wren() }, to: ash(), qty: 3, of: 3 })).toMatchObject({ ok: true });
    const gave = await newest(world.playerA, 'inventory.move');
    const [theirs] = await stackOn(ash(), t.name);
    expect(await as(world.playerB, removeItem, { line: { id: theirs!.id as string, carrier: ash() }, qty: 1, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, gave)).toMatchObject({ ok: true, value: { left: 2, of: 3, by: 'Ash the Reed Cutter' } });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([2]);
  });

  // Purpose: the receiver handing the joined stack on stops the Undo, with the reason; nothing moves.
  it('a joined stack given on refuses the Undo with the reason', async () => {
    const t = await torches();
    const mine = await add(world.playerA, wren(), t.one, 3);
    await add(world.playerB, ash(), t.one, 2);
    await as(world.playerA, moveItem, { line: { id: mine.id, carrier: wren() }, to: ash(), qty: 3, of: 3 });
    const gave = await newest(world.playerA, 'inventory.move');
    const [theirs] = await stackOn(ash(), t.name);
    expect(await as(world.playerB, moveItem, { line: { id: theirs!.id as string, carrier: ash() }, to: stash(), qty: 5, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, gave)).toMatchObject({ ok: false });
    expect(await stackOn(wren(), t.name)).toEqual([]);
  });

  // Purpose: the same give tried again with its request id joins once; a player can't use the join to take from
  // another player's character.
  it('a retried give joins once; the join is no way round the access rules', async () => {
    const t = await torches();
    const mine = await add(world.playerA, wren(), t.one, 4);
    await add(world.playerB, ash(), t.one, 1);
    const requestId = crypto.randomUUID();
    const input = { line: { id: mine.id, carrier: wren() }, to: ash(), qty: 2, of: 4 };
    expect(await as(world.playerA, moveItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 3 } });
    expect(await as(world.playerA, moveItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 3 } });
    expect((await stackOn(wren(), t.name)).map((l) => l.qty)).toEqual([2]);
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([3]);
    const [theirs] = await stackOn(ash(), t.name);
    const taken = await world.playerA.db.rpc('move_into_stack', { line: theirs!.id, how_many: 1, to_actor: world.wrenId, to_location: null, to_container: null });
    expect(taken.data ?? null).toBeNull();
    expect((await stackOn(ash(), t.name)).map((l) => l.qty)).toEqual([3]);
  });
});
