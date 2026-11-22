// @vitest-environment jsdom
// A player's Where to? on the Scene (plan dec-9-the-players-scene, row P2, with what P13 and P14 ask of it; mc-28b,
// mc-36, d5-1, d5-2; page 18, PL1, PL2, PL4c, PL9). Against the stand-in database, with an invented harbour.
// What it checks, in plain words:
//   * before anything of the place is shown: "Where to?" says there is nothing to choose from yet, and no way, no far
//     end's name and no hidden way is on the page (hard rule 5);
//   * once the GM shows a piece: a row a destination, its ways as buttons with their times; a far end the group hasn't
//     been shown reads "Not yet explored."; the GM's hidden way is nowhere;
//   * a tap on a way's button opens a pop-up that says the GM moves the party, and writes nothing;
//   * a shown place the read gives no ways for has no "Where to?" at all (d5-1);
//   * the GM's Scene has no players' Where to?;
//   * the read's states: still bars while it is out; a failed first read says so with Try again; a failed refresh
//     keeps the last list and says at what turn it was read (PL9);
//   * the "End expedition" row, given a way out: last, and its tap only says the GM ends the expedition (d5-2).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import type { WayOn } from '../modules/library/waysOn.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { createAppRegistry } from './commandRegistry.ts';
import { PartyGroups } from './PartyGroups.tsx';
import { PlayersWhereTo, usePlayersWaysOn, type WaysRead } from './PlayersWhereTo.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
});
afterEach(() => cleanup());

const PACK = 'pack-harbour';
const JETTY = { id: 'the-jetty', name: 'The jetty', type: 'area', playerView: { text: 'Black piles and a mooring ring.' } };
const WRECK = { id: 'the-wreck', name: 'The wreck', type: 'area', playerView: { text: 'A cog on her side on the bar.' } };
const SHED = { id: 'customs-shed', name: 'The customs shed', type: 'area' };
const CAVE = { id: 'sea-cave', name: 'The sea cave', type: 'area' };

/**
 * The GM and Sam, whose character Wren is on an expedition. The pack links the jetty to the wreck (rowing, swimming), to
 * the customs shed (walking) and, by a hidden way, to the sea cave. The group has been to the wreck and was shown a
 * piece of it; now it is at the jetty, nothing of it shown yet. `routes: false`: a pack with no links at all.
 */
async function harbour({ routes = true } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const users = { gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser };
  world.tables.packs.push({ id: PACK, owner_user_id: gm, campaign_id: null, name: 'Harbour', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-20T12:00:00Z', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'link-harbour', campaign_id: campaign, pack_id: PACK, pack_name: 'Harbour', option_choices: {}, overrides: {}, priority: 1 });
  for (const data of [JETTY, WRECK, SHED, CAVE]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: PACK, kind: 'location', pack_entry_id: data.id, name: data.name, data });
  const route = (id: string, to: string, travel: unknown, hidden = false) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: PACK, kind: 'route', pack_entry_id: id, name: id, data: { id, from: 'the-jetty', to, travel, hidden } });
  if (routes) {
    route('to-wreck', 'the-wreck', [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }]);
    route('to-shed', 'customs-shed', [{ by: 'walk', name: 'Walking', value: 2, unit: 'turn' }]);
    route('to-cave', 'sea-cave', [{ by: 'climb', name: 'Clambering', value: 7, unit: 'turn' }], true);
  }
  world.signInAs(gm);
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const registry = createAppRegistry();
  const rowNow = async () => (await loadGroupPlaces(world.db, campaign, started.data!.id))!.get(1)!;
  const goTo = (data: typeof JETTY) => runCommand(registry, world.db, users.gm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: PACK, packEntryId: data.id, name: data.name, data } });
  /** The GM taps the first piece's eye of where the group is. */
  const showFirst = async () => {
    world.signInAs(gm);
    const row = await rowNow();
    expect((await runCommand(registry, world.db, users.gm, showPiece, { campaignId: campaign, row, piece: row.pieces[0]! })).ok).toBe(true);
  };
  await goTo(WRECK);
  await showFirst();
  await goTo(JETTY);
  return { gm, sam, campaign, users, showFirst };
}

function open(t: Awaited<ReturnType<typeof harbour>>, who: 'gm' | 'sam') {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <PartyGroups db={world.db} user={t.users[who]} campaign={campaign} />
    </ToastHost>,
  );
}

const leftColumn = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('.players-page__column[data-column="left"]')).toBeTruthy());
  return container.querySelector<HTMLElement>('.players-page__column[data-column="left"]')!;
};

describe("a player's Where to? on the Scene (P2)", () => {
  // Purpose (P14, hard rule 5; mc-28b; PL2): before anything of the place is shown, Where to? says there is nothing to
  // choose from yet, and nothing of a way reaches the page: no way, no far end's name, no hidden way.
  it('says there is nothing to choose from yet before anything is shown, and shows no way', async () => {
    const t = await harbour();
    const { container } = open(t, 'sam');
    const left = await leftColumn(container);
    await waitFor(() => expect(within(left).getByText('None to choose from yet. They show here once your GM has shown you something of this place.')).toBeTruthy());
    expect(within(left).getByRole('heading', { name: 'Where to?' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Rowing|Swimming|Walking|Clambering|wreck|customs|sea cave/i);
  });

  // Purpose (mc-28, mc-28a, mc-36; PL1; P14): once a piece is shown, a row a destination with its ways and times; the
  // far end not shown reads "Not yet explored." and is not named; the hidden way is nowhere on the page.
  it('lists a row a destination once a piece is shown, never the hidden way', async () => {
    const t = await harbour();
    await t.showFirst();
    const { container } = open(t, 'sam');
    const left = await leftColumn(container);
    const where = await waitFor(() => within(left).getByRole('region', { name: 'Where to?' }));
    const wreck = within(where).getByRole('group', { name: 'The wreck' });
    expect(within(wreck).getByRole('button', { name: 'Rowing, 1 turn, to The wreck' })).toBeTruthy();
    expect(within(wreck).getByRole('button', { name: 'Swimming, 3 turns, to The wreck' })).toBeTruthy();
    const unexplored = within(where).getByRole('group', { name: 'Walking' });
    expect(within(unexplored).getByText('Not yet explored.')).toBeTruthy();
    expect(within(unexplored).getByRole('button', { name: 'Walking, 2 turns, to Walking' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/customs|sea cave|Clambering|7 turns/i);
  });

  // Purpose (pw-1; PL4c; hard rule 3): a tap on a way's button is never a dead end and never a move: a pop-up says
  // where and how, and that the GM moves the party; nothing is written.
  it('opens a pop-up on a tap that says the GM moves the party, and writes nothing', async () => {
    const t = await harbour();
    await t.showFirst();
    const { container } = open(t, 'sam');
    const left = await leftColumn(container);
    const button = await waitFor(() => within(left).getByRole('button', { name: 'Rowing, 1 turn, to The wreck' }));
    const events = world.tables.events.length;
    fireEvent.click(button);
    const popup = screen.getByRole('dialog', { name: 'To the wreck, rowing' });
    expect(within(popup).getByText('1 turn.')).toBeTruthy();
    expect(within(popup).getByText('Your GM moves the party. Say where you want to go.')).toBeTruthy();
    expect(world.tables.events.length).toBe(events);
  });

  // Purpose (d5-1): a place shown to the group with no ways to send leaves "Where to?" out, as Activities is left out.
  it('leaves Where to? out where the place is shown and the read gives no ways', async () => {
    const t = await harbour({ routes: false });
    await t.showFirst();
    const { container } = open(t, 'sam');
    const left = await leftColumn(container);
    await waitFor(() => expect(within(left).getByText('Black piles and a mooring ring.')).toBeTruthy());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(within(left).queryByRole('heading', { name: 'Where to?' })).toBeNull();
  });

  // Purpose: the GM's Scene keeps its own Move on; the players' Where to? is never drawn there.
  it('is not on the GM’s Scene', async () => {
    const t = await harbour();
    await t.showFirst();
    const { container } = open(t, 'gm');
    await waitFor(() => expect(container.textContent).toMatch(/jetty/i));
    expect(container.querySelector('.where-to')).toBeNull();
  });
});

const WAYS: WayOn[] = [{ groupNumber: 1, routeId: 'r1', to: { placeId: 'p-wreck', name: 'The wreck' }, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] }];
const readOf = (over: Partial<WaysRead>): WaysRead => ({ ways: WAYS, failed: false, retry: () => undefined, ...over });

describe("a player's Where to?, its read's states (P13; PL9)", () => {
  // Purpose (PL9): while the first read is out, still bars stand under the heading, so nothing jumps.
  it('shows still bars while the first read is out', () => {
    render(<PlayersWhereTo read={readOf({ ways: null })} group={1} step="turn 13" />);
    expect(screen.getByRole('status', { name: 'Loading the ways' })).toBeTruthy();
  });

  // Purpose (PL9): a failed first read says so with Try again, which reads again; no way is guessed.
  it('says a failed first read with Try again', () => {
    const retry = vi.fn();
    render(<PlayersWhereTo read={readOf({ ways: null, failed: true, retry })} group={1} step="turn 13" />);
    expect(screen.getByText('The ways didn’t load.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  // Purpose (PL9): a failed refresh keeps the last list and says at what turn it was read, though the turn has moved.
  it('keeps the last list after a failed refresh and says when it was read', () => {
    const { rerender } = render(<PlayersWhereTo read={readOf({})} group={1} step="turn 13" />);
    rerender(<PlayersWhereTo read={readOf({ failed: true })} group={1} step="turn 14" />);
    expect(screen.getByText('The ways didn’t refresh. These are as they were at turn 13.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rowing, 1 turn, to The wreck' })).toBeTruthy();
  });

  // Purpose (d5-2, p2p-flag4): at a way out the last row is "End expedition"; a tap ends nothing and says the GM ends
  // the expedition; with no ways the heading and that row still show.
  it('ends with End expedition at a way out, whose tap only says the GM ends it', () => {
    const { container } = render(<PlayersWhereTo read={readOf({ ways: [] })} group={1} step={null} wayOut />);
    expect(screen.getByRole('heading', { name: 'Where to?' })).toBeTruthy();
    const rows = container.querySelectorAll('.move-sheet__rows > *');
    expect(rows[rows.length - 1]!.textContent).toBe('End expedition');
    fireEvent.click(screen.getByRole('button', { name: /End expedition/ }));
    const popup = screen.getByRole('dialog', { name: 'End expedition' });
    expect(within(popup).getByText('Your GM ends the expedition.')).toBeTruthy();
  });

  // Purpose (PL9): the read keeps its last good list when a later read fails, and reads again on Try again.
  it('keeps the last good list when a read fails, and reads again on Try again', async () => {
    let fail = false;
    const rpc = vi.fn(async () => (fail ? { data: null, error: { message: 'offline' } } : { data: [{ group_number: 1, route_id: 'r1', to_place_id: 'p-wreck', to_name: 'The wreck', ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] }], error: null }));
    const db = { rpc } as unknown as Db;
    let seen: WaysRead | null = null;
    function Probe() {
      seen = usePlayersWaysOn(db, 'campaign-1', true);
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(seen!.ways).toHaveLength(1));
    fail = true;
    act(() => seen!.retry());
    await waitFor(() => expect(seen!.failed).toBe(true));
    expect(seen!.ways).toHaveLength(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
