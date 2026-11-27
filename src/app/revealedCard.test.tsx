// @vitest-environment jsdom
// The revealed result on the players' Scene (sf-7b; page 44's EN5, approved 2026-11-26): the card in the players'
// prompt slot, against the stand-in database. Invented names only. What it checks, in plain words:
//   * the card shows the crossed swords, "An encounter" and the words the GM sent, and nothing else of the check (not
//     the row as the book has it, the table or the roll); its "Got it" is plain, never the accent;
//   * "Got it" puts the card away on this device, sends nothing, and it stays away when the Scene opens again; another
//     device still shows it (sf-23);
//   * with the device's storage blocked, "Got it" still puts the card away while the Scene is open;
//   * a reveal shown while the Scene is open arrives without reloading, and one taken back goes;
//   * the card shows whatever the device remembers of the top's fold (the slot is not part of the fold);
//   * after "Got it", focus moves to the next revealed card's "Got it";
//   * the GM's Scene never draws the players' card.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { showCheckWords, takeBackCheckWords } from '../modules/expedition/reminderPlay.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { setSceneTopOpen } from './sceneTopOpen.ts';
import { SceneTime } from './SceneTime.tsx';
import { readRevealsGotIt } from './useRevealedWords.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

function table() {
  const gm = world.addPerson('priya@weirs.example', 'Priya');
  const sam = world.addPerson('sam@weirs.example', 'Sam');
  const campaign = world.addCampaign('The Eel Weirs', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, campaign, users };
}
type Table = ReturnType<typeof table>;

const registry = createAppRegistry();
let hits = 0;
/** A hit on the weir's table (the book's row, its roll), then the GM shows the players these words, as "Show players" does. */
async function reveal(t: Table, words: string): Promise<string> {
  hits += 1;
  const id = `check-weir-${hits}`;
  world.tables.check_results.push({
    id, campaign_id: t.campaign, expedition_id: 'trip-weirs', check_key: `place:weir:${hits}`, name: 'Encounter check', source: 'place', outcome: 'hit', at_seconds: 0, modifiers: [], note: null,
    table_id: 'weir-water', roll: '17', row_text: 'Bog lurkers (1d4), hungry', secret: true, revealed: false, revealed_by_hand: false, created_by: t.gm, undone: false, version: 1, created_at: '2026-11-27T10:00:00Z',
  });
  world.signInAs(t.gm);
  const shown = await runCommand(registry, world.db, t.users.gm, showCheckWords, { campaignId: t.campaign, resultId: id, words });
  expect(shown.ok).toBe(true);
  return shown.ok ? shown.value.id : '';
}

/** The Scene's strip as one person sees it, live (the log's version moves it), with one other prompt in the slot. */
function scene(t: Table, who: 'gm' | 'sam') {
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

const card = () => screen.getByRole('heading', { name: 'An encounter' }).closest<HTMLElement>('.call-card')!;

describe("the revealed result on the players' Scene (sf-7b, EN5)", () => {
  // Purpose (EN5; sf-7a's hidden data): the card in the slot shows "An encounter" and the words the GM sent, and
  // nothing of the check itself; its "Got it" is plain (no accent on a player's Scene).
  it('shows the words the GM sent and nothing else; Got it is plain', async () => {
    const t = table();
    await reveal(t, 'Two grey shapes rise from the weed.');
    const { container } = scene(t, 'sam');
    expect(await screen.findByRole('heading', { name: 'An encounter' })).toBeTruthy();
    const slot = container.querySelector('.prompt-slot')!;
    expect(slot.contains(card())).toBe(true);
    expect(within(card()).getByText('Two grey shapes rise from the weed.')).toBeTruthy();
    expect(card().textContent).toBe('An encounterGot itTwo grey shapes rise from the weed.');
    expect(container.textContent).not.toContain('Bog lurkers');
    expect(container.textContent).not.toContain('weir-water');
    expect(container.textContent).not.toContain('1d4');
    const gotIt = within(card()).getByRole('button', { name: 'Got it: An encounter' });
    expect(gotIt.className).not.toContain('button-primary');
    expect(gotIt.className).not.toContain('accent');
  });

  // Purpose (sf-23, "On the device"): "Got it" puts the card away at once and sends nothing (no command, no line); it
  // stays away when the Scene opens again on this device, and another device (its own storage) still shows it.
  it('Got it puts the card away on this device, sends nothing, and is remembered', async () => {
    const t = table();
    const id = await reveal(t, 'Two grey shapes rise from the weed.');
    const events = world.tables.events.length;
    const first = scene(t, 'sam');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it: An encounter' }));
    expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull();
    expect(world.tables.events.length).toBe(events);
    expect(world.tables.check_reveals[0]).toMatchObject({ taken_back: false });
    expect(readRevealsGotIt()).toEqual([id]);
    first.unmount();
    scene(t, 'sam');
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull();
    // Another device: nothing remembered there.
    cleanup();
    localStorage.clear();
    scene(t, 'sam');
    expect(await screen.findByRole('heading', { name: 'An encounter' })).toBeTruthy();
  });

  // Purpose (offline-safe storage, as sceneTopOpen.ts): with the browser's storage blocked, "Got it" still puts the
  // card away while the Scene stays open.
  it('with storage blocked, Got it still puts the card away', async () => {
    const t = table();
    await reveal(t, 'Two grey shapes rise from the weed.');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    scene(t, 'sam');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it: An encounter' }));
    expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull();
  });

  // Purpose (live; EN1 C's take-back): a reveal the GM shows while the player's Scene is open arrives without reloading,
  // and when the GM takes it back the card goes.
  it('a reveal arrives live, and one taken back goes', async () => {
    const t = table();
    scene(t, 'sam');
    expect(await screen.findByTestId('other-prompt')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull();
    const id = await reveal(t, 'Gulls, mobbing the boat.');
    world.signInAs(t.sam);
    expect(await screen.findByRole('heading', { name: 'An encounter' }, { timeout: 3000 })).toBeTruthy();
    world.signInAs(t.gm);
    expect((await runCommand(registry, world.db, t.users.gm, takeBackCheckWords, { campaignId: t.campaign, revealId: id })).ok).toBe(true);
    world.signInAs(t.sam);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull(), { timeout: 3000 });
    // Taken back is not "Got it": nothing is remembered on the device.
    expect(readRevealsGotIt()).toEqual([]);
  });

  // Purpose (EN5: "the card also shows if the top is folded, since the slot is not part of the fold"): whatever this
  // device remembers of the top's fold, the card stands in the slot.
  it('shows with the top folded', async () => {
    const t = table();
    await reveal(t, 'Two grey shapes rise from the weed.');
    setSceneTopOpen(false);
    scene(t, 'sam');
    expect(await screen.findByRole('heading', { name: 'An encounter' })).toBeTruthy();
  });

  // Purpose (focus, as the call card's audit finding 1): after "Got it" the button goes with its card, so focus moves to
  // the next revealed card's "Got it" rather than falling to the page.
  it('after Got it, focus moves to the next revealed card', async () => {
    const t = table();
    await reveal(t, 'Two grey shapes rise from the weed.');
    await reveal(t, 'Gulls, mobbing the boat.');
    scene(t, 'sam');
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Got it: An encounter' })).toHaveLength(2));
    await user.click(screen.getAllByRole('button', { name: 'Got it: An encounter' })[0]!);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Got it: An encounter' })).toHaveLength(1));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it: An encounter' })));
  });

  // Purpose (EN5 is the players' screen): the GM's Scene never draws the players' card.
  it("the GM's Scene draws no revealed card", async () => {
    const t = table();
    await reveal(t, 'Two grey shapes rise from the weed.');
    scene(t, 'gm');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: 'An encounter' })).toBeNull();
  });
});
