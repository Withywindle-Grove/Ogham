// M5b step g2: the place card as pieces (supabase/migrations/20261102100000_m5b_g2_place_pieces.sql; ruled
// 2026-11-01, M5 gate B1; docs/03, hidden means hidden). TEST project only; invented places and characters.
//   A hidden piece is never in a player's query result; a shown one reaches its group's players only, as its kind and
//   text and nothing more: never the GM-only facts (value, trigger, stat line), the place's description column or the
//   notes, and never another group's or another campaign's. Players read no piece, show or place row directly.
//   Showing to Group 1 shows nothing to Group 2. Players see the pieces in the order shown.
//   Undo after Show hides the piece; Undo after Hide all shows exactly what was shown, in the same order.
//   Players can't add, show or hide a piece (as commands or straight to the database).
//   The signal ticks on Show and Hide, and when a group with shown pieces moves on; a split carries them along.
//   The lines are the GM's alone, Verbose, and Hide all is one line.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, hideAllPieces, hidePiece, loadGroupPlaces, loadScenePlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
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
  return {
    campaignId,
    trip,
    placeId,
    visit,
    add,
    reed: { id: reed!.id, campaignId, ownerUserId: world.playerA.id },
    moss: { id: moss!.id, campaignId, ownerUserId: world.playerB.id },
  };
}

const scene = (person: Person, campaignId: string) => loadScenePlaces(asDb(person), campaignId);
const texts = async (person: Person, campaignId: string, group = 1) => (await scene(person, campaignId))?.get(group)?.pieces.map((p) => p.text) ?? [];
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const tick = async (campaignId: string, group = 1) =>
  Number(must(await world.admin.from('group_place_signals').select('tick').eq('campaign_id', campaignId).eq('group_number', group).single()).tick);

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('hidden means hidden (B1, docs/03)', () => {
  it("a player gets only the shown pieces of their group's place, as kind and text: never a hidden piece or a GM-only fact", async () => {
    const t = await freshTable();
    const hall = await t.add('description', 'A low vaulted hall, knee-deep in black water');
    // Pieces with their GM-only facts (read from adventures in M8b; made here as the service would, since a piece
    // never changes once made).
    const made = async (kind: string, body: string, facts: Record<string, string>, position: number) =>
      must(await world.admin.from('place_pieces').insert({ campaign_id: t.campaignId, place_id: t.placeId, kind, body, position, ...facts }).select('id').single()).id as string;
    const seal = await made('treasure', 'A silver seal under a loose flagstone', { gm_value: 'Forty crowns of silver' }, 1);
    const figure = await made('person', 'A hunched figure in a reed cloak, very still', { gm_stat_line: 'Bog lurker, quick to anger' }, 2);
    await made('hazard', 'The benches look unsteady', { gm_trigger: 'Disturbed: the figure rises' }, 3);
    must(await world.admin.from('places').update({ description: 'An old description, never a piece' }).eq('id', t.placeId).select('id'));
    must(await world.admin.from('place_notes').update({ traps: 'The ninth flagstone gives way.' }).eq('id', t.placeId).select('id'));

    // Nothing shown yet: the player's device receives nothing about the place.
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());

    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: hall } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: seal } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: figure } }));

    const raw = must(await world.playerA.db.rpc('scene_pieces', { campaign: t.campaignId })) as Record<string, unknown>[];
    // December 2c (pf-3): a shown piece's lead-in joins its words (null for these: none was given); nothing else.
    expect(raw.map((r) => Object.keys(r).sort())).toEqual(Array(3).fill(['body', 'group_number', 'kind', 'lead', 'piece_id', 'place_name']));
    expect(raw.map((r) => r.lead)).toEqual([null, null, null]);
    expect(raw.map((r) => r.body)).toEqual(['A low vaulted hall, knee-deep in black water', 'A silver seal under a loose flagstone', 'A hunched figure in a reed cloak, very still']);
    const sent = JSON.stringify(raw);
    for (const secret of ['Forty crowns', 'Bog lurker', 'Disturbed', 'The benches look unsteady', 'An old description', 'ninth flagstone']) expect(sent).not.toContain(secret);

    // Straight to the tables: players read no piece, no show row, no place, no notes.
    for (const person of [world.playerA, world.playerB]) {
      expect(must(await person.db.from('place_pieces').select('id, gm_value, gm_trigger, gm_stat_line').eq('campaign_id', t.campaignId))).toEqual([]);
      expect(must(await person.db.from('piece_shows').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
      expect(must(await person.db.from('places').select('id, description').eq('campaign_id', t.campaignId))).toEqual([]);
      expect(must(await person.db.from('place_notes').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    }
    // The GM reads them all.
    expect(must(await world.gm.db.from('place_pieces').select('id').eq('campaign_id', t.campaignId))).toHaveLength(4);
  });

  it('showing to Group 1 shows nothing to Group 2, and nobody outside the campaign reads it', async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east, dark beyond');
    // Moss splits off to a group of their own, in the same room; nothing is shown yet, so nothing is carried.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: await t.visit(1), piece: { id: arch } }));
    expect(await texts(world.playerA, t.campaignId, 1)).toEqual(['An archway to the east, dark beyond']);
    expect(await scene(world.playerB, t.campaignId)).toEqual(new Map());
    expect(await texts(world.playerB, t.campaignId, mossGroup)).toEqual([]);
    // Someone outside the campaign asks for it: nothing.
    expect(must(await world.outsider.db.rpc('scene_pieces', { campaign: t.campaignId }))).toEqual([]);
    // And a player of another campaign asking with this campaign's id gets nothing either (playerA's own campaign
    // isn't this one for the newcomer).
    expect(must(await world.newcomer.db.rpc('scene_pieces', { campaign: t.campaignId }))).toEqual([]);
  });

  it("players see the pieces in the order shown; showing one again puts it last; a group's move on clears them", async () => {
    const t = await freshTable();
    const a = await t.add('exit', 'Stairs up, to the north');
    const b = await t.add('clue', 'Wet footprints to the lectern');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Wet footprints to the lectern', 'Stairs up, to the north']);
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Stairs up, to the north', 'Wet footprints to the lectern']);
    // Where now?: a new visit starts with nothing shown; coming back (g2b, gp-5) starts with what was shown at the
    // end of the last visit, in its order.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Bone Stair' }));
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Chapter House' }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Stairs up, to the north', 'Wet footprints to the lectern']);
  });

  it("players can't add, show or hide a piece, as commands or straight to the database", async () => {
    const t = await freshTable();
    const arch = await t.add('exit', 'An archway to the east');
    const row = await t.visit();
    expect((await as(world.playerA, addPiece, { campaignId: t.campaignId, placeId: t.placeId, kind: 'clue', text: 'Sneaky' })).ok).toBe(false);
    expect((await as(world.playerA, showPiece, { campaignId: t.campaignId, row, piece: { id: arch } })).ok).toBe(false);
    expect((await world.playerA.db.rpc('add_place_piece', { place: t.placeId, kind: 'clue', body: 'Sneaky' })).error).not.toBeNull();
    expect((await world.playerA.db.rpc('show_place_piece', { visit: row.id, piece: arch, show_it: true })).error).not.toBeNull();
    expect((await world.playerA.db.rpc('hide_all_pieces', { visit: row.id })).error).not.toBeNull();
    const inserted = await world.playerA.db.from('piece_shows').insert({ campaign_id: t.campaignId, group_place_id: row.id, piece_id: arch, group_number: 1 }).select('id');
    expect(inserted.error).not.toBeNull();
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
  });
});

describe('Undo and the log (B1)', () => {
  it('Undo after Show hides the piece; Undo after Hide all shows exactly what was shown, in the same order', async () => {
    const t = await freshTable();
    const a = await t.add('exit', 'Stairs up, to the north');
    const b = await t.add('exit', 'An archway to the east');
    const c = await t.add('clue', 'A drain gurgles underfoot');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: c } }));
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'place.showPiece')));
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());

    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: c } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['A drain gurgles underfoot', 'Stairs up, to the north']);
    expect(await ok(as(world.gm, hideAllPieces, { campaignId: t.campaignId, row }))).toBe(2);
    expect(await scene(world.playerA, t.campaignId)).toEqual(new Map());
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'place.hideAll')));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['A drain gurgles underfoot', 'Stairs up, to the north']);

    // Undo of + Piece (the drain, added last) takes a shown piece away from players too.
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'place.addPiece')));
    expect(await texts(world.playerA, t.campaignId)).toEqual(['Stairs up, to the north']);
  });

  it("the lines are the GM's alone, Verbose, and Hide all is one line", async () => {
    const t = await freshTable();
    const a = await t.add('exit', 'Stairs up, to the north');
    const b = await t.add('exit', 'An archway to the east');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    await ok(as(world.gm, hideAllPieces, { campaignId: t.campaignId, row }));
    const lines = must(await world.admin.from('events').select('type, level, request_id').eq('campaign_id', t.campaignId).in('type', ['place.addPiece', 'place.showPiece', 'place.hideAll']));
    expect(new Set(lines.map((e) => e.level))).toEqual(new Set(['verbose']));
    expect(new Set(lines.filter((e) => e.type === 'place.hideAll').map((e) => e.request_id)).size).toBe(1);
    for (const person of [world.playerA, world.playerB]) {
      const seen = must(await person.db.from('events').select('target_table').eq('campaign_id', t.campaignId)).map((e) => e.target_table as string);
      expect(seen).not.toContain('place_pieces');
      expect(seen).not.toContain('piece_shows');
    }
  });
});

describe("players' screens follow (B1)", () => {
  it('the signal ticks on Show and Hide and when a group with shown pieces moves on; not on + Piece', async () => {
    const t = await freshTable();
    const start = await tick(t.campaignId);
    const a = await t.add('exit', 'Stairs up, to the north');
    expect(await tick(t.campaignId)).toBe(start);
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    expect(await tick(t.campaignId)).toBe(start + 1);
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    expect(await tick(t.campaignId)).toBe(start + 2);
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Bone Stair' }));
    expect(await tick(t.campaignId)).toBe(start + 4);
  });

  it('a split carries the shown pieces along, in their order', async () => {
    const t = await freshTable();
    const a = await t.add('exit', 'Stairs up, to the north');
    const b = await t.add('clue', 'Wet footprints to the lectern');
    await t.add('treasure', 'A silver seal under a loose flagstone');
    const row = await t.visit();
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: b } }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row, piece: { id: a } }));
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    expect(await texts(world.playerB, t.campaignId, mossGroup)).toEqual(['Wet footprints to the lectern', 'Stairs up, to the north']);
    // Player B's own split can still be undone by them (the carried pieces are the GM's lines).
    await ok(undo(world.playerB, t.campaignId, await latestEvent(t.campaignId, 'party.chooseGroup')));
    expect(await texts(world.playerB, t.campaignId, 1)).toEqual(['Wet footprints to the lectern', 'Stairs up, to the north']);
  });
});
