// The players' place card (plan dec-9-the-players-scene, P4; supabase/migrations/20261120200000_p4_players_place_card.sql;
// rulings p4s-1, p4s-2, p4s-4 in docs/design/rulings/p4-sitting-2026-11-20.md; hard rule 5). Tested on what the
// DATABASE sends a player, never on what a screen draws. TEST project or CI's local database; invented packs, places and
// words only. What it checks, in plain words:
//   * before anything of the place is shown, a player in the group reads no card and no knowledge, even a section the GM
//     already shared;
//   * once shown: the place's number and name; no name of a place it sits in that the group was never shown (the Area,
//     the Region), not as the trail, not as the card's heading, not as a shared section's place; no Location the group
//     was never shown (not its name, not its number);
//   * a Location the group was shown, and the Area once the group was shown it, do come, with their numbers;
//   * knowledge: only a section the GM shared with this group, its link marks as their labels (never an id); an unshared
//     section's words never; taken back, gone at once; Undo brings it back; Undo of a first share takes it away;
//   * a player in another group, and someone outside the campaign, read nothing of it; a section shared with the other
//     group never reaches this one;
//   * only the GM shares; players read none of the GM's share rows; each share is one log line, the GM's alone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { loadPlayersKnowledge, loadPlayersPlaceCards, numbered, setKnowledgeShare } from '../../src/modules/expedition/placeKnowledge.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let campaignId = '';
let packId = '';
let tripId = '';
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
const undoLatest = async () => {
  const eventId = await latestChange(asDb(world.gm), campaignId, 'placeKnowledge.eye', world.gm.id);
  if (!eventId) throw new Error('no placeKnowledge.eye line');
  await ok(as(world.gm, undoChange, { campaignId, eventId, authorUserId: world.gm.id }));
};

const SECRET = 'The eel-mother sleeps under the third pile';
const AREA_PAST = 'Before the silt, forty boats moored here';

/** An invented adventure: an island Region, a harbour Area, and three numbered Locations in it. */
const harbourPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'saltwick-island', name: 'Saltwick Island', type: 'region', playerView: { text: 'A long grey island.' } },
        {
          id: 'drowned-harbour',
          name: 'The Drowned Harbour',
          type: 'site',
          parentId: 'saltwick-island',
          playerView: { text: 'A silted harbour of black water.' },
          gm: { sections: [{ heading: "The harbour's past", text: AREA_PAST }] },
        },
        {
          id: 'the-jetty',
          name: 'The Jetty',
          type: 'area',
          key: '1',
          parentId: 'drowned-harbour',
          playerView: { text: 'Black piles and a slick deck.' },
          gm: {
            sections: [
              { heading: 'What everyone knows', text: 'The harbour silted in a single winter; ask [[npc:heron-wardens|the Heron Wardens]].' },
              { heading: 'The eel-mother', text: SECRET },
            ],
          },
        },
        { id: 'the-wreck', name: 'The Wreck', type: 'area', key: '2', parentId: 'drowned-harbour', playerView: { text: 'A cog on her side on the bar.' } },
        { id: 'the-breakwater', name: 'The Breakwater', type: 'area', key: '3', parentId: 'drowned-harbour', playerView: { text: 'A drowned wall with a gap.' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

const entryOf = async (id: string) => {
  const found = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === id);
  if (!found) throw new Error(`no ${id}`);
  return { packId, packEntryId: id, name: found.name, data: found.data as Record<string, unknown> };
};
/** The group moves to a place and the GM shows its first piece (a return visit may bring it back already shown). */
const goAndShow = async (id: string) => {
  await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf(id) }));
  const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(1)!;
  if (!visit.pieces[0]!.shown) await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
};
/** The GM shows the first piece of where the group stands now. */
const showHere = async () => {
  const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(1)!;
  if (!visit.pieces[0]!.shown) await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
};
const share = (entryId: string, sectionAt: number, on: boolean, group = 1) => ok(as(world.gm, setKnowledgeShare, { campaignId, group, packId, entryId, sectionAt, share: on }));
/** Everything the two new reads send this person, as one string. */
const readAll = async (person: Person) =>
  JSON.stringify([must(await person.db.rpc('place_card_for_players', { campaign: campaignId })), must(await person.db.rpc('knowledge_for_players', { campaign: campaignId }))]);

beforeAll(async () => {
  world = await buildWorld();
  campaignId = world.campaignId;
  packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
  tripId = (await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }))).id;
  // Player B's character goes to a group of its own, which is shown nothing of the harbour.
  await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId, ownerUserId: world.playerB.id }, group: null }));
  await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('the-jetty') }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("the players' place card, as the database sends it (p4s-1, p4s-2)", () => {
  // Purpose: before anything of the jetty is shown, a player in the group reads no card and no knowledge, even a section
  // the GM has already shared with the group.
  it('sends nothing before the place is shown', async () => {
    await share('the-jetty', 0, true);
    expect(must(await world.playerA.db.rpc('place_card_for_players', { campaign: campaignId }))).toEqual([]);
    expect(must(await world.playerA.db.rpc('knowledge_for_players', { campaign: campaignId }))).toEqual([]);
  });

  // Purpose: once the jetty is shown, the player reads its number and name and the section shared with the group, its
  // link mark as its label; never the Area's or the Region's name (never shown), never another Location, never the
  // unshared section's words.
  it('sends the number, the name and the shared section; nothing of what was never shown', async () => {
    await showHere();
    const card = (await loadPlayersPlaceCards(asDb(world.playerA), campaignId))!.get(1)!;
    expect(numbered(card.here)).toBe('1. The Jetty');
    expect(card.trail).toEqual([]);
    expect(card.area).toBeNull();
    expect(card.known).toEqual([]);
    const knowledge = (await loadPlayersKnowledge(asDb(world.playerA), campaignId))!;
    expect(knowledge.map((k) => [k.group, k.placeName, k.section.heading, k.section.text])).toEqual([[1, 'The Jetty', 'What everyone knows', 'The harbour silted in a single winter; ask the Heron Wardens.']]);
    const everything = await readAll(world.playerA);
    for (const never of ['Drowned Harbour', 'drowned-harbour', 'Saltwick', 'saltwick', 'Wreck', 'Breakwater', 'eel-mother', SECRET, 'heron-wardens', 'npc:']) expect(everything, never).not.toContain(never);
    // Another group's player and someone outside the campaign: nothing at all.
    expect(must(await world.playerB.db.rpc('place_card_for_players', { campaign: campaignId }))).toEqual([]);
    expect(must(await world.playerB.db.rpc('knowledge_for_players', { campaign: campaignId }))).toEqual([]);
    const outside = await world.outsider.db.rpc('place_card_for_players', { campaign: campaignId });
    expect(outside.data ?? []).toEqual([]);
    const outsideKnowledge = await world.outsider.db.rpc('knowledge_for_players', { campaign: campaignId });
    expect(outsideKnowledge.data ?? []).toEqual([]);
  });

  // Purpose: a section of the Area the GM shares reaches the group under the place it is at (the Area was never shown, so
  // its name isn't sent); Undo of that first share takes it away again.
  it("sends an Area's shared section under the place's own name, and Undo takes it back", async () => {
    await share('drowned-harbour', 0, true);
    const knowledge = (await loadPlayersKnowledge(asDb(world.playerA), campaignId))!;
    expect(knowledge.map((k) => [k.placeName, k.section.heading, k.section.text])).toEqual([
      ['The Jetty', 'What everyone knows', 'The harbour silted in a single winter; ask the Heron Wardens.'],
      ['The Jetty', "The harbour's past", AREA_PAST],
    ]);
    expect(await readAll(world.playerA)).not.toContain('Drowned Harbour');
    await undoLatest();
    expect((await loadPlayersKnowledge(asDb(world.playerA), campaignId))!.map((k) => k.section.heading)).toEqual(['What everyone knows']);
  });

  // Purpose: taken back, a section leaves the player's read at once; Undo of the taking back brings it again. A section
  // shared with the other group never reaches this one, and that group, shown nothing, reads nothing.
  it('takes a section back at once, Undo brings it, and a share stays with its own group', async () => {
    await share('the-jetty', 0, false);
    expect(await loadPlayersKnowledge(asDb(world.playerA), campaignId)).toEqual([]);
    await undoLatest();
    expect((await loadPlayersKnowledge(asDb(world.playerA), campaignId))!.map((k) => k.section.heading)).toEqual(['What everyone knows']);
    await share('the-jetty', 1, true, 2);
    expect(await readAll(world.playerA)).not.toContain(SECRET);
    expect(await readAll(world.playerB)).not.toContain(SECRET);
  });

  // Purpose: a Location of the same Area the group has been shown comes with its number; one never shown (the
  // Breakwater) sends nothing, not its name nor its number.
  it('sends the other Locations the group was shown, never one it was not', async () => {
    await goAndShow('the-wreck');
    await goAndShow('the-jetty');
    const card = (await loadPlayersPlaceCards(asDb(world.playerA), campaignId))!.get(1)!;
    expect(card.known.map(numbered)).toEqual(['2. The Wreck']);
    const everything = await readAll(world.playerA);
    expect(everything).not.toContain('Breakwater');
    expect(everything).not.toContain('"3"');
  });

  // Purpose: once the group has been shown the Area itself, the trail and the card's heading name it; the Region, never
  // shown, still isn't sent.
  it('names the Area once it was shown, never the Region', async () => {
    await goAndShow('drowned-harbour');
    await goAndShow('the-jetty');
    const card = (await loadPlayersPlaceCards(asDb(world.playerA), campaignId))!.get(1)!;
    expect(card.trail).toEqual(['The Drowned Harbour']);
    expect(card.area).toBe('The Drowned Harbour');
    expect(await readAll(world.playerA)).not.toContain('Saltwick');
  });

  // Purpose: only the GM shares; players read none of the share rows; each share is one log line, the GM's alone.
  it("keeps sharing the GM's, and its log lines the GM's", async () => {
    const refused = await world.playerA.db.rpc('set_knowledge_share', { campaign: campaignId, group_no: 1, pack: packId, entry_id: 'the-jetty', section_at: 1, share: true });
    expect(refused.error).not.toBeNull();
    const asCommand = await as(world.playerA, setKnowledgeShare, { campaignId, group: 1, packId, entryId: 'the-jetty', sectionAt: 1, share: true });
    expect(asCommand.ok).toBe(false);
    expect(must(await world.playerA.db.from('knowledge_shares').select('id'))).toEqual([]);
    expect(must(await world.playerB.db.from('knowledge_shares').select('id'))).toEqual([]);
    expect(await readAll(world.playerA)).not.toContain(SECRET);
    // A section the pack doesn't have is refused.
    const missing = await as(world.gm, setKnowledgeShare, { campaignId, group: 1, packId, entryId: 'the-jetty', sectionAt: 7, share: true });
    expect(missing.ok).toBe(false);
    const lines = must(await world.admin.from('events').select('type, audience').eq('campaign_id', campaignId).eq('type', 'placeKnowledge.eye'));
    // Five shares were set (the jetty's first, the harbour's, the taking back, the other group's; and the first share
    // again by Undo is logged under the undo's own type): four lines of this type.
    expect(lines.length).toBe(4);
    expect(new Set(lines.map((l) => l.audience))).toEqual(new Set(['gm']));
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).eq('type', 'placeKnowledge.eye'))).toEqual([]);
  });

  // Purpose: a pack taken off the campaign sends its shared Knowledge to no player, as the place's rules don't (review of
  // P4). Last, as it detaches the pack.
  it("sends a detached pack's shared Knowledge to no player", async () => {
    expect((await loadPlayersKnowledge(asDb(world.playerA), campaignId))!.map((k) => k.section.heading)).toEqual(['What everyone knows']);
    must(await world.admin.from('campaign_packs').delete().eq('campaign_id', campaignId).eq('pack_id', packId).select('id'));
    expect(must(await world.playerA.db.rpc('knowledge_for_players', { campaign: campaignId }))).toEqual([]);
  });
});
