// @vitest-environment jsdom
// Move on, wired (piece 5b-0; dec-4 pieces b and d; pt-f2, pt-f3), clicked through against the stand-in database: 4a's
// sheet fed with the ways from where the party is, the move made through the time strip's own advance. Not on any
// screen yet (5b mounts it): here the sheet sits beside the strip under the provider, as the place page will put it.
// Invented places, rules and people. The tests, purpose first:
//   - Move on a way moves the party and the clock by its turns as one place.moveOn, and the move's encounter check is
//     on the strip's card after it (dec-4 piece d).
//   - A far end the campaign hasn't made is made from the pack first; Yes on an obstacle the GM decides moves with the
//     extra turns, and the move's check takes the passing place's chance.
//   - No on that obstacle moves nothing.
//   - The strip's one Undo puts back the place, the clock and the move's card lines (Departure 3).
//   - A move the database refuses (a stale clock) leaves the sheet open: nothing tells the caller it moved.
//   - While the party is split, nothing is sent and the caller gets the ruled words for its pop-up (pt-f3 point 3); the
//     sheet reads from group 1's place even when group 2 arrived at its own place later.
//   - At a Location the pack marks a way out, End expedition ends the expedition through the strip, with Undo; with no
//     mark there is no such row (B10).
//   - A check that is a roll on its table: the step's Then line names the table, never the check's id (B9).
//   - Without the strip listening, Move on says where it works and moves nothing.
//   - When the players' own read fails, the sheet stays open and a toast says their lines go by map number (cs-22).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { SPLIT_PARTY_WORDS } from '../modules/expedition/moveOnWays.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { MOVE_ON_NO_STRIP, MOVE_ON_PLAYERS_UNREAD, MoveOnWiring } from './MoveOn.tsx';
import { SceneMoveProvider } from './sceneMove.tsx';
import { SceneTime } from './SceneTime.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
});
afterEach(() => cleanup());

const TURN = 600;

/** A campaign in a creeping mode (Lurkers every 2 turns, 1 in 6), at the Jetty of an invented adventure pack. */
async function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  const pack = (id: string, name: string, kind: string) => {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind, format_version: 2, source: '', notes: '', updated_at: '2026-11-14T00:00:00Z', extra_meta: {} });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority: 1 });
  };
  const entry = (packId: string, kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${id}`, pack_id: packId, kind, pack_entry_id: id, name, data: { id, name, ...data } });
  pack('pack-fen', 'Fen Rules', 'setting');
  entry('pack-fen', 'rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'lurk', name: 'Lurkers', icon: 'monster', kind: 'check', checkId: 'lurk' }],
          checks: [{ id: 'lurk', name: 'Lurkers', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: {} }],
          movement: {},
        },
      ],
    },
  });
  pack('pack-mere', 'Mere Tower', 'adventure');
  entry('pack-mere', 'location', 'jetty', 'The Jetty', { key: '1' });
  entry('pack-mere', 'location', 'islet', 'The Islet', { key: '2' });
  entry('pack-mere', 'location', 'cave', 'The Sea Cave', { key: '3' });
  entry('pack-mere', 'location', 'weir', 'The Weir', { key: '4', encounterCheck: { chance: { die: 'd6', on: [1, 2] } } });
  entry('pack-mere', 'route', 'jetty-islet', 'jetty-islet', { from: 'jetty', to: 'islet', travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
  entry('pack-mere', 'route', 'cave-jetty', 'cave-jetty', { from: 'cave', to: 'jetty', travel: { value: 2, unit: 'turn' }, barrier: { name: 'the weir’s gap', extraTurns: 2, needsApproval: true, through: 'weir', note: 'Only at slack water.' } });
  world.signInAs(gm);
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
  if (started.error) throw new Error(started.error.message);
  const expedition = String(world.tables.expeditions.find((x) => x.campaign_id === campaign)!.id);
  const place = (id: string, entryId: string, name: string) =>
    world.tables.places.push({
      id, campaign_id: campaign, name, description: '', version: 1, undone: false, created_by: gm, pack_id: 'pack-mere', pack_entry_id: entryId, pack_type: null, pack_parent_id: null, pack_key: null,
      players_name: '', region_id: null, terrain_id: null, safety: null, town: {}, created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z',
    });
  place('place-jetty', 'jetty', 'The Jetty');
  place('place-islet', 'islet', 'The Islet');
  const visit = (id: string, placeId: string, group: number) =>
    world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: expedition, group_number: group, place_id: placeId, shown: true, created_at: new Date(Date.now() - 60000).toISOString(), undone: false, moved_on: false });
  visit('visit-jetty', 'place-jetty', 1);
  const user = { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser;
  return { gm, campaign, expedition, user, visit };
}
type Table = Awaited<ReturnType<typeof table>>;

/** The Move on sheet beside the time strip, as the place page will put it; the caller's pop-up shows the refusal. */
function Page({ t, strip = true }: { t: Table; strip?: boolean }) {
  const [blocked, setBlocked] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <ToastHost>
      <SceneMoveProvider>
        {strip && <SceneTime db={world.db} user={t.user} campaign={{ id: t.campaign, name: 'The Ash Barrows', role: 'gm', line: null }} />}
        {open && <MoveOnWiring db={world.db as unknown as Db} campaignId={t.campaign} expeditionId={t.expedition} onClose={() => setOpen(false)} onElsewhere={() => undefined} onBlocked={setBlocked} onMoved={() => setOpen(false)} />}
        {blocked && <p data-testid="blocked">{blocked}</p>}
      </SceneMoveProvider>
    </ToastHost>
  );
}

const clock = (t: Table) => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === t.campaign)!.seconds);
const moves = (t: Table) => world.tables.place_moves.filter((m) => m.campaign_id === t.campaign && !m.undone);
const hereNow = (t: Table) => world.tables.group_places.find((g) => g.campaign_id === t.campaign && g.group_number === 1 && !g.moved_on && !g.undone)?.place_id;
const sheet = () => screen.findByRole('dialog');

describe('Move on, wired to the time strip', () => {
  it('moves the party and the clock by the way’s turns, then puts the move’s encounter check on the card', async () => {
    const t = await table();
    const before = clock(t);
    render(<Page t={t} />);
    const user = userEvent.setup();
    const list = within(await sheet());
    await user.click(await list.findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    const shown = await sheet();
    const step = within(shown);
    expect(shown.textContent).toContain('ThenLurkers, 1 in 6.');
    await user.click(step.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(moves(t)).toHaveLength(1));
    expect(moves(t)[0]).toMatchObject({ turns: 1, seconds: TURN, way_by: 'row', way_name: 'Rowing' });
    expect(clock(t)).toBe(before + TURN);
    expect(hereNow(t)).toBe('place-islet');
    expect(world.tables.events.filter((e) => e.type === 'place.moveOn')).not.toHaveLength(0);
    const due = within(await screen.findByRole('region', { name: /^Due/ }));
    expect(await due.findByRole('button', { name: 'Miss, Lurkers, now' })).toBeTruthy();
  }, 30000);

  it('makes a far end from the pack first; Yes crosses the obstacle with its extra turns and the passing place’s chance', async () => {
    const t = await table();
    const before = clock(t);
    render(<Page t={t} />);
    const user = userEvent.setup();
    const list = within(await sheet());
    // Nothing of either far end has been shown to the players yet.
    // Each has the closed eye and what its players read (sf-9, WT1 A).
    expect(list.getAllByRole('img', { name: 'Not shown yet. Players read:' })).toHaveLength(2);
    await user.click(await list.findByRole('button', { name: 'Move, 2 turns, to 3. The Sea Cave' }));
    const shown = await sheet();
    const step = within(shown);
    expect(shown.textContent).toContain('ThenLurkers, with the Weir’s chance: 2 in 6.');
    expect(step.getByText('2 turns, and 2 more for the obstacle: 4 turns.')).toBeTruthy();
    await user.click(step.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(moves(t)).toHaveLength(1));
    const cave = world.tables.places.find((p) => p.campaign_id === t.campaign && p.pack_entry_id === 'cave' && !p.undone);
    expect(cave).toBeTruthy();
    expect(hereNow(t)).toBe(cave!.id);
    expect(moves(t)[0]).toMatchObject({ turns: 4, seconds: 4 * TURN, way_by: null });
    expect(clock(t)).toBe(before + 4 * TURN);
    // The move's check, with the Weir's chance (2 in 6).
    const due = within(await screen.findByRole('region', { name: /^Due/ }));
    expect(await due.findByText(/Lurkers, now/)).toBeTruthy();
    expect(due.getByText(/2 in 6|1–2/)).toBeTruthy();
  }, 30000);

  it('one Undo on the strip puts back the place, the clock and the move’s check line', async () => {
    const t = await table();
    const before = clock(t);
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    await user.click(within(await sheet()).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(moves(t)).toHaveLength(1));
    const due = within(await screen.findByRole('region', { name: /^Due/ }));
    expect(await due.findByRole('button', { name: 'Miss, Lurkers, now' })).toBeTruthy();
    // The strip's own Undo is gone (st-1): a Move on's Undo is in its toast ("Moved to The Islet.": the toast names the place, not its key; mc-57).
    await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
    await waitFor(() => expect(moves(t)).toHaveLength(0));
    expect(clock(t)).toBe(before);
    expect(hereNow(t)).toBe('place-jetty');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Miss, Lurkers, now' })).toBeNull());
  }, 30000);

  it('a move the database refuses keeps the sheet open and moves nothing', async () => {
    const t = await table();
    const before = clock(t);
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    // Another GM device moves the clock meanwhile: this strip's copy is stale, and the database refuses the move.
    const row = world.tables.campaign_clocks.find((c) => c.campaign_id === t.campaign)!;
    row.version = Number(row.version) + 1;
    await user.click(within(await sheet()).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(world.tables.events.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 200));
    expect(moves(t)).toHaveLength(0);
    expect(clock(t)).toBe(before);
    expect(screen.getByRole('dialog')).toBeTruthy();
  }, 30000);

  it('No on an obstacle the GM decides moves nothing', async () => {
    const t = await table();
    const before = clock(t);
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Move, 2 turns, to 3. The Sea Cave' }));
    await user.click(within(await sheet()).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(moves(t)).toHaveLength(0);
    expect(clock(t)).toBe(before);
    expect(world.tables.places.some((p) => p.pack_entry_id === 'cave')).toBe(false);
  }, 30000);

  it('while the party is split, sends nothing and gives the ruled words for the pop-up', async () => {
    const t = await table();
    t.visit('visit-g2', 'place-islet', 2);
    // Group 2 reached the Islet after group 1 reached the Jetty (a minute later, always): the sheet still reads from
    // group 1's place, the database ordering by group first. Before, both visits took the clock's millisecond, and when
    // a slow machine let the clock tick between them the stand-in database put group 2 first (cleanup-flaky-2).
    world.tables.group_places.find((g) => g.id === 'visit-g2')!.created_at = new Date(Date.now() + 60000).toISOString();
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    await user.click(within(await sheet()).getByRole('button', { name: 'Move' }));
    expect((await screen.findByTestId('blocked')).textContent).toBe(SPLIT_PARTY_WORDS);
    expect(moves(t)).toHaveLength(0);
  }, 30000);

  // Purpose (B10; p2p-22, page 24 WY1d): at a Location the pack marks a way out, Move on's list ends with End
  // expedition; a tap ends the expedition through the strip, End expedition's own command, with its toast and Undo,
  // and the sheet closes. Elsewhere there is no such row.
  it('at a way out, End expedition ends the expedition through the strip, with Undo', async () => {
    const t = await table();
    const jetty = world.tables.library_entries.find((e) => e.pack_entry_id === 'jetty')!;
    jetty.data = { ...(jetty.data as Record<string, unknown>), wayOut: true };
    render(<Page t={t} />);
    const user = userEvent.setup();
    const list = within(await sheet());
    await user.click(await list.findByRole('button', { name: 'End expedition' }));
    await waitFor(() => expect(world.tables.expeditions.find((x) => x.id === t.expedition)!.ended_at).not.toBeNull());
    expect(world.tables.events.some((e) => e.type === 'expedition.end')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /where to\?/ })).toBeNull());
    expect(await screen.findByText(/^Expedition ended\./)).toBeTruthy();
    expect(moves(t)).toHaveLength(0);
    await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
    await waitFor(() => expect(world.tables.expeditions.find((x) => x.id === t.expedition)!.ended_at).toBeNull());
  }, 30000);

  // Purpose (#1086's review, finding 5): a second tap on End expedition while the first is still saving says so
  // ("Still saving…") rather than nothing, and the expedition ends once.
  it('at a way out, a second End expedition while the first is saving says Still saving…', async () => {
    const t = await table();
    const jetty = world.tables.library_entries.find((e) => e.pack_entry_id === 'jetty')!;
    jetty.data = { ...(jetty.data as Record<string, unknown>), wayOut: true };
    render(<Page t={t} />);
    const end = await within(await sheet()).findByRole('button', { name: 'End expedition' });
    fireEvent.click(end);
    fireEvent.click(end);
    expect(await screen.findByText('Still saving…')).toBeTruthy();
    await waitFor(() => expect(world.tables.expeditions.find((x) => x.id === t.expedition)!.ended_at).not.toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'expedition.end')).toHaveLength(1);
  }, 30000);

  // Purpose (B10): with no way-out mark the list has no End expedition row (End expedition stays in the GM's menu).
  it('with no way-out mark, has no End expedition row', async () => {
    const t = await table();
    render(<Page t={t} />);
    const list = within(await sheet());
    await list.findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' });
    expect(list.queryByRole('button', { name: 'End expedition' })).toBeNull();
  }, 30000);

  // Purpose (G-27, dg-2, dg-4): at a place whose pack says "none" nothing comes due: Move on's step has no Then check
  // line, and the move puts no encounter check on the card (the setting's Lurkers would be on it, as the first test shows).
  it('at a place with no encounters: no Then check line, and no check after the move', async () => {
    const t = await table();
    const jetty = world.tables.library_entries.find((e) => e.pack_entry_id === 'jetty')!;
    jetty.data = { ...(jetty.data as Record<string, unknown>), encounterCheck: { none: true, note: 'The harbour watch keeps the jetty quiet.' } };
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    const shown = await screen.findByRole('dialog', { name: 'Move on: Rowing to 2. The Islet' });
    expect(shown.textContent).not.toMatch(/Then|Lurkers/);
    await user.click(within(shown).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(moves(t)).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /Lurkers, now/ })).toBeNull();
  }, 30000);

  // Purpose (B9; p2p-18, p2p-19, page 24 WY1a): a place's check with a table and no chance, standing in for the mode's,
  // is named by its table and is a roll on it: the step is titled with the way and where to, has no Where line and no
  // line about the log, and its Then line reads "a roll on Encounters in the harbour.", never the check's id.
  it('a check that is a roll on its table: the step’s Then line names the table', async () => {
    const t = await table();
    world.tables.library_entries.push({ id: 'entry-table-harbour', pack_id: 'pack-fen', kind: 'table', pack_entry_id: 'harbour-encounters', name: 'Encounters in the harbour', data: { id: 'harbour-encounters', name: 'Encounters in the harbour', die: 'd20', rows: [{ min: 1, max: 10, result: 'Nothing stirs' }, { min: 11, max: 20, result: 'Gulls, mobbing the boat' }] } });
    const jetty = world.tables.library_entries.find((e) => e.pack_entry_id === 'jetty')!;
    jetty.data = { ...(jetty.data as Record<string, unknown>), encounterCheck: { when: 'eachMove', replacesScheduled: true, tableId: 'harbour-encounters', note: 'Roll d20 for an encounter each time the party rows to a new Location.' } };
    render(<Page t={t} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    const shown = await screen.findByRole('dialog', { name: 'Move on: Rowing to 2. The Islet' });
    await waitFor(() => expect(shown.textContent).toContain('Thena roll on Encounters in the harbour.'));
    expect(shown.textContent).not.toMatch(/jetty-check|Where|in the log/);
  }, 30000);

  it('without the time strip, says where Move on works and moves nothing', async () => {
    const t = await table();
    render(<Page t={t} strip={false} />);
    const user = userEvent.setup();
    await user.click(await within(await sheet()).findByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' }));
    await user.click(within(await sheet()).getByRole('button', { name: 'Move' }));
    expect(await screen.findByText(MOVE_ON_NO_STRIP)).toBeTruthy();
    expect(moves(t)).toHaveLength(0);
  }, 30000);

  it('says when the players’ read failed, and keeps the sheet open', async () => {
    const t = await table();
    const real = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: never) => (name === 'campaign_ways_on' ? Promise.resolve({ data: null, error: { message: 'offline' } }) : real(name as never, args))) as never);
    render(<Page t={t} />);
    expect(await screen.findByText(MOVE_ON_PLAYERS_UNREAD)).toBeTruthy();
    expect(within(await sheet()).getByRole('button', { name: 'Rowing, 1 turn, to 2. The Islet' })).toBeTruthy();
  }, 30000);

  // Purpose: a re-read of the ways (the log changed) that again finds the players' read failed must not stack a second copy of the same toast on the one the sheet already showed.
  it('says the players’ read failed once per opening, not again on each re-read', async () => {
    const t = await table();
    const real = world.db.rpc.bind(world.db);
    let failing = true;
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: never) => (name === 'campaign_ways_on' && failing ? Promise.resolve({ data: null, error: { message: 'offline' } }) : real(name as never, args))) as never);
    function Rereads() {
      const [version, setVersion] = useState(1);
      return (
        <ToastHost>
          <SceneMoveProvider>
            <button onClick={() => setVersion((v) => v + 1)}>Re-read</button>
            <MoveOnWiring db={world.db as unknown as Db} campaignId={t.campaign} expeditionId={t.expedition} version={version} onClose={() => undefined} onElsewhere={() => undefined} onBlocked={() => undefined} />
          </SceneMoveProvider>
        </ToastHost>
      );
    }
    render(<Rereads />);
    const user = userEvent.setup();
    const first = await screen.findByText(MOVE_ON_PLAYERS_UNREAD);
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Re-read' }));
    await waitFor(() => expect(world.db.rpc).toHaveBeenCalledTimes(2));
    failing = true;
    await user.click(screen.getByRole('button', { name: 'Re-read' }));
    await waitFor(() => expect(world.db.rpc).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 200));
    // The host shows one toast at a time and draws each new one as a new element: the first still standing means no second was shown.
    expect(first.isConnected).toBe(true);
    expect(screen.getByText(MOVE_ON_PLAYERS_UNREAD)).toBe(first);
  }, 30000);
});
