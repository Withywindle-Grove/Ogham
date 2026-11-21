// The log's names after the fact (cleanup-lookback-nits), on the stand-in database with invented names:
//   once an item line is gone (the rest of a stack dropped), the earlier "use one up" lines still say what was used,
//   from the log's copy of the line ("fired a reed arrow", never "used an item"; the #552 look-back);
//   a reader gets only the copies their own log shows them (a copy they may not read leaves "an item");
//   End, Undo, End again and Yes to In a safe place?: only the End that stands says "in a safe place" (the #527 look-back).
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from './commandRegistry.ts';
import { answerSafePlace, endExpedition, startExpedition } from '../modules/expedition/play.ts';
import { removeItem, useItem, type CarrierRef } from '../modules/inventory/inventory.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { runCommand, type Command, type CurrentUser } from '../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../core/events.ts';
import { undoChange } from '../core/undo.ts';

const registry = createAppRegistry();

function table() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const gmUser: CurrentUser = { id: gm, roles: { [campaign]: 'gm' } };
  const samUser: CurrentUser = { id: sam, roles: { [campaign]: 'player' } };
  return { world, gm, sam, campaign, wren, gmUser, samUser };
}

/** The lines the reader's log shows (Verbose too), newest first, in words. */
async function lines(t: ReturnType<typeof table>, reader: string) {
  t.world.signInAs(reader);
  const page = await loadLog(t.world.db, t.campaign, { verbose: true });
  const names = await loadLogNames(t.world.db, t.campaign, reader);
  return groupEntries(page!.events).map((entry) => ({ type: entry.main.type, words: describeEntry(entry, names) }));
}

describe('item lines that are gone keep their names in the log', () => {
  // Purpose: after Sam fires two reed arrows and then drops the rest, the two earlier lines still say "fired a reed
  // arrow", from the log's copy of the dropped line, not "used an item".
  it('earlier use lines name the item from the log copy once the line is gone', async () => {
    const t = table();
    t.world.tables.inventory_lines.push({
      ...{ id: 'line-arrows', campaign_id: t.campaign, actor_id: t.wren, location_id: null, library_entry_id: null, name: 'Reed arrows', category: 'ammunition' },
      ...{ weight_coin: null, slots: null, stack: 20, qty: 5, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '', item_data: { unitName: 'reed arrow' } },
      ...{ source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null },
      ...{ pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, created_at: '2026-10-23T09:00:00Z', version: 1 },
    });
    const carrier: CarrierRef = { campaignId: t.campaign, actorId: t.wren, locationId: null, ownerUserId: t.sam, archived: false };
    t.world.signInAs(t.sam);
    const line = { id: 'line-arrows', carrier };
    expect((await runCommand(registry, t.world.db, t.samUser, useItem, { line, of: 5, verb: 'Fire' })).ok).toBe(true);
    expect((await runCommand(registry, t.world.db, t.samUser, useItem, { line, of: 4, verb: 'Fire' })).ok).toBe(true);
    expect((await runCommand(registry, t.world.db, t.samUser, removeItem, { line, qty: 3, of: 3 })).ok).toBe(true);
    expect(t.world.tables.inventory_lines.some((l) => l.id === 'line-arrows')).toBe(false);

    const used = (await lines(t, t.sam)).filter((l) => l.type === 'item.use').map((l) => l.words);
    expect(used).toEqual(['You fired a reed arrow, 3 left.', 'You fired a reed arrow, 4 left.']);
  });

  // Purpose: the copy comes only from the reader's own log: a copy whose line the reader may not read leaves "an item".
  it("doesn't use a copy the reader's log doesn't show them", async () => {
    const t = table();
    t.world.tables.inventory_lines.push({
      ...{ id: 'line-salt', campaign_id: t.campaign, actor_id: t.wren, location_id: null, library_entry_id: null, name: 'Grey salt', category: 'gear' },
      ...{ weight_coin: null, slots: null, stack: 10, qty: 3, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '', item_data: {} },
      ...{ source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null },
      ...{ pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, created_at: '2026-10-23T09:00:00Z', version: 1 },
    });
    const carrier: CarrierRef = { campaignId: t.campaign, actorId: t.wren, locationId: null, ownerUserId: t.sam, archived: false };
    t.world.signInAs(t.sam);
    const line = { id: 'line-salt', carrier };
    expect((await runCommand(registry, t.world.db, t.samUser, useItem, { line, of: 3, verb: 'Use' })).ok).toBe(true);
    expect((await runCommand(registry, t.world.db, t.samUser, removeItem, { line, qty: 2, of: 2 })).ok).toBe(true);
    // The drop's copy, as if only the GM could read it.
    const drop = t.world.tables.events.find((e) => e.target_id === 'line-salt' && e.after === null)!;
    drop.audience = 'gm';

    const samSees = await loadLogNames(t.world.db, t.campaign, t.sam);
    expect(samSees.items.has('line-salt')).toBe(false);
    t.world.signInAs(t.gm);
    const gmSees = await loadLogNames(t.world.db, t.campaign, t.gm);
    expect(gmSees.items.get('line-salt')).toBe('Grey salt');
  });
});

describe('In a safe place? folds only into the End that stands', () => {
  // Purpose: End, Undo, End again and Yes: the newer End says "in a safe place"; the undone first End doesn't.
  it('End, Undo, End again and Yes: the undone first End says nothing of safety', async () => {
    const t = table();
    t.world.signInAs(t.gm);
    const run = <I, T, O>(command: Command<I, T, O>, input: I) => runCommand(registry, t.world.db, t.gmUser, command, input);
    const started = await run(startExpedition, { campaignId: t.campaign, mode: 'dungeon' });
    if (!started.ok) throw new Error(started.message);
    const first = await run(endExpedition, { campaignId: t.campaign, expedition: started.value });
    if (!first.ok) throw new Error(first.message);
    const endEvent = t.world.tables.events.filter((e) => e.type === 'expedition.end').at(-1)!;
    const undone = await run(undoChange, { campaignId: t.campaign, eventId: String(endEvent.id), authorUserId: t.gm });
    expect(undone.ok).toBe(true);
    const trip = t.world.tables.expeditions.find((x) => x.id === started.value.id)!;
    const again = await run(endExpedition, { campaignId: t.campaign, expedition: { ...started.value, version: Number(trip.version) } });
    if (!again.ok) throw new Error(again.message);
    const yes = await run(answerSafePlace, { campaignId: t.campaign, expedition: again.value, safe: true });
    expect(yes.ok).toBe(true);

    const ends = (await lines(t, t.gm)).filter((l) => l.type === 'expedition.end').map((l) => l.words);
    expect(ends).toHaveLength(2);
    expect(ends[0]).toMatch(/^You ended the expedition in a safe place/);
    expect(ends[1]).toMatch(/^You ended the expedition/);
    expect(ends[1]).not.toContain('safe');
  });
});
