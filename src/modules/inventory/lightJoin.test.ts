// Stacks join (Q2: fb5-1 to fb5-3, sw-1 to sw-9; docs/05 "Stackable things join into one stack"), run through the
// app's registry on the stand-in database (src/testing/fakeDb.ts mirrors public.join_added_line, public.move_into_stack
// and the join's Undo in supabase/migrations/20261121120000_q2_stacks_join.sql; supabase/tests/q2-stacks.test.ts runs
// the same cases on the real one). Invented names, items and figures only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type Command, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { cameBackText, isJoin, mayUndo, undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { timeUnits } from '../expedition/clock.ts';
import { lightOptions } from '../expedition/lightPlay.ts';
import { carriedLoad, combineEncumbrance, toLoadLine } from './encumbrance.ts';
import { addItem, equipItem, loadInventory, moveItem, removeItem, type CarrierRef, type InventoryLine, type ItemCopy } from './inventory.ts';

type Row = Record<string, unknown>;
const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;
let sam: CurrentUser;
let lena: CurrentUser;
let wren: CarrierRef;
let ash: CarrierRef;
let stash: CarrierRef;

const ENTRIES: Row[] = [
  { id: 'e-torch', name: 'Reed torch', data: { category: 'light', weightCoin: 1, slots: 1, stack: 5, lightTypeId: 'reed-torch' } },
  // Another pack entry of the same light: plural, other capitals, and twice the weight.
  { id: 'e-torches', name: 'REED TORCHES', data: { category: 'light', weightCoin: 2, slots: 2, stack: 5, lightTypeId: 'reed-torch' } },
  { id: 'e-rushlight', name: 'Rushlight', data: { category: 'light', weightCoin: 1, slots: 1, stack: 5, lightTypeId: 'reed-torch' } },
  { id: 'e-sack', name: 'Reed sack', data: { category: 'gear', weightCoin: 5, slots: 1, container: { capacitySlots: 4 } } },
  { id: 'e-wand', name: 'Fen wands', data: { category: 'wand', weightCoin: 1, stack: 5, charges: { formula: '2' } } },
];
const item = (id: string): ItemCopy => {
  const entry = ENTRIES.find((e) => e.id === id)!;
  const data = entry.data as Row;
  return { libraryEntryId: id, name: String(entry.name), category: String(data.category), weightCoin: Number(data.weightCoin), slots: Number(data.slots ?? 1), stack: Number(data.stack ?? 1) };
};
const oneOff = (name: string): ItemCopy => ({ libraryEntryId: null, name, category: 'light', weightCoin: 1, slots: 1, stack: 5 });

// A coin mode and a slot mode, each with no misc-gear weight, so a load is exactly what its lines weigh.
const rules = combineEncumbrance([
  {
    coin: { maxLoadCoin: 1000, miscGearCoin: 0, miscGearCategories: [], tiers: [{ label: 'Easy', max: 1000, effect: 'Full pace' }], overMax: 'Stuck' },
    slot: { baseSlots: 20, tiers: [{ label: 'Light', maxSlots: 20, effect: 'Normal pace' }], overMax: "Can't move" },
  },
]);

async function as<I, T, O>(user: CurrentUser, command: Command<I, T, O>, input: I, requestId?: string) {
  world.signInAs(user.id);
  return runCommand(registry, world.db, user, command, input, requestId ? { requestId } : {});
}
const add = (user: CurrentUser, carrier: CarrierRef, entry: string, qty: number, extra: Partial<Parameters<typeof addItem.run>[2]> = {}) =>
  as(user, addItem, { carrier, item: item(entry), qty, howGot: 'found', ...extra });
const linesOf = (carrier: CarrierRef) =>
  world.tables.inventory_lines.filter((l) => (l.actor_id ?? null) === carrier.actorId && (l.location_id ?? null) === carrier.locationId);
const counts = (carrier: CarrierRef) => linesOf(carrier).map((l) => [l.name, l.qty]);
async function inventoryOf(carrier: CarrierRef): Promise<InventoryLine[]> {
  world.signInAs(gm.id);
  const read = await loadInventory(world.db, campaign);
  return read!.lines.filter((l) => l.actorId === carrier.actorId && l.locationId === carrier.locationId);
}
/** The carried total in each mode, as the Pack works it out (encumbrance.ts). */
async function loads(carrier: CarrierRef): Promise<{ coin: number; slot: number }> {
  const lines = (await inventoryOf(carrier)).map(toLoadLine);
  const load = (mode: 'coin' | 'slot') => {
    const carried = carriedLoad(lines, rules, mode);
    return carried.mode === 'none' ? 0 : carried.load;
  };
  return { coin: load('coin'), slot: load('slot') };
}
const newestBy = (user: CurrentUser) => [...world.tables.events].filter((e) => e.actor_user_id === user.id && !e.reverts_event_id).sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
const undo = (user: CurrentUser) => {
  const event = newestBy(user);
  return as(user, undoChange, { campaignId: campaign, eventId: String(event.id), authorUserId: String(event.actor_user_id) });
};
async function newestLine(user: CurrentUser): Promise<string> {
  world.signInAs(user.id);
  const log = await loadLog(world.db, campaign);
  const names = await loadLogNames(world.db, campaign, user.id);
  return describeEntry(groupEntries(log!.events)[0]!, names);
}
async function newestEntryEvents(user: CurrentUser) {
  world.signInAs(user.id);
  const log = await loadLog(world.db, campaign);
  return groupEntries(log!.events)[0]!;
}
const lineNamed = (carrier: CarrierRef, name: string) => linesOf(carrier).find((l) => l.name === name)!;
const ref = (line: Row, carrier: CarrierRef) => ({ id: String(line.id), carrier, version: Number(line.version) });

beforeEach(async () => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@weirs.example', 'Priya');
  const samId = world.addPerson('sam@weirs.example', 'Sam');
  const lenaId = world.addPerson('lena@weirs.example', 'Lena');
  campaign = world.addCampaign('The Eel Weirs', gmId);
  const wrenId = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  const ashId = world.addCharacter(campaign, 'Ash', { ownerId: lenaId });
  world.addMember(campaign, samId, 'player', wrenId);
  world.addMember(campaign, lenaId, 'player', ashId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
  sam = { id: samId, roles: { [campaign]: 'player' } };
  lena = { id: lenaId, roles: { [campaign]: 'player' } };
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gmId, campaign_id: null, name: 'Fen kit', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-21T12:00:00Z', extra_meta: {} });
  for (const e of ENTRIES) world.tables.library_entries.push({ ...e, pack_id: 'pack-fen', kind: 'item', pack_entry_id: String(e.id).slice(2) });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen kit', option_choices: {}, overrides: {}, priority: 1 });
  // The stash is made on the first read of the campaign's places.
  world.signInAs(gmId);
  await world.db.from('purses' as never).select('*');
  const stashId = world.tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash')!.id as string;
  stash = { campaignId: campaign, actorId: null, locationId: stashId, ownerUserId: null, archived: false };
  wren = { campaignId: campaign, actorId: wrenId, locationId: null, ownerUserId: samId, archived: false };
  ash = { campaignId: campaign, actorId: ashId, locationId: null, ownerUserId: lenaId, archived: false };
});

describe('an added thing joins a same-name stack (sw-1, fb5-1)', () => {
  // Purpose: "Reed torch ×2" and an added "REED TORCHES" ×3 from another pack entry are one line of 5, counted at the
  // stack's weight (sw-7, option A): the carried total is 5 by weight and 1 slot, not 2 + 6 and two slots' worth.
  it('two pack entries of one name, capitals and plural aside, make one line of 5 at the older line’s figures', async () => {
    expect(await add(sam, wren, 'e-torch', 2)).toMatchObject({ ok: true });
    expect(await loads(wren)).toEqual({ coin: 2, slot: 1 });
    const joined = await add(sam, wren, 'e-torches', 3);
    expect(joined).toMatchObject({ ok: true, value: { name: 'Reed torch', qty: 5, weightCoin: 1, slots: 1, libraryEntryId: 'e-torch' } });
    expect(counts(wren)).toEqual([['Reed torch', 5]]);
    expect(await loads(wren)).toEqual({ coin: 5, slot: 1 });
    // One log line for the add, saying what was added.
    expect(await newestLine(sam)).toBe('You added Reed torch ×3 to Wren.');
  });

  // Purpose: the picker ("Which light?") lists one row for the joined stack, "Reed torch ×5" (fb5-1).
  it('the light picker lists one row of 5', async () => {
    await add(sam, wren, 'e-torch', 2);
    await add(sam, wren, 'e-torches', 3);
    const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
    const options = lightOptions(await inventoryOf(wren), new Map([['reed-torch', { name: 'Reed torch', duration: 6, unit: 'turn', consumed: true }]]), units);
    expect(options.map((o) => [o.line.name, o.line.qty])).toEqual([['Reed torch', 5]]);
  });

  // Purpose: Undo of the add takes the added count back off and leaves the stack as it was; one log line for the add,
  // one for its Undo; the carried total is back to the 2 (fb5-2, sw-4, sw-7).
  it('Undo of the add leaves the 2, and the carried total with them', async () => {
    await add(sam, wren, 'e-torch', 2);
    await add(sam, wren, 'e-torches', 3);
    const entry = await newestEntryEvents(sam);
    expect(mayUndo(entry.main.type, entry.events)).toBe(true);
    expect(await undo(sam)).toMatchObject({ ok: true, value: { left: 3, of: 3 } });
    expect(counts(wren)).toEqual([['Reed torch', 2]]);
    expect(await loads(wren)).toEqual({ coin: 2, slot: 1 });
    expect(world.tables.events.filter((e) => e.target_table === 'inventory_lines' && e.reverts_event_id)).toHaveLength(1);
  });

  // Purpose: with some used since, Undo takes back what's left of the added part, never going below what the stack had,
  // and says so; with none of it left it refuses with the reason (sw-4, as the give's 5b).
  it('after some were used, Undo takes back what is left and says so; with none left it refuses', async () => {
    await add(sam, wren, 'e-torch', 2);
    const joined = await add(sam, wren, 'e-torches', 3);
    if (!joined.ok) throw new Error(joined.message);
    const addEvent = newestBy(sam);
    expect(await as(sam, removeItem, { line: ref(lineNamed(wren, 'Reed torch'), wren), qty: 1, of: 5 })).toMatchObject({ ok: true });
    const undone = await as(sam, undoChange, { campaignId: campaign, eventId: String(addEvent.id), authorUserId: sam.id });
    expect(undone).toMatchObject({ ok: true, value: { left: 2, of: 3 } });
    expect(cameBackText(undone.ok ? undone.value : null)).toBe('2 of 3 Reed torch came back, Wren used 1');
    expect(counts(wren)).toEqual([['Reed torch', 2]]);
    expect(await loads(wren)).toEqual({ coin: 2, slot: 1 });

    const again = await add(sam, wren, 'e-torches', 3);
    if (!again.ok) throw new Error(again.message);
    const second = newestBy(sam);
    expect(await as(sam, removeItem, { line: ref(lineNamed(wren, 'Reed torch'), wren), qty: 3, of: 5 })).toMatchObject({ ok: true });
    expect(await as(sam, undoChange, { campaignId: campaign, eventId: String(second.id), authorUserId: sam.id })).toMatchObject({ ok: false, message: 'None of it is left, so nothing can come back.' });
    expect(counts(wren)).toEqual([['Reed torch', 2]]);
  });

  // Purpose: the same add tried again with its request id (an offline retry) adds once.
  it('a retried add adds once', async () => {
    await add(sam, wren, 'e-torch', 2);
    const requestId = crypto.randomUUID();
    const input = { carrier: wren, item: item('e-torches'), qty: 3, howGot: 'found' as const };
    expect(await as(sam, addItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(await as(sam, addItem, input, requestId)).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(counts(wren)).toEqual([['Reed torch', 5]]);
  });

  // Purpose: what doesn't match keeps its own line: another name; another place (a container, or worn); a one-off; a
  // thing with charges; a character still waiting for approval (creation's records count each pick's lines).
  it('another name, another place, a one-off, a charged thing or a character waiting for approval keep their own line', async () => {
    await add(sam, wren, 'e-torch', 2);
    await add(sam, wren, 'e-rushlight', 2);
    const sack = await add(sam, wren, 'e-sack', 1);
    if (!sack.ok) throw new Error(sack.message);
    await add(sam, wren, 'e-torch', 3, { containerLineId: sack.value.id });
    await add(sam, wren, 'e-torch', 1, { equipped: true });
    await as(sam, addItem, { carrier: wren, item: oneOff('Reed torch'), qty: 2, howGot: 'found' });
    await add(gm, wren, 'e-wand', 2);
    await add(gm, wren, 'e-wand', 2);
    expect(linesOf(wren).map((l) => [l.name, l.qty, l.container_line_id ?? null, l.equipped ?? false]).sort()).toEqual(
      [
        ['Reed torch', 2, null, false],
        ['Rushlight', 2, null, false],
        ['Reed sack', 1, null, false],
        ['Reed torch', 3, sack.value.id, false],
        ['Reed torch', 1, null, true],
        ['Reed torch', 2, null, false],
        ['Fen wands', 2, null, false],
        ['Fen wands', 2, null, false],
      ].sort(),
    );
    const draft = world.addCharacter(campaign, 'Tam', { ownerId: sam.id, approval: 'pending' });
    const tam: CarrierRef = { campaignId: campaign, actorId: draft, locationId: null, ownerUserId: sam.id, archived: false };
    await add(gm, tam, 'e-torch', 2);
    await add(gm, tam, 'e-torch', 2);
    expect(counts(tam)).toEqual([
      ['Reed torch', 2],
      ['Reed torch', 2],
    ]);
  });

  // Purpose: a lit light, or one partly burnt (put out with time left), is never joined (sw-3).
  it('a lit or partly burnt light is not joined', async () => {
    const lit = await add(sam, wren, 'e-torch', 2);
    if (!lit.ok) throw new Error(lit.message);
    world.tables.character_lights.push({ id: 'light-wren', actor_id: wren.actorId, campaign_id: campaign, line_id: lit.value.id, lit_at: 0, left_seconds: null, version: 1 });
    await add(sam, wren, 'e-torch', 3);
    expect(counts(wren)).toEqual([
      ['Reed torch', 2],
      ['Reed torch', 3],
    ]);
    world.tables.character_lights[0]!.lit_at = null;
    world.tables.character_lights[0]!.left_seconds = 300;
    await add(sam, wren, 'e-torch', 1);
    // The partly burnt stack is passed over; the other stack takes it.
    expect(counts(wren)).toEqual([
      ['Reed torch', 2],
      ['Reed torch', 4],
    ]);
  });

  // Purpose: the party stash is a place too: things stack inside it by the same rule (sw-2).
  it('joins in the party stash', async () => {
    await add(sam, stash, 'e-torch', 2);
    await add(lena, stash, 'e-torches', 4);
    expect(counts(stash)).toEqual([['Reed torch', 6]]);
  });
});

describe('a give or a move joins where it lands (sw-6, sw-9)', () => {
  // Purpose: part of a stack given to a character with a same-name stack is counted over, no line made; Undo puts the
  // counts back; the carried totals of both are right after each (sw-7).
  it('part of a stack given joins the other stack, and Undo puts both back', async () => {
    await add(sam, wren, 'e-torch', 5);
    await add(lena, ash, 'e-torches', 3);
    expect(await as(sam, moveItem, { line: ref(lineNamed(wren, 'Reed torch'), wren), to: ash, qty: 2, of: 5 })).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(counts(wren)).toEqual([['Reed torch', 3]]);
    expect(counts(ash)).toEqual([['REED TORCHES', 5]]);
    // Ash's stack keeps its own name and figures: 2 by weight and 2 slots for each 5.
    expect(await loads(wren)).toEqual({ coin: 3, slot: 1 });
    expect(await loads(ash)).toEqual({ coin: 10, slot: 2 });
    expect(await newestLine(sam)).toBe('You moved REED TORCHES ×2 to Ash.');
    expect(await undo(sam)).toMatchObject({ ok: true });
    expect(counts(wren)).toEqual([['Reed torch', 5]]);
    expect(counts(ash)).toEqual([['REED TORCHES', 3]]);
    expect(await loads(wren)).toEqual({ coin: 5, slot: 1 });
    expect(await loads(ash)).toEqual({ coin: 6, slot: 2 });
  });

  // Purpose: a whole line given onto a same-name stack is merged in and removed, the log keeping its full copy; Undo
  // makes it again as its own line with its count, and the other keeps theirs (sw-9's "A").
  it('a whole line given is merged in and removed; Undo makes it again', async () => {
    const given = await add(sam, wren, 'e-torch', 3);
    if (!given.ok) throw new Error(given.message);
    await add(lena, ash, 'e-torch', 2);
    expect(await as(sam, moveItem, { line: ref(lineNamed(wren, 'Reed torch'), wren), to: ash, qty: 3, of: 3 })).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(counts(wren)).toEqual([]);
    expect(counts(ash)).toEqual([['Reed torch', 5]]);
    expect(await loads(wren)).toEqual({ coin: 0, slot: 0 });
    expect(await loads(ash)).toEqual({ coin: 5, slot: 1 });
    const removal = world.tables.events.find((e) => e.target_id === given.value.id && e.after === null);
    expect(removal?.before).toMatchObject({ name: 'Reed torch', qty: 3, actor_id: wren.actorId });
    const entry = await newestEntryEvents(sam);
    expect(mayUndo(entry.main.type, entry.events)).toBe(true);
    expect(await newestLine(sam)).toBe('You moved Reed torch ×3 to Ash.');
    expect(await undo(sam)).toMatchObject({ ok: true });
    expect(counts(wren)).toEqual([['Reed torch', 3]]);
    expect(lineNamed(wren, 'Reed torch').id).toBe(given.value.id);
    expect(counts(ash)).toEqual([['Reed torch', 2]]);
    expect(await loads(wren)).toEqual({ coin: 3, slot: 1 });
    expect(await loads(ash)).toEqual({ coin: 2, slot: 1 });
  });

  // Purpose: after the receiver used some, Undo of a whole give brings back what's left of it and says so.
  it('a merged give whose receiver used some comes back with what is left', async () => {
    await add(sam, wren, 'e-torch', 3);
    await add(lena, ash, 'e-torch', 2);
    await as(sam, moveItem, { line: ref(lineNamed(wren, 'Reed torch'), wren), to: ash, qty: 3, of: 3 });
    const gave = newestBy(sam);
    await as(lena, removeItem, { line: ref(lineNamed(ash, 'Reed torch'), ash), qty: 1, of: 5 });
    const undone = await as(sam, undoChange, { campaignId: campaign, eventId: String(gave.id), authorUserId: sam.id });
    expect(undone).toMatchObject({ ok: true, value: { left: 2, of: 3, by: 'Ash' } });
    expect(counts(wren)).toEqual([['Reed torch', 2]]);
    expect(counts(ash)).toEqual([['Reed torch', 2]]);
  });

  // Purpose: a stack taken out of a bag joins the loose stack of the same name, and moved from the stash joins too.
  it('moves inside a pack and out of the stash join', async () => {
    const sack = await add(sam, wren, 'e-sack', 1);
    if (!sack.ok) throw new Error(sack.message);
    await add(sam, wren, 'e-torch', 2);
    await add(sam, wren, 'e-torch', 3, { containerLineId: sack.value.id });
    const inBag = linesOf(wren).find((l) => l.container_line_id === sack.value.id)!;
    expect(await as(sam, moveItem, { line: ref(inBag, wren), to: wren, containerLineId: null, qty: 3, of: 3 })).toMatchObject({ ok: true, value: { qty: 5 } });
    expect(counts(wren).sort()).toEqual([
      ['Reed sack', 1],
      ['Reed torch', 5],
    ]);
    expect(await loads(wren)).toEqual({ coin: 10, slot: 2 });
    await add(sam, stash, 'e-torch', 4);
    await as(sam, moveItem, { line: ref(lineNamed(stash, 'Reed torch'), stash), to: wren, qty: 4, of: 4 });
    expect(await newestLine(sam)).toBe('Wren took Reed torch ×4 from the party stash.');
    expect(counts(wren).sort()).toEqual([
      ['Reed sack', 1],
      ['Reed torch', 9],
    ]);
  });

  // Purpose: a one-off given keeps its own line (it may wait for the GM where it lands), and a worn stack moved is
  // taken off and joins.
  it('a one-off given stays its own line; a worn stack put down joins', async () => {
    await as(gm, addItem, { carrier: wren, item: oneOff('Reed torch'), qty: 2, howGot: 'found' });
    await add(lena, ash, 'e-torch', 2);
    const odd = linesOf(wren)[0]!;
    await as(sam, moveItem, { line: ref(odd, wren), to: ash, qty: 2, of: 2 });
    expect(counts(ash)).toEqual([
      ['Reed torch', 2],
      ['Reed torch', 2],
    ]);
    const held = await add(lena, ash, 'e-rushlight', 1, { equipped: false });
    if (!held.ok) throw new Error(held.message);
    await as(lena, equipItem, { line: ref(linesOf(ash).find((l) => l.id === held.value.id)!, ash), equipped: true });
    await add(lena, ash, 'e-rushlight', 2);
    const worn = linesOf(ash).find((l) => l.id === held.value.id)!;
    expect(await as(lena, moveItem, { line: ref(worn, ash), to: ash, qty: 1, of: 1 })).toMatchObject({ ok: true, value: { qty: 3 } });
  });
});

describe('the log and Undo read a join', () => {
  // Purpose: a join's change is told apart from any other count change (an add's or a move's raise only).
  it('isJoin', () => {
    expect(isJoin('inventory.add', { before: { qty: 2 }, after: { qty: 5 } })).toBe(true);
    expect(isJoin('inventory.move', { before: { qty: 2 }, after: { qty: 5 } })).toBe(true);
    expect(isJoin('inventory.move', { before: { qty: 5 }, after: { qty: 3 } })).toBe(false);
    expect(isJoin('inventory.setQty', { before: { qty: 2 }, after: { qty: 5 } })).toBe(false);
    expect(isJoin('inventory.add', { before: null, after: { qty: 5 } })).toBe(false);
  });
});
