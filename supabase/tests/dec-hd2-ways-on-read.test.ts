// A reveal belongs to its campaign (hd-2), and players read the ways on (mc-28; December step 4, piece e).
// Migration 20261111190000_dec_hd2_ways_on_read.sql; plan docs/plans/dec-hd2-ways-on-read.md. CI's local database
// (or the TEST project); invented content. Each test's purpose is its first comment line.
// Since sf-9 (Scene feedback ⚑ 6 and sf-19; migration 20261126230000_sf_9_ways_on_number_elsewhere.sql; plan
// docs/plans/dec-scene-feedback.md, batch C1): a way's map number and "Elsewhere", in the last group of tests.
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
  must(await person.db.rpc('campaign_ways_on', { campaign })) as { group_number: number; route_id: string; to_place_id: string | null; to_name: string | null; to_number: string | null; elsewhere: boolean; ways: unknown }[];
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
    expect(Object.keys(rows[0]!).sort()).toEqual(['elsewhere', 'group_number', 'route_id', 'to_name', 'to_number', 'to_place_id', 'ways']);
    // sf-9: this pack's places sit in no Area and have no map number: no number, and nothing leads elsewhere.
    expect(rows.every((r) => r.to_number === null && r.elsewhere === false)).toBe(true);
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

const HARBOUR_AREA = 'The Gull Harbour';
const STRAND_AREA = 'The Kelp Strand';
const MOLE_GM_NAME = 'The mole';
const MOLE_PLAYERS_NAME = 'A stone mole';
// An adventure of two Areas (frame WT1 of page 44). From 5, the sea cave, in the harbour: ways to three more places
// of the harbour (3, 4 and one with no map number), a hidden way to a fourth (10), and ways to two places of the
// strand (0, and 7 by a two-way link written from its far end).
const harbourPack = () =>
  pack({
    meta: { name: 'Gull Harbour', version: '0.1', kind: 'adventure' },
    locations: [
      { id: 'gh-harbour', name: HARBOUR_AREA, type: 'area' },
      { id: 'gh-strand', name: STRAND_AREA, type: 'area' },
      { id: 'gh-cave', name: 'The sea cave', type: 'site', parentId: 'gh-harbour', key: '5', playerView: { text: 'Green water breathes in the dark.' } },
      { id: 'gh-mole', name: MOLE_GM_NAME, type: 'site', parentId: 'gh-harbour', key: ' 3 ', playerView: { name: MOLE_PLAYERS_NAME, text: 'Weed-slick stones run out to sea.' } },
      { id: 'gh-shed', name: 'The tally shed', type: 'site', parentId: 'gh-harbour', key: '4' },
      { id: 'gh-flat', name: 'The mud flat', type: 'site', parentId: 'gh-harbour' },
      { id: 'gh-gate', name: 'The chain gate', type: 'site', parentId: 'gh-harbour', key: '10' },
      { id: 'gh-landing', name: 'The shingle landing', type: 'site', parentId: 'gh-strand', key: '0' },
      { id: 'gh-dunes', name: 'The marram dunes', type: 'site', parentId: 'gh-strand', key: '7', playerView: { text: 'Grass hisses on the ridge.' } },
    ],
    routes: [
      { id: 'gh-route-cave-mole', from: 'gh-cave', to: 'gh-mole', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] },
      { id: 'gh-route-cave-shed', from: 'gh-cave', to: 'gh-shed', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] },
      { id: 'gh-route-cave-flat', from: 'gh-cave', to: 'gh-flat', type: 'other', hidden: false, oneWay: false, travel: [{ by: 'walk', name: 'Walking', value: 2, unit: 'turn' }] },
      { id: 'gh-route-cave-gate', from: 'gh-cave', to: 'gh-gate', type: 'secret', hidden: true, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] },
      { id: 'gh-route-cave-landing', from: 'gh-cave', to: 'gh-landing', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] },
      { id: 'gh-route-dunes-cave', from: 'gh-dunes', to: 'gh-cave', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] },
    ],
  });
/**
 * Words no way on may carry about the harbour: the pack's ids, either Area's name, a route's type, and the names of
 * the places nobody explores in these tests. (The cave's and the mole's names are checked where they may not be read.)
 */
const HARBOUR_NEVER_SENT = ['gh-', HARBOUR_AREA, STRAND_AREA, MOLE_GM_NAME, 'The tally shed', 'The mud flat', 'The chain gate', 'The shingle landing', 'The marram dunes', 'parentId', 'river', 'secret', 'hidden'];

describe('a way’s map number, and "Elsewhere" (sf-9, sf-19)', () => {
  let harbour = '';
  let tripId = '';
  let caveId = '';
  let moleId = '';
  let dunesId = '';
  // Player A's character is in `mine`; player B's in a group of its own, `theirs`.
  let mine = 0;
  let theirs = 0;
  const route: Record<'mole' | 'shed' | 'flat' | 'gate' | 'landing' | 'dunes', string> = { mole: '', shed: '', flat: '', gate: '', landing: '', dunes: '' };
  const groupOf = async (actorId: string) =>
    Number(must(await world.admin.from('party_group_members').select('group_number').eq('campaign_id', campaignA).eq('actor_id', actorId).single()).group_number);
  const harbourPlace = async (entryId: string) => {
    const entry = ((await loadCampaignEntries(asDb(world.gm), campaignA)) ?? []).find((e) => e.kind === 'location' && e.packId === harbour && e.packEntryId === entryId);
    if (!entry) throw new Error(`no location ${entryId}`);
    return (await ok(as(world.gm, placeFromPack, { campaignId: campaignA, entry }))).id;
  };
  const goTo = (group: number, placeId: string) => ok(as(world.gm, setPlace, { campaignId: campaignA, group, name: '', placeId }));
  const showFirstPiece = async (group: number) => {
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignA, tripId))!.get(group)!;
    await ok(as(world.gm, showPiece, { campaignId: campaignA, row: visit, piece: visit.pieces[0]! }));
  };
  /** What a reader's rows say of one route's far end, for one group; null when no row is sent for it. */
  const farOf = async (person: Person, routeId: string, group: number) => {
    const row = (await ways(person)).find((r) => r.route_id === routeId && r.group_number === group);
    return row ? { place: row.to_place_id, name: row.to_name, number: row.to_number, elsewhere: row.elsewhere } : null;
  };
  const unexplored = (number: string | null) => ({ place: null, name: null, number, elsewhere: false });
  const ELSEWHERE = { place: null, name: null, number: null, elsewhere: true };
  /** The raw answer and the app's reading of it, as text, to search for words that may not be there. */
  const sentTo = async (person: Person) => JSON.stringify(await ways(person)) + JSON.stringify(await loadWaysOn(asDb(person), campaignA));

  beforeAll(async () => {
    harbour = await ok(as(world.gm, importPack, { pack: harbourPack() }));
    await ok(as(world.gm, attachPack, { campaignId: campaignA, packId: harbour }));
    for (const key of Object.keys(route) as (keyof typeof route)[]) {
      route[key] = await rowIdOf(harbour, 'route', key === 'dunes' ? 'gh-route-dunes-cave' : `gh-route-cave-${key}`);
    }
    caveId = await harbourPlace('gh-cave');
    moleId = await harbourPlace('gh-mole');
    dunesId = await harbourPlace('gh-dunes');
    // Player A's group stands at the sea cave: moved there in the expedition the tests above left under way, or
    // starting there in one of its own when this group of tests runs alone.
    mine = await groupOf(world.wrenId);
    const running = must(await world.admin.from('expeditions').select('id').eq('campaign_id', campaignA).is('ended_at', null).eq('undone', false));
    if (running[0]) {
      tripId = running[0].id as string;
      await goTo(mine, caveId);
    } else {
      tripId = (await ok(as(world.gm, startExpedition, { campaignId: campaignA, mode: 'dungeon', placeId: caveId }))).id;
    }
    // Player B's character in a group of its own (the tests above may have moved it there already).
    if ((await groupOf(world.ashId)) === mine) {
      await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId: campaignA, ownerUserId: world.playerB.id }, group: null }));
    }
    theirs = await groupOf(world.ashId);
    expect(theirs).not.toBe(mine);
    // Player A's group is shown the cave; no map is shown to anyone in this world.
    await showFirstPiece(mine);
  }, 300_000);

  it('an unexplored place in an Area the group knows comes with its map number and no name, with no map shown', async () => {
    // Purpose: read rule (2): the number is sent for a place not yet explored when the group knows its Area (it
    // stands in it), whether or not the Area's map is shown; a place with no map number comes with none; rule (4):
    // the hidden way is still absent.
    const rows = (await ways(world.playerA)).filter((r) => r.group_number === mine);
    expect(rows.map((r) => r.route_id).sort()).toEqual([route.mole, route.shed, route.flat, route.landing, route.dunes].sort());
    expect(Object.keys(rows[0]!).sort()).toEqual(['elsewhere', 'group_number', 'route_id', 'to_name', 'to_number', 'to_place_id', 'ways']);
    expect(await farOf(world.playerA, route.shed, mine)).toEqual(unexplored('4'));
    // Trimmed; and the mole has a place in the campaign, but nothing of it was shown: no place, no name.
    expect(await farOf(world.playerA, route.mole, mine)).toEqual(unexplored('3'));
    expect(await farOf(world.playerA, route.flat, mine)).toEqual(unexplored(null));
    expect(await farOf(world.playerA, route.gate, mine)).toBeNull();
    // No map reaches this player: the number does not wait for one.
    expect(must(await world.playerA.db.rpc('map_for_players', { campaign: campaignA }))).toEqual([]);
    const raw = await sentTo(world.playerA);
    for (const word of [...HARBOUR_NEVER_SENT, MOLE_PLAYERS_NAME, moleId, dunesId]) expect(raw, word).not.toContain(word);
    // The app's reader says the same in its own shape.
    expect(await loadWaysOn(asDb(world.playerA), campaignA)).toContainEqual({ groupNumber: mine, routeId: route.shed, to: null, number: '4', elsewhere: false, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
  });

  it('an unexplored place in an Area the group has not been to comes with no number and no name, only that it leads elsewhere', async () => {
    // Purpose: read rule (3): before any visit, the ways into the second Area carry the elsewhere mark and nothing of
    // the place or its Area. The number is absent from the answer itself: the whole row is checked, field by field.
    expect(await farOf(world.playerA, route.landing, mine)).toEqual(ELSEWHERE);
    expect(await farOf(world.playerA, route.dunes, mine)).toEqual(ELSEWHERE);
    const rows = (await ways(world.playerA)).filter((r) => r.elsewhere);
    expect(rows.map((r) => r.route_id).sort()).toEqual([route.landing, route.dunes].sort());
    for (const row of rows) {
      expect(row).toEqual({ group_number: mine, route_id: row.route_id, to_place_id: null, to_name: null, to_number: null, elsewhere: true, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
    }
    // The strand's numbers (0 and 7) are nowhere in the answer.
    expect(JSON.stringify(await ways(world.playerA))).not.toMatch(/"to_number":"(0|7)"/);
    expect(await loadWaysOn(asDb(world.playerA), campaignA)).toContainEqual({ groupNumber: mine, routeId: route.landing, to: null, number: null, elsewhere: true, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
  });

  it('the GM gets the same narrow rows, and someone outside the campaign gets nothing', async () => {
    // Purpose: the function is narrow for everyone: the GM's own answer carries no name, pack id or Area's name
    // either; a player of another campaign, who is no member of this one, gets no row.
    const raw = await sentTo(world.gm);
    for (const word of [...HARBOUR_NEVER_SENT, MOLE_PLAYERS_NAME]) expect(raw, word).not.toContain(word);
    expect((await ways(world.gm)).filter((r) => r.group_number === mine && r.elsewhere).map((r) => r.route_id).sort()).toEqual([route.landing, route.dunes].sort());
    expect(await ways(world.outsider)).toEqual([]);
    expect(await loadWaysOn(asDb(world.outsider), campaignA)).toEqual([]);
  });

  it('once the group has been at a place of that Area, with nothing of it shown, its places come with their numbers; another group’s player gets none it has not earned', async () => {
    // Purpose: sf-19, "Once they have been there": a visit earns the Area for the group that made it, shown or not,
    // and for no other group. Player B's group stands at the cave too, shown it, and never goes to the strand.
    await goTo(theirs, caveId);
    await showFirstPiece(theirs);
    await goTo(mine, dunesId);
    // At the dunes, shown nothing: no way at all, as before (mc-28b).
    expect((await ways(world.playerA)).filter((r) => r.group_number === mine)).toEqual([]);
    await goTo(mine, caveId);
    // Player A: both places of the strand come with their numbers; the dunes were visited, not shown: still no name.
    expect(await farOf(world.playerA, route.landing, mine)).toEqual(unexplored('0'));
    expect(await farOf(world.playerA, route.dunes, mine)).toEqual(unexplored('7'));
    expect((await ways(world.playerA)).some((r) => r.elsewhere)).toBe(false);
    // Player B: the harbour's numbers, and the strand still elsewhere, with no number.
    const theirRows = await ways(world.playerB);
    expect(theirRows.length).toBeGreaterThan(0);
    expect(theirRows.every((r) => r.group_number === theirs)).toBe(true);
    expect(await farOf(world.playerB, route.shed, theirs)).toEqual(unexplored('4'));
    expect(await farOf(world.playerB, route.landing, theirs)).toEqual(ELSEWHERE);
    expect(await farOf(world.playerB, route.dunes, theirs)).toEqual(ELSEWHERE);
    expect(JSON.stringify(theirRows)).not.toMatch(/"to_number":"(0|7)"/);
    // Knowing the Area sends its places' numbers, never its name or theirs, to either player.
    for (const person of [world.playerA, world.playerB]) {
      const raw = await sentTo(person);
      for (const word of [...HARBOUR_NEVER_SENT, MOLE_PLAYERS_NAME]) expect(raw, word).not.toContain(word);
    }
  });

  it('an explored place comes with its number beside its players’ name, and only for the group it was shown to', async () => {
    // Purpose: read rule (1): explored, the far place has its place, its players' name and its number; the GM's name
    // for it is never sent; the other group, which was not shown it, has the number alone.
    await goTo(mine, moleId);
    await showFirstPiece(mine);
    // From the mole, the way back to the cave, which the group knows: its name and its number.
    expect(await farOf(world.playerA, route.mole, mine)).toEqual({ place: caveId, name: 'The sea cave', number: '5', elsewhere: false });
    await goTo(mine, caveId);
    expect(await farOf(world.playerA, route.mole, mine)).toEqual({ place: moleId, name: MOLE_PLAYERS_NAME, number: '3', elsewhere: false });
    expect(await sentTo(world.playerA)).not.toContain(MOLE_GM_NAME);
    expect(await farOf(world.playerB, route.mole, theirs)).toEqual(unexplored('3'));
    expect(await sentTo(world.playerB)).not.toContain(MOLE_PLAYERS_NAME);
  });

  it('a pack that files a place’s `key` among its GM-only fields sends no number for it', async () => {
    // Purpose: the number is read from the part of the entry players' reads may use; when in doubt it is not sent.
    const shed = await rowIdOf(harbour, 'location', 'gh-shed');
    must(await world.gm.db.from('library_entries').update({ data: { id: 'gh-shed', name: 'The tally shed', type: 'site', parentId: 'gh-harbour', key: '4', gmOnly: ['key'] } }).eq('id', shed).select('id'));
    expect(await farOf(world.playerA, route.shed, mine)).toEqual(unexplored(null));
    // A number that is not text is not a map number (the GM's Move on shows none for it either).
    must(await world.gm.db.from('library_entries').update({ data: { id: 'gh-shed', name: 'The tally shed', type: 'site', parentId: 'gh-harbour', key: 4 } }).eq('id', shed).select('id'));
    expect(await farOf(world.playerA, route.shed, mine)).toEqual(unexplored(null));
  });
});
