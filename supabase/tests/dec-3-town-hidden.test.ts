// December step 3, row W21: hidden means hidden for the town (docs/plans/dec-3-the-whole-town.md, W21 and its table
// "W21: never sent to a player"; hard rule 5; tr-1). Tests on what the database sends to a player, never on what a
// screen draws. TEST project only; invented names. Not run by the cloud session that wrote it (no database there):
// CI's database job runs it.
//
// A place's own name (the describe at the top): it is the GM's. places.players_name is "what players see as the
// place's name once a piece is shown" (20261106140000), m8b-0-places-from-packs.test.ts checks that scene_pieces never
// sends the own name ("…not.toContain('The Reed Inn')"), and tr-1 keeps the place's own row the GM's. public.scene_town
// and public.known_places sent it until pn-1 (20261115004000_place_players_name.sql) made them send
// `coalesce(nullif(p.players_name, ''), p.name)`, as scene_pieces and known_places_campaign do. The two tests here
// were `it.fails` until then (#825); they pass now.
//
// Cases already covered elsewhere, not repeated here (named so a reader finds them):
//   1. A place in town not shown: m5b-6c-town-screen.test.ts, "a hidden place in town never reaches a player…", "a
//      shown place in a town players don't see yet stays invisible…", "a non-member and a member of another campaign
//      read nothing of the town". A hidden piece: m5b-place-pieces.test.ts, "a player gets only the shown pieces of
//      their group's place…" and "showing to Group 1 shows nothing to Group 2, and nobody outside the campaign reads
//      it". A hidden piece's lead: dec-2c-piece-lead.test.ts, "is made with the piece, hidden from players until shown…".
//   2. The town's GM notes: m5-places.test.ts, "a player never receives a place that isn't shown, or another group's
//      place, and never the GM's notes"; m8b-0-places-from-packs.test.ts, "a player reads no pack location, no place
//      made from one, none of its notes or pieces…" (the library entry, read directly). Its facts (the settlement
//      mark): m8b-0-places-settlement.test.ts, "carries the mark when the pack gives one…; a player never reads it".
//      Its tables (GM-only unless the pack opens one, fs-1): m4b-hooks-readable.test.ts, "a player reads hooks and XP
//      tables, never stat blocks or tables…".
//   3. A person's stat block or NPC on a person piece (gm_stat_line): m5b-place-pieces.test.ts, "…never a hidden piece
//      or a GM-only fact".
//   5. A stock line out or undecided, and any chance (W12; w12-1, mc-74, tn-8): dec-3-w12-shop-stock.test.ts, "the GM
//      reads all three; a player the in line only; outsiders nothing" (its row, its thing's id, the day's answers and
//      the log), "another campaign's rows aren't this one's", "the players' reader works the answer out itself" (an
//      out or undecided line never comes back, whatever the device offers) and "a GM-only availability still decides"
//      (a town size a pack keeps GM-only is not readable by a player, yet still decides what the player is shown). The players' reader, shop_stock_in, returns thing ids
//      alone, never an answer, a count or a chance. A pack's shop: dec-3-stock-reader-narrow.test.ts, "returns a stored
//      in, never an out or undecided, never a thing not for sale" and "an outsider reads nothing". The table read
//      straight: fix-856-1-shop-stock-read.test.ts, "a player reads no rows from the table". Stock is the campaign's,
//      not a group's, so there is no other group to test. A chance a pack leaves readable stays readable (av-1).
//   6. A rumour's truth and notes; a rumour not given (dec-12 E; rm-1, rm-2, rm-3): dec-12e-rumours.test.ts, "is read
//      by no player, nor an outsider, as each reads the tables", "to one character: that character's player reads it,
//      the other player doesn't, row and log line", "stores the words alone: no truth and no note in the given row" and
//      "Undo marks the give undone, and the hearer no longer reads it"; dec-12e-rumours-gm-only.test.ts, "reaches no
//      player through campaign_library or a direct read, in every shape" and "gives a player in another campaign
//      nothing".
//   7. A hook not sent: dec-12b-calls-to-adventure.test.ts, "an adventure's hooks are the GM's alone until sent" (both),
//      "to one character: that character's player reads it, the other player doesn't…", "Undo marks the send undone,
//      and players no longer read it".
//   8. The town's map (GM-only today, no eye yet): dec-7-5m-1-map-kind.test.ts, "never reach a player in the campaign,
//      nor an outsider"; dec-7-5m-2-place-map.test.ts, "a player and an outsider read nothing while it is the GM's".
//   9. A rule the GM switched off: dec-7-3-place-check-and-rules.test.ts, "reach a player only once the spot is shown,
//      only the open ones…" and "each mark becomes its label…; another group reads nothing".
//
// Added here:
//   1. A place in town and the town's shown piece reach no player of ANOTHER group in the same campaign (scene_town,
//      scene_pieces, known_places_campaign); m5b-6c tests another campaign and an outsider only.
//   2, 4. The town's own book side (its GM notes, secrets, page reference, encounter check and GM-only table) reaches
//      no player through public.campaign_library (m8b-0 reads library_entries directly) nor through the town's shown
//      piece, and nothing of it reaches a player of another campaign.
//   3, 4, 7 (a notice), 8 (the map's eye). Not built: tests to do, each naming the row that builds it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { showTownPlace } from '../../src/modules/expedition/townPlaces.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

// The town's own name (the GM's) and its name for players.
const OWN_NAME = 'Gullwick Smugglers Quay';
const PLAYERS_NAME = 'A fishing harbour';
const DESCRIPTION = 'Gulls over tarred nets and a crooked jetty.';
const SHOWN_PLACE = { key: 'service:tallow', name: 'The Tallow Chandler', group: 'shop' as const };
// The town's book side, the GM's alone (the watch is the location's `settlement.watch`, read on the GM's device).
const BOOK_SIDE = /harbourmaster takes eel-silver|lamp in the bell tower|Gullwick book, page 31|Harbour troubles|Press-gang at the tide steps|wardens walk the quay|Brine-eye/;

/** An invented region pack: a harbour town marked a settlement, with a players' name, its GM side and a GM-only table. */
const harbourPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Gull Coast', version: '0.1', kind: 'homebrew' },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6' }],
      tables: [{ id: 'harbour-troubles', name: 'Harbour troubles', die: 'd6', rows: [{ min: 1, max: 6, result: 'Press-gang at the tide steps' }] }],
      locations: [
        {
          id: 'gullwick',
          name: OWN_NAME,
          type: 'site',
          settlement: { size: 'town', population: 300, watch: { text: 'Six wardens walk the quay at dusk.', leads: [{ lead: 'Captain', text: 'Old Brine-eye, who drinks.' }] } },
          playerView: { name: PLAYERS_NAME, text: DESCRIPTION },
          gm: { notes: 'The harbourmaster takes eel-silver from every boat.', secrets: ['A lamp in the bell tower signals the night boats.'] },
          tables: ['harbour-troubles'],
          source: 'Gullwick book, page 31',
        },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

let campaignId = '';
let packId = '';

beforeAll(async () => {
  world = await buildWorld();
  // The newcomer plays in another campaign (the world's second one), so "another campaign's player" is a member there.
  must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.newcomer.id, base_role: 'player' }).select());
  campaignId = must(await world.admin.from('campaigns').insert({ name: 'The Gull Coast', created_by: world.gm.id }).select().single()).id as string;
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
  const [, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));

  // The GM picks the town and starts there; Moss splits off into a group of their own before anything is shown.
  const entry = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packEntryId === 'gullwick');
  if (!entry) throw new Error('no entry gullwick');
  const town = await ok(as(world.gm, placeFromPack, { campaignId, entry }));
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', placeId: town.id }));
  await ok(as(world.playerB, chooseGroup, { character: { id: moss!.id, campaignId, ownerUserId: world.playerB.id }, group: null }));

  // To group 1 only: the town's description, then one place in town.
  const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
  await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces.find((p) => p.text === DESCRIPTION)! }));
  await ok(as(world.gm, showTownPlace, { campaignId, place: visit.place!, entry: SHOWN_PLACE, shown: true }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

type Row = Record<string, unknown>;
const read = async (person: Person, fn: string, args: Record<string, unknown> = { campaign: campaignId }) => must(await person.db.rpc(fn, args)) as Row[];

describe("a place's own name never reaches a player (hard rule 5; tr-1; pn-1)", () => {
  // Purpose: the town and its shown piece do reach group 1's player by each road, so the two tests after this one
  // fail on the name alone, not on an empty answer.
  it('the setup: group 1 reads the town, its shown place and its description by each road', async () => {
    const towns = await read(world.playerA, 'scene_town');
    expect(towns.map((r) => r.name)).toEqual([SHOWN_PLACE.name]);
    expect(JSON.stringify(await read(world.playerA, 'known_places'))).toContain(DESCRIPTION);
    expect((await read(world.playerA, 'scene_pieces')).map((r) => r.place_name)).toEqual([PLAYERS_NAME]);
  });

  // Purpose: scene_town names the town as players know it (its players' name), as scene_pieces does, and never sends
  // the place's own name, which is the GM's.
  it("scene_town sends the town under its players' name, never its own name", async () => {
    const towns = await read(world.playerA, 'scene_town');
    expect(towns.map((r) => r.place_name)).toEqual([PLAYERS_NAME]);
    expect(JSON.stringify(towns)).not.toContain(OWN_NAME);
  });

  // Purpose: known_places (granted to every signed-in user; nothing in src/ calls it now) names a shown place as
  // players know it, and never sends the place's own name.
  it("known_places sends a shown place under its players' name, never its own name", async () => {
    const known = await read(world.playerA, 'known_places');
    expect(known.map((r) => r.place_name)).toEqual([PLAYERS_NAME]);
    expect(JSON.stringify(known)).not.toContain(OWN_NAME);
  });
});

describe('1. what is shown to one group, and another group (mc-15; 2c; scene_town)', () => {
  // Purpose: what is shown to group 1 (the town's description and a place in town) reaches no player of group 2 in the
  // same campaign and the same town, by any of the three reads; nothing at all reaches an outsider or another
  // campaign's player.
  it('reaches no player of another group, and nobody outside the campaign', async () => {
    for (const fn of ['scene_town', 'scene_pieces', 'known_places_campaign', 'known_places']) {
      expect(await read(world.playerB, fn), `${fn} to group 2`).toEqual([]);
      expect(await read(world.outsider, fn), `${fn} to an outsider`).toEqual([]);
      expect(await read(world.newcomer, fn), `${fn} to another campaign's player`).toEqual([]);
    }
  });
});

describe("2, 4. the town's book side: notes, secrets, page reference, check and tables (ds-7a, gt-1, pf-15)", () => {
  // Purpose: the town's pack entry (its GM notes, secrets and page reference) and its GM-only table reach no player
  // through the campaign library read, and a player of another campaign gets nothing of the campaign's library.
  it('reaches no player through the campaign library, nor anyone in another campaign', async () => {
    const mine = await read(world.playerA, 'campaign_library');
    expect(mine.map((r) => r.kind)).toEqual(['class']);
    expect(JSON.stringify(mine)).not.toMatch(BOOK_SIDE);
    expect(await read(world.newcomer, 'campaign_library')).toEqual([]);
    expect(await read(world.outsider, 'campaign_library')).toEqual([]);
    // The GM reads them all (so the pack holds what the player is denied).
    const gm = JSON.stringify(await read(world.gm, 'campaign_library'));
    expect(gm).toContain('Gullwick book, page 31');
    expect(gm).toContain('Press-gang at the tide steps');
  });

  // Purpose: once the town's description is shown, the player gets its words alone: none of the book side by the
  // town's reads or the log.
  it("reaches no player through the town's shown piece, the town's read or the log", async () => {
    for (const fn of ['scene_town', 'scene_pieces', 'known_places_campaign', 'known_places']) {
      expect(JSON.stringify(await read(world.playerA, fn)), fn).not.toMatch(BOOK_SIDE);
    }
    expect(JSON.stringify(await read(world.playerA, 'scene_pieces'))).toContain(DESCRIPTION);
    expect(JSON.stringify(must(await world.playerA.db.from('events').select('*').eq('campaign_id', campaignId)))).not.toMatch(BOOK_SIDE);
    expect(must(await world.playerA.db.from('place_notes').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });
});

// 5 (stock) and 6 (rumours) are covered by W12's and dec-12e's tests: see the header.
describe('3, 4, 7 (a notice), 8 (the map\'s eye). not built yet: tests to do, each naming its row', () => {
  // A person from a pack (name, leads, stat block) beside their place: 2d is on its branch, not merged.
  it.todo("a person's name, leads and stat block reach no player unless written into a shown piece (W8, 2d; mc-18)");
  // The keeper's box (mc-71) and a page reference on a player's sheet (mc-72, pf-15) come with the place's sheet.
  it.todo("a keeper's box line not revealed reaches no player (W8; mc-71)");
  it.todo("a page reference into a GM's book is dropped from what a player reads of a place; one into a players' book is kept (W4, W8; mc-72, pf-15)");
  it.todo("a notice not shared reaches no player (W14, dec-12 F; mc-66)");
  // The map is the GM's alone today (covered above); its eye is not built.
  it.todo("the town's map reaches a player only once its eye is open, and closes again with it (W15, 5m-3; mc-44a)");
});
