// B15 of docs/plans/scene-point-to-point.md: a magic item's truth as a piece (p2p-29; page 30, approved 2026-11-20;
// pg30-4), and a hoard as one piece with counts (p2p-28). supabase/migrations/20261120210000_p2p_b15_item_truth.sql.
// TEST project only; an invented adventure (an island, a wreck, a strongbox, a lantern). Hidden means hidden (hard
// rule 5), run as players. What it checks, in plain words:
//   1. Picking the Location makes the hoard one piece in the book's words and the magic item's truth a piece of its own,
//      both hidden. Before the GM's eye no player reads anything of the truth (its name or its words): not from the
//      pieces table, not through scene_pieces or known_places_campaign, not through item_truths, not on the item they
//      hold (sent from the hoard under its plain name, with its count), and not in any log line they read.
//   2. The eye: the piece reaches the group, and the item, wherever it is held, carries the real name and what it does.
//   3. Undo of the show takes back both (pg30-4): afterwards no player reads the truth anywhere, the log included.
//   4. A later hide takes the piece off the players' card and leaves the item as the players now know it (pg30-4).
//   5. Who may: a player can't show it (nor call the database's function), nor can someone outside the campaign; a
//      player who writes a pointer onto a one-off of their own reads nothing: not a piece never shown.
//   6. A thing sent while its magic item's piece is shown arrives named, and the send's own Undo still takes it back.
//   7. Forged pointers read nothing (the reviews of #1101; b15f-4): a player's one-off pointing at a shown treasure
//      piece or a shown clue piece returns neither its words, its value nor its source; one pointing at a magic item's
//      piece shown only to another group while the party is split returns nothing (a piece item_truths' own kind check
//      lets through, so only the GM's-log-line check stops it); and no read ever carries a piece's GM-only value or the
//      pack's source, not even for the real magic item.
//   8. A revealed name is for everyone (Francis, 2026-11-21, replacing b15f-6), on the compass, shown to group 2 only:
//      the eye names a compass held in group 1 and one in the party stash, and both players read them by their real
//      name; a send to group 1 through group 2's visit arrives named; the piece stays on group 2's card only.
//   9. Not shown, nobody but the GM reads it, split or not (the spyglass); the eye on group 1 names it for both players;
//      its Undo takes it back from both, the log included.
//  11. A name revealed once stays revealed through a split (pg30-4; the local review of the carried #1101): a player
//      who gives part of a named stack to another character keeps the name on both the part and the rest, for every
//      player; a part split off a one-off whose pointer no GM wrote reads nothing, not even for the GM.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadLog } from '../../src/core/events.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { giveFind, sendOf, undoFind } from '../../src/modules/expedition/findSend.ts';
import { hoardRows, magicPieceOf } from '../../src/modules/expedition/hoard.ts';
import { heldLinesOf, showItemTruth } from '../../src/modules/expedition/itemTruth.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { hidePiece, loadGroupPlaces, showPiece, type GroupPlace } from '../../src/modules/expedition/placePlay.ts';
import { chooseGroup, joinUp } from '../../src/modules/expedition/groupPlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { loadInventory, moveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
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

const NAME = 'Lantern of the Drowned';
const SOURCE = 'p. 14 of the Saltwick book';
const NOTICED = 'Cold to the touch; the glass smells of the sea.';
const POWERS = 'it burns no oil and shows whatever lies under water';
const TRUTH = `The hooded lantern in the strongbox. Lit, ${POWERS} within ten paces.`;
const CLUE = 'Gull feathers caught in the rigging, all pointing at the bar.';
const CLUE_SOURCE = 'Old Hesk the netmender';
const COMPASS = 'Compass of the Low Tide';
const COMPASS_TRUTH = 'A brass compass that points at the nearest dry land, however far.';
const SPYGLASS = 'Glass of the Far Shoals';
const SPYGLASS_TRUTH = 'A cracked spyglass that shows the shoals a day ahead, as they will lie at the next low tide.';
const HOARD = 'A purse of herons, nine swords and daggers and a hooded lantern, under a rotted sailcloth.';

const wreckData: Record<string, unknown> = {
  id: 'the-wreck',
  name: 'The Wreck',
  type: 'area',
  playerView: { text: 'A cog on her side on the bar, a strongbox jammed under the beams.' },
  clues: [{ text: CLUE, source: CLUE_SOURCE, pointsTo: 'the sandbar' }],
  hoards: [{ name: 'Strongbox', text: HOARD }],
  treasure: [
    { text: 'Swords', qty: 4, hoard: 'Strongbox' },
    { text: 'Daggers', qty: 5, hoard: 'Strongbox' },
    { text: 'Hooded lantern', hoard: 'Strongbox', magicItem: { name: NAME, text: TRUTH, noticed: NOTICED, source: SOURCE } },
    { text: 'A tin cup on a nail', value: { heron: 7 } },
    // A second magic item, outside the hoard: shown only to group 2 in 7b.
    { text: 'A brass compass', magicItem: { name: COMPASS, text: COMPASS_TRUTH } },
    // A third, outside the hoard: sent and named by the eye on group 1 during the split, then undone, in 9.
    { text: 'A cracked spyglass', magicItem: { name: SPYGLASS, text: SPYGLASS_TRUTH } },
  ],
};
const islandPack = () => {
  const read = readPackJson(
    JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Saltwick Isle', version: '0.1', kind: 'adventure' }, locations: [wreckData] }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

/** Everything a person reads that could carry the truth: pieces, the players' reads, item truths, lines, the log. */
async function everythingRead(person: Person): Promise<string> {
  const db = person.db;
  const reads = await Promise.all([
    db.from('place_pieces').select('*').eq('campaign_id', world.campaignId),
    db.rpc('scene_pieces', { campaign: world.campaignId }),
    db.rpc('known_places_campaign', { campaign: world.campaignId }),
    db.rpc('item_truths', { campaign: world.campaignId }),
    db.from('inventory_lines').select('*').eq('campaign_id', world.campaignId),
    db.from('events').select('*').eq('campaign_id', world.campaignId),
  ]);
  return JSON.stringify(reads.map((r) => r.data));
}
const truthsOf = async (person: Person) => must(await person.db.rpc('item_truths', { campaign: world.campaignId })) as { line_id: string; name: string; body: string }[];
const linesReadBy = async (person: Person) => (await truthsOf(person)).map((t) => t.line_id);

let packId = '';
let placeId = '';
let visit: GroupPlace;
let magicPieceId = '';
let lanternLine = '';

beforeAll(async () => {
  world = await buildWorld();
  packId = await ok(as(world.gm, importPack, { pack: islandPack() }));
  await ok(as(world.gm, attachPack, { campaignId: world.campaignId, packId }));
  const entries = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
  const entry = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'the-wreck');
  if (!entry) throw new Error('no entry');
  const wreck = await ok(as(world.gm, placeFromPack, { campaignId: world.campaignId, entry }));
  placeId = wreck.id;
  const trip = await ok(as(world.gm, startExpedition, { campaignId: world.campaignId, mode: 'dungeon', placeId }));
  visit = (await loadGroupPlaces(asDb(world.gm), world.campaignId, trip.id))!.get(1)!;
}, 300_000);

afterAll(async () => {
  await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', packId);
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('B15: a hoard as one piece, a magic item’s truth as a piece', () => {
  it('1. makes the pieces, all hidden, and sends the item under its plain name: no player reads the truth', async () => {
    expect(visit.pieces.map((p) => [p.kind, p.lead ?? '', p.text])).toEqual([
      ['description', '', 'A cog on her side on the bar, a strongbox jammed under the beams.'],
      ['clue', '', CLUE],
      ['treasure', 'Strongbox', HOARD],
      ['other', NAME, TRUTH],
      ['treasure', '', 'A tin cup on a nail'],
      ['treasure', '', 'A brass compass'],
      ['other', COMPASS, COMPASS_TRUTH],
      ['treasure', '', 'A cracked spyglass'],
      ['other', SPYGLASS, SPYGLASS_TRUTH],
    ]);
    const magic = visit.pieces.find((p) => p.kind === 'other' && p.lead === NAME)!;
    magicPieceId = magic.id;
    const place = entryData();
    expect(magicPieceOf(magic, place)).toEqual({ entry: 2, name: NAME });

    // The GM sends the whole hoard to Wren: each thing at its count, the lantern under its plain name.
    const hoard = hoardRows(visit.pieces.find((p) => p.lead === 'Strongbox')!, place, [], new Set());
    const send = sendOf(hoard.rows, new Map());
    expect(send.things).toEqual([{ name: 'Swords', qty: 4 }, { name: 'Daggers', qty: 5 }, { name: 'Hooded lantern', qty: 1 }]);
    await ok(as(world.gm, giveFind, { campaignId: world.campaignId, to: world.wrenId, placeId, things: send.things, coins: send.coins, rows: send.rows }));

    // Where the lantern is, read from the GM's log.
    const log = await loadLog(asDb(world.gm), world.campaignId, { verbose: true });
    const held = heldLinesOf(log!.events, placeId, 2);
    expect(held).toHaveLength(1);
    lanternLine = held[0]!;
    const lantern = must(await world.admin.from('inventory_lines').select('name, qty, actor_id').eq('id', lanternLine).single());
    expect(lantern).toEqual({ name: 'Hooded lantern', qty: 1, actor_id: world.wrenId });

    // Hidden means hidden: Wren's player and the other player read nothing of the truth, anywhere.
    for (const player of [world.playerA, world.playerB]) {
      const read = await everythingRead(player);
      expect(read).toContain('Hooded lantern');
      expect(read).not.toContain(NAME);
      expect(read).not.toContain(POWERS);
      expect(await truthsOf(player)).toEqual([]);
    }
  });

  it('2. the eye shows the piece and names the item wherever it is held', async () => {
    const named = await ok(as(world.gm, showItemTruth, { campaignId: world.campaignId, row: visit, piece: { id: magicPieceId }, lines: [lanternLine] }));
    expect(named).toBe(1);
    for (const player of [world.playerA, world.playerB]) {
      const scene = JSON.stringify(must(await player.db.rpc('scene_pieces', { campaign: world.campaignId })));
      expect(scene).toContain(NAME);
      expect(await truthsOf(player)).toEqual([{ line_id: lanternLine, name: NAME, body: TRUTH }]);
    }
    const pack = await loadInventory(asDb(world.playerA), world.campaignId);
    const line = pack!.lines.find((l) => l.id === lanternLine)!;
    expect(line.name).toBe(NAME);
    expect(line.details.description).toBe(TRUTH);
  });

  it('3. Undo of the show takes back both the piece and the real name, from every read and the log', async () => {
    const gm = await userOf(world.gm);
    const eventId = await latestChange(asDb(world.gm), world.campaignId, showItemTruth.name, gm.id);
    expect(eventId).not.toBeNull();
    await ok(as(world.gm, undoChange, { campaignId: world.campaignId, eventId: eventId!, authorUserId: gm.id }));
    for (const player of [world.playerA, world.playerB]) {
      const read = await everythingRead(player);
      expect(read).toContain('Hooded lantern');
      expect(read).not.toContain(NAME);
      expect(read).not.toContain(POWERS);
      expect(await truthsOf(player)).toEqual([]);
    }
    const pack = await loadInventory(asDb(world.playerA), world.campaignId);
    expect(pack!.lines.find((l) => l.id === lanternLine)!.name).toBe('Hooded lantern');
  });

  it('4. a later hide takes the piece off the card and leaves the item as the players now know it', async () => {
    visit = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!.get(1)!;
    await ok(as(world.gm, showItemTruth, { campaignId: world.campaignId, row: visit, piece: { id: magicPieceId }, lines: [lanternLine] }));
    await ok(as(world.gm, hidePiece, { campaignId: world.campaignId, row: visit, piece: { id: magicPieceId } }));
    const scene = JSON.stringify(must(await world.playerA.db.rpc('scene_pieces', { campaign: world.campaignId })));
    expect(scene).not.toContain(NAME);
    expect(await truthsOf(world.playerA)).toEqual([{ line_id: lanternLine, name: NAME, body: TRUTH }]);
  });

  it("5. a player or an outsider can't show it; a pointer a player writes reads no unshown piece", async () => {
    const hoardPiece = visit.pieces.find((p) => p.kind === 'treasure')!;
    expect((await as(world.playerA, showItemTruth, { campaignId: world.campaignId, row: visit, piece: { id: hoardPiece.id }, lines: [lanternLine] })).ok).toBe(false);
    const direct = await world.playerA.db.rpc('show_item_truth', { visit: visit.id, piece: hoardPiece.id, lines: [lanternLine] });
    expect(direct.error?.code).toBe('42501');
    const outsider = await world.outsider.db.rpc('show_item_truth', { visit: visit.id, piece: hoardPiece.id, lines: [lanternLine] });
    expect(outsider.error).not.toBeNull();
    expect(must(await world.admin.from('piece_shows').select('id').eq('piece_id', hoardPiece.id).eq('undone', false))).toEqual([]);

    // A one-off of the player's own, pointing at a piece never shown: its words stay the GM's.
    const forged = await world.playerA.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'A pebble', qty: 1, how_got: 'found', item_data: { truthPiece: hoardPiece.id } })
      .select('id');
    const read = JSON.stringify(await truthsOf(world.playerA));
    expect(read).not.toContain(HOARD);
    if (!forged.error) expect(read).not.toContain(forged.data[0]!.id);
    expect(await truthsOf(world.outsider)).toEqual([]);

    // A shown treasure piece keeps its value for the GM: a pointer the player writes to it reads nothing.
    const cup = visit.pieces.find((p) => p.text === 'A tin cup on a nail')!;
    expect(must(await world.admin.from('place_pieces').select('gm_value').eq('id', cup.id).single()).gm_value).toContain('7');
    await ok(as(world.gm, showPiece, { campaignId: world.campaignId, row: visit, piece: { id: cup.id } }));
    const scene = must(await world.playerA.db.rpc('scene_pieces', { campaign: world.campaignId })) as { piece_id: string }[];
    expect(scene.map((p) => p.piece_id)).toContain(cup.id);
    const cupForged = await world.playerA.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'A tin cup', qty: 1, how_got: 'found', item_data: { truthPiece: cup.id } })
      .select('id');
    // The player can make such a line: the attack is real, so the read must refuse it.
    expect(cupForged.error).toBeNull();
    const after = await truthsOf(world.playerA);
    expect(after.map((t) => t.line_id)).toEqual([lanternLine]);
    if (!cupForged.error) expect(JSON.stringify(after)).not.toContain(cupForged.data[0]!.id);
    expect(JSON.stringify(after)).not.toContain('7 heron');
  });
});


describe('B15: a thing sent while its truth is shown', () => {
  it('6. arrives named, and the send’s own Undo takes it back whole', async () => {
    visit = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: world.campaignId, row: visit, piece: { id: magicPieceId } }));
    const sent = await ok(
      as(world.gm, giveFind, { campaignId: world.campaignId, to: world.ashId, placeId, things: [{ name: 'Hooded lantern', qty: 1 }], coins: {}, rows: ['2:thing'], named: [{ visit: visit.id, piece: magicPieceId, thing: 0 }] }),
    );
    expect(sent.notNamed).toBe(false);
    const ash = must(await world.admin.from('inventory_lines').select('id').eq('actor_id', world.ashId).eq('name', 'Hooded lantern'));
    expect(ash).toHaveLength(1);
    expect((await truthsOf(world.playerB)).map((t) => [t.line_id, t.name])).toContainEqual([ash[0]!.id, NAME]);
    await ok(as(world.gm, undoFind, { campaignId: world.campaignId, eventId: sent.eventId }));
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', world.ashId).eq('name', 'Hooded lantern'))).toEqual([]);
  });
});

describe('B15: forged pointers (the reviews of #1101; b15f-4)', () => {
  /** A one-off of the player's own on their character, pointing at a piece; answers its id. */
  async function forge(person: Person, actorId: string, pieceId: string, name: string): Promise<string> {
    const made = await person.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: actorId, name, qty: 1, how_got: 'found', item_data: { truthPiece: pieceId } })
      .select('id');
    // The player can make such a line: the attack is real, so the read must refuse it.
    expect(made.error).toBeNull();
    return (made.data as { id: string }[])[0]!.id;
  }
  /** What a player reads through item_truths for one line: nothing, whatever the pointer. */
  const readFor = async (person: Person, line: string) => (await truthsOf(person)).filter((t) => t.line_id === line);

  // Purpose: a player who points a one-off of their own at a SHOWN treasure piece or a SHOWN clue piece reads nothing
  // through item_truths: not the piece's words, not its GM-only value (a treasure's worth, a clue's source and where it
  // points), and not the pack's source; and the real magic item's read carries only its name and words.
  it('7a. a pointer at a shown treasure or clue piece reads neither its value nor its source', async () => {
    visit = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!.get(1)!;
    const clue = visit.pieces.find((p) => p.kind === 'clue')!;
    const cup = visit.pieces.find((p) => p.text === 'A tin cup on a nail')!;
    expect(must(await world.admin.from('place_pieces').select('gm_value').eq('id', clue.id).single()).gm_value).toContain(CLUE_SOURCE);
    await ok(as(world.gm, showPiece, { campaignId: world.campaignId, row: visit, piece: { id: clue.id } }));
    const scene = must(await world.playerA.db.rpc('scene_pieces', { campaign: world.campaignId })) as { piece_id: string }[];
    expect(scene.map((p) => p.piece_id)).toEqual(expect.arrayContaining([clue.id, cup.id]));

    const atClue = await forge(world.playerA, world.wrenId, clue.id, 'A gull feather');
    const atCup = await forge(world.playerA, world.wrenId, cup.id, 'A tin mug');
    expect(await readFor(world.playerA, atClue)).toEqual([]);
    expect(await readFor(world.playerA, atCup)).toEqual([]);
    const all = JSON.stringify(await truthsOf(world.playerA));
    for (const secret of [CLUE_SOURCE, 'the sandbar', '7 heron', SOURCE, NOTICED]) expect(all).not.toContain(secret);
    // The real item's read: its name and words, nothing else (b15f-4); its piece keeps no GM-only value at all.
    for (const truth of await truthsOf(world.playerA)) expect(Object.keys(truth).sort()).toEqual(['body', 'line_id', 'name']);
    expect(must(await world.admin.from('place_pieces').select('gm_value, gm_trigger, gm_stat_line').eq('id', magicPieceId).single())).toEqual({ gm_value: '', gm_trigger: '', gm_stat_line: '' });
    // Nothing a player reads anywhere carries the pack's source or the noticed words on the piece.
    for (const player of [world.playerA, world.playerB]) expect(await everythingRead(player)).not.toContain(SOURCE);
  });

  // Purpose: while the party is split, a magic item's piece shown only to the other group stays out of reach: a player
  // of group 1 who points a one-off at it reads nothing of it, and neither does group 2's own player who points one at
  // it (no GM wrote either pointer). The piece passes item_truths' kind check and has a live show, so only the check
  // that the GM wrote the pointer stops these reads.
  it("7b. a pointer at a magic item's piece shown only to another group reads nothing", async () => {
    // The lantern's piece is hidden before the split, so the new group's visit doesn't carry it (a group that splits off
    // takes the pieces shown at that moment); its show still stands.
    await ok(as(world.gm, hidePiece, { campaignId: world.campaignId, row: visit, piece: { id: magicPieceId } }));
    const ash = { id: world.ashId, campaignId: world.campaignId, ownerUserId: world.playerB.id };
    await ok(as(world.playerB, chooseGroup, { character: ash, group: null }));
    const groups = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!;
    const second = groups.get(2)!;
    expect(second).toBeDefined();
    const compass = second.pieces.find((p) => p.kind === 'other' && p.lead === COMPASS)!;
    expect(compass).toBeDefined();
    // The GM's eye on the compass for group 2 only, naming no line.
    await ok(as(world.gm, showItemTruth, { campaignId: world.campaignId, row: second, piece: { id: compass.id }, lines: [] }));
    // Group 1's player does not see it; group 2's does.
    const sceneA = must(await world.playerA.db.rpc('scene_pieces', { campaign: world.campaignId })) as { piece_id: string }[];
    expect(sceneA.map((p) => p.piece_id)).not.toContain(compass.id);
    const sceneB = must(await world.playerB.db.rpc('scene_pieces', { campaign: world.campaignId })) as { piece_id: string }[];
    expect(sceneB.map((p) => p.piece_id)).toContain(compass.id);

    const fromA = await forge(world.playerA, world.wrenId, compass.id, 'A bent pin');
    const fromB = await forge(world.playerB, world.ashId, compass.id, 'A bent nail');
    expect(await readFor(world.playerA, fromA)).toEqual([]);
    expect(await readFor(world.playerB, fromB)).toEqual([]);
    for (const player of [world.playerA, world.playerB]) {
      const read = JSON.stringify(await truthsOf(player));
      expect(read).not.toContain(COMPASS);
      expect(read).not.toContain(COMPASS_TRUTH);
    }
    // Group 1's player reads nothing of the compass anywhere.
    const everything = await everythingRead(world.playerA);
    expect(everything).not.toContain(COMPASS);
    expect(everything).not.toContain(COMPASS_TRUTH);
  });
});

describe('B15: a revealed name is for everyone (Francis, 2026-11-21: "Once it\'s revealed it\'s revealed to everyone")', () => {
  const compassPiece = (row: GroupPlace) => row.pieces.find((p) => p.kind === 'other' && p.lead === COMPASS)!;
  const spyglassPiece = (row: GroupPlace) => row.pieces.find((p) => p.kind === 'other' && p.lead === SPYGLASS)!;
  const linesNamed = async (actor: string | null, name: string) =>
    (must(await (actor ? world.admin.from('inventory_lines').select('id').eq('actor_id', actor) : world.admin.from('inventory_lines').select('id').eq('campaign_id', world.campaignId).not('location_id', 'is', null)).eq('name', name)) as { id: string }[]).map((l) => l.id);
  const pointerOf = async (line: string) =>
    (must(await world.admin.from('inventory_lines').select('item_data').eq('id', line).single()) as { item_data: Record<string, unknown> | null }).item_data?.truthPiece;
  /** A send of one thing row from the Wreck, plain or named through a group's visit. */
  const sendOne = (to: string | null, name: string, row: string, named: { visit: string; piece: string; thing: number }[] | null = null) =>
    ok(as(world.gm, giveFind, { campaignId: world.campaignId, to, placeId, things: [{ name, qty: 1 }], coins: {}, rows: [row], named }));

  // Purpose: while the party is split, a magic item's piece shown to one group names the item for every player: the
  // compass's piece is shown to group 2 (Ash's) only (7b); a compass sent to Wren, in group 1, and one put in the party
  // stash, named by the eye on group 2, read by their real name for both players; a compass sent to Wren through group
  // 2's visit arrives named; and the piece itself stays on group 2's card only (which group sees a piece is unchanged).
  it('8. shown to one group while split, a carrier in the other group and the stash read the real name', async () => {
    const groups = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!;
    const first = groups.get(1)!;
    const second = groups.get(2)!;
    const members = must(await world.admin.from('party_group_members').select('actor_id, group_number').eq('campaign_id', world.campaignId)) as { actor_id: string; group_number: number }[];
    expect(members.find((m) => m.actor_id === world.wrenId)?.group_number).toBe(1);
    expect(members.find((m) => m.actor_id === world.ashId)?.group_number).toBe(2);
    const compass = compassPiece(second);
    expect(compass.shown).toBe(true);
    expect(compassPiece(first).shown).toBe(false);

    // Sent plain to Wren (group 1) and to the party stash, then the GM's eye on group 2 names both.
    await sendOne(world.wrenId, 'A brass compass', '4:thing');
    await sendOne(null, 'A brass compass', '4:thing');
    const [wrenCompass] = await linesNamed(world.wrenId, 'A brass compass');
    const [stashCompass] = await linesNamed(null, 'A brass compass');
    expect(wrenCompass).toBeDefined();
    expect(stashCompass).toBeDefined();
    expect(await ok(as(world.gm, showItemTruth, { campaignId: world.campaignId, row: second, piece: { id: compass.id }, lines: [wrenCompass!, stashCompass!] }))).toBe(2);
    for (const player of [world.playerA, world.playerB]) {
      const read = (await truthsOf(player)).map((t) => [t.line_id, t.name, t.body]);
      expect(read).toContainEqual([wrenCompass, COMPASS, COMPASS_TRUTH]);
      expect(read).toContainEqual([stashCompass, COMPASS, COMPASS_TRUTH]);
    }
    expect((await loadInventory(asDb(world.playerA), world.campaignId))!.lines.find((l) => l.id === wrenCompass)!.name).toBe(COMPASS);

    // Sent to Wren through group 2's visit while the piece is shown there: it arrives named.
    const sent = await sendOne(world.wrenId, 'A brass compass', '4:thing', [{ visit: second.id, piece: compass.id, thing: 0 }]);
    expect(sent.notNamed).toBe(false);
    const fresh = (await linesNamed(world.wrenId, 'A brass compass')).find((id) => id !== wrenCompass)!;
    expect(await pointerOf(fresh)).toBe(compass.id);
    expect(await linesReadBy(world.playerA)).toContain(fresh);

    // The piece itself: still on group 2's card only.
    const sceneA = must(await world.playerA.db.rpc('scene_pieces', { campaign: world.campaignId })) as { piece_id: string }[];
    expect(sceneA.map((p) => p.piece_id)).not.toContain(compass.id);
  });

  // Purpose: before the GM's eye nobody but the GM reads a magic item's truth, the party split or not: the spyglass,
  // sent plain to Wren (group 1) and to the party stash, reads plain for both players everywhere, while the GM reads its
  // piece; the eye on group 1 then names both lines for both players, Ash's in group 2 included; and the eye's Undo
  // takes the name back from everyone, the log included.
  it('9. not shown, nobody but the GM reads it; the eye names it for all, and its Undo takes it back from all', async () => {
    const first = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!.get(1)!;
    const spyglass = spyglassPiece(first);
    expect(spyglass.shown).toBe(false);
    await sendOne(world.wrenId, 'A cracked spyglass', '5:thing');
    await sendOne(null, 'A cracked spyglass', '5:thing');
    const [wrenSpyglass] = await linesNamed(world.wrenId, 'A cracked spyglass');
    const [stashSpyglass] = await linesNamed(null, 'A cracked spyglass');
    const nothingOfIt = async () => {
      for (const player of [world.playerA, world.playerB]) {
        const read = await everythingRead(player);
        expect(read).toContain('A cracked spyglass');
        expect(read).not.toContain(SPYGLASS);
        expect(read).not.toContain(SPYGLASS_TRUTH);
      }
    };
    await nothingOfIt();
    const gmPieces = JSON.stringify(must(await world.gm.db.from('place_pieces').select('lead, body').eq('id', spyglass.id)));
    expect(gmPieces).toContain(SPYGLASS);

    expect(await ok(as(world.gm, showItemTruth, { campaignId: world.campaignId, row: first, piece: { id: spyglass.id }, lines: [wrenSpyglass!, stashSpyglass!] }))).toBe(2);
    for (const player of [world.playerA, world.playerB]) {
      const read = (await truthsOf(player)).map((t) => [t.line_id, t.name]);
      expect(read).toContainEqual([wrenSpyglass, SPYGLASS]);
      expect(read).toContainEqual([stashSpyglass, SPYGLASS]);
    }

    const gm = await userOf(world.gm);
    const eventId = await latestChange(asDb(world.gm), world.campaignId, showItemTruth.name, gm.id);
    expect(eventId).not.toBeNull();
    await ok(as(world.gm, undoChange, { campaignId: world.campaignId, eventId: eventId!, authorUserId: gm.id }));
    await nothingOfIt();
    expect(await pointerOf(wrenSpyglass!)).toBeUndefined();
    expect(await pointerOf(stashSpyglass!)).toBeUndefined();
  });
});

describe('B15: a named stack split or partly given (the local review of the carried #1101; pg30-4)', () => {
  const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
  const ash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false });

  // Purpose: a name revealed once stays revealed, so when a player gives part of a named stack to someone else (the
  // database splits it into a new line, pointer and all), both the part and what is left keep the real name for every
  // player; and a "named" stack whose pointer no GM wrote (a player's one-off) gives a part that reads nothing either.
  it('11. a part split off a named stack keeps its name; a part split off a forged pointer reads nothing', async () => {
    // One group again, so the give isn't across groups.
    await ok(as(world.gm, joinUp, { campaignId: world.campaignId, together: true, from: 2, into: 1 }));
    const first = (await loadGroupPlaces(asDb(world.gm), world.campaignId, visit.expeditionId))!.get(1)!;

    // The GM sends Wren two hooded lanterns, named as they arrive (the eye on the lantern's piece).
    const sent = await ok(
      as(world.gm, giveFind, { campaignId: world.campaignId, to: world.wrenId, placeId, things: [{ name: 'Hooded lantern', qty: 2 }], coins: {}, rows: ['2:thing'], named: [{ visit: first.id, piece: magicPieceId, thing: 0 }] }),
    );
    expect(sent.notNamed).toBe(false);
    const stacks = must(await world.admin.from('inventory_lines').select('id').eq('actor_id', world.wrenId).eq('name', 'Hooded lantern').eq('qty', 2)) as { id: string }[];
    expect(stacks).toHaveLength(1);
    const stack = stacks[0]!.id;
    expect(await linesReadBy(world.playerA)).toContain(stack);

    // Wren's player gives one of the two to Ash: the database splits the stack, and the part goes to Ash.
    const part = (await ok(as(world.playerA, moveItem, { line: { id: stack, carrier: wren() }, to: ash(), qty: 1, of: 2 }))).id;
    expect(part).not.toBe(stack);
    expect(must(await world.admin.from('inventory_lines').select('qty, actor_id').eq('id', part).single())).toEqual({ qty: 1, actor_id: world.ashId });
    for (const player of [world.playerA, world.playerB]) {
      const read = (await truthsOf(player)).map((t) => [t.line_id, t.name]);
      expect(read).toContainEqual([stack, NAME]);
      expect(read).toContainEqual([part, NAME]);
    }
    expect((await loadInventory(asDb(world.playerB), world.campaignId))!.lines.find((l) => l.id === part)!.name).toBe(NAME);

    // A one-off of Wren's player's own, pointing at the lantern's piece (no GM wrote it), given in part to Ash: neither
    // the rest nor the part reads anything, not even for the GM, who reads every counting pointer.
    const forged = await world.playerA.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'A lamp', qty: 2, how_got: 'found', item_data: { truthPiece: magicPieceId } })
      .select('id');
    expect(forged.error).toBeNull();
    const fake = (forged.data as { id: string }[])[0]!.id;
    const fakePart = (await ok(as(world.playerA, moveItem, { line: { id: fake, carrier: wren() }, to: ash(), qty: 1, of: 2 }))).id;
    for (const person of [world.playerA, world.playerB, world.gm]) {
      const read = await linesReadBy(person);
      expect(read).not.toContain(fake);
      expect(read).not.toContain(fakePart);
    }
  });
});

/** The Wreck's pack data, as the GM's page reads it. */
function entryData(): Record<string, unknown> {
  return wreckData;
}
