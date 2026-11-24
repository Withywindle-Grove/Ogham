// @vitest-environment jsdom
// The Scene in the GM's view as the player (page 32, M3i, approved 2026-11-21; row C15f of
// plans/test-feedback-2026-11-19.md; pg32-5), against the stand-in database. Invented places and characters.
//   Purpose:
//   1. With the party split, the GM's view of Sam's Scene shows Wren's group alone ("Your group. Ash is elsewhere.")
//      with no group chips, and the GM's own Scene still shows every group.
//   2. A place shown to another group (the GM's own character's) shows nothing of itself in the view of Sam's Scene.
//   3. A place shown to Wren's group shows in the view as Sam reads it, whether or not the GM's own character is in
//      that group (the players' reads made as Sam, ruling a2).
//   4. Asked as Sam by someone other than the GM (Jo), the reads give nothing; asked as Sam by the GM, exactly Sam's.
//   5. Sam's waiting request shows in the view's prompt slot (Jo's does not), and its Cancel opens "Only Sam can take
//      back this request" and writes nothing.
//   6. The GM's Rest in the view rests Wren's group (not the other), logged as his, and Undo takes it back.
//   7. With "players see hit points" off, the view's marching order shows hit points as Sam sees them: Wren's (his own),
//      never Moss's (Jo's) nor Ash's (the GM's own); the GM's own Scene shows everyone's.
//   8. With a place shown to Wren's group, the view of Sam's Scene never stays on "Loading the map" (the players' map
//      read has no form naming a player yet, so the view makes none and shows no map).
//   9. Before anything is shown to Wren's group, the view of Sam's Scene never says "No map shared yet." (unread, Sam may
//      still see the map of the last place shown), and draws no dashed map frame.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { chooseGroup } from '../modules/expedition/groupPlay.ts';
import { addPiece, loadGroupPlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { MarchingOrder } from './MarchingOrder.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { PartyGroups } from './PartyGroups.tsx';
import { PlayerViewContext } from './playerView.ts';
import { PlayerRequests } from './RequestCard.tsx';
import { SceneTime } from './SceneTime.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => cleanup());

const registry = createAppRegistry();
const PLACE = 'The Moth Gallery';
const VIEW = { player: 'Sam', character: 'Wren', goToWaiting: () => undefined };

/**
 * The GM (whose own character is Ash), Sam (Wren) and Jo (Moss), on an expedition in a mode that wants a rest. With
 * `split`, Ash goes off to Group 2 alone. `shownTo` sets a place for that group and shows it its first piece.
 */
async function table({ split = false, shownTo = null as number | null } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: gm });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', moss);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [{ id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: [], checks: [], movement: {}, rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary' } }],
      },
    },
  });
  world.tables.library_entries.push({ id: 'entry-weary', pack_id: 'pack-fen', kind: 'condition', pack_entry_id: 'weary', name: 'Weary', data: { id: 'weary', name: 'Weary', stacks: true } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const users = { gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser };
  world.signInAs(gm);
  await world.db.rpc('start_session', { campaign });
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'creep' } as never)) as unknown as { data: { id: string } };
  if (split) await runCommand(registry, world.db, users.gm, chooseGroup, { character: { id: ash, campaignId: campaign, ownerUserId: gm }, group: null });
  if (shownTo !== null) {
    await runCommand(registry, world.db, users.gm, setPlace, { campaignId: campaign, group: shownTo, name: PLACE, placeId: null, packEntry: null });
    const rowNow = async () => (await loadGroupPlaces(world.db, campaign, started.data.id))!.get(shownTo)!;
    await runCommand(registry, world.db, users.gm, addPiece, { campaignId: campaign, placeId: (await rowNow()).place!.id, kind: 'description', text: 'Dusty frames and a draught.' });
    const row = await rowNow();
    expect((await runCommand(registry, world.db, users.gm, showPiece, { campaignId: campaign, row, piece: row.pieces[0]! })).ok).toBe(true);
  }
  return { gm, sam, jo, campaign, wren, moss, ash, users };
}
type Table = Awaited<ReturnType<typeof table>>;

const gmCampaign = (t: Table) => ({ id: t.campaign, name: 'The Ash Barrows', role: 'gm' as const, line: null });

/** The party's page as the GM sees it: his own Scene, or (with `player`) his view of Sam's. */
function groups(t: Table, view: boolean) {
  world.signInAs(t.gm);
  return render(
    <PlayerViewContext.Provider value={view ? VIEW : null}>
      <ToastHost>
        <PartyGroups db={world.db} user={t.users.gm} campaign={gmCampaign(t)} {...(view ? { player: t.sam } : {})} />
      </ToastHost>
    </PlayerViewContext.Provider>,
  );
}

describe("the Scene in the GM's view (C15f)", () => {
  it("shows Wren's group alone with who is elsewhere, and the GM's own Scene still shows every group", async () => {
    const t = await table({ split: true });
    const view = groups(t, true);
    expect(await screen.findByText('Your group. Ash is elsewhere.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Group in focus' })).toBeNull();
    expect(view.container.querySelector('.players-page')).toBeTruthy();
    view.unmount();
    groups(t, false);
    const chips = await screen.findByRole('group', { name: 'Group in focus' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['✓ Group 1, 2', 'Group 2, 1']);
  });

  it("shows nothing of a place shown only to another group (the GM's own character's)", async () => {
    const t = await table({ split: true, shownTo: 2 });
    const { container } = groups(t, true);
    expect(await screen.findByRole('heading', { name: 'Somewhere new' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).not.toContain(PLACE);
    expect(container.textContent).not.toContain('Dusty frames');
  });

  it("shows the place shown to Wren's group as Sam reads it, with or without the GM's own character there", async () => {
    for (const split of [false, true]) {
      cleanup();
      world = createFakeDb();
      const t = await table({ split, shownTo: 1 });
      groups(t, true);
      expect(await screen.findByText('Dusty frames and a draught.')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Somewhere new' })).toBeNull();
    }
  });

  it("never leaves the map loading in the view of Sam's Scene, as its read has no form naming a player yet", async () => {
    const t = await table({ shownTo: 1 });
    groups(t, true);
    expect(await screen.findByText('Dusty frames and a draught.')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByLabelText('Loading the map')).toBeNull();
    expect(screen.queryByText(/Couldn't load the map/)).toBeNull();
  });

  it('never says "No map shared yet." in the view of Sam\'s Scene, as the map is not read there', async () => {
    const t = await table({ split: true, shownTo: 2 });
    const { container } = groups(t, true);
    expect(await screen.findByRole('heading', { name: 'Somewhere new' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('No map shared yet.')).toBeNull();
    expect(container.querySelector('.players-page__no-map')).toBeNull();
    expect(screen.getByText('Nothing shared yet.')).toBeTruthy();
  });

  it('gives the reads as Sam to the GM only, and exactly what Sam reads', async () => {
    const t = await table({ split: true, shownTo: 1 });
    const read = async (who: string, as?: string) => {
      world.signInAs(who);
      return JSON.stringify((await world.db.rpc('scene_pieces' as never, (as ? { campaign: t.campaign, as_player: as } : { campaign: t.campaign }) as never)).data);
    };
    const sams = await read(t.sam);
    expect(sams).toContain('Dusty frames');
    expect(await read(t.gm, t.sam)).toBe(sams);
    expect(await read(t.jo, t.sam)).toBe('[]');
    // The GM as himself reads his own character's group (Ash's, shown nothing).
    expect(await read(t.gm)).toBe('[]');
  });

  it("shows Sam's waiting request in the prompt slot, and its Cancel opens Only Sam can take back this request", async () => {
    const t = await table();
    const row = (id: string, requester: string, actor: string, text: string) => ({
      id, campaign_id: t.campaign, expedition_id: null, group_number: null, requester_id: requester, actor_id: actor, kind: 'askGm', direction: 'playerAsks',
      text, cost_text: '', prompt: {}, entry: null, status: 'waiting', answer_kind: 'yesNo', answer: null, answered_at: null, reply: null,
      created_at: '2026-11-22T10:00:00Z', version: 1, undone: false,
    });
    world.tables.requests.push(row('req-sam', t.sam, t.wren, 'Search the hold') as never, row('req-jo', t.jo, t.moss, 'Climb the mast') as never);
    world.signInAs(t.gm);
    render(
      <PlayerViewContext.Provider value={VIEW}>
        <ToastHost>
          <PlayerRequests db={world.db} user={t.users.gm} campaign={gmCampaign(t)} player={t.sam} />
        </ToastHost>
      </PlayerViewContext.Provider>,
    );
    const card = await screen.findByRole('article', { name: 'Sent to the GM' });
    expect(within(card).getByText('“Search the hold”')).toBeTruthy();
    expect(screen.queryByText('“Climb the mast”')).toBeNull();
    const before = { events: world.tables.events.length, requests: JSON.stringify(world.tables.requests) };
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Only Sam can take back this request' })).toBeTruthy();
    expect({ events: world.tables.events.length, requests: JSON.stringify(world.tables.requests) }).toEqual(before);
  });

  it("rests Wren's group with the GM's Rest, logged as his, and Undo takes it back", async () => {
    const t = await table({ split: true });
    world.signInAs(t.gm);
    render(
      <PlayerViewContext.Provider value={VIEW}>
        <ToastHost>
          <SceneTime
            db={world.db}
            user={t.users.gm}
            campaign={gmCampaign(t)}
            player={t.sam}
            tableView={{
              prompts: null,
              body: (restButton) => (
                <>
                  <div data-testid="group-1">{restButton(1)}</div>
                  <div data-testid="group-2">{restButton(2)}</div>
                </>
              ),
            }}
          />
        </ToastHost>
      </PlayerViewContext.Provider>,
    );
    const user = userEvent.setup();
    // Rest stands under Wren's group only: Sam has nobody in Ash's.
    // (The strip draws its body again as its reads arrive: each look finds the group afresh.)
    const rest = await waitFor(() => within(screen.getByTestId('group-1')).getByRole('button', { name: 'Rest' }), { timeout: 3000 });
    expect(within(screen.getByTestId('group-2')).queryByRole('button', { name: 'Rest' })).toBeNull();
    await user.click(rest);
    expect(await screen.findByText('You called a rest for the group. Everyone answers Rest or Push on.')).toBeTruthy();
    const restOf = (id: string) => world.tables.character_rests.find((r) => r.actor_id === id);
    await waitFor(() => expect(restOf(t.wren)?.called_at).toBe(0));
    expect(restOf(t.moss)?.called_at).toBe(0);
    expect(restOf(t.ash)?.called_at ?? null).toBeNull();
    const call = world.tables.events.find((e) => e.type === 'rest.call');
    expect(call?.actor_user_id).toBe(t.gm);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(restOf(t.wren)?.called_at ?? null).toBeNull());
  });

  it("shows hit points in the view's marching order as Sam sees them, and the GM's own as the GM's", async () => {
    const t = await table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { playersSeeHp: false };
    for (const id of [t.wren, t.moss, t.ash]) Object.assign(world.tables.actors.find((a) => a.id === id)!, { hp_current: 7, hp_max: 12 });
    const names = async () => {
      await screen.findByRole('list', { name: 'Marching order, front to back' });
      return within(screen.getByRole('list', { name: 'Marching order, front to back' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? '')
        .sort();
    };
    world.signInAs(t.gm);
    const view = render(
      <PlayerViewContext.Provider value={VIEW}>
        <ToastHost>
          <MarchingOrder db={world.db} user={t.users.gm} campaign={gmCampaign(t)} player={t.sam} />
        </ToastHost>
      </PlayerViewContext.Provider>,
    );
    expect(await names()).toEqual(['Ash. Details', 'Moss. Details', 'Wren, 7 of 12 hit points. Details']);
    view.unmount();
    render(
      <ToastHost>
        <MarchingOrder db={world.db} user={t.users.gm} campaign={gmCampaign(t)} />
      </ToastHost>,
    );
    expect(await names()).toEqual(['Ash, 7 of 12 hit points. Details', 'Moss, 7 of 12 hit points. Details', 'Wren, 7 of 12 hit points. Details']);
  });
});
