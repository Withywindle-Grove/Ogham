// Take from the party stash and its Undo (K28, pk-3; hard rule 4), run through the app's registry on the stand-in
// database, and Take's words (K12). Invented names, items and tiers only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type Command, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import type { CarriedLoad } from './encumbrance.ts';
import { moveItem, removeItem, type CarrierRef } from './inventory.ts';
import { asksHowMany, readTake, takeLabel, takeLoadWords, takeRefusal, takeToast } from './stashTake.ts';

type Row = Record<string, unknown>;
const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;
let sam: CurrentUser;
let stash: CarrierRef;
let wren: CarrierRef;

async function as<I, T, O>(user: CurrentUser, command: Command<I, T, O>, input: I) {
  world.signInAs(user.id);
  return runCommand(registry, world.db, user, command, input);
}
const newestBy = (user: CurrentUser) => [...world.tables.events].filter((e) => e.actor_user_id === user.id && !e.reverts_event_id).sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
const undo = (user: CurrentUser) => {
  const event = newestBy(user);
  return as(user, undoChange, { campaignId: campaign, eventId: String(event.id), authorUserId: String(event.actor_user_id) });
};
/** The newest log line as this person reads it. */
async function newestLine(user: CurrentUser): Promise<string> {
  world.signInAs(user.id);
  const log = await loadLog(world.db, campaign);
  const names = await loadLogNames(world.db, campaign, user.id);
  return describeEntry(groupEntries(log!.events)[0]!, names);
}
const line = (id: string) => world.tables.inventory_lines.find((l) => l.id === id);
function stashLine(id: string, name: string, qty: number, item_data: Row = {}) {
  world.tables.inventory_lines.push({ id, campaign_id: campaign, actor_id: null, location_id: stash.locationId, name, qty, approval: 'approved', container_line_id: null, item_data, source_entry_id: null, version: 1, equipped: false });
}

beforeEach(async () => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@weirs.example', 'Priya');
  const samId = world.addPerson('sam@weirs.example', 'Sam');
  campaign = world.addCampaign('The Eel Weirs', gmId);
  const wrenId = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  world.addMember(campaign, samId, 'player', wrenId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
  sam = { id: samId, roles: { [campaign]: 'player' } };
  // The stash is made on the first read of the campaign's places.
  world.signInAs(gmId);
  await world.db.from('purses' as never).select('*');
  const stashId = world.tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash')!.id as string;
  stash = { campaignId: campaign, actorId: null, locationId: stashId, ownerUserId: null, archived: false };
  wren = { campaignId: campaign, actorId: wrenId, locationId: null, ownerUserId: samId, archived: false };
});

describe('Take from the party stash, through the app', () => {
  // Purpose: a player taking a whole thing reads, in the log, as the character: "Wren took Hooded lantern from the party
  // stash."; and its Undo puts it back in the stash.
  it('logs "Wren took <thing> from the party stash." and Undo restores the stash', async () => {
    stashLine('line-lantern', 'Hooded lantern', 1);
    expect(await as(sam, moveItem, { line: { id: 'line-lantern', carrier: stash }, to: wren, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(line('line-lantern')).toMatchObject({ actor_id: wren.actorId, location_id: null });
    expect(await newestLine(sam)).toBe('Wren took Hooded lantern from the party stash.');
    expect(await undo(sam)).toMatchObject({ ok: true });
    expect(line('line-lantern')).toMatchObject({ actor_id: null, location_id: stash.locationId });
  });

  // Purpose: part of a stack reads with its count ("Wren took 2 torches …"), and its Undo puts the count back on the
  // stash's stack.
  it('logs a stack’s count, and Undo puts the count back in the stash', async () => {
    stashLine('line-torch', 'Torch', 6, { unitName: 'torch', pluralName: 'torches' });
    expect(await as(sam, moveItem, { line: { id: 'line-torch', carrier: stash }, to: wren, qty: 2, of: 6 })).toMatchObject({ ok: true });
    expect(line('line-torch')).toMatchObject({ qty: 4 });
    expect(await newestLine(sam)).toBe('Wren took 2 torches from the party stash.');
    expect(await undo(sam)).toMatchObject({ ok: true });
    expect(line('line-torch')).toMatchObject({ qty: 6, location_id: stash.locationId });
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === wren.actorId)).toEqual([]);
  });
});

describe('a whole stack, and the GM, through the app (the lead, 2026-11-14)', () => {
  // Purpose: a whole stack taken at once names its count ("Wren took 6 torches …"), and the GM's take reads "Your GM
  // took …", from the log's own names on the stand-in database.
  it('names a whole stack’s count, and the GM as "Your GM"', async () => {
    stashLine('line-torch', 'Torch', 6, { unitName: 'torch', pluralName: 'torches' });
    expect(await as(sam, moveItem, { line: { id: 'line-torch', carrier: stash }, to: wren, qty: 6, of: 6 })).toMatchObject({ ok: true });
    expect(await newestLine(sam)).toBe('Wren took 6 torches from the party stash.');
    stashLine('line-lantern', 'Hooded lantern', 1);
    expect(await as(gm, moveItem, { line: { id: 'line-lantern', carrier: stash }, to: wren, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await newestLine(sam)).toBe('Your GM took Hooded lantern from the party stash.');
  });
});

describe('an item that left play (hard rule 4)', () => {
  // Purpose: a thing dropped from the stash is deleted, the log keeps its whole copy, and Undo restores it from that copy.
  it('keeps the dropped line’s copy in the log, and Undo restores it', async () => {
    stashLine('line-rope', 'Reed rope', 1, { note: 'Tarred' });
    expect(await as(gm, removeItem, { line: { id: 'line-rope', carrier: stash }, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(line('line-rope')).toBeUndefined();
    const dropped = world.tables.events.find((e) => e.target_id === 'line-rope' && e.after === null)!;
    expect(dropped.before).toMatchObject({ name: 'Reed rope', qty: 1, location_id: stash.locationId, item_data: { note: 'Tarred' } });
    expect(await undo(gm)).toMatchObject({ ok: true });
    expect(line('line-rope')).toMatchObject({ name: 'Reed rope', qty: 1, location_id: stash.locationId, item_data: { note: 'Tarred' } });
  });
});

describe('Take’s words (K12, frame PK4b)', () => {
  const tier = (label: string) => ({ label, max: 100, effect: '' });
  const coinLoad = (load: number, over: boolean): CarriedLoad => ({ mode: 'coin', load, capacity: 1200, tier: over ? null : tier('Light'), over, overMax: 'Can’t move' });
  const torch = { name: 'Torch', details: { unitName: 'torch', pluralName: 'torches' } };

  // Purpose: the toast says who took what, in the log line's words, and the taker's load after it, by coins or by slots.
  it('reads "<Taker> took <thing>. Load N of M coins’ weight."', () => {
    expect(takeToast('Wren', { name: 'Silver ewer', details: {} }, 1, coinLoad(413, false))).toEqual({ text: 'Wren took Silver ewer. Load 413 of 1,200 coins’ weight.', warning: null });
    expect(takeToast('Wren', torch, 2, coinLoad(60, false)).text).toBe('Wren took 2 torches. Load 60 of 1,200 coins’ weight.');
    expect(takeToast('Wren', { name: 'Reed rope', details: {} }, 3, { mode: 'slot', load: 9, capacity: 12, tier: tier('Laden'), over: false, overMax: '' }).text).toBe('Wren took Reed rope ×3. Load 9 of 12 slots.');
  });

  // Purpose: one thing taken reads by the pack's own name, never its piece's word ("Wren took Torch.", not "torch";
  // ⚑ 5 ruled A, 24 Nov); more than one keeps the count words.
  it('names one thing by the pack’s own name', () => {
    expect(takeToast('Wren', torch, 1, { mode: 'none' }).text).toBe('Wren took Torch.');
    expect(takeToast('Wren', { name: 'reed whistle', details: {} }, 1, { mode: 'none' }).text).toBe('Wren took Reed whistle.');
  });

  // Purpose: a taker put over the limit is told in the toast, on a warning line of its own, and the take is not stopped.
  it('warns past the limit, and says the thing alone where no load is counted', () => {
    expect(takeToast('Wren', { name: 'Reed chest', details: {} }, 1, coinLoad(1263, true))).toEqual({ text: 'Wren took Reed chest.', warning: 'Over the limit: 1,263 of 1,200.' });
    expect(takeToast('Wren', { name: 'Iron pot', details: {} }, 1, { mode: 'none' })).toEqual({ text: 'Wren took Iron pot.', warning: null });
    expect(takeLoadWords({ mode: 'none' })).toBeNull();
  });

  // Purpose: a stack's accent names the amount typed, and plain "Take" until a count it can take is typed.
  it('names the amount on the stack sheet’s accent', () => {
    expect(takeLabel(torch, '2', 6)).toBe('Take 2 torches');
    expect(takeLabel(torch, '1', 6)).toBe('Take 1 torch');
    expect(takeLabel({ name: 'reed', details: {} }, '1', 6)).toBe('Take Reed ×1');
    expect(takeLabel(torch, '', 6)).toBe('Take');
    expect(takeLabel(torch, '7', 6)).toBe('Take');
    expect(takeLabel({ name: 'Bead', details: {} }, '999', 999)).toBe('Take Bead ×999');
  });

  // Purpose: more than the stash has, 0, or something not a count is refused in words under the row, never guessed.
  it('refuses too many, 0 and words, and takes a whole count from 1 to what the stash has', () => {
    expect(takeRefusal('7', 6)).toBe('The stash has 6.');
    expect(takeRefusal('1000', 999)).toBe('The stash has 999.');
    expect(takeRefusal('0', 6)).toBe('Say how many: a whole number, 1 or more.');
    expect(takeRefusal('two', 6)).toBe('Say how many: a whole number, 1 or more.');
    expect(takeRefusal('', 6)).toBe('Say how many: a whole number, 1 or more.');
    expect(takeRefusal(' 6 ', 6)).toBeNull();
    expect(readTake('6', 6)).toBe(6);
    expect(readTake('2.5', 6)).toBeNull();
  });

  // Purpose: a single thing is taken at once; only a row holding more than one asks how many (pk-3).
  it('asks how many only of a row holding more than one', () => {
    expect(asksHowMany({ qty: 1 })).toBe(false);
    expect(asksHowMany({ qty: 6 })).toBe(true);
  });
});
