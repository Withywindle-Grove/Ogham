// @vitest-environment jsdom
// The players' Scene under its top: the page's structure (plan dec-9-the-players-scene, row P1, with what P11, P13 and
// P14 ask of it; page 18, PL1, PL2, PL5, PL9). Against the stand-in database, with invented places and characters.
// What it checks, in plain words:
//   * who gets the page: a player during an expedition, never the GM, never in a town or in a wilderness day;
//   * the order: what the party may do next comes before what there is to read, so one column reads in PL5's order;
//   * before anything of the place is shown: "Somewhere new" at the left; at the right the map's place and the
//     place's card, both empty; nothing of the place's name anywhere on the page;
//   * once the GM shows a piece: the place and its piece at the left, the empty frames gone, the marching order still
//     the last card at the right;
//   * loading: still bars in both columns;
//   * the parts that say "nothing yet" take nothing of a place, so nothing hidden can reach the screen through them.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { chooseGroup } from '../modules/expedition/groupPlay.ts';
import { addPiece, loadGroupPlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { createAppRegistry } from './commandRegistry.ts';
import { PartyGroups } from './PartyGroups.tsx';
import { NothingSharedYet, PlayersSceneLoading, PlayersScenePage, showsPlayersPage, SomewhereNew } from './PlayersScenePage.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
});
afterEach(() => cleanup());

const PLACE = 'The Moth Gallery';

/** A table of two: the GM and Sam, whose character Wren is on an expedition at a place nobody has been shown. */
async function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const users = { gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser };
  world.signInAs(gm);
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const registry = createAppRegistry();
  await runCommand(registry, world.db, users.gm, setPlace, { campaignId: campaign, group: 1, name: PLACE, placeId: null, packEntry: null });
  const rowNow = async () => (await loadGroupPlaces(world.db, campaign, started.data!.id))!.get(1)!;
  const placeId = (await rowNow()).place!.id;
  await runCommand(registry, world.db, users.gm, addPiece, { campaignId: campaign, placeId, kind: 'description', text: 'Dusty frames and a draught.' });
  /** The GM taps the first piece's eye. */
  const showFirst = async () => {
    world.signInAs(gm);
    const row = await rowNow();
    const shown = await runCommand(registry, world.db, users.gm, showPiece, { campaignId: campaign, row, piece: row.pieces[0]! });
    expect(shown.ok).toBe(true);
  };
  /** The GM's copy of a map, tied to this place, its eye open (`shown`) or closed: as place.addMap and place.setMap leave it. */
  const addMap = async (shown: boolean) => {
    world.signInAs(gm);
    world.tables.assets.push({ id: 'asset-moth-plan', campaign_id: campaign, kind: 'map', name: 'The Moth Gallery, a plan', visibility: shown ? 'all' : 'gm' });
    await world.db.storage.from('campaign-files').upload(`${campaign}/asset-moth-plan`, new Blob(['a plan'], { type: 'image/svg+xml' }));
    world.tables.places.find((p) => p.id === placeId)!.map_asset_id = 'asset-moth-plan';
  };
  /** The GM moves the group on to a place typed by hand, not shown. */
  const moveOn = async () => {
    world.signInAs(gm);
    await runCommand(registry, world.db, users.gm, setPlace, { campaignId: campaign, group: 1, name: 'The Cellar Stair', placeId: null, packEntry: null });
  };
  return { gm, sam, campaign, users, showFirst, addMap, moveOn };
}

function open(t: Awaited<ReturnType<typeof table>>, who: 'gm' | 'sam') {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <PartyGroups db={world.db} user={t.users[who]} campaign={campaign} />
    </ToastHost>,
  );
}

const column = (container: HTMLElement, side: 'left' | 'right') => container.querySelector<HTMLElement>(`.players-page__column[data-column="${side}"]`)!;

describe("the players' Scene, the page's structure (P1)", () => {
  // Purpose: the page is a player's during an expedition; the GM, a town and a wilderness day keep what they have,
  // and so does a player whose towns couldn't be read (nobody can say they aren't in one).
  it('is for a player during an expedition, not for the GM, not in a town and not in a wilderness day', () => {
    const player = { gm: false, expedition: true, day: false, townsRead: true, inTown: false };
    expect(showsPlayersPage(player)).toBe(true);
    expect(showsPlayersPage({ ...player, gm: true })).toBe(false);
    expect(showsPlayersPage({ ...player, expedition: false })).toBe(false);
    expect(showsPlayersPage({ ...player, inTown: true })).toBe(false);
    expect(showsPlayersPage({ ...player, day: true })).toBe(false);
    expect(showsPlayersPage({ ...player, townsRead: false })).toBe(false);
  });

  // Purpose (P11; PL5, PL5b): in one column the page reads left column first, so what a player acts on comes before
  // what they read; the page stands in the book's faces, as the top above it.
  it('puts the left column before the right, in the book’s faces', () => {
    const { container } = render(<PlayersScenePage left={<p>Where to</p>} right={<p>To read</p>} />);
    const columns = [...container.querySelectorAll('.players-page__column')];
    expect(columns.map((c) => c.getAttribute('data-column'))).toEqual(['left', 'right']);
    expect(columns.map((c) => c.textContent)).toEqual(['Where to', 'To read']);
    expect(container.querySelector('.book-faces .players-page')).toBeTruthy();
  });

  // Purpose (P13; PL9): while the page loads, still bars stand in both columns, where the cards will be.
  it('shows still bars in both columns while it loads', () => {
    const { container } = render(<PlayersSceneLoading />);
    expect(within(column(container, 'left')).getByRole('status', { name: 'Loading where you are' })).toBeTruthy();
    expect(within(column(container, 'right')).getByRole('status', { name: 'Loading the marching order' })).toBeTruthy();
  });

  // Purpose (P14, hard rule 5; PL2): the cards that say "nothing yet" say it in PL2's words, which name no place,
  // with no "Spot" or "Site" (p2p-1). (That the place's own name stays off the page is checked on the party's page,
  // below.)
  it('says "nothing yet" in words that name no place', () => {
    const { container } = render(
      <>
        <SomewhereNew />
        <NothingSharedYet />
      </>,
    );
    expect(within(screen.getByRole('region', { name: 'Where you are' })).getByRole('heading', { name: 'Somewhere new' })).toBeTruthy();
    expect(screen.getByText('Your GM hasn’t described this place yet.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'The map' })).getByText('No map shared yet.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'This place' })).getByText('Nothing shared yet.')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b(spot|site)s?\b/i);
  });

  // Purpose: where a player's characters are in more than one group, each "nothing yet" card says whose it is, on
  // screen and to a screen reader.
  it('names the group on each "nothing yet" card when it is given one', () => {
    render(
      <>
        <SomewhereNew group="Group 2" />
        <NothingSharedYet group="Group 2" />
      </>,
    );
    const where = screen.getByRole('region', { name: 'Group 2: where you are' });
    expect(within(where).getByText('Group 2: where you are')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Group 2: the map' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Group 2: this place' })).getByRole('heading', { name: 'Group 2: this place' })).toBeTruthy();
  });
});

describe("the players' Scene on the party's page (P1)", () => {
  // Purpose (P13, P14; mc-28b, mc-50; PL2): before the GM shows anything of the place, a player reads "Somewhere new"
  // at the left; the right column keeps its place with the map's frame and the place's card, both empty, and today's
  // marching order after them; the place's name is nowhere on the page.
  it('before anything is shown: Somewhere new at the left, the right column in place and empty, no name of the place', async () => {
    const t = await table();
    const { container } = open(t, 'sam');
    // (The loading bars stand in the columns first; the page's own columns replace them.)
    await screen.findByRole('heading', { name: 'Somewhere new' });
    expect(within(column(container, 'left')).getByRole('heading', { name: 'Somewhere new' })).toBeTruthy();
    const right = column(container, 'right');
    expect(within(right).getByRole('region', { name: 'The map' })).toBeTruthy();
    expect(within(right).getByRole('region', { name: 'This place' })).toBeTruthy();
    // The marching order comes after the empty frames, in the same column.
    const order = await within(right).findByRole('heading', { name: 'Marching order' });
    expect(within(right).getByRole('region', { name: 'This place' }).compareDocumentPosition(order) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(column(container, 'left')).queryByRole('heading', { name: 'Marching order' })).toBeNull();
    expect(container.textContent).not.toContain(PLACE);
    expect(container.textContent).not.toContain('Dusty frames');
  });

  // Purpose (PL1): once the GM shows a piece, the place and that piece stand in the left column, the empty frames are
  // gone, and the marching order is still at the right; today's "What we know" has left the page with the players' map
  // (p4s-3).
  it('once a piece is shown: the place at the left, the empty frames gone, the marching order still at the right', async () => {
    const t = await table();
    await t.showFirst();
    const { container } = open(t, 'sam');
    await screen.findByRole('heading', { name: PLACE });
    const left = within(column(container, 'left'));
    expect(left.getByRole('heading', { name: PLACE })).toBeTruthy();
    expect(left.getByText('Dusty frames and a draught.')).toBeTruthy();
    expect(left.queryByRole('heading', { name: 'Somewhere new' })).toBeNull();
    const right = within(column(container, 'right'));
    expect(right.queryByRole('region', { name: 'The map' })).toBeNull();
    expect(right.queryByRole('region', { name: 'This place' })).toBeNull();
    const order = await right.findByRole('heading', { name: 'Marching order' });
    expect(right.queryByRole('button', { name: /^What we know/ })).toBeNull();
    // Today's Split party keeps its place under the marching order.
    expect(order.compareDocumentPosition(right.getByRole('button', { name: 'Split party' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Purpose: the GM's Scene is untouched: the GM's own place page, and none of the players' "nothing yet" cards.
  it('leaves the GM’s Scene as it is', async () => {
    const t = await table();
    const { container } = open(t, 'gm');
    expect(await screen.findByRole('heading', { name: PLACE })).toBeTruthy();
    expect(container.querySelector('.players-page')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Somewhere new' })).toBeNull();
  });

  // Purpose: with no expedition under way a player's Scene keeps today's one column (the town is its own plan).
  it('keeps today’s one column for a player between expeditions', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
    world.signInAs(sam);
    const { container } = render(
      <ToastHost>
        <PartyGroups db={world.db} user={{ id: sam, roles: { [campaign]: 'player' } } as CurrentUser} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'player', line: null }} />
      </ToastHost>,
    );
    expect(await screen.findByRole('heading', { name: 'Marching order' })).toBeTruthy();
    expect(container.querySelector('.players-page')).toBeNull();
  });

  // Purpose (the local review of the pull request, nit 2): when the towns can't be read during an expedition, nobody
  // can say the player isn't in a town, so the Scene keeps today's one column instead of the expedition's page.
  it('keeps today’s one column when the towns can’t be read', async () => {
    const t = await table();
    const real = world.db.rpc.bind(world.db) as (name: string, args: unknown) => unknown;
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: unknown) =>
      name === 'scene_town' ? Promise.resolve({ data: null, error: { message: 'The network dropped.' } }) : real(name, args)) as never);
    const { container } = open(t, 'sam');
    expect(await screen.findByRole('heading', { name: 'Marching order' })).toBeTruthy();
    expect(container.querySelector('.players-page')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Somewhere new' })).toBeNull();
  });

  // Purpose (the local review, nit 1): a player whose characters are in two groups has a card for each group, and
  // each card says whose it is; a player with one group's card sees no group name on it (PL6).
  it('names each group’s cards for a player with characters in two groups', async () => {
    const t = await table();
    world.signInAs(t.gm);
    const moss = world.addCharacter(t.campaign, 'Moss', { ownerId: t.sam });
    world.signInAs(t.sam);
    const split = await runCommand(createAppRegistry(), world.db, t.users.sam, chooseGroup, { character: { id: moss, campaignId: t.campaign, ownerUserId: t.sam }, group: null });
    expect(split.ok).toBe(true);
    const { container } = open(t, 'sam');
    const left = () => within(column(container, 'left'));
    await screen.findByRole('region', { name: 'Group 1: where you are' });
    expect(left().getByRole('region', { name: 'Group 1: where you are' })).toBeTruthy();
    expect(left().getByRole('region', { name: 'Group 2: where you are' })).toBeTruthy();
    const right = within(column(container, 'right'));
    expect(right.getByRole('heading', { name: 'Group 1: this place' })).toBeTruthy();
    expect(right.getByRole('heading', { name: 'Group 2: this place' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Where you are' })).toBeNull();
  });
});

describe("the marching order as a player sees it, split (P8; page 18, PL6; ap-10)", () => {
  /** Jo joins with Ash, then takes Ash off to a group of their own; the GM names that group's place. */
  async function splitTable() {
    const t = await table();
    const jo = world.addPerson('jo@lantern.example', 'Jo');
    world.signInAs(t.gm);
    const ash = world.addCharacter(t.campaign, 'Ash', { ownerId: jo });
    world.addMember(t.campaign, jo, 'player', ash);
    const joUser = { id: jo, roles: { [t.campaign]: 'player' } } as CurrentUser;
    world.signInAs(jo);
    const split = await runCommand(createAppRegistry(), world.db, joUser, chooseGroup, { character: { id: ash, campaignId: t.campaign, ownerUserId: jo }, group: null });
    expect(split.ok).toBe(true);
    world.signInAs(t.gm);
    const named = await runCommand(createAppRegistry(), world.db, t.users.gm, setPlace, { campaignId: t.campaign, group: 2, name: 'The Weir’s Throat', placeId: null, packEntry: null });
    expect(named.ok).toBe(true);
    return t;
  }

  // Purpose (PL6; ap-10): in a split party a player whose characters are in one group sees that group's order alone,
  // headed plain "Marching order", with one line naming who is elsewhere and never where: the other group's place is
  // nowhere on the page, and the other group's character has no circle.
  it('a player in one group: plain "Marching order", "Your group. Ash is elsewhere.", and nothing of where Ash is', async () => {
    const t = await splitTable();
    const { container } = open(t, 'sam');
    // (The loading bars stand in the columns first; the page's own columns replace them.)
    const order = await screen.findByRole('heading', { name: 'Marching order' });
    expect(column(container, 'right').contains(order)).toBe(true);
    const card = within(order.closest('section')!);
    expect(await card.findByText('Your group. Ash is elsewhere.')).toBeTruthy();
    expect(card.getByRole('button', { name: /^Wren/ })).toBeTruthy();
    expect(card.queryByRole('button', { name: /^Ash/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^Marching order: Group/ })).toBeNull();
    expect(container.textContent).not.toContain('Weir');
  });

  // Purpose: the GM keeps the group's name on each order and gets no "elsewhere" line (the GM's page is not PL6's).
  it('the GM keeps "Marching order: Group 1" and no line of who is elsewhere', async () => {
    const t = await splitTable();
    open(t, 'gm');
    expect(await screen.findByRole('heading', { name: 'Marching order: Group 1' })).toBeTruthy();
    expect(screen.queryByText(/elsewhere/)).toBeNull();
  });

  // Purpose: in a split party a player with no character marching is shown the first group's order, which is not
  // theirs: it keeps its group's name, "Marching order: Group 1", and there is no "Your group" line.
  it('a player with no character marching: "Marching order: Group 1", with no "Your group" line', async () => {
    const t = await splitTable();
    const kit = world.addPerson('kit@lantern.example', 'Kit');
    world.signInAs(t.gm);
    world.addMember(t.campaign, kit, 'player');
    world.signInAs(kit);
    const campaign = { id: t.campaign, name: 'The Ash Barrows', role: 'player' as const, line: null };
    render(
      <ToastHost>
        <PartyGroups db={world.db} user={{ id: kit, roles: { [t.campaign]: 'player' } } as CurrentUser} campaign={campaign} />
      </ToastHost>,
    );
    expect(await screen.findByRole('heading', { name: 'Marching order: Group 1' })).toBeTruthy();
    expect(screen.queryByText(/^Your group\./)).toBeNull();
    expect(screen.queryByText(/elsewhere/)).toBeNull();
  });

  // Purpose: a player with characters in two groups has an order for each, each keeping its group's name, and no
  // "Your group" line (no frame draws that player; the cards above are named the same way).
  it('a player in two groups: each order keeps its group’s name, with no "Your group" line', async () => {
    const t = await table();
    world.signInAs(t.gm);
    const moss = world.addCharacter(t.campaign, 'Moss', { ownerId: t.sam });
    world.signInAs(t.sam);
    expect((await runCommand(createAppRegistry(), world.db, t.users.sam, chooseGroup, { character: { id: moss, campaignId: t.campaign, ownerUserId: t.sam }, group: null })).ok).toBe(true);
    open(t, 'sam');
    expect(await screen.findByRole('heading', { name: 'Marching order: Group 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Marching order: Group 2' })).toBeTruthy();
    expect(screen.queryByText(/^Your group\./)).toBeNull();
  });
});

describe("the players' place card on the page (P4)", () => {
  /** Sam's table with a pack: an Area holding the jetty (1) and the wreck (2); the party at the jetty. */
  async function packTable() {
    const t = await table();
    const AREA = { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'site', playerView: { text: 'Black water.' }, gm: { sections: [{ heading: 'What everyone knows', text: 'Nobody crosses at slack water.' }, { heading: 'The eel-mother', text: 'She sleeps under the third pile.' }] } };
    const JETTY = { id: 'the-jetty', name: 'The Jetty', key: '1', type: 'area', parentId: 'drowned-harbour', playerView: { text: 'Black piles and a slick deck.' } };
    world.tables.packs.push({ id: 'pack-reed', owner_user_id: t.gm, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-reed', campaign_id: t.campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, priority: 1 });
    for (const data of [AREA, JETTY]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
    world.signInAs(t.gm);
    const registry = createAppRegistry();
    const moved = await runCommand(registry, world.db, t.users.gm, setPlace, { campaignId: t.campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: JETTY.id, name: JETTY.name, data: JETTY } });
    expect(moved.ok).toBe(true);
    return { ...t, registry };
  }

  // Purpose (ppf-6, ppf-1, ppf-6 a): once the jetty is shown and the GM has shared one section of the Area, the left
  // column holds the Location's card ("1. The Jetty" under the trail, in place of today's place line) and the right the
  // Area's card, headed by the Area's name (shown with its Location), with the section's row and its turn ("Shared,
  // turn N."), and nothing of the section not shared.
  it("shows the Location's card, and the shared section on the Area card, and nothing of what was not shared", async () => {
    const t = await packTable();
    const visit = (await loadGroupPlaces(world.db, t.campaign, (world.tables.expeditions[0] as { id: string }).id))!.get(1)!;
    expect((await runCommand(t.registry, world.db, t.users.gm, showPiece, { campaignId: t.campaign, row: visit, piece: visit.pieces[0]! })).ok).toBe(true);
    const { setKnowledgeShare } = await import('../modules/expedition/placeKnowledge.ts');
    expect((await runCommand(t.registry, world.db, t.users.gm, setKnowledgeShare, { campaignId: t.campaign, group: 1, packId: 'pack-reed', entryId: 'drowned-harbour', sectionAt: 0, share: true })).ok).toBe(true);
    const { container } = open(t, 'sam');
    // Once loaded (the loading bars give way to the page), the left column holds the Location's card.
    const location = await screen.findByRole('region', { name: 'Where you are: 1. The Jetty' });
    expect(column(container, 'left').contains(location)).toBe(true);
    expect(within(location).getByRole('navigation', { name: 'Where this is' }).textContent).toBe('The Drowned Harbour');
    expect(within(location).getByText('Black piles and a slick deck.')).toBeTruthy();
    expect(container.querySelector('.place-line')).toBeNull();
    const right = within(column(container, 'right'));
    expect(await right.findByRole('button', { name: /^What everyone knows: Shared, turn \d+\.$/ })).toBeTruthy();
    const card = container.querySelector<HTMLElement>('.players-area')!;
    expect(within(card).getByRole('heading', { name: 'The Drowned Harbour' })).toBeTruthy();
    expect(container.textContent).not.toContain('eel-mother');
  });

  // Purpose (ppf-4; p4s-1): a Location of the Area the group was shown before stands on the Area card by number, its
  // first shown piece on the line under it; a piece of it never shown is nowhere on the page.
  it("lists a known Location with its first shown piece, and nothing of it not shown", async () => {
    const t = await packTable();
    const WRECK = { id: 'the-wreck', name: 'The Wreck', key: '2', type: 'area', parentId: 'drowned-harbour', playerView: { text: 'A cog on her side on the bar.', aspects: [{ lead: 'Ribs', text: 'A tarred box under her ribs.' }] } };
    world.tables.library_entries.push({ id: 'entry-the-wreck', pack_id: 'pack-reed', kind: 'location', pack_entry_id: WRECK.id, name: WRECK.name, data: WRECK });
    const trip = (world.tables.expeditions[0] as { id: string }).id;
    const JETTY = world.tables.library_entries.find((e) => e.pack_entry_id === 'the-jetty')!.data as { id: string; name: string };
    for (const data of [WRECK, JETTY]) {
      world.signInAs(t.gm);
      expect((await runCommand(t.registry, world.db, t.users.gm, setPlace, { campaignId: t.campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } })).ok).toBe(true);
      const row = (await loadGroupPlaces(world.db, t.campaign, trip))!.get(1)!;
      if (!row.pieces[0]!.shown) expect((await runCommand(t.registry, world.db, t.users.gm, showPiece, { campaignId: t.campaign, row, piece: row.pieces[0]! })).ok).toBe(true);
    }
    const { container } = open(t, 'sam');
    await screen.findByRole('region', { name: 'Where you are: 1. The Jetty' });
    const row = await within(column(container, 'right')).findByRole('button', { name: /^2\. The Wreck/ });
    expect(row.querySelector('.list-row__sub')?.textContent).toBe('A cog on her side on the bar.');
    expect(container.textContent).not.toContain('tarred box');
  });
});

describe("the players' map (P5; mc-37, dp-3; 01-08, 01-08c, PL1, PL2)", () => {
  // Purpose: a map the GM hasn't shared never reaches the page: no frame at all once the place is shown (dp-3), and the
  // map's title nowhere.
  it('draws no map while its eye is closed', async () => {
    const t = await table();
    await t.addMap(false);
    await t.showFirst();
    const { container } = open(t, 'sam');
    await screen.findByRole('heading', { name: PLACE });
    expect(within(column(container, 'right')).queryByRole('region', { name: 'The map' })).toBeNull();
    expect(container.textContent).not.toContain('a plan');
  });

  // Purpose: once shared, the map stands first in the right column, its picture the GM's copy, fitted whole with no
  // locate tool (a map carries no positions yet).
  it('draws the shared map first in the right column, with its title', async () => {
    const t = await table();
    await t.addMap(true);
    await t.showFirst();
    const { container } = open(t, 'sam');
    await screen.findByRole('heading', { name: PLACE });
    const map = await within(column(container, 'right')).findByRole('region', { name: 'The map' });
    const right = column(container, 'right');
    expect(right.firstElementChild!.contains(map)).toBe(true);
    await waitFor(() => expect(map.querySelector('img')?.getAttribute('src')).toContain('asset-moth-plan'));
    expect(within(map).queryByRole('button', { name: 'Where we are' })).toBeNull();
  });

  // Purpose: before anything is shown, a shared map isn't sent (the read waits for a place shown); after a move to a
  // place not shown yet, the last shown place's map stays in the dashed frame's place (mc-39b's rule), so it doesn't go
  // at each move.
  it('is not sent before anything is shown, and stays through a move to a place not shown', async () => {
    const t = await table();
    await t.addMap(true);
    let page = open(t, 'sam');
    await screen.findByRole('heading', { name: 'Somewhere new' });
    expect(within(column(page.container, 'right')).getByText('No map shared yet.')).toBeTruthy();
    cleanup();
    await t.showFirst();
    await t.moveOn();
    page = open(t, 'sam');
    await screen.findByRole('heading', { name: 'Somewhere new' });
    const right = within(column(page.container, 'right'));
    expect(await right.findByRole('region', { name: 'The map' })).toBeTruthy();
    expect(right.queryByText('No map shared yet.')).toBeNull();
    expect(right.getByRole('region', { name: 'This place' })).toBeTruthy();
  });
});
