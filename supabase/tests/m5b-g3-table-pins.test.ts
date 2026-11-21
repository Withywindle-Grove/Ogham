// M5b step g3: pins for the session and rows read by hand (supabase/migrations/20261102110000_m5b_g3_table_pins.sql;
// docs/05 "Encounter tables, full screen", M5 gate B2). TEST project only; invented tables.
//   The GM pins a table of the setting rules; a table that isn't there, or one already pinned, is refused in words.
//   Pins and rows read by hand are the GM's alone: a player reads none, and none of their log lines.
//   Pins vanish at End session and reappear nowhere (the next session starts with none); undoing End session brings
//   them back; nothing is removed.
//   Unpinning takes a pin away and its undo puts it back; undoing a pin marks it undone.
//   A row read by hand is kept (Simple) with where the clock was, and undo marks it undone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endSession, startSession } from '../../src/modules/expedition/play.ts';
import { loadTablePins, pinTable, readTableByHand, unpinTable } from '../../src/modules/expedition/tablePins.ts';
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
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const pinned = async (person: Person, campaignId: string) => (await loadTablePins(asDb(person), campaignId))?.map((p) => p.tableId) ?? null;

/** The world's campaign gets a homebrew pack holding two invented tables (once). */
let tablesReady = false;
async function withTables() {
  if (tablesReady) return world.campaignId;
  const found = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId));
  const packId =
    found[0]?.id ??
    must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, campaign_id: world.campaignId, name: 'Homebrew', kind: 'homebrew' }).select().single()).id;
  if (found.length === 0) must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, priority: 100 }).select());
  for (const [id, name] of [
    ['g3-abbey', 'Abbey'],
    ['g3-marsh', 'Marsh'],
  ]) {
    must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'table', pack_entry_id: id, name, data: { id, name, die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurkers' }] } }).select());
  }
  tablesReady = true;
  return world.campaignId;
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('pins for the session (B2)', () => {
  it('the GM pins a table of the setting rules; an unknown table or one already pinned is refused in words', async () => {
    const campaignId = await withTables();
    await ok(as(world.gm, pinTable, { campaignId, tableId: 'g3-abbey' }));
    expect(await pinned(world.gm, campaignId)).toEqual(['g3-abbey']);
    const again = await as(world.gm, pinTable, { campaignId, tableId: 'g3-abbey' });
    expect(again.ok ? 'pinned twice' : again.message).toBe('That table is already pinned.');
    const unknown = await as(world.gm, pinTable, { campaignId, tableId: 'g3-nowhere' });
    expect(unknown.ok ? 'pinned' : unknown.message).toBe("That table isn't in your setting rules.");
    const line = must(await world.admin.from('events').select('level, audience').eq('campaign_id', campaignId).eq('type', 'tables.pin'));
    expect(line).toEqual([{ level: 'verbose', audience: 'gm' }]);
  });

  it("a player reads no pins and none of their log lines, and can't pin through the database either", async () => {
    const campaignId = await withTables();
    expect(await pinned(world.playerA, campaignId)).toEqual([]);
    expect(must(await world.playerA.db.from('table_pins').select('id').eq('campaign_id', campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).like('type', 'tables.%'))).toEqual([]);
    const { error } = await world.playerA.db.rpc('pin_table', { campaign: campaignId, table_id: 'g3-marsh' });
    expect(error?.code).toBe('42501');
    const direct = await world.playerA.db.from('table_pins').insert({ campaign_id: campaignId, table_id: 'g3-marsh' }).select();
    expect(direct.error).toBeTruthy();
  });

  it('pins vanish at End session and reappear nowhere; undoing End session brings them back; nothing is removed', async () => {
    const campaignId = await withTables();
    const session = await ok(as(world.gm, startSession, { campaignId }));
    expect(await pinned(world.gm, campaignId)).toEqual(['g3-abbey']);
    await ok(as(world.gm, endSession, { campaignId, session }));
    expect(await pinned(world.gm, campaignId)).toEqual([]);
    expect(must(await world.admin.from('table_pins').select('table_id, undone, unpinned_at').eq('campaign_id', campaignId))).toEqual([{ table_id: 'g3-abbey', undone: false, unpinned_at: null }]);
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'session.end')));
    expect(await pinned(world.gm, campaignId)).toEqual(['g3-abbey']);
    // End it again; the next session starts with none.
    const running = must(await world.admin.from('sessions').select('*').eq('campaign_id', campaignId).is('ended_at', null).eq('undone', false).single());
    await ok(as(world.gm, endSession, { campaignId, session: { id: running.id as string, campaignId, number: running.number as number, startedAt: '', endedAt: null, version: running.version as number } }));
    const next = await ok(as(world.gm, startSession, { campaignId }));
    expect(await pinned(world.gm, campaignId)).toEqual([]);
    // A pin made during the session belongs to it.
    await ok(as(world.gm, pinTable, { campaignId, tableId: 'g3-marsh' }));
    expect(await pinned(world.gm, campaignId)).toEqual(['g3-marsh']);
    await ok(as(world.gm, endSession, { campaignId, session: next }));
    expect(await pinned(world.gm, campaignId)).toEqual([]);
  });

  it('Unpin takes a pin away and its undo puts it back; undoing a pin marks it undone', async () => {
    const campaignId = await withTables();
    const pin = await ok(as(world.gm, pinTable, { campaignId, tableId: 'g3-abbey' }));
    await ok(as(world.gm, unpinTable, { campaignId, pin }));
    expect(await pinned(world.gm, campaignId)).toEqual([]);
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'tables.unpin')));
    expect(await pinned(world.gm, campaignId)).toEqual(['g3-abbey']);
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'tables.pin')));
    expect(await pinned(world.gm, campaignId)).toEqual([]);
    expect(must(await world.admin.from('table_pins').select('undone').eq('id', pin.id).single()).undone).toBe(true);
  });
});

describe('a row read by hand (B2)', () => {
  it('is kept (Simple, the GM only) with where the clock was, and undo marks it undone', async () => {
    const campaignId = await withTables();
    const read = await ok(as(world.gm, readTableByHand, { campaignId, tableId: 'g3-marsh', roll: '4', rowText: 'Marsh: Bog lurkers' }));
    expect(read).toMatchObject({ tableId: 'g3-marsh', roll: '4', rowText: 'Marsh: Bog lurkers' });
    const line = must(await world.admin.from('events').select('level, audience').eq('campaign_id', campaignId).eq('type', 'tables.readByHand'));
    expect(line).toEqual([{ level: 'simple', audience: 'gm' }]);
    expect(must(await world.playerA.db.from('table_reads').select('id').eq('campaign_id', campaignId))).toEqual([]);
    const refused = await as(world.playerA, readTableByHand, { campaignId, tableId: 'g3-marsh', roll: '4', rowText: 'Marsh: Bog lurkers' });
    expect(refused.ok).toBe(false);
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'tables.readByHand')));
    expect(must(await world.admin.from('table_reads').select('undone').eq('id', read.id).single()).undone).toBe(true);
    // Only undo changes it.
    const { error } = await world.gm.db.from('table_reads').update({ row_text: 'Something else' }).eq('id', read.id).select();
    expect(error?.message).toBe('A row read from a table can only be undone.');
  });
});
