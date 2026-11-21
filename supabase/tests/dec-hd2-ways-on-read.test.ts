// A reveal belongs to its campaign (hd-2), and players read the ways on (mc-28; December step 4, piece e).
// Migration 20261111190000_dec_hd2_ways_on_read.sql; plan docs/plans/dec-hd2-ways-on-read.md. CI's local database
// (or the TEST project); invented content. Each test's purpose is its first comment line.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { placeFromPack, type PackPlaceEntry } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { attachPack, loadCampaignEntries, loadCampaignPacks, preferEntry } from '../../src/modules/library/campaignPacks.ts';
import { saveHomebrewEntry } from '../../src/modules/library/homebrew.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadWaysOn } from '../../src/modules/library/waysOn.ts';
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
const pack = (file: Record<string, unknown>) => {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, ...file }));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

// The goods both campaigns use. Only the rope is for sale as written; the rest each open one way, in campaign A only.
const goodsPack = () =>
  pack({
    meta: { name: 'Fen Goods', version: '1' },
    items: [
      { id: 'reed-rope', name: 'Reed rope', category: 'gear', weightCoin: 10 },
      { id: 'glow-wand', name: 'Glow wand', category: 'magic-wand', weightCoin: 1 },
      { id: 'bog-charm', name: 'Bog charm', category: 'gear', weightCoin: 1, forSale: false },
      { id: 'heron-cloak', name: 'Heron cloak', category: 'magic-cloak', weightCoin: 20 },
      { id: 'ember-ring', name: 'Ember ring', category: 'magic-ring', weightCoin: 1 },
    ],
    patches: [{ match: { kind: 'item', ids: ['glow-wand'] }, change: { weightCoin: { set: 2 } } }],
  });
// Attached to campaign A only: a kit that lists the cloak.
const kitsPack = () =>
  pack({
    meta: { name: 'Fen Kits', version: '1' },
    startingKits: [{ id: 'kit-warden', name: 'Lantern Warden kit', items: [{ itemId: 'heron-cloak', qty: 1 }] }],
  });

const SECRET_NOTE = 'The eel-way floods at the turn of the tide';
const GM_NAME = 'The reed islet';
const PLAYERS_NAME = 'An islet among the reeds';
// An adventure of four linked places. From the jetty: an open two-way link to the islet, a hidden link to the sluice,
// an open one-way drop to the vault, and a one-way climb that only leads back FROM the vault.
const adventurePack = () =>
  pack({
    meta: { name: 'Mire Tower', version: '0.1', kind: 'adventure' },
    locations: [
      { id: 'mt-jetty', name: 'The jetty', type: 'area', playerView: { text: 'Black water laps the posts.' } },
      { id: 'mt-islet', name: GM_NAME, type: 'area', playerView: { name: PLAYERS_NAME, text: 'Reeds taller than a mast.' } },
      { id: 'mt-sluice', name: 'The sluice', type: 'room' },
      { id: 'mt-vault', name: 'The drowned vault', type: 'room' },
    ],
    routes: [
      {
        id: 'mt-route-jetty-islet', from: 'mt-jetty', to: 'mt-islet', type: 'river', hidden: false, oneWay: false,
        travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }],
      },
      { id: 'mt-route-jetty-sluice', from: 'mt-jetty', to: 'mt-sluice', type: 'secret', hidden: true, oneWay: false, travel: { value: 2, unit: 'turn' }, notes: SECRET_NOTE },
      { id: 'mt-route-jetty-vault', from: 'mt-jetty', to: 'mt-vault', type: 'stairs', hidden: false, oneWay: true, travel: { value: 1, unit: 'turn' } },
      { id: 'mt-route-vault-jetty', from: 'mt-vault', to: 'mt-jetty', type: 'other', hidden: false, oneWay: true, travel: { value: 4, unit: 'turn' } },
    ],
  });
const BARRIER_NOTE = 'Needs a rope across the weir';
/** Words no player is ever sent about the ways on: the pack's ids, types, notes, a barrier's note or approval, GM names. */
const NEVER_SENT = ['mt-', 'secret', 'stairs', 'river', SECRET_NOTE, GM_NAME, 'The sluice', 'The drowned vault', 'travel', 'hidden', BARRIER_NOTE, 'needsApproval', 'note', 'Flying', 'fortnight', 'Rowing again'];

let goods = '';
let kits = '';
let adventure = '';
let campaignA = '';
let campaignB = '';

type LibraryRow = { id: string; pack_id: string; kind: string; pack_entry_id: string; name: string; data: Record<string, unknown> };
const libraryOf = async (person: Person, campaign: string, packs?: string[]) =>
  must(await person.db.rpc('campaign_library', packs ? { campaign, packs } : { campaign })) as LibraryRow[];
const itemsIn = (rows: LibraryRow[], packId: string) => rows.filter((r) => r.kind === 'item' && r.pack_id === packId).map((r) => r.pack_entry_id).sort();
const directItems = async (person: Person, packId: string) =>
  must(await person.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'item'))
    .map((row) => row.pack_entry_id as string)
    .sort();
const directKinds = async (person: Person, packId: string) =>
  [...new Set(must(await person.db.from('library_entries').select('kind').eq('pack_id', packId)).map((row) => row.kind as string))].sort();
const ways = async (person: Person, campaign = campaignA) =>
  must(await person.db.rpc('campaign_ways_on', { campaign })) as { group_number: number; route_id: string; to_place_id: string | null; to_name: string | null; ways: unknown }[];
const rowIdOf = async (packId: string, kind: string, entryId: string) =>
  must(await world.admin.from('library_entries').select('id').eq('pack_id', packId).eq('kind', kind).eq('pack_entry_id', entryId).single()).id as string;
const locationOf = async (entryId: string): Promise<PackPlaceEntry> => {
  const found = ((await loadCampaignEntries(asDb(world.gm), campaignA)) ?? []).find((e) => e.kind === 'location' && e.packId === adventure && e.packEntryId === entryId);
  if (!found) throw new Error(`no location ${entryId}`);
  return found;
};
const place = (entryId: string) => locationOf(entryId).then((entry) => ok(as(world.gm, placeFromPack, { campaignId: campaignA, entry })));
const logOf = async (person: Person) => JSON.stringify(must(await person.db.from('events').select('type, before, after, reason').eq('campaign_id', campaignA)));

beforeAll(async () => {
  world = await buildWorld();
  campaignA = world.campaignId;
  campaignB = world.otherCampaignId;
  // Player A plays in both campaigns; the outsider plays only in B; player B only in A.
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignB, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignB, user_id: world.outsider.id, base_role: 'player' },
      ])
      .select('user_id'),
  );
  goods = await ok(as(world.gm, importPack, { pack: goodsPack() }));
  kits = await ok(as(world.gm, importPack, { pack: kitsPack() }));
  adventure = await ok(as(world.gm, importPack, { pack: adventurePack() }));
  await ok(as(world.gm, attachPack, { campaignId: campaignA, packId: goods }));
  await ok(as(world.gm, attachPack, { campaignId: campaignB, packId: goods }));
  await ok(as(world.gm, attachPack, { campaignId: campaignA, packId: kits }));
  await ok(as(world.gm, attachPack, { campaignId: campaignA, packId: adventure }));
  // Campaign A opens three items, each its own way: a reveal, a sale (its homebrew copy), a kit (the Fen Kits pack).
  must(await world.admin.from('known_items').insert({ campaign_id: campaignA, item_id: 'glow-wand' }).select('item_id'));
  await ok(
    as(world.gm, saveHomebrewEntry, {
      campaignId: campaignA,
      campaignName: 'The Reedmouth Delve',
      kind: 'item',
      data: { id: 'bog-charm', name: 'Bog charm', category: 'gear', weightCoin: 1, forSale: true },
    }),
  );
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('a reveal, a sale or a kit belongs to its campaign (hd-2)', () => {
  it('a player in two campaigns on one pack gets what campaign A opened in A, and none of it in B', async () => {
    // Purpose: the campaign's own answer follows that campaign alone.
    const inA = await libraryOf(world.playerA, campaignA);
    expect(itemsIn(inA, goods)).toEqual(['bog-charm', 'glow-wand', 'heron-cloak', 'reed-rope']);
    const inB = await libraryOf(world.playerA, campaignB);
    expect(itemsIn(inB, goods)).toEqual(['reed-rope']);
    expect(JSON.stringify(inB)).not.toMatch(/Glow wand|Bog charm|Heron cloak|Ember ring/);
    // The app's loader goes the same way.
    const loaded = (await loadCampaignEntries(asDb(world.playerA), campaignB)) ?? [];
    expect(loaded.filter((e) => e.kind === 'item').map((e) => e.packEntryId)).toEqual(['reed-rope']);
  });

  it("a direct read of the table gives that player only what both campaigns opened", async () => {
    // Purpose: the row has no campaign, so campaign A's reveal, sale or kit alone must not open it to someone also in B.
    expect(await directItems(world.playerA, goods)).toEqual(['reed-rope']);
  });

  it("a player of campaign B only never reads what A opened, by the function or directly; and gets nothing of A's", async () => {
    // Purpose: another campaign's player on the same pack reads nothing new.
    expect(itemsIn(await libraryOf(world.outsider, campaignB), goods)).toEqual(['reed-rope']);
    expect(await directItems(world.outsider, goods)).toEqual(['reed-rope']);
    expect(await libraryOf(world.outsider, campaignA)).toEqual([]);
    expect(await ways(world.outsider, campaignA)).toEqual([]);
  });

  it('a patch naming a revealed item follows the same campaign', async () => {
    // Purpose: a patch's name carries the item's id, so it opens only where the item has.
    const patchIn = (rows: LibraryRow[]) => rows.filter((r) => r.kind === 'patch' && r.pack_id === goods).length;
    expect(patchIn(await libraryOf(world.playerA, campaignA))).toBe(1);
    expect(patchIn(await libraryOf(world.playerA, campaignB))).toBe(0);
    expect(patchIn(await libraryOf(world.outsider, campaignB))).toBe(0);
    expect(await directKinds(world.playerA, goods)).toEqual(['item']);
    expect(await directKinds(world.outsider, goods)).toEqual(['item']);
  });

  it('a player in campaign A only reads there what they read before, by the function and directly', async () => {
    // Purpose: nothing is taken from a player in their own campaign.
    expect(itemsIn(await libraryOf(world.playerB, campaignA), goods)).toEqual(['bog-charm', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(await directItems(world.playerB, goods)).toEqual(['bog-charm', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(await directKinds(world.playerB, goods)).toEqual(['item', 'patch']);
    expect(await libraryOf(world.playerB, campaignB)).toEqual([]);
  });

  it('the GM reads every entry of the campaign\'s packs through the function, hidden fields aside as before', async () => {
    // Purpose: the GM's reads are unchanged.
    const all = must(await world.admin.from('library_entries').select('id, pack_id').in('pack_id', (await loadCampaignPacks(asDb(world.gm), campaignA))!.map((p) => p.packId)));
    const gms = await libraryOf(world.gm, campaignA);
    expect(gms.map((r) => r.id).sort()).toEqual(all.map((r) => r.id as string).sort());
    expect(itemsIn(gms, goods)).toEqual(['bog-charm', 'ember-ring', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(gms.some((r) => r.kind === 'route')).toBe(true);
    // Only the packs asked for, when some are named.
    const some = await libraryOf(world.gm, campaignA, [kits]);
    expect([...new Set(some.map((r) => r.pack_id))]).toEqual([kits]);
    // A pack that isn't attached to the campaign gives nothing, even to the GM who owns it.
    expect(await libraryOf(world.gm, campaignB, [kits])).toEqual([]);
  });

  it("a player's exceptions for an item follow this campaign only", async () => {
    // Purpose: an exception's key carries the item's id.
    const linkIn = async (campaign: string) => (await loadCampaignPacks(asDb(world.gm), campaign))!.find((p) => p.packId === goods)!.id;
    await ok(as(world.gm, preferEntry, { campaignId: campaignA, key: 'item:glow-wand', name: 'Glow wand', campaignPackId: await linkIn(campaignA) }));
    await ok(as(world.gm, preferEntry, { campaignId: campaignB, key: 'item:glow-wand', name: 'Glow wand', campaignPackId: await linkIn(campaignB) }));
    const seen = async (person: Person, campaign: string) =>
      Object.assign({}, ...(must(await person.db.rpc('campaign_exceptions', { campaign })) as { overrides: Record<string, string> }[]).map((row) => row.overrides)) as Record<string, string>;
    expect(await seen(world.playerA, campaignA)).toEqual({ 'item:glow-wand': 'Glow wand' });
    expect(await seen(world.playerA, campaignB)).toEqual({});
    expect(await seen(world.gm, campaignB)).toEqual({ 'item:glow-wand': 'Glow wand' });
  });

  it('being the GM of one campaign opens nothing in another', async () => {
    // Purpose: the GM's answer is for the campaign asked about, not for whoever is a GM somewhere.
    const own = must(await world.admin.from('campaigns').insert({ name: 'The Sedge Court', created_by: world.playerB.id }).select().single()).id as string;
    must(await world.admin.from('members').insert({ campaign_id: own, user_id: world.playerB.id, base_role: 'gm' }).select('user_id'));
    // Campaign B, where they aren't a member: nothing.
    expect(await libraryOf(world.playerB, campaignB)).toEqual([]);
    expect(await ways(world.playerB, campaignB)).toEqual([]);
    // Campaign A, where they play: a player's answer, no more.
    const inA = await libraryOf(world.playerB, campaignA);
    expect(itemsIn(inA, goods)).toEqual(['bog-charm', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(inA.some((r) => ['route', 'location'].includes(r.kind))).toBe(false);
    // Their own campaign attaches no pack.
    expect(await libraryOf(world.playerB, own)).toEqual([]);
  });

  it("a patron's holy garb opens its item in the campaign whose packs have that patron, and in no other", async () => {
    // Purpose: the fourth reason an item opens (#636) is per campaign too. The patron is in a pack only A attaches.
    must(
      await world.admin
        .from('library_entries')
        .insert({ pack_id: kits, kind: 'patron', pack_entry_id: 'the-reed-mother', name: 'The Reed Mother', data: { id: 'the-reed-mother', name: 'The Reed Mother', holyGarb: [{ itemIds: ['ember-ring'] }] } })
        .select('id'),
    );
    expect(itemsIn(await libraryOf(world.playerA, campaignA), goods)).toEqual(['bog-charm', 'ember-ring', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(itemsIn(await libraryOf(world.playerA, campaignB), goods)).toEqual(['reed-rope']);
    expect(itemsIn(await libraryOf(world.outsider, campaignB), goods)).toEqual(['reed-rope']);
    expect(await directItems(world.playerB, goods)).toEqual(['bog-charm', 'ember-ring', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(await directItems(world.playerA, goods)).toEqual(['reed-rope']);
    expect(await directItems(world.outsider, goods)).toEqual(['reed-rope']);
  });

  it('the answer comes a page at a time by the last id received', async () => {
    // Purpose: paging by key loses and repeats nothing.
    const all = await libraryOf(world.gm, campaignA);
    const page = async (after?: string) =>
      must(await world.gm.db.rpc('campaign_library', after ? { campaign: campaignA, page_size: 3, after_id: after } : { campaign: campaignA, page_size: 3 })) as LibraryRow[];
    const got: string[] = [];
    for (let rows = await page(); ; rows = await page(got[got.length - 1])) {
      got.push(...rows.map((r) => r.id));
      if (rows.length < 3) break;
    }
    expect(got).toEqual(all.map((r) => r.id));
  });
});

describe('players read the ways on (mc-28)', () => {
  let jettyId = '';
  let isletId = '';
  let tripId = '';
  const showFirstPiece = async () => {
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignA, tripId))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: campaignA, row: visit, piece: visit.pieces[0]! }));
  };
  const goTo = (placeId: string) => ok(as(world.gm, setPlace, { campaignId: campaignA, group: 1, name: '', placeId }));

  it('before the group is anywhere from a pack, there are no ways on', async () => {
    // Purpose: nothing is sent without a current place made from an attached pack.
    expect(await ways(world.playerA)).toEqual([]);
  });

  it('until something of the place the group is in has been shown to it, a player gets no way at all', async () => {
    // Purpose: mc-28b: not a nameless way, not a count of them; the GM's own answer lists none for the group either.
    jettyId = (await place('mt-jetty')).id;
    isletId = (await place('mt-islet')).id;
    tripId = (await ok(as(world.gm, startExpedition, { campaignId: campaignA, mode: 'dungeon', placeId: jettyId }))).id;
    // The open route's travel, as a messy pack might write it: untrimmed words, a barrier's note and approval on one
    // way, a bad value, a bad unit, and a way named twice. (Written on the row: the importer isn't what is tested.)
    must(
      await world.gm.db
        .from('library_entries')
        .update({
          data: {
            from: ' mt-jetty', to: 'mt-islet ', type: 'river', hidden: false, oneWay: false,
            travel: [
              { by: 'row', name: 'Rowing', value: 1, unit: 'turn' },
              { by: ' swim ', name: ' Swimming ', value: 3, unit: ' turn ', note: BARRIER_NOTE, needsApproval: true },
              { by: 'wade', value: 2, unit: 'hour' },
              { by: 'fly', name: 'Flying', value: 1.5, unit: 'turn' },
              { by: 'crawl', name: 'Flying', value: 1, unit: 'fortnight' },
              { by: 'row', name: 'Rowing again', value: 9, unit: 'turn' },
            ],
          },
        })
        .eq('id', await rowIdOf(adventure, 'route', 'mt-route-jetty-islet'))
        .select('id'),
    );
    expect(await ways(world.playerA)).toEqual([]);
    expect(await ways(world.playerB)).toEqual([]);
    expect(await ways(world.gm)).toEqual([]);
    expect(await loadWaysOn(asDb(world.playerA), campaignA)).toEqual([]);
  });

  it("once a piece of the place is shown, a player gets its open routes: no hidden route, no name for a place not yet shown, and how each is travelled", async () => {
    // Purpose: hidden means hidden for routes; the far end reads "not yet explored"; mc-28a's four fields and no more.
    await showFirstPiece();
    const rows = await ways(world.playerA);
    const toIslet = await rowIdOf(adventure, 'route', 'mt-route-jetty-islet');
    const toVault = await rowIdOf(adventure, 'route', 'mt-route-jetty-vault');
    // The hidden route to the sluice is absent; so is the one-way climb that only leads here.
    expect(rows.map((r) => r.route_id).sort()).toEqual([toIslet, toVault].sort());
    expect(rows.every((r) => r.group_number === 1 && r.to_place_id === null && r.to_name === null)).toBe(true);
    expect(Object.keys(rows[0]!).sort()).toEqual(['group_number', 'route_id', 'to_name', 'to_place_id', 'ways']);
    // By, name, value and unit alone, trimmed, in the pack's order; a name left out reads as its id; the bad value,
    // the bad unit and the second "row" are left out.
    expect(rows.find((r) => r.route_id === toIslet)!.ways).toEqual([
      { by: 'row', name: 'Rowing', value: 1, unit: 'turn' },
      { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' },
      { by: 'wade', name: 'wade', value: 2, unit: 'hour' },
    ]);
    // One amount is one way with no id or name.
    expect(rows.find((r) => r.route_id === toVault)!.ways).toEqual([{ by: '', name: '', value: 1, unit: 'turn' }]);
    const raw = JSON.stringify(rows);
    for (const word of [...NEVER_SENT, PLAYERS_NAME, isletId]) expect(raw, word).not.toContain(word);
    // The app's reader says the same in its own shape.
    const loaded = (await loadWaysOn(asDb(world.playerA), campaignA)) ?? [];
    expect(loaded.map((w) => w.to)).toEqual([null, null]);
    expect(loaded.find((w) => w.routeId === toIslet)?.ways.map((w) => `${w.name}, ${w.value} ${w.unit}`)).toEqual(['Rowing, 1 turn', 'Swimming, 3 turn', 'wade, 2 hour']);
  });

  it('neither a direct read, the campaign library nor the log gives a player any route or an unshown place', async () => {
    // Purpose: the function is the only way a route reaches a player.
    expect(await directKinds(world.playerA, adventure)).toEqual([]);
    expect((await libraryOf(world.playerA, campaignA)).filter((r) => r.pack_id === adventure)).toEqual([]);
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id').eq('pack_id', adventure))).toEqual([]);
    const log = await logOf(world.playerA);
    for (const word of ['mt-route', SECRET_NOTE, BARRIER_NOTE, GM_NAME, PLAYERS_NAME, 'The sluice', 'The drowned vault']) expect(log, word).not.toContain(word);
  });

  it('arriving somewhere new with nothing shown, the group has no way, not even back to the place it knows', async () => {
    // Purpose: a way back named "the jetty" would say where the group has come to before the GM does (mc-28b).
    await goTo(isletId);
    expect(await ways(world.playerA)).toEqual([]);
    // (Whether the log names a place on entering it is the other hidden-data fix's, fm-2; not checked here.)
  });

  it("once a piece of it is shown, the two-way route leads back, named as the players know the place, and the hidden one is still never sent", async () => {
    // Purpose: a two-way link is listed from both ends; the far end is named exactly when What we know names it.
    await showFirstPiece();
    const rows = await ways(world.playerA);
    expect(rows.map((r) => r.route_id)).toEqual([await rowIdOf(adventure, 'route', 'mt-route-jetty-islet')]);
    // The jetty has no players' name of its own, so it reads by its name, as What we know gives it.
    expect(rows[0]).toMatchObject({ to_place_id: jettyId, to_name: 'The jetty' });
    expect((rows[0]!.ways as { name: string }[]).map((w) => w.name)).toEqual(['Rowing', 'Swimming', 'wade']);
    for (const word of NEVER_SENT) expect(JSON.stringify(rows), word).not.toContain(word);
  });

  it('coming back to a place it knows, a group has its ways at once, before anything is shown on the new visit', async () => {
    // Purpose: what has been revealed stays known (mc-28c): the gate asks whether something of this place was ever
    // shown to this group, not only on this visit. Where now? would bring the last visit's shows back (place.backAt), so
    // the group arrives as a travel arrival does (group_goes_to_id): a new visit with nothing shown on it.
    must(await world.gm.db.rpc('set_group_place_at', { campaign: campaignA, group_no: 1, place: jettyId }));
    const back = (await loadGroupPlaces(asDb(world.gm), campaignA, tripId))!.get(1)!;
    expect(back.pieces.every((p) => !p.shown)).toBe(true);
    const rows = await ways(world.playerA);
    expect(rows).toHaveLength(2);
    // The islet's way carries the players' name, never the GM's; the vault's is still unexplored.
    expect(rows.find((r) => r.to_place_id !== null)).toMatchObject({ to_place_id: isletId, to_name: PLAYERS_NAME });
    expect(rows.filter((r) => r.to_place_id === null)).toHaveLength(1);
    expect(rows.every((r) => Array.isArray(r.ways) && (r.ways as unknown[]).length > 0)).toBe(true);
    for (const word of NEVER_SENT) expect(JSON.stringify(rows), word).not.toContain(word);
    // The same name What we know gives, and no other.
    const known = must(await world.playerA.db.rpc('known_places_campaign', { campaign: campaignA })) as { place_id: string; place_name: string }[];
    expect(known.some((k) => k.place_id === isletId && k.place_name === PLAYERS_NAME)).toBe(true);
    expect((await loadWaysOn(asDb(world.playerA), campaignA))?.find((w) => w.to)?.to).toEqual({ placeId: isletId, name: PLAYERS_NAME });
  });

  it("a player whose group was shown nothing gets no way, and no name", async () => {
    // Purpose: "shown" is per group. Player B's character leaves for a group of its own, which has been shown nothing.
    await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId: campaignA, ownerUserId: world.playerB.id }, group: null }));
    expect(await ways(world.playerB)).toEqual([]);
  });

  it('the GM gets the same narrow rows for every group, and still reads the routes themselves whole', async () => {
    // Purpose: the function is narrow for everyone; the GM's own reads of the routes are as before.
    const rows = await ways(world.gm);
    expect(rows.filter((r) => r.group_number === 1)).toHaveLength(2);
    const raw = JSON.stringify(rows);
    for (const word of NEVER_SENT) expect(raw, word).not.toContain(word);
    const entries = (await loadCampaignEntries(asDb(world.gm), campaignA)) ?? [];
    expect(entries.filter((e) => e.kind === 'route')).toHaveLength(4);
    // The GM still reads a way's barrier note on the route itself.
    expect(JSON.stringify(entries.find((e) => e.packEntryId === 'mt-route-jetty-islet')?.data)).toContain(BARRIER_NOTE);
    expect(entries.find((e) => e.packEntryId === 'mt-route-jetty-sluice')?.data).toMatchObject({ hidden: true, notes: SECRET_NOTE });
  });

  it('a pack that files `hidden` among its GM-only fields has the route kept back all the same', async () => {
    // Purpose: the hidden mark is read on the whole entry; when in doubt the route is not sent.
    const vaultRoute = await rowIdOf(adventure, 'route', 'mt-route-jetty-vault');
    must(await world.gm.db.from('library_entries').update({ data: { from: 'mt-jetty', to: 'mt-vault', type: 'stairs', hidden: true, oneWay: true, gmOnly: ['hidden'] } }).eq('id', vaultRoute).select('id'));
    expect((await ways(world.playerA)).map((r) => r.route_id)).not.toContain(vaultRoute);
    must(await world.gm.db.from('library_entries').update({ data: { from: 'mt-jetty', to: 'mt-vault', type: 'stairs', hidden: 'no', oneWay: true } }).eq('id', vaultRoute).select('id'));
    expect((await ways(world.playerA)).map((r) => r.route_id)).not.toContain(vaultRoute);
  });
});
