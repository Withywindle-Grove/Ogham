// M5b step g2b: pieces after they're added (supabase/migrations/20261102320000_m5b_g2b_pieces_follow_up.sql; ruled
// 2026-11-02, gp-1 … gp-6). TEST project only; invented places and characters.
//   Editing a shown piece changes what the player's scene_pieces returns and nothing else about the room; Undo puts
//   the old words back; players never read the edit's record; a save from an old copy is refused.
//   A removed piece disappears from the player's query and from the GM's card; Undo brings both back with the same
//   shows; nothing is deleted.
//   Coming back to a place shows exactly the pieces shown at the end of its last visit, in order: a piece hidden before
//   leaving stays hidden, a piece added between visits is hidden, a removed one doesn't come back; it is one Verbose
//   line of the GM's with its own Undo, which hides them all again.
//   Coming back by a different group (after a split) shows the same set (gp-5: any group).
//   Where now? to a never-visited place starts with nothing shown and writes no "back at" line.
//   logged_commands has no place.show / place.hide rows and the app registers neither.
//   Players can't edit or remove a piece or bring back a visit's shows, as commands or straight to the database.
//   Start expedition at a place visited before (the follow-up, ruled 2026-11-02) shows the last visit's shown pieces
//   and writes one "back at" line of its own; at a place never visited, nothing and no line; Undo of that line hides
//   them and leaves the expedition started.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, backAtPlace, editPiece, hidePiece, loadGroupPlaces, loadScenePlaces, removePiece, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { endExpedition, startExpedition } from '../../src/modules/expedition/play.ts';
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

/** A fresh campaign: Reed (player A's) and Moss (player B's), an expedition under way at the Chapter House. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Drowned Chapter', created_by: world.gm.id }).select().single());
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
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Chapter House' }));
  const visit = async (group = 1) => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(group)!;
  const placeId = (await visit()).placeId!;
  const add = (kind: 'description' | 'exit' | 'person' | 'clue' | 'treasure' | 'hazard', text: string) => ok(as(world.gm, addPiece, { campaignId, placeId, kind, text }));
  const pieceOf = async (id: string) => (await visit()).pieces.find((p) => p.id === id)!;
  const go = (name: string, group = 1) => ok(as(world.gm, setPlace, { campaignId, group, name }));
  return {
    campaignId,
    trip,
    placeId,
    visit,
    add,
    pieceOf,
    go,
    reed: { id: reed!.id, campaignId, ownerUserId: world.playerA.id },
    moss: { id: moss!.id, campaignId, ownerUserId: world.playerB.id },
  };
}

const scene = (person: Person, campaignId: string) => loadScenePlaces(asDb(person), campaignId);
const texts = async (person: Person, campaignId: string, group = 1) => (await scene(person, campaignId))?.get(group)?.pieces.map((p) => p.text) ?? [];
const events = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id, type, level, request_id, target_table, before, after').eq('campaign_id', campaignId).eq('type', type).order('seq'));
const latestEvent = async (campaignId: string, type: string) => (await events(campaignId, type)).at(-1)!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const tick = async (campaignId: string, group = 1) =>
  Number(must(await world.admin.from('group_place_signals').select('tick').eq('campaign_id', campaignId).eq('group_number', group).single()).tick);

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('editing a piece (gp-1, gp-2)', () => {
  it("changes what the player's query returns and nothing else; Undo puts the old words back; the record is the GM's", async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    const stairs = await t.add('exit', 'Stairs up, to the north');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: stairs } }));
    const before = await tick(t.campaignId);
    const showsBefore = must(await world.admin.from('piece_shows').select('id, shown, shown_at, undone').eq('group_place_id', row.id).order('shown_at'));

    await ok(as(world.gm, editPiece, { campaignId: t.campaignId, piece: await t.pieceOf(arch), kind: 'clue', text: 'An archway to the east, dark beyond' }));
    // The player sees the new words in the same place of the order; the signal ticked so their screen re-reads.
    expect(await texts(world.playerA, t.campaignId)).toEqual(['An archway to the east, dark beyond', 'Stairs up, to the north']);
    expect((await scene(world.playerA, t.campaignId))!.get(1)!.pieces[0]!.kind).toBe('clue');
    expect(await tick(t.campaignId)).toBe(before + 1);
    // No show row was touched; the piece's position stands; its version moved on.
    expect(must(await world.admin.from('piece_shows').select('id, shown, shown_at, undone').eq('group_place_id', row.id).order('shown_at'))).toEqual(showsBefore);
    const piece = await t.pieceOf(arch);
    expect([piece.version, (await t.visit()).pieces.map((p) => p.id)]).toEqual([2, [arch, stairs]]);
    // One Verbose line of the GM's, with the old and the new words; players never read it.
    const lines = await events(t.campaignId, 'place.editPiece');
    expect(lines).toHaveLength(1);
    expect([lines[0]!.level, lines[0]!.target_table, lines[0]!.before, lines[0]!.after]).toEqual([
      'verbose',
      'place_pieces',
      { kind: 'exit', body: 'An archway to the east' },
      { kind: 'clue', body: 'An archway to the east, dark beyond' },
    ]);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', t.campaignId).eq('type', 'place.editPiece'))).toEqual([]);

    // Undo: the old words, still shown, still in their place.
    await ok(undo(world.gm, t.campaignId, lines[0]!.id as string));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['An archway to the east', 'Stairs up, to the north']);
    expect((await t.pieceOf(arch)).kind).toBe('exit');
  });

  it('a save from an old copy is refused, and an empty text answers in a line', async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    const stale = await t.pieceOf(arch);
    await ok(as(world.gm, editPiece, { campaignId: t.campaignId, piece: stale, kind: 'exit', text: 'An archway to the east, dark beyond' }));
    const again = await as(world.gm, editPiece, { campaignId: t.campaignId, piece: stale, kind: 'exit', text: 'An archway to the east, bright' });
    expect(again.ok ? 'saved' : again.reason).toBe('stale');
    const empty = await as(world.gm, editPiece, { campaignId: t.campaignId, piece: await t.pieceOf(arch), kind: 'exit', text: '   ' });
    expect(empty.ok ? 'saved' : empty.message).toBe('Write what players will see.');
    expect((await t.pieceOf(arch)).text).toBe('An archway to the east, dark beyond');
  });
});

describe('removing a piece (gp-3)', () => {
  it("disappears from the player's query and the GM's card; Undo brings both back with the same shows; nothing is deleted", async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    const stairs = await t.add('exit', 'Stairs up, to the north');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: stairs } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } }));
    const before = await tick(t.campaignId);

    await ok(as(world.gm, removePiece, { campaignId: t.campaignId, piece: { id: arch } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Stairs up, to the north']);
    expect((await t.visit()).pieces.map((p) => p.id)).toEqual([stairs]);
    expect(await tick(t.campaignId)).toBe(before + 1);
    // The row and its show stand (retired, never deleted); the line is the GM's, Verbose.
    expect(must(await world.admin.from('place_pieces').select('undone').eq('id', arch).single()).undone).toBe(true);
    expect(must(await world.admin.from('piece_shows').select('shown, undone').eq('piece_id', arch))).toEqual([{ shown: true, undone: false }]);
    const lines = await events(t.campaignId, 'place.removePiece');
    expect(lines.map((l) => [l.level, l.after])).toEqual([['verbose', { undone: true }]]);
    // Removing it again changes nothing (no second line).
    await ok(as(world.gm, removePiece, { campaignId: t.campaignId, piece: { id: arch } }));
    expect(await events(t.campaignId, 'place.removePiece')).toHaveLength(1);
    // Editing a removed piece is refused in words.
    const edit = await as(world.gm, editPiece, { campaignId: t.campaignId, piece: { id: arch, version: 1 }, kind: 'exit', text: 'Still here?' });
    expect(edit.ok ? 'saved' : edit.message).toBe('That piece was removed.');

    await ok(undo(world.gm, t.campaignId, lines[0]!.id as string));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Stairs up, to the north', 'An archway to the east']);
    expect((await t.visit()).pieces.map((p) => [p.id, p.shown])).toEqual([
      [arch, true],
      [stairs, true],
    ]);
  });
});

describe('coming back (gp-5)', () => {
  it('a return visit shows what was shown at the end of the last visit, in order; one Verbose line with Undo', async () => {
    const t = await freshTable();
    const hall = await t.add('description', 'A low vaulted hall, knee-deep in black water');
    const arch = await t.add('exit', 'An archway to the east');
    const stairs = await t.add('exit', 'Stairs up, to the north');
    const seal = await t.add('treasure', 'A silver seal under a loose flagstone');
    let row = await t.visit();
    for (const id of [stairs, hall, arch, seal]) await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id } }));
    // Before leaving: the stairs hidden again, the seal removed.
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row, piece: { id: stairs } }));
    await ok(as(world.gm, removePiece, { campaignId: t.campaignId, piece: { id: seal } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['A low vaulted hall, knee-deep in black water', 'An archway to the east']);

    // Where now? to a place never visited: nothing shown, no "back at" line.
    const moved = await t.go('The Bone Stair');
    expect(moved.backShown).toBe(0);
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    expect(await events(t.campaignId, 'place.backAt')).toEqual([]);
    // Added between visits: hidden on the return.
    await t.add('clue', 'Wet footprints to the lectern');

    const back = await t.go('The Chapter House');
    expect(back.backShown).toBe(2);
    expect(await texts(world.playerA, t.campaignId)).toEqual(['A low vaulted hall, knee-deep in black water', 'An archway to the east']);
    row = await t.visit();
    expect(row.pieces.map((p) => [p.text, p.shown])).toEqual([
      ['A low vaulted hall, knee-deep in black water', true],
      ['An archway to the east', true],
      ['Stairs up, to the north', false],
      ['Wet footprints to the lectern', false],
    ]);
    // One line of its own (not the move's request), Verbose, the GM's; players don't read it.
    const lines = await events(t.campaignId, 'place.backAt');
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((l) => l.level))).toEqual(new Set(['verbose']));
    expect(new Set(lines.map((l) => l.request_id)).size).toBe(1);
    const moves = await events(t.campaignId, 'place.set');
    expect(moves.some((m) => m.request_id === lines[0]!.request_id)).toBe(false);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', t.campaignId).eq('type', 'place.backAt'))).toEqual([]);

    // Undo of the "back at" line hides them all again; the group is still there.
    await ok(undo(world.gm, t.campaignId, lines[0]!.id as string));
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    expect((await t.visit()).id).toBe(row.id);
    // The GM shows one by one from there, as always.
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['An archway to the east']);
  });

  it('a different group coming back (after a split) gets the same set; Undo of the move leaves the earlier visit as it was', async () => {
    const t = await freshTable();
    const hall = await t.add('description', 'A low vaulted hall, knee-deep in black water');
    const arch = await t.add('exit', 'An archway to the east');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: hall } }));
    // Moss splits off (carrying the shown pieces) and goes on to the Bone Stair; the party stays.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await t.go('The Bone Stair', mossGroup);
    expect(await scene(world.playerB, t.campaignId)).toEqual(new Map());
    // The party, meanwhile, hides the hall. Moss comes back: the most recent visit is the party's, so the arch alone.
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row, piece: { id: hall } }));
    const back = await t.go('The Chapter House', mossGroup);
    expect(back.backShown).toBe(1);
    expect(await texts(world.playerB, t.campaignId, mossGroup)).toEqual(['An archway to the east']);
    expect(await texts(world.playerA, t.campaignId, 1)).toEqual(['An archway to the east']);
    // Undo of Moss's move: back at the Bone Stair with nothing shown; the party's visit untouched.
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'place.set')));
    expect(await scene(world.playerB, t.campaignId)).toEqual(new Map());
    expect(await texts(world.playerA, t.campaignId, 1)).toEqual(['An archway to the east']);
  });
});

describe('Start expedition at a known place (the g2b follow-up; gp-5 "any expedition")', () => {
  it("starting at a place visited before shows its last visit's shown pieces in one line of its own; Undo hides them and the expedition stands", async () => {
    const t = await freshTable();
    const hall = await t.add('description', 'A low vaulted hall, knee-deep in black water');
    const arch = await t.add('exit', 'An archway to the east');
    await t.add('exit', 'Stairs up, to the north');
    const row = await t.visit();
    for (const id of [arch, hall]) await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id } }));
    await ok(as(world.gm, endExpedition, { campaignId: t.campaignId, expedition: t.trip }));

    const again = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Chapter House' }));
    expect(again.backShown).toBe(2);
    expect(await texts(world.playerA, t.campaignId)).toEqual(['An archway to the east', 'A low vaulted hall, knee-deep in black water']);
    const lines = await events(t.campaignId, 'place.backAt');
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((l) => l.request_id)).size).toBe(1);
    expect(new Set(lines.map((l) => l.level))).toEqual(new Set(['verbose']));
    expect((await events(t.campaignId, 'expedition.start')).some((e) => e.request_id === lines[0]!.request_id)).toBe(false);

    await ok(undo(world.gm, t.campaignId, lines[0]!.id as string));
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    const now = (await loadGroupPlaces(asDb(world.gm), t.campaignId, again.id))!.get(1)!;
    expect(now.placeId).toBe(t.placeId);
    const trip = must(await world.admin.from('expeditions').select('undone, ended_at').eq('id', again.id).single());
    expect([trip.undone, trip.ended_at]).toEqual([false, null]);
  });

  it('starting at a place never visited shows nothing and writes no "back at" line', async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: await t.visit(), piece: { id: arch } }));
    await ok(as(world.gm, endExpedition, { campaignId: t.campaignId, expedition: t.trip }));
    const fresh = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Bone Stair' }));
    expect(fresh.backShown).toBe(0);
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    expect(await events(t.campaignId, 'place.backAt')).toEqual([]);
  });
});

describe('retired and refused (gp-4, gp-6)', () => {
  it('logged_commands has no place.show / place.hide rows, the app registers neither, and the new three are listed', async () => {
    const names = must(await world.gm.db.from('logged_commands').select('name, level, gm_only').in('name', ['place.show', 'place.hide', 'place.editPiece', 'place.removePiece', 'place.backAt']));
    expect(names.map((n) => [n.name, n.level, n.gm_only]).sort()).toEqual([
      ['place.backAt', 'verbose', true],
      ['place.editPiece', 'verbose', true],
      ['place.removePiece', 'verbose', true],
    ]);
    expect([registry.has('place.show'), registry.has('place.hide'), registry.has('place.editPiece'), registry.has('place.removePiece'), registry.has('place.backAt')]).toEqual([false, false, true, true, true]);
  });

  it("players can't edit or remove a piece or bring back a visit's shows, as commands or straight to the database", async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } }));
    expect((await as(world.playerA, editPiece, { campaignId: t.campaignId, piece: { id: arch, version: 1 }, kind: 'clue', text: 'Sneaky' })).ok).toBe(false);
    expect((await as(world.playerA, removePiece, { campaignId: t.campaignId, piece: { id: arch } })).ok).toBe(false);
    expect((await as(world.playerB, backAtPlace, { campaignId: t.campaignId, row })).ok).toBe(false);
    expect((await world.playerA.db.rpc('edit_place_piece', { piece: arch, kind: 'clue', body: 'Sneaky' })).error).not.toBeNull();
    expect((await world.playerA.db.rpc('remove_place_piece', { piece: arch })).error).not.toBeNull();
    expect((await world.playerB.db.rpc('back_at_place', { visit: row.id })).error).not.toBeNull();
    const updated = await world.playerA.db.from('place_pieces').update({ body: 'Sneaky' }).eq('id', arch).select('id');
    expect(updated.data ?? []).toEqual([]);
    expect(await texts(world.playerA, t.campaignId)).toEqual(['An archway to the east']);
  });
});
