// The fake database answers by campaign as the real one does (hd-2 and mc-28;
// supabase/migrations/20261111190000_dec_hd2_ways_on_read.sql; hard rule 5), and the app's loaders read through it.
// Invented content only. The fake doesn't model which items a campaign has opened (a member reads every item of the
// campaign's packs), so "a reveal stays in its campaign" is proved on the database (supabase/tests/
// dec-hd2-ways-on-read.test.ts); here: the campaign's packs, its members, a patch's items, and the ways on, with a
// way's map number and "Elsewhere" (sf-9, sf-19; supabase/migrations/20261126230000_sf_9_ways_on_number_elsewhere.sql).
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../core/supabase.ts';
import { LIBRARY_PAGE, loadCampaignEntries } from '../modules/library/campaignPacks.ts';
import { loadWaysOn } from '../modules/library/waysOn.ts';
import { createFakeDb } from './fakeDb.ts';

type World = ReturnType<typeof createFakeDb>;
const asDb = (world: World) => world.db as unknown as Db;

function addPack(world: World, id: string, owner: string, name: string) {
  world.tables.packs.push({ id, owner_user_id: owner, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-12T12:00:00Z', extra_meta: {} });
}
function addEntry(world: World, pack: string, kind: string, id: string, data: Record<string, unknown>) {
  // A row id that says nothing of the entry, as the database's are.
  const rowId = `entry-${String(world.tables.library_entries.length + 1).padStart(5, '0')}`;
  world.tables.library_entries.push({ id: rowId, pack_id: pack, kind, pack_entry_id: id, name: String(data.name ?? id), data: { id, ...data } });
  return rowId;
}
function attach(world: World, campaign: string, pack: string) {
  world.tables.campaign_packs.push({ id: `link-${campaign}-${pack}`, campaign_id: campaign, pack_id: pack, pack_name: pack, option_choices: {}, overrides: {}, priority: 1 });
}

/** Two campaigns of one GM sharing the goods pack; campaign A alone also attaches the extras pack. */
function twoCampaigns() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const both = world.addPerson('wren@lantern.example', 'Sam');
  const onlyB = world.addPerson('ash@lantern.example', 'Ash');
  const stranger = world.addPerson('moss@lantern.example', 'Moss');
  const a = world.addCampaign('The Reedmouth Delve', gm);
  const b = world.addCampaign('The Ash Barrows', gm);
  world.addMember(a, both, 'player');
  world.addMember(b, both, 'player');
  world.addMember(b, onlyB, 'player');
  addPack(world, 'pack-goods', gm, 'Fen Goods');
  addPack(world, 'pack-extras', gm, 'Fen Extras');
  addEntry(world, 'pack-goods', 'item', 'reed-rope', { name: 'Reed rope', category: 'gear' });
  addEntry(world, 'pack-goods', 'statBlock', 'bog-lurker', { name: 'Bog lurker' });
  addEntry(world, 'pack-goods', 'table', 'marsh-omens', { name: 'Marsh omens', gmOnly: false });
  // A patch in the shared pack on an item only the extras pack has: open where the extras are attached.
  addEntry(world, 'pack-goods', 'patch', 'heavier-lantern', { byOption: 'mire-depth=deep', match: { kind: 'item', ids: ['bog-lantern'] }, change: { cost: { delta: 1 } } });
  addEntry(world, 'pack-extras', 'item', 'bog-lantern', { name: 'Bog lantern', category: 'gear' });
  attach(world, a, 'pack-goods');
  attach(world, b, 'pack-goods');
  attach(world, a, 'pack-extras');
  return { world, gm, both, onlyB, stranger, a, b };
}

const ids = (rows: { packEntryId: string }[] | null) => (rows ?? []).map((e) => e.packEntryId).sort();

describe('the campaign library, by campaign', () => {
  // Purpose: what a device loads for a campaign follows that campaign alone: a pack only campaign A attaches, and a
  // patch on an item only A has, are in A's answer and never in B's, for a player in both.
  it("a player in two campaigns gets each campaign's own answer", async () => {
    const { world, both, a, b } = twoCampaigns();
    world.signInAs(both);
    expect(ids(await loadCampaignEntries(asDb(world), a))).toEqual(['bog-lantern', 'heavier-lantern', 'marsh-omens', 'reed-rope']);
    expect(ids(await loadCampaignEntries(asDb(world), b))).toEqual(['marsh-omens', 'reed-rope']);
  });

  // Purpose: the narrowed direct rule: a patch on an item reaches a direct read only when every one of the reader's
  // campaigns using the pack has the item.
  it('a direct read gives a player in both campaigns only what both have', async () => {
    const { world, both, onlyB, a } = twoCampaigns();
    const patchesSeen = async () => ((await world.db.from('library_entries').select('kind, pack_entry_id').eq('kind', 'patch')).data ?? []).length;
    world.signInAs(both);
    expect(await patchesSeen()).toBe(0);
    world.signInAs(onlyB);
    expect(await patchesSeen()).toBe(0);
    // Once campaign B has the item too, the patch is everyone's.
    attach(world, 'unused', 'pack-extras');
    world.tables.campaign_packs[world.tables.campaign_packs.length - 1]!.campaign_id = world.tables.campaigns.find((c) => c.id !== a)!.id;
    expect(await patchesSeen()).toBe(1);
    world.signInAs(both);
    expect(await patchesSeen()).toBe(1);
  });

  // Purpose: the GM's reads are as before; someone outside the campaign gets nothing; `packs` narrows the answer.
  it('the GM gets every entry, a stranger none, and only the packs asked for', async () => {
    const { world, gm, stranger, onlyB, a, b } = twoCampaigns();
    world.signInAs(gm);
    expect(ids(await loadCampaignEntries(asDb(world), a))).toEqual(['bog-lantern', 'bog-lurker', 'heavier-lantern', 'marsh-omens', 'reed-rope']);
    expect(ids(await loadCampaignEntries(asDb(world), a, ['pack-extras']))).toEqual(['bog-lantern']);
    // A pack the campaign doesn't attach is never answered for it, even to its owner.
    expect((await world.db.rpc('campaign_library', { campaign: b, packs: ['pack-extras'] })).data).toEqual([]);
    world.signInAs(stranger);
    expect((await world.db.rpc('campaign_library', { campaign: a })).data).toEqual([]);
    world.signInAs(onlyB);
    expect((await world.db.rpc('campaign_library', { campaign: a })).data).toEqual([]);
  });

  // Purpose: a long pack is read a page at a time by key: each page starts after the last id of the one before, and
  // the loader follows until a short page, losing and repeating nothing.
  it('the answer is read a page at a time, by the last id received', async () => {
    const { world, gm, a } = twoCampaigns();
    world.signInAs(gm);
    const all = ((await world.db.rpc('campaign_library', { campaign: a })).data ?? []) as { id: string }[];
    expect(all.map((r) => r.id)).toEqual([...all.map((r) => r.id)].sort());
    const first = ((await world.db.rpc('campaign_library', { campaign: a, page_size: 2 })).data ?? []) as { id: string }[];
    const next = ((await world.db.rpc('campaign_library', { campaign: a, page_size: 2, after_id: first[1]!.id })).data ?? []) as { id: string }[];
    expect([...first, ...next].map((r) => r.id)).toEqual(all.slice(0, 4).map((r) => r.id));
    // A pack longer than one page: the loader asks again from the last id, and gets every entry once.
    for (let n = 0; n < LIBRARY_PAGE + 5; n += 1) addEntry(world, 'pack-extras', 'spell', `reed-song-${n}`, { name: `Reed song ${n}` });
    const loose = world.db as unknown as { rpc: (name: string, args: Record<string, unknown>) => unknown };
    const asked = vi.spyOn(loose, 'rpc');
    const loaded = (await loadCampaignEntries(asDb(world), a)) ?? [];
    expect(loaded.length).toBe(all.length + LIBRARY_PAGE + 5);
    expect(new Set(loaded.map((e) => e.entryId)).size).toBe(loaded.length);
    const pages = asked.mock.calls.filter(([name]) => name === 'campaign_library').map(([, args]) => args.after_id);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toBeUndefined();
    expect(typeof pages[1]).toBe('string');
    asked.mockRestore();
  });
});

/** An adventure of linked places in one campaign, the party at the jetty; the islet's place exists, nothing shown. */
function adventure() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const player = world.addPerson('wren@lantern.example', 'Sam');
  const other = world.addPerson('ash@lantern.example', 'Ash');
  const stranger = world.addPerson('moss@lantern.example', 'Moss');
  const campaign = world.addCampaign('The Reedmouth Delve', gm);
  world.addMember(campaign, player, 'player');
  world.addMember(campaign, other, 'player');
  world.addCharacter(campaign, 'Wren', { ownerId: player });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: other });
  addPack(world, 'pack-mire', gm, 'Mire Tower');
  attach(world, campaign, 'pack-mire');
  const route = (id: string, data: Record<string, unknown>) => addEntry(world, 'pack-mire', 'route', id, data);
  // The places as the pack has them: none sits in another, and none has a map number.
  for (const [id, name] of [['mt-jetty', 'The jetty'], ['mt-islet', 'The reed islet'], ['mt-sluice', 'The sluice'], ['mt-vault', 'The drowned vault'], ['mt-crypt', 'The crypt']] as const) {
    addEntry(world, 'pack-mire', 'location', id, { name });
  }
  const open = route('mt-route-jetty-islet', { from: 'mt-jetty', to: 'mt-islet', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: ' swim ', name: '', value: 3, unit: 'turn', note: 'Needs a rope', needsApproval: true }, { by: 'fly', value: 1.5, unit: 'turn' }, { by: 'crawl', value: 1, unit: 'fortnight' }, { by: 'row', name: 'Rowing again', value: 9, unit: 'turn' }] });
  route('mt-route-jetty-sluice', { from: 'mt-jetty', to: 'mt-sluice', type: 'secret', hidden: true, oneWay: false, notes: 'Floods at the turn of the tide' });
  const drop = route('mt-route-jetty-vault', { from: 'mt-jetty', to: 'mt-vault', type: 'stairs', oneWay: true, travel: { value: 1, unit: 'turn' } });
  route('mt-route-vault-jetty', { from: 'mt-vault', to: 'mt-jetty', type: 'other', hidden: false, oneWay: true });
  // A pack that files `hidden` among its GM-only fields: the mark sits in the hidden part.
  const filed = route('mt-route-jetty-crypt', { from: 'mt-jetty', to: 'mt-crypt' });
  world.tables.library_entry_secrets.push({ id: filed, pack_id: 'pack-mire', data: { gmOnly: ['hidden'], hidden: true } });
  const placeRow = (id: string, entry: string, name: string, playersName: string) =>
    world.tables.places.push({ id, campaign_id: campaign, name, players_name: playersName, pack_id: 'pack-mire', pack_entry_id: entry, undone: false });
  placeRow('place-jetty', 'mt-jetty', 'The jetty', '');
  placeRow('place-islet', 'mt-islet', 'The reed islet', 'An islet among the reeds');
  world.tables.expeditions.push({ id: 'trip-1', campaign_id: campaign, ended_at: null, undone: false, created_at: '2026-11-12T10:00:00Z' });
  const visit = (id: string, group: number, placeId: string, at: string, movedOn = false) =>
    world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: 'trip-1', group_number: group, place_id: placeId, shown: false, moved_on: movedOn, undone: false, created_at: at });
  visit('visit-jetty', 1, 'place-jetty', '2026-11-12T10:00:00Z');
  world.tables.place_pieces.push({ id: 'piece-islet', campaign_id: campaign, place_id: 'place-islet', kind: 'description', body: 'Reeds taller than a mast.', undone: false });
  return { world, gm, player, other, stranger, campaign, ash, open, drop, visit };
}

describe('the ways on', () => {
  /** The GM shows a piece of the jetty to a group on one of its visits there. */
  const showJetty = (world: World, campaign: string, visitId: string, group: number) => {
    if (!world.tables.place_pieces.some((p) => p.id === 'piece-jetty')) {
      world.tables.place_pieces.push({ id: 'piece-jetty', campaign_id: campaign, place_id: 'place-jetty', kind: 'description', body: 'Black water laps the posts.', undone: false });
    }
    world.tables.piece_shows.push({ id: `show-jetty-${visitId}`, campaign_id: campaign, group_place_id: visitId, piece_id: 'piece-jetty', group_number: group, shown: true, undone: false });
  };

  // Purpose: until something of the place the group is in has been shown to it, a player gets no way at all (mc-28b):
  // not a nameless one, not a count. Then: the open routes, never the hidden ones (marked on the entry or filed in
  // its hidden part), never the one-way route that only leads here, no id of the pack's, no name for the unexplored.
  it('a player gets no way until something of the place is shown, then the open ways with nothing hidden', async () => {
    const { world, player, gm, campaign, open, drop } = adventure();
    world.signInAs(player);
    expect((await world.db.rpc('campaign_ways_on', { campaign })).data).toEqual([]);
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
    // Nor does the GM's own answer list any for that group yet (the GM reads the routes themselves).
    world.signInAs(gm);
    expect((await world.db.rpc('campaign_ways_on', { campaign })).data).toEqual([]);
    showJetty(world, campaign, 'visit-jetty', 1);
    world.signInAs(player);
    const rows = (await world.db.rpc('campaign_ways_on', { campaign })).data as Record<string, unknown>[];
    expect(rows.map((r) => r.route_id).sort()).toEqual([open, drop].sort());
    expect(rows.every((r) => r.group_number === 1 && r.to_place_id === null && r.to_name === null)).toBe(true);
    expect(Object.keys(rows[0]!).sort()).toEqual(['elsewhere', 'group_number', 'route_id', 'to_area_name', 'to_name', 'to_number', 'to_place_id', 'ways']);
    // How each way is travelled and how long it takes (mc-28a): the four fields, trimmed, in the pack's order; a bad
    // value or unit and a way named twice left out; a barrier's note and approval never sent.
    const rowing = [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'swim', value: 3, unit: 'turn' }];
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: open, to: null, number: null, elsewhere: false, areaName: null, ways: rowing });
    // A route that gives one amount has one way with no id or name.
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: drop, to: null, number: null, elsewhere: false, areaName: null, ways: [{ by: '', name: '', value: 1, unit: 'turn' }] });
    const sent = JSON.stringify(rows);
    for (const word of ['mt-', 'rope', 'needsApproval', 'note', 'fly', 'crawl', 'fortnight', 'Rowing again', 'Floods', 'secret', 'islet']) expect(sent, word).not.toContain(word);
    // A route is no player's by a direct read, nor in the campaign's library.
    expect(((await world.db.from('library_entries').select('kind').eq('kind', 'route')).data ?? []).length).toBe(0);
    expect((await loadCampaignEntries(asDb(world), campaign))?.some((e) => e.kind === 'route')).toBe(false);
  });

  // Purpose: a way whose pack names its own icon (pf-25) is still sent as the four fields alone, as the database
  // sends it: the icon is the GM's read of the route and reaches no player (review of #1003).
  it('sends a way’s four fields alone, never the icon its pack names', async () => {
    const { world, player, campaign, open } = adventure();
    const entry = world.tables.library_entries.find((e) => e.id === open)!;
    entry.data = { ...(entry.data as Record<string, unknown>), travel: [{ by: 'wade', name: 'Wading', icon: 'leather-boot', value: 2, unit: 'turn' }] };
    showJetty(world, campaign, 'visit-jetty', 1);
    world.signInAs(player);
    const rows = (await world.db.rpc('campaign_ways_on', { campaign })).data as { route_id: string; ways: Record<string, unknown>[] }[];
    const wading = rows.find((r) => r.route_id === open)!.ways;
    expect(wading).toEqual([{ by: 'wade', name: 'Wading', value: 2, unit: 'turn' }]);
    expect(Object.keys(wading[0]!).sort()).toEqual(['by', 'name', 'unit', 'value']);
    for (const word of ['icon', 'leather-boot']) expect(JSON.stringify(rows), word).not.toContain(word);
  });

  // Purpose: the far end is named once a piece of it has been shown to the reader's group, with the players' name;
  // what was shown stays known on a later visit (mc-28c); a group that wasn't shown it gets no name, and a group shown
  // nothing of where it stands gets no way.
  it('the far end is named once that place has been shown to the group, and only to that group', async () => {
    const { world, player, other, campaign, ash, open, visit } = adventure();
    // The group went to the islet, was shown a piece there, and came back to the jetty.
    world.tables.group_places.find((v) => v.id === 'visit-jetty')!.moved_on = true;
    visit('visit-islet', 1, 'place-islet', '2026-11-12T10:10:00Z', true);
    visit('visit-jetty-again', 1, 'place-jetty', '2026-11-12T10:20:00Z');
    world.tables.piece_shows.push({ id: 'show-1', campaign_id: campaign, group_place_id: 'visit-islet', piece_id: 'piece-islet', group_number: 1, shown: true, undone: false });
    world.signInAs(player);
    // Back at the jetty, of which nothing has ever been shown to them: no way yet, not even to the islet they know.
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
    // Had a piece of the jetty been shown on their FIRST visit, they would know the place on coming back (mc-28c):
    // the ways are there at once, the islet's with its name, nothing shown on this visit.
    showJetty(world, campaign, 'visit-jetty', 1);
    const mine = (await loadWaysOn(asDb(world), campaign)) ?? [];
    expect(mine).toHaveLength(2);
    expect(mine.find((w) => w.routeId === open)?.to).toEqual({ placeId: 'place-islet', name: 'An islet among the reeds' });
    expect(JSON.stringify((await world.db.rpc('campaign_ways_on', { campaign })).data)).not.toContain('The reed islet');
    // Ash is in a group of its own, at the jetty too, shown nothing: no way.
    world.tables.party_groups.push({ id: 'group-2', campaign_id: campaign, number: 2 });
    world.tables.party_group_members.find((m) => m.actor_id === ash)!.group_number = 2;
    visit('visit-jetty-2', 2, 'place-jetty', '2026-11-12T10:30:00Z');
    world.signInAs(other);
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
    // Group 2 is shown the jetty: its ways, and still no name for the islet, which was never shown to it.
    showJetty(world, campaign, 'visit-jetty-2', 2);
    const theirs = (await loadWaysOn(asDb(world), campaign)) ?? [];
    expect(theirs).toHaveLength(2);
    expect(theirs.every((w) => w.groupNumber === 2 && w.to === null)).toBe(true);
    // A show of the islet taken back un-names it again for group 1.
    world.tables.piece_shows.find((sh) => sh.id === 'show-1')!.shown = false;
    world.signInAs(player);
    expect((await loadWaysOn(asDb(world), campaign))?.map((w) => w.to)).toEqual([null, null]);
  });

  // Purpose: nobody outside the campaign gets a way on; the GM gets the same narrow rows, for every group.
  it('a stranger gets nothing; the GM gets the narrow rows', async () => {
    const { world, gm, stranger, campaign } = adventure();
    showJetty(world, campaign, 'visit-jetty', 1);
    world.signInAs(stranger);
    expect((await world.db.rpc('campaign_ways_on', { campaign })).data).toEqual([]);
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
    world.signInAs(gm);
    const raw = JSON.stringify((await world.db.rpc('campaign_ways_on', { campaign })).data);
    expect(((await loadWaysOn(asDb(world), campaign)) ?? []).length).toBe(2);
    for (const word of ['mt-', 'secret', 'Floods', 'rope']) expect(raw, word).not.toContain(word);
  });

  // Purpose: with the adventure detached, there is nothing to send even for a place the group knows.
  it('no ways without a current place from an attached pack', async () => {
    const { world, player, campaign } = adventure();
    showJetty(world, campaign, 'visit-jetty', 1);
    world.signInAs(player);
    expect((await loadWaysOn(asDb(world), campaign)) ?? []).toHaveLength(2);
    world.tables.campaign_packs.length = 0;
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
  });
});

const HARBOUR = 'The Gull Harbour';
const STRAND = 'The Kelp Strand';
// The name the pack gives the strand for players (`playerView.name`); the harbour is given none.
const STRAND_FOR_PLAYERS = 'The pale shore';
/** Names and ids of the harbour adventure that no way on may carry before its place is explored, or ever (an Area's). */
const HARBOUR_NEVER = ['gh-', HARBOUR, STRAND, 'The sea cave', 'The mole', 'A stone mole', 'The tally shed', 'The mud flat', 'The chain gate', 'The shingle landing', 'The marram dunes', 'The shed cellar', 'The far moor', 'parentId'];

/**
 * An adventure of two Areas (sf-9's frame WT1): the party's one group stands at 5, the sea cave, in the harbour, and
 * has been shown it. Ways lead to places of the harbour (3, 4, one with no number, a hidden one), to places of the
 * strand (0 and 7), to a cellar inside the shed, to a moor in no Area, and to a place the pack doesn't have.
 */
function twoAreas() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const player = world.addPerson('wren@lantern.example', 'Sam');
  const other = world.addPerson('ash@lantern.example', 'Ash');
  const stranger = world.addPerson('moss@lantern.example', 'Moss');
  const campaign = world.addCampaign('The Reedmouth Delve', gm);
  world.addMember(campaign, player, 'player');
  world.addMember(campaign, other, 'player');
  world.addCharacter(campaign, 'Wren', { ownerId: player });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: other });
  addPack(world, 'pack-gull', gm, 'Gull Harbour');
  attach(world, campaign, 'pack-gull');
  const location = (id: string, data: Record<string, unknown>) => addEntry(world, 'pack-gull', 'location', id, data);
  location('gh-harbour', { name: HARBOUR, type: 'site' });
  location('gh-strand', { name: STRAND, type: 'site', playerView: { name: ` ${STRAND_FOR_PLAYERS} ` } });
  location('gh-cave', { name: 'The sea cave', parentId: 'gh-harbour', key: '5' });
  location('gh-mole', { name: 'The mole', parentId: 'gh-harbour', key: ' 3 ', playerView: { name: 'A stone mole' } });
  location('gh-shed', { name: 'The tally shed', parentId: 'gh-harbour', key: '4' });
  location('gh-flat', { name: 'The mud flat', parentId: 'gh-harbour' });
  location('gh-gate', { name: 'The chain gate', parentId: 'gh-harbour', key: '10' });
  location('gh-landing', { name: 'The shingle landing', parentId: 'gh-strand', key: '0' });
  location('gh-dunes', { name: 'The marram dunes', parentId: 'gh-strand', key: '7' });
  location('gh-cellar', { name: 'The shed cellar', parentId: 'gh-shed', key: '4a' });
  location('gh-moor', { name: 'The far moor', key: '12' });
  const travel = [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }];
  const route = (to: string, more: Record<string, unknown> = {}) => addEntry(world, 'pack-gull', 'route', `gh-route-cave-${to}`, { from: 'gh-cave', to: `gh-${to}`, travel, ...more });
  const to = {
    mole: route('mole'), shed: route('shed'), flat: route('flat'), gate: route('gate', { hidden: true }), landing: route('landing'),
    // A two-way link written from the far end.
    dunes: addEntry(world, 'pack-gull', 'route', 'gh-route-dunes-cave', { from: 'gh-dunes', to: 'gh-cave', travel }),
    cellar: route('cellar'), moor: route('moor'), nowhere: route('nowhere'),
  };
  const placeRow = (id: string, entry: string, name: string, playersName = '') =>
    world.tables.places.push({ id, campaign_id: campaign, name, players_name: playersName, pack_id: 'pack-gull', pack_entry_id: entry, undone: false });
  placeRow('place-cave', 'gh-cave', 'The sea cave');
  placeRow('place-mole', 'gh-mole', 'The mole', 'A stone mole');
  placeRow('place-dunes', 'gh-dunes', 'The marram dunes');
  placeRow('place-shed', 'gh-shed', 'The tally shed');
  placeRow('place-cellar', 'gh-cellar', 'The shed cellar');
  placeRow('place-moor', 'gh-moor', 'The far moor');
  world.tables.expeditions.push({ id: 'trip-1', campaign_id: campaign, ended_at: null, undone: false, created_at: '2026-11-26T10:00:00Z' });
  let minute = 0;
  /** A visit of a group at a place, in the order the calls are made; the newest one not moved on is where it stands. */
  const visit = (id: string, group: number, placeId: string, movedOn = false) => {
    minute += 1;
    world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: 'trip-1', group_number: group, place_id: placeId, shown: false, moved_on: movedOn, undone: false, created_at: `2026-11-26T10:${String(minute).padStart(2, '0')}:00Z` });
  };
  /** The GM shows a piece of a place to a group on one of its visits there. */
  const show = (visitId: string, group: number, placeId: string) => {
    const piece = `piece-${placeId}`;
    if (!world.tables.place_pieces.some((p) => p.id === piece)) world.tables.place_pieces.push({ id: piece, campaign_id: campaign, place_id: placeId, kind: 'description', body: 'Green water breathes in the dark.', undone: false });
    world.tables.piece_shows.push({ id: `show-${visitId}`, campaign_id: campaign, group_place_id: visitId, piece_id: piece, group_number: group, shown: true, undone: false });
  };
  visit('visit-cave', 1, 'place-cave');
  show('visit-cave', 1, 'place-cave');
  /** Group 1 has been somewhere and is back at the cave, which it knows (mc-28c). */
  const beenAt = (placeId: string) => {
    world.tables.group_places.filter((v) => v.group_number === 1).forEach((v) => (v.moved_on = true));
    visit(`visit-${placeId}-${minute}`, 1, placeId, true);
    visit(`visit-cave-${minute}`, 1, 'place-cave');
  };
  type Sent = { group_number: number; route_id: string; to_place_id: string | null; to_name: string | null; to_number: string | null; elsewhere: boolean; to_area_name: string | null; ways: unknown };
  const sent = async () => ((await world.db.rpc('campaign_ways_on', { campaign })).data ?? []) as Sent[];
  /** What a row says of its far end, by the route it is for. */
  const farOf = async (routeId: string, group = 1) => {
    const row = (await sent()).find((r) => r.route_id === routeId && r.group_number === group);
    return row ? { place: row.to_place_id, name: row.to_name, number: row.to_number, elsewhere: row.elsewhere } : null;
  };
  /** The Area's name a row carries, by the route it is for (#122's ⚑ 1); undefined when no row is sent for it. */
  const areaOf = async (routeId: string, group = 1) => (await sent()).find((r) => r.route_id === routeId && r.group_number === group)?.to_area_name;
  /** The pack files these fields of a location among its GM-only fields: kept apart, as the database's split does. */
  const hide = (entryId: string, ...fields: string[]) => {
    const entry = world.tables.library_entries.find((e) => e.pack_entry_id === entryId)!;
    const data = { ...(entry.data as Record<string, unknown>) };
    const hidden: Record<string, unknown> = { gmOnly: fields };
    for (const field of fields) {
      if (field in data) hidden[field] = data[field];
      delete data[field];
    }
    entry.data = data;
    world.tables.library_entry_secrets.push({ id: entry.id, pack_id: entry.pack_id, data: hidden });
  };
  return { world, gm, player, other, stranger, campaign, ash, to, visit, show, beenAt, sent, farOf, areaOf, placeRow, hide };
}

describe("a way's map number, and Elsewhere (sf-9, sf-19)", () => {
  const unexplored = (number: string | null) => ({ place: null, name: null, number, elsewhere: false });
  const ELSEWHERE = { place: null, name: null, number: null, elsewhere: true };

  // Purpose: a place not yet explored, in an Area the group knows (it stands in it), comes with its map number,
  // trimmed, and no name; one with no map number comes with none; the hidden way is still absent.
  it('an unexplored place in an Area the group knows comes with its number and no name', async () => {
    const { world, player, to, sent, farOf } = twoAreas();
    world.signInAs(player);
    expect(await farOf(to.shed)).toEqual(unexplored('4'));
    expect(await farOf(to.mole)).toEqual(unexplored('3'));
    expect(await farOf(to.flat)).toEqual(unexplored(null));
    expect((await sent()).map((r) => r.route_id)).not.toContain(to.gate);
    expect((await sent()).length).toBe(8);
  });

  // Purpose: a place in an Area the group has not been to comes with no number, no name and the elsewhere mark: the
  // first way into that Area reads "Elsewhere". The number is absent from the answer itself, not left off a screen.
  it('an unexplored place in an Area the group does not know comes with no number, only that it leads elsewhere', async () => {
    const { world, player, campaign, to, sent, farOf } = twoAreas();
    world.signInAs(player);
    expect(await farOf(to.landing)).toEqual(ELSEWHERE);
    expect(await farOf(to.dunes)).toEqual(ELSEWHERE);
    const landing = (await sent()).find((r) => r.route_id === to.landing)!;
    expect(landing).toEqual({ group_number: 1, route_id: to.landing, to_place_id: null, to_name: null, to_number: null, elsewhere: true, to_area_name: null, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
    // The app's reader says the same in its own shape.
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: to.landing, to: null, number: null, elsewhere: true, areaName: null, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: to.shed, to: null, number: '4', elsewhere: false, areaName: null, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
  });

  // Purpose: sf-19, "Once they have been there": after a visit to one place of an Area, with nothing of it shown, that
  // Area's other places come with their numbers, and so does the place visited, still without a name; an undone visit
  // counts for nothing, nor one of an undone expedition.
  it('once the group has been at a place of an Area, shown or not, its places come with their numbers', async () => {
    const { world, player, to, beenAt, farOf } = twoAreas();
    world.signInAs(player);
    beenAt('place-dunes');
    expect(await farOf(to.landing)).toEqual(unexplored('0'));
    expect(await farOf(to.dunes)).toEqual(unexplored('7'));
    const visit = world.tables.group_places.find((v) => v.place_id === 'place-dunes')!;
    visit.undone = true;
    expect(await farOf(to.landing)).toEqual(ELSEWHERE);
    expect(await farOf(to.dunes)).toEqual(ELSEWHERE);
    visit.undone = false;
    expect(await farOf(to.landing)).toEqual(unexplored('0'));
    // A visit of an expedition that was undone, at a place of the strand: it earns nothing.
    world.tables.expeditions.push({ id: 'trip-undone', campaign_id: visit.campaign_id, ended_at: 1, undone: true, created_at: '2026-11-25T10:00:00Z' });
    visit.expedition_id = 'trip-undone';
    expect(await farOf(to.landing)).toEqual(ELSEWHERE);
  });

  // Purpose: an explored place comes with its number beside its players' name; a show taken back leaves the number
  // (the group has been there) and takes the name.
  it('an explored place comes with its number and its players’ name', async () => {
    const { world, player, campaign, to, beenAt, show, farOf } = twoAreas();
    world.signInAs(player);
    beenAt('place-mole');
    const visit = world.tables.group_places.find((v) => v.place_id === 'place-mole')!;
    show(String(visit.id), 1, 'place-mole');
    expect(await farOf(to.mole)).toEqual({ place: 'place-mole', name: 'A stone mole', number: '3', elsewhere: false });
    expect((await loadWaysOn(asDb(world), campaign))?.find((w) => w.routeId === to.mole)).toMatchObject({ to: { placeId: 'place-mole', name: 'A stone mole' }, number: '3', elsewhere: false });
    world.tables.piece_shows.find((sh) => sh.group_place_id === visit.id)!.shown = false;
    expect(await farOf(to.mole)).toEqual(unexplored('3'));
  });

  // Purpose: what one group has earned is not another's. Ash's group stands at the cave too and has been shown it, but
  // has never been to the strand: after group 1's visit there, Ash still gets no number for the strand's places.
  it('another group’s player gets no number that group has not earned', async () => {
    const { world, player, other, campaign, ash, to, beenAt, visit, show, farOf, sent } = twoAreas();
    // A first read makes the stand-in's group rows (everyone in group 1), as in the test of the far end's name above.
    world.signInAs(player);
    await sent();
    world.tables.party_groups.push({ id: 'group-2', campaign_id: campaign, number: 2 });
    world.tables.party_group_members.find((m) => m.actor_id === ash)!.group_number = 2;
    visit('visit-cave-2', 2, 'place-cave');
    show('visit-cave-2', 2, 'place-cave');
    beenAt('place-dunes');
    world.signInAs(player);
    expect(await farOf(to.landing)).toEqual(unexplored('0'));
    world.signInAs(other);
    expect((await sent()).every((r) => r.group_number === 2)).toBe(true);
    expect(await farOf(to.landing, 2)).toEqual(ELSEWHERE);
    expect(await farOf(to.dunes, 2)).toEqual(ELSEWHERE);
    expect(await farOf(to.shed, 2)).toEqual(unexplored('4'));
    expect(JSON.stringify(await sent())).not.toMatch(/"to_number":"(0|7)"/);
  });

  // Purpose: the edges of "an Area the group knows", as the database decides them. A room inside a place the group has
  // not entered leads elsewhere until the group has stood at that place or inside it; a place in no Area leads
  // elsewhere from inside an Area until the group has stood at a place in no Area; a place the pack doesn't have
  // always leads elsewhere.
  it('a room of a place not entered, a place in no Area and a place the pack lacks lead elsewhere until earned', async () => {
    const { world, player, to, beenAt, farOf } = twoAreas();
    world.signInAs(player);
    expect(await farOf(to.cellar)).toEqual(ELSEWHERE);
    expect(await farOf(to.moor)).toEqual(ELSEWHERE);
    expect(await farOf(to.nowhere)).toEqual(ELSEWHERE);
    // Standing at the shed itself is having been where the cellar is.
    beenAt('place-shed');
    expect(await farOf(to.cellar)).toEqual(unexplored('4a'));
    // Standing in the cellar is having been in the shed and in the harbour.
    world.tables.group_places.find((v) => v.place_id === 'place-shed')!.place_id = 'place-cellar';
    expect(await farOf(to.cellar)).toEqual(unexplored('4a'));
    expect(await farOf(to.shed)).toEqual(unexplored('4'));
    beenAt('place-moor');
    expect(await farOf(to.moor)).toEqual(unexplored('12'));
    expect(await farOf(to.nowhere)).toEqual(ELSEWHERE);
  });

  // Purpose: #122's ⚑ 1, "Send a visited Area's name": a way into a second Area the group knows (a visit, shown or
  // not) comes with that Area's players' name, trimmed, so its rows can stand under it; until the visit, and for a
  // group that has not made it, the name is nowhere in the answer; an undone visit takes it back.
  it('a way into a second Area the group has been to comes with that Area’s players’ name, and not before', async () => {
    const { world, gm, player, other, campaign, ash, to, beenAt, visit, show, sent, areaOf } = twoAreas();
    world.signInAs(player);
    expect(await areaOf(to.landing)).toBeNull();
    expect(JSON.stringify(await sent())).not.toContain(STRAND_FOR_PLAYERS);
    // Ash's group stands at the cave too, shown it, and never goes to the strand.
    world.tables.party_groups.push({ id: 'group-2', campaign_id: campaign, number: 2 });
    world.tables.party_group_members.find((m) => m.actor_id === ash)!.group_number = 2;
    visit('visit-cave-2', 2, 'place-cave');
    show('visit-cave-2', 2, 'place-cave');
    beenAt('place-dunes');
    expect(await areaOf(to.landing)).toBe(STRAND_FOR_PLAYERS);
    expect(await areaOf(to.dunes)).toBe(STRAND_FOR_PLAYERS);
    expect((await loadWaysOn(asDb(world), campaign))?.find((w) => w.routeId === to.landing)).toEqual({ groupNumber: 1, routeId: to.landing, to: null, number: '0', elsewhere: false, areaName: STRAND_FOR_PLAYERS, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
    // The strand's own name (the GM's) is still nowhere.
    expect(JSON.stringify(await sent())).not.toContain(STRAND);
    world.signInAs(other);
    expect((await sent()).length).toBeGreaterThan(0);
    expect(await areaOf(to.landing, 2)).toBeNull();
    expect(JSON.stringify(await sent()) + JSON.stringify(await loadWaysOn(asDb(world), campaign))).not.toContain(STRAND_FOR_PLAYERS);
    // The GM reads every group's rows: the name on group 1's rows only.
    world.signInAs(gm);
    expect((await sent()).filter((r) => r.to_area_name !== null).map((r) => r.group_number)).toEqual([1, 1]);
    world.signInAs(player);
    world.tables.group_places.find((v) => v.place_id === 'place-dunes')!.undone = true;
    expect(await areaOf(to.landing)).toBeNull();
    expect(JSON.stringify(await sent())).not.toContain(STRAND_FOR_PLAYERS);
  });

  // Purpose: only a name given for players is ever sent. An Area with no players' name sends none, known or not (its
  // own name never stands in); the Area the group stands in is named by the same rule; the campaign's place made from
  // an Area gives its players' name before the pack's; a `playerView.name` that is not text, or blank, is no name; a
  // place in no Area has no Area's name.
  it('an Area with no players’ name sends no name, never its own; the campaign’s place’s players’ name comes first', async () => {
    const { world, player, to, beenAt, sent, areaOf, placeRow } = twoAreas();
    world.signInAs(player);
    // The harbour, where the group stands, was given no players' name: its rows carry none.
    expect(await areaOf(to.shed)).toBeNull();
    expect(await areaOf(to.mole)).toBeNull();
    const harbour = world.tables.library_entries.find((e) => e.pack_entry_id === 'gh-harbour')!;
    harbour.data = { ...(harbour.data as Record<string, unknown>), playerView: { name: 'The old port' } };
    expect(await areaOf(to.shed)).toBe('The old port');
    for (const notAName of [7, '   ', null]) {
      harbour.data = { ...(harbour.data as Record<string, unknown>), playerView: { name: notAName } };
      expect(await areaOf(to.shed)).toBeNull();
    }
    // A place of the campaign made from the harbour: its players' name, when it has one; not when undone.
    placeRow('place-harbour', 'gh-harbour', HARBOUR);
    expect(await areaOf(to.shed)).toBeNull();
    const harbourPlace = world.tables.places.find((p) => p.id === 'place-harbour')!;
    harbourPlace.players_name = 'The drowned port';
    harbour.data = { ...(harbour.data as Record<string, unknown>), playerView: { name: 'The old port' } };
    expect(await areaOf(to.shed)).toBe('The drowned port');
    harbourPlace.undone = true;
    expect(await areaOf(to.shed)).toBe('The old port');
    // A place in no Area stands under none. (A room's rows, and the place it is in: the next test.)
    beenAt('place-moor');
    expect(await areaOf(to.moor)).toBeNull();
    expect(JSON.stringify(await sent())).not.toContain(HARBOUR);
  });

  // Purpose: the review of #122, finding 1: ⚑ 1 sends an Area's name, and the place a room is in (a cellar's shed) is
  // no Area. Its players' name is a place's name: never sent on a visit alone, only once the group has explored that
  // place (a piece of it shown), the far end's own test; a show taken back takes it back. And a container whose
  // `type` the pack files among its GM-only fields is not plainly an Area: it is named by the same narrower test.
  it('the place a room is in is named only once the group has explored it; a visit alone names an Area only', async () => {
    const { world, player, to, beenAt, show, sent, farOf, areaOf, hide } = twoAreas();
    world.signInAs(player);
    const shed = world.tables.library_entries.find((e) => e.pack_entry_id === 'gh-shed')!;
    shed.data = { ...(shed.data as Record<string, unknown>), type: 'area', playerView: { name: 'A tarred shed' } };
    world.tables.places.find((p) => p.id === 'place-shed')!.players_name = 'A tarred shed';
    expect(await areaOf(to.cellar)).toBeNull();
    // The group has stood in the shed, shown nothing of it: the cellar has its number, and the shed's name stays unsent.
    beenAt('place-shed');
    expect(await farOf(to.cellar)).toEqual({ place: null, name: null, number: '4a', elsewhere: false });
    expect(await areaOf(to.cellar)).toBeNull();
    expect(JSON.stringify(await sent())).not.toContain('A tarred shed');
    // Shown a piece of the shed, the group has explored it: now its players' name stands over the cellar's row.
    const visit = world.tables.group_places.find((v) => v.place_id === 'place-shed')!;
    show(String(visit.id), 1, 'place-shed');
    expect(await areaOf(to.cellar)).toBe('A tarred shed');
    world.tables.piece_shows.find((sh) => sh.group_place_id === visit.id)!.shown = false;
    expect(await areaOf(to.cellar)).toBeNull();
    // The strand is an Area: named on a visit. With its `type` filed among the GM-only fields, it is not.
    beenAt('place-dunes');
    expect(await areaOf(to.landing)).toBe(STRAND_FOR_PLAYERS);
    hide('gh-strand', 'type');
    expect(await farOf(to.landing)).toEqual({ place: null, name: null, number: '0', elsewhere: false });
    expect(await areaOf(to.landing)).toBeNull();
    expect(JSON.stringify(await sent())).not.toContain(STRAND_FOR_PLAYERS);
  });

  // Purpose: the review of #122, finding 2: a pack that files a place's `parentId` among its GM-only fields hides
  // where that place sits, so the read cannot say its Area is known: the way leads elsewhere, with no number and no
  // Area's name, even when the places the group has stood at hide theirs the same way. A visited place that hides
  // where it sits does not count as standing in no Area either. An explored place stays explored (its place and
  // name, as before sf-9), without its number.
  it('a place whose `parentId` the pack files among its GM-only fields leads elsewhere, with no number', async () => {
    const { world, player, to, beenAt, show, sent, farOf, areaOf, hide } = twoAreas();
    const ELSEWHERE = { place: null, name: null, number: null, elsewhere: true };
    world.signInAs(player);
    beenAt('place-dunes');
    expect(await farOf(to.landing)).toEqual({ place: null, name: null, number: '0', elsewhere: false });
    // The strand's two places hide where they sit; the group has stood at one of them.
    hide('gh-dunes', 'parentId');
    hide('gh-landing', 'parentId');
    expect(await farOf(to.landing)).toEqual(ELSEWHERE);
    expect(await farOf(to.dunes)).toEqual(ELSEWHERE);
    expect(await areaOf(to.landing)).toBeNull();
    expect(JSON.stringify(await sent())).not.toMatch(/"to_number":"(0|7)"/);
    expect(JSON.stringify(await sent())).not.toContain(STRAND_FOR_PLAYERS);
    // The moor sits in no Area. The dunes only look as if they did not: standing there earns nothing for the moor.
    expect(await farOf(to.moor)).toEqual(ELSEWHERE);
    // The harbour's places, which hide nothing, are as before.
    expect(await farOf(to.shed)).toEqual({ place: null, name: null, number: '4', elsewhere: false });
    // An explored place that hides where it sits: its place and players' name as before, and no number.
    beenAt('place-mole');
    show(String(world.tables.group_places.find((v) => v.place_id === 'place-mole')!.id), 1, 'place-mole');
    expect(await farOf(to.mole)).toEqual({ place: 'place-mole', name: 'A stone mole', number: '3', elsewhere: false });
    hide('gh-mole', 'parentId');
    expect(await farOf(to.mole)).toEqual({ place: 'place-mole', name: 'A stone mole', number: null, elsewhere: false });
    expect(await areaOf(to.mole)).toBeNull();
    // A list of GM-only fields that names `parentId` on a place that has none hides nothing: the moor, once earned.
    hide('gh-moor', 'parentId');
    beenAt('place-moor');
    expect(await farOf(to.moor)).toEqual({ place: null, name: null, number: '12', elsewhere: false });
  });

  // Purpose: the review of #122, finding 5: a players' name of the campaign's place that is only blanks is no name: it
  // is not sent, and the pack's name for players stands in; a name with blanks around it is sent trimmed.
  it('a blank players’ name on the campaign’s place is no name: the pack’s stands in', async () => {
    const { world, player, to, beenAt, areaOf, placeRow } = twoAreas();
    world.signInAs(player);
    beenAt('place-dunes');
    placeRow('place-strand', 'gh-strand', STRAND, ' \t ');
    expect(await areaOf(to.landing)).toBe(STRAND_FOR_PLAYERS);
    world.tables.places.find((p) => p.id === 'place-strand')!.players_name = '  The white strand ';
    expect(await areaOf(to.landing)).toBe('The white strand');
  });

  // Purpose: hidden means hidden: no answer, the player's, the other player's or the GM's, carries a pack id, the
  // name of a place not explored, or an Area's own name, before or after the group gets to know the second Area;
  // someone outside the campaign gets nothing.
  it('no answer carries a pack id, an unexplored place’s name or an Area’s own name; a stranger gets nothing', async () => {
    const { world, gm, player, other, stranger, campaign, beenAt, sent } = twoAreas();
    const check = async () => {
      for (const person of [player, other, gm]) {
        world.signInAs(person);
        const raw = JSON.stringify(await sent()) + JSON.stringify(await loadWaysOn(asDb(world), campaign));
        for (const word of HARBOUR_NEVER) expect(raw, word).not.toContain(word);
      }
    };
    await check();
    beenAt('place-dunes');
    await check();
    world.signInAs(gm);
    expect((await sent()).length).toBe(8);
    world.signInAs(stranger);
    expect(await sent()).toEqual([]);
    expect(await loadWaysOn(asDb(world), campaign)).toEqual([]);
  });

  // Purpose: a number that is not text (the GM's Move on shows none either) is not sent; and the app's reader keeps
  // no number and no Area's name that arrives under "elsewhere", and reads an answer from before sf-9 as no number,
  // not elsewhere, no Area's name.
  it('a number that is not text is not sent; the reader drops a number and an Area’s name under elsewhere', async () => {
    const { world, player, campaign, to, farOf } = twoAreas();
    world.signInAs(player);
    const shed = world.tables.library_entries.find((e) => e.pack_entry_id === 'gh-shed')!;
    shed.data = { ...(shed.data as Record<string, unknown>), key: 4 };
    expect(await farOf(to.shed)).toEqual({ place: null, name: null, number: null, elsewhere: false });
    const answer = (rows: unknown[]) => loadWaysOn({ rpc: async () => ({ data: rows, error: null }) } as unknown as Db, campaign);
    expect(await answer([{ group_number: 1, route_id: 'r1', to_place_id: null, to_name: null, ways: [], to_number: '9', elsewhere: true, to_area_name: 'The pale shore' }])).toEqual([{ groupNumber: 1, routeId: 'r1', to: null, number: null, elsewhere: true, areaName: null, ways: [] }]);
    expect(await answer([{ group_number: 1, route_id: 'r1', to_place_id: null, to_name: null, ways: [] }])).toEqual([{ groupNumber: 1, routeId: 'r1', to: null, number: null, elsewhere: false, areaName: null, ways: [] }]);
    // An Area's name that is not text, or blank, reads as none; one that is text is kept, trimmed.
    expect(await answer([{ group_number: 1, route_id: 'r1', to_place_id: null, to_name: null, ways: [], to_number: '9', elsewhere: false, to_area_name: 7 }])).toEqual([{ groupNumber: 1, routeId: 'r1', to: null, number: '9', elsewhere: false, areaName: null, ways: [] }]);
    expect(await answer([{ group_number: 1, route_id: 'r1', to_place_id: null, to_name: null, ways: [], to_number: '9', elsewhere: false, to_area_name: ' The pale shore ' }])).toEqual([{ groupNumber: 1, routeId: 'r1', to: null, number: '9', elsewhere: false, areaName: 'The pale shore', ways: [] }]);
  });
});
