// The fake database answers by campaign as the real one does (hd-2 and mc-28;
// supabase/migrations/20261111190000_dec_hd2_ways_on_read.sql; hard rule 5), and the app's loaders read through it.
// Invented content only. The fake doesn't model which items a campaign has opened (a member reads every item of the
// campaign's packs), so "a reveal stays in its campaign" is proved on the database (supabase/tests/
// dec-hd2-ways-on-read.test.ts); here: the campaign's packs, its members, a patch's items, and the ways on.
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
    expect(Object.keys(rows[0]!).sort()).toEqual(['group_number', 'route_id', 'to_name', 'to_place_id', 'ways']);
    // How each way is travelled and how long it takes (mc-28a): the four fields, trimmed, in the pack's order; a bad
    // value or unit and a way named twice left out; a barrier's note and approval never sent.
    const rowing = [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'swim', value: 3, unit: 'turn' }];
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: open, to: null, ways: rowing });
    // A route that gives one amount has one way with no id or name.
    expect(await loadWaysOn(asDb(world), campaign)).toContainEqual({ groupNumber: 1, routeId: drop, to: null, ways: [{ by: '', name: '', value: 1, unit: 'turn' }] });
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
