// @vitest-environment jsdom
// The call to adventure reaching a player (P7, the mount; p7-1 to p7-13, page 40): the call card in the players'
// prompt slot on the Scene, against the stand-in database. Invented names only. What it checks, in plain words:
//   * a call the GM sent shows in the player's slot, last, after the slot's other prompts (p7-9);
//   * "Got it" writes the player's own seen mark through the command layer and folds the card to its row (p7-7);
//   * a call sent to another player's character never reaches this player, and neither does their mark;
//   * a call the GM sends while the Scene is open arrives without reloading;
//   * with no calls, nothing is drawn; while loading or after a failed read, nothing either, and the other prompts stand;
//   * a refused "Got it" leaves the card standing and says so in a toast;
//   * the GM's Scene never draws the players' call card.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { sendHook } from '../modules/library/callsToAdventure.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { SceneTime } from './SceneTime.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function table() {
  const gm = world.addPerson('priya@weirs.example', 'Priya');
  const sam = world.addPerson('sam@weirs.example', 'Sam');
  const tess = world.addPerson('tess@weirs.example', 'Tess');
  const campaign = world.addCampaign('The Eel Weirs', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: tess });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tess, 'player', moss);
  world.tables.packs.push({ id: 'weirs', owner_user_id: gm, campaign_id: null, name: 'The eel weirs', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-weirs', campaign_id: campaign, pack_id: 'weirs', option_choices: {}, priority: 1 });
  world.tables.library_entries.push(
    { id: 'e1', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'bounty', name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post.', pays: 'Ten silver a head', giver: null, order: 0 } },
    { id: 'e2', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'lantern', name: 'The lost lantern', data: { text: 'A Lantern Warden never came back.', pays: '', giver: null, order: 1 } },
  );
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    tess: { id: tess, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, tess, campaign, wren, moss, users };
}
type Table = ReturnType<typeof table>;

const registry = createAppRegistry();
/** The GM sends a call, as the GM's sheet does (through the command layer). */
async function send(t: Table, hookId: 'bounty' | 'lantern', to: string | null, body: string, pays = '') {
  world.signInAs(t.gm);
  const sent = await runCommand(registry, world.db, t.users.gm, sendHook, { campaignId: t.campaign, packId: 'weirs', hookId, actorId: to, body, pays });
  expect(sent.ok).toBe(true);
}

/** The Scene's strip as one person sees it, live (the log's version moves it), with one other prompt in the slot. */
function scene(t: Table, who: 'gm' | 'sam' | 'tess') {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Eel Weirs', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <CampaignLog db={world.db} user={t.users[who]} campaignId={t.campaign}>
        <SceneTime
          db={world.db}
          user={t.users[who]}
          campaign={campaign}
          tableView={who === 'gm' ? undefined : { prompts: <p key="other" data-testid="other-prompt">A message from the GM</p>, body: () => null }}
        />
      </CampaignLog>
    </ToastHost>,
  );
}

const slot = (container: HTMLElement) => container.querySelector<HTMLElement>('.prompt-slot')!;

describe("the call card in the players' prompt slot (P7, the mount)", () => {
  // Purpose (p7-4, p7-5, p7-9): a call the GM sent to the party shows in the player's slot, its heading, words and
  // "Pays", after the slot's other prompts.
  it('shows a sent call, last in the slot', async () => {
    const t = table();
    await send(t, 'bounty', null, 'Nailed to the quay post: a bounty on the Bog lurker.', 'Ten silver a head');
    const { container } = scene(t, 'sam');
    const calls = await screen.findByRole('group', { name: 'Calls to adventure' });
    expect(within(calls).getByRole('heading', { name: 'A call to adventure, for the party' })).toBeTruthy();
    expect(within(calls).getByText('Nailed to the quay post: a bounty on the Bog lurker.')).toBeTruthy();
    expect(within(calls).getByText('Ten silver a head')).toBeTruthy();
    expect(screen.getByTestId('other-prompt')).toBeTruthy();
    // Last in the slot (p7-9): the calls' place is the slot's final item.
    expect(slot(container).lastElementChild!.contains(calls)).toBe(true);
  });

  // Purpose (p7-1, p7-7): "Got it" writes the player's own mark through the command layer and folds the card to its row.
  it('Got it marks the call seen for this player and folds it', async () => {
    const t = table();
    await send(t, 'lantern', t.wren, 'A Lantern Warden never came back.');
    scene(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Got it: A call to adventure, for Wren' }));
    const row = await screen.findByRole('button', { name: 'A call to adventure, for Wren: read it again' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /^Got it/ })).toBeNull();
    expect(world.tables.calls_seen.filter((m) => m.player_user_id === t.sam)).toHaveLength(1);
    // Reading it again opens the card with no button (p7-10).
    await user.click(row);
    expect(screen.getByText('A Lantern Warden never came back.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Got it/ })).toBeNull();
  });

  // Purpose (hard rule 5, ca-1): a call sent to another player's character never reaches this player's screen.
  it("never shows a call sent to another player's character", async () => {
    const t = table();
    await send(t, 'lantern', t.moss, 'Only for Moss: the lantern was seen at the weir.');
    const { container } = scene(t, 'sam');
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
    expect(container.textContent).not.toContain('Only for Moss');
    expect(container.textContent).not.toContain('Moss');
  });

  // Purpose (p7-2): one player's "Got it" on a call to the party leaves the other player's card standing.
  it("one player's Got it leaves the other's card standing", async () => {
    const t = table();
    await send(t, 'bounty', null, 'A bounty on the Bog lurker.');
    const samView = scene(t, 'sam');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it: A call to adventure, for the party' }));
    await screen.findByRole('button', { name: 'A call to adventure, for the party: read it again' });
    samView.unmount();
    scene(t, 'tess');
    expect(await screen.findByRole('button', { name: 'Got it: A call to adventure, for the party' })).toBeTruthy();
  });

  // Purpose (live): a call the GM sends while the player's Scene is open arrives without reloading.
  it('a call sent while the Scene is open arrives without reloading', async () => {
    const t = table();
    scene(t, 'sam');
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
    await send(t, 'bounty', null, 'A bounty on the Bog lurker.');
    world.signInAs(t.sam);
    expect(await screen.findByRole('heading', { name: 'A call to adventure, for the party' }, { timeout: 3000 })).toBeTruthy();
  });

  // Purpose (empty, loading): with no calls, or before the calls are read, nothing of the calls is drawn and the slot's
  // other prompts stand.
  it('draws nothing with no calls', async () => {
    const t = table();
    const { container } = scene(t, 'sam');
    // Before the first read answers, nothing is drawn.
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
    expect(container.querySelector('.prompt-slot__item--last')).toBeNull();
  });

  // Purpose (error, page 40's critique 7): a failed read draws no card and no error of its own; the other prompts stand.
  it('a failed read draws nothing, and the rest of the slot stands', async () => {
    const t = table();
    await send(t, 'bounty', null, 'A bounty on the Bog lurker.');
    const from = world.db.from.bind(world.db);
    const failing = (): unknown => {
      const chain: Record<string, unknown> = {};
      for (const k of ['select', 'eq', 'in']) chain[k] = () => chain;
      chain.then = (done: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }).then(done);
      return chain;
    };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => (table === 'hook_sends' ? failing() : from(table as never))) as typeof world.db.from);
    scene(t, 'sam');
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
  });

  // Purpose (critique 7; ⚑ 4 of #69, ruled "keep"): a "Got it" the database refuses leaves the card standing and says so.
  it('a refused Got it leaves the card standing, with a toast', async () => {
    const t = table();
    await send(t, 'bounty', null, 'A bounty on the Bog lurker.');
    scene(t, 'sam');
    const gotIt = await screen.findByRole('button', { name: 'Got it: A call to adventure, for the party' });
    const rpc = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
      name === 'mark_call_seen' ? Promise.resolve({ data: null, error: null }) : rpc(name as never, args as never)) as unknown as typeof world.db.rpc);
    await userEvent.setup().click(gotIt);
    expect(await screen.findByText("Couldn't mark it seen. Try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Got it: A call to adventure, for the party' })).toBeTruthy();
    expect(world.tables.calls_seen).toHaveLength(0);
  });

  // Purpose (03: the GM reads every mark, never writes one): the GM's Scene never draws the players' call card.
  it("the GM's Scene draws no call card", async () => {
    const t = table();
    await send(t, 'bounty', null, 'A bounty on the Bog lurker.');
    scene(t, 'gm');
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull());
  });
});
